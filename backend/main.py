"""Campus Customs API: products, product images, accounts, and the shop chat agent.

Run from the backend/ folder:
    uvicorn main:app --reload --port 8000
(or ../.venv/bin/uvicorn main:app --reload --port 8000 without activating the venv)
"""

import logging
import sqlite3

from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic_ai.exceptions import ModelHTTPError, UsageLimitExceeded

from agent import run_chat
from models import (
    ChatMessage,
    ChatReply,
    ChatRequest,
    LoginRequest,
    ProductDetail,
    ProductSummary,
    RegisterRequest,
    UserPublic,
)
from tools import (
    DATA_DIR,
    DUMMY_HASH,
    EMAIL,
    SESSION_COOKIE,
    SESSION_TTL_SECONDS,
    AgentDeps,
    ChatNotConfigured,
    clear_failures,
    connect,
    create_session_token,
    ensure_chat_index,
    get_product,
    hash_password,
    is_locked_out,
    list_products,
    load_chat_history,
    load_customer,
    password_problems,
    read_session_token,
    record_failure,
    resolve_current_product,
    save_chat_turn,
    verify_password,
)

log = logging.getLogger("campus_customs")

app = FastAPI(title="Campus Customs API")
ensure_chat_index()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    allow_credentials=True,
)

# image_file_path in the catalogue is relative to data/ (e.g. products/x.jpg),
# so mounting data/products at /media/products gives /media/<image_file_path>.
app.mount("/media/products", StaticFiles(directory=DATA_DIR / "products"), name="products")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# --- Products --------------------------------------------------------------------


@app.get("/api/products", response_model=list[ProductSummary])
def products() -> list[ProductSummary]:
    return list_products()


@app.get("/api/products/{product_id}", response_model=ProductDetail)
def product(product_id: str) -> ProductDetail:
    found = get_product(product_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return found


# --- Accounts ------------------------------------------------------------------


def to_public(row: sqlite3.Row) -> UserPublic:
    first, last = row["first_name"], row["last_name"]
    if first is None:  # fall back to splitting the full name
        first, _, last = row["name"].partition(" ")
    return UserPublic(id=row["id"], first_name=first, last_name=last or "", email=row["email"])


def set_session(response: Response, user_id: int) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        create_session_token(user_id),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,  # not readable from JavaScript
        samesite="lax",
        # secure=True once served over HTTPS
    )


@app.post("/api/auth/register", response_model=UserPublic, status_code=201)
def register(body: RegisterRequest, response: Response) -> UserPublic:
    first, last = body.first_name.strip(), body.last_name.strip()
    email = body.email.strip().lower()
    if not first or not last:
        raise HTTPException(422, "First and last name are required.")
    if not EMAIL.match(email):
        raise HTTPException(422, "Enter a valid email address.")
    if problems := password_problems(body.password):
        raise HTTPException(422, "Password needs " + ", ".join(problems) + ".")

    password_hash = hash_password(body.password)
    with connect(write=True) as conn:
        if conn.execute("SELECT 1 FROM users WHERE lower(email) = ?", (email,)).fetchone():
            raise HTTPException(409, "An account with that email already exists.")
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
            (f"{first} {last}", email, password_hash, first, last),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()

    set_session(response, row["id"])
    return to_public(row)


@app.post("/api/auth/login", response_model=UserPublic)
def login(body: LoginRequest, response: Response) -> UserPublic:
    email = body.email.strip().lower()
    if is_locked_out(email):
        raise HTTPException(429, "Too many failed attempts. Try again in a minute.")
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE lower(email) = ?", (email,)).fetchone()
    # Always run a hash check so response time doesn't reveal whether the email exists.
    ok = verify_password(body.password, row["password_hash"] if row else DUMMY_HASH)
    if not row or not ok:
        record_failure(email)
        raise HTTPException(401, "Incorrect email or password.")
    clear_failures(email)
    set_session(response, row["id"])
    return to_public(row)


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE)


@app.get("/api/auth/me", response_model=UserPublic)
def me(cc_session: str | None = Cookie(default=None)) -> UserPublic:
    user = current_user(cc_session)
    if user is None:
        raise HTTPException(401, "Not logged in.")
    return user


def current_user(cc_session: str | None) -> UserPublic | None:
    """The logged-in user for a session cookie, or None for guests."""
    user_id = read_session_token(cc_session) if cc_session else None
    if user_id is None:
        return None
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return to_public(row) if row else None


# --- Chat ------------------------------------------------------------------------


@app.post("/api/chat", response_model=ChatReply)
async def chat(body: ChatRequest, cc_session: str | None = Cookie(default=None)) -> ChatReply:
    user = current_user(cc_session)
    # Identity comes only from the signed session cookie. Logged-in shoppers' history is reloaded
    # from chat_messages (anything the browser sent is ignored); guests' history lives in the browser.
    customer = load_customer(user.id) if user else None
    history = load_chat_history(user.id) if user else body.history
    deps = AgentDeps(
        customer=customer,
        page=body.page,
        current_product=resolve_current_product(body.page.product_id if body.page.page == "product" else None),
    )
    try:
        reply = await run_chat(body.message.strip(), history, deps)
    except ChatNotConfigured as exc:
        raise HTTPException(503, "The chat assistant isn't configured yet.") from exc
    except ModelHTTPError as exc:
        if "content_filter" not in str(exc.body):
            log.exception("chat model error")
            raise HTTPException(502, "The chat assistant is having trouble right now. Please try again.") from exc
        # The provider's safety filter blocked the message (e.g. a jailbreak attempt); answer in-voice.
        reply = ChatReply(
            reply="I can't help with that one, but I'd love to help you find some Yale gear. "
            "Looking for a hoodie, crewneck, or something for your residential college?",
            products=[],
        )
    except UsageLimitExceeded:
        reply = ChatReply(
            reply="Sorry, I got a little tangled up on that one. Could you ask it a different way?", products=[]
        )
    except Exception as exc:
        log.exception("chat failed")
        raise HTTPException(502, "The chat assistant is having trouble right now. Please try again.") from exc
    if user:  # guests are never saved
        save_chat_turn(user.id, body.message.strip(), reply.reply, reply.products)
    return reply


@app.get("/api/chat/history", response_model=list[ChatMessage])
def chat_history(cc_session: str | None = Cookie(default=None)) -> list[ChatMessage]:
    user = current_user(cc_session)
    return load_chat_history(user.id, limit=50) if user else []
