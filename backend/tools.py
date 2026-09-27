"""Database helpers, model setup, and the tools the Campus Customs shop agent can call.

Agent tools (registered in agent.py), all read straight from campus_customs.db:
  - search_products: keyword + filter search over the catalogue, joined with inventory (finds product_ids).
  - show_products_on_page: the same search, but the full match list is sent to the website as PageResults.
  - get_product_description: description, garment type, and colors for one product.
  - get_product_price: the price for one product.
  - check_stock: units in stock for one product, overall or for a single size.
  - get_customer_profile: the logged-in shopper's name, email, and chat history stats (None for guests).
Also here: account helpers used by main.py (password hashing, password rules, signed session cookies,
login throttling) and the append-only audit-trail writer.
The same query helpers back the /api/products routes in main.py, so the site and the
agent always read the catalogue the same way.
"""

import base64
import fcntl
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path

from pydantic_ai import ModelRetry, RunContext
from pydantic_ai.models.openai import OpenAIResponsesModel, OpenAIResponsesModelSettings
from pydantic_ai.providers.openai import OpenAIProvider

from models import (
    AuditEntry,
    ChatMessage,
    CurrentProduct,
    CustomerContext,
    PageContext,
    PageResults,
    PageSearchSummary,
    ProductCard,
    ProductDescription,
    ProductDetail,
    ProductMatch,
    ProductPrice,
    ProductSummary,
    SearchFilters,
    SizeAvailability,
    SizeStock,
    StockLookup,
    StockStatus,
)

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR.parent / "data"
DB_PATH = Path(os.environ.get("CAMPUS_CUSTOMS_DB", DATA_DIR / "campus_customs.db"))
SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]
MAX_SEARCH_RESULTS = 8
PAGE_RESULTS_LIMIT = 48  # cards shown on the page for one chat search
HISTORY_TURNS = 12  # recent messages replayed to the model
LOW_STOCK_THRESHOLD = 5  # fewer than this many units reads as "only a few left"


# --- Database ------------------------------------------------------------------


def connect(write: bool = False) -> sqlite3.Connection:
    # Read-only unless a route needs to write (account creation and saving chat messages).
    mode = "rw" if write else "ro"
    conn = sqlite3.connect(f"file:{DB_PATH}?mode={mode}", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def image_url(image_file_path: str) -> str:
    # image_file_path is relative to data/ (products/x.jpg); main.py mounts data/products at /media/products.
    return f"/media/{image_file_path}"


def size_key(size: str) -> int:
    return SIZE_ORDER.index(size) if size in SIZE_ORDER else len(SIZE_ORDER)


def stock_status(quantity: int) -> StockStatus:
    if quantity <= 0:
        return "out_of_stock"
    return "low_stock" if quantity < LOW_STOCK_THRESHOLD else "in_stock"


def short_description(description: str, garment_type: str) -> str:
    """First sentence, cut at a word boundary to fit a card."""
    if "filename-based stub" in description:  # three catalogue rows have placeholder text
        return f"Campus Customs {garment_type}."
    first = re.split(r"(?<=[.!?])\s", description.strip(), maxsplit=1)[0]
    if len(first) <= 110:
        return first
    return first[:110].rsplit(" ", 1)[0].rstrip(",;:") + "…"


def _load_catalogue(conn: sqlite3.Connection) -> tuple[list[sqlite3.Row], dict[str, dict[str, int]]]:
    rows = conn.execute("SELECT * FROM catalogue").fetchall()
    stock: dict[str, dict[str, int]] = {}
    for s in conn.execute("SELECT product_id, size, quantity FROM inventory"):
        stock.setdefault(s["product_id"], {})[s["size"]] = s["quantity"]
    return rows, stock


def _summary(row: sqlite3.Row, sizes: dict[str, int]) -> ProductSummary:
    total = sum(sizes.values())
    return ProductSummary(
        product_id=row["product_id"],
        name=row["name"],
        garment_type=row["garment_type"],
        description=row["description"],
        short_description=short_description(row["description"], row["garment_type"]),
        price=row["price"],
        image_url=image_url(row["image_file_path"]),
        colors=json.loads(row["colors"]),
        search_tags=json.loads(row["search_tags"]),
        sizes_in_stock=sorted((s for s, q in sizes.items() if q > 0), key=size_key),
        total_stock=total,
        stock_status=stock_status(total),
    )


def _tokens(text: str) -> set[str]:
    # Light plural folding so "crewnecks" matches "crewneck" and "hoodies" matches "hoodie".
    words = (t for t in re.split(r"[^a-z0-9]+", text.lower()) if len(t) > 1)
    return {t[:-1] if len(t) > 3 and t.endswith("s") and not t.endswith("ss") else t for t in words}


# garment_type is written many ways ("pullover hoodie", "full-zip hooded sweatshirt", "short-sleeve T-shirt"),
# so a requested garment matches if any of its spellings is a whole word of the type + name (hyphens and
# slashes dropped, so "T-shirt" -> "tshirt"). Whole words matter: "sweatshirt" contains "tshirt".
GARMENT_SYNONYMS = {
    "hoodie": ["hoodie", "hooded"],
    "tshirt": ["tshirt", "tee"],
    "tee": ["tshirt", "tee"],
    "shirt": ["tshirt"],  # not "shirt": it would match "sweatshirt"
    "crewneck": ["crewneck"],  # not "crew": it would match the Crew Left Chest Hoodie
    "crew": ["crewneck"],
    "quarterzip": ["quarterzip", "14zip"],
    "14zip": ["quarterzip", "14zip"],
    "zip": ["zip"],
    "fleece": ["fleece"],
    "jacket": ["jacket"],
    "sweatshirt": ["sweatshirt", "crewneck", "hoodie", "hooded"],
    "sweater": ["sweater", "fleece"],
}


def _garment_words(text: str) -> set[str]:
    words = _tokens(re.sub(r"[-/]", "", text))
    compact = re.sub(r"[^a-z0-9]", "", text.lower())
    if "14zip" in compact:  # names spell quarter-zips as "1 4 Zip"
        words.add("14zip")
    return words


def _garment_terms(garment_type: str) -> list[str]:
    key = re.sub(r"[^a-z0-9]", "", garment_type.lower())
    key = key[:-1] if key.endswith("s") and not key.endswith("ss") else key
    return GARMENT_SYNONYMS.get(key, [key])


def find_products(
    query: str = "",
    garment_type: str | None = None,
    color: str | None = None,
    size: str | None = None,
    max_price: float | None = None,
    in_stock_only: bool = False,
) -> list[ProductSummary]:
    """Filter + keyword-score the catalogue. Shared by the Products page, search_products, and page results."""
    with connect() as conn:
        rows, stock = _load_catalogue(conn)
    wanted = _tokens(query)
    garments = set(_garment_terms(garment_type)) if garment_type else None
    scored: list[tuple[int, ProductSummary]] = []
    for r in rows:
        p = _summary(r, stock.get(r["product_id"], {}))
        if garments and not garments & _garment_words(f"{r['garment_type']} {r['name']}"):
            continue
        if color and not any(color.lower() in c.lower() for c in p.colors):
            continue
        if size and size not in p.sizes_in_stock:
            continue
        if max_price is not None and p.price > max_price:
            continue
        if in_stock_only and p.total_stock == 0:
            continue
        haystack = " ".join([r["name"], r["garment_type"], r["description"], " ".join(p.colors), r["search_tags"]])
        score = len(wanted & _tokens(haystack))
        if wanted and score == 0:
            continue
        scored.append((score, p))
    scored.sort(key=lambda x: (-x[0], x[1].name))
    return [p for _, p in scored]


def list_products() -> list[ProductSummary]:
    return find_products()


def get_product(product_id: str) -> ProductDetail | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            return None
        stock = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
        ).fetchall()
    sizes = {s["size"]: s["quantity"] for s in stock}
    inventory = sorted((SizeStock(size=k, quantity=v) for k, v in sizes.items()), key=lambda s: size_key(s.size))
    return ProductDetail(**_summary(row, sizes).model_dump(), inventory=inventory)


def product_cards(product_ids: list[str], size: str | None = None) -> list[ProductCard]:
    """Cards for the given ids in the given order; unknown ids are dropped.

    With a size, each card also carries that size's quantity from inventory (for the out-of-stock banner).
    """
    ids = list(dict.fromkeys(product_ids))  # de-duplicate, keep order
    if not ids:
        return []
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT c.product_id, c.name, c.garment_type, c.price, c.image_file_path,
                   COALESCE(SUM(i.quantity), 0) AS total_stock
            FROM catalogue c
            LEFT JOIN inventory i ON i.product_id = c.product_id
            WHERE c.product_id IN ({",".join("?" * len(ids))})
            GROUP BY c.product_id
            """,
            ids,
        ).fetchall()
        size = size.upper().strip() if size else None
        size_qty: dict[str, int] = {}
        if size:
            size_qty = {
                r["product_id"]: r["quantity"]
                for r in conn.execute(
                    f"SELECT product_id, quantity FROM inventory WHERE size = ? AND product_id IN ({','.join('?' * len(ids))})",
                    [size, *ids],
                )
            }
    by_id = {
        r["product_id"]: ProductCard(
            product_id=r["product_id"],
            name=r["name"],
            garment_type=r["garment_type"],
            price=r["price"],
            image_url=image_url(r["image_file_path"]),
            total_stock=r["total_stock"],
            requested_size=size if size else None,
            # A size the product doesn't carry counts as 0 so the card reads "out of stock" for it.
            requested_size_quantity=size_qty.get(r["product_id"], 0) if size else None,
        )
        for r in rows
    }
    return [by_id[i] for i in ids if i in by_id]


# --- Audit trail (Problem 12) -----------------------------------------------------------

AUDIT_PATH = Path(os.environ.get("CAMPUS_CUSTOMS_AUDIT", BACKEND_DIR.parent / "output" / "audit_trail.json"))
AUDIT_LOCK_PATH = AUDIT_PATH.with_name(AUDIT_PATH.name + ".lock")
SHORT = 200  # characters kept from any argument, result, or message

_CARD = re.compile(r"\b(?:\d[ -]?){12,19}\b")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_SECRET = re.compile(r"(?i)\b(password|passcode|pwd|ssn)\b\s*(is|:|=)?\s*\S+")


def redact(text: str) -> str:
    """Strip card numbers, emails, and 'password is …' phrases before anything is written to the audit trail."""
    text = _CARD.sub("[card redacted]", text)
    text = _EMAIL.sub("[email redacted]", text)
    return _SECRET.sub(lambda m: f"{m.group(1)} [redacted]", text)


def shorten(value: object, limit: int = SHORT) -> str:
    text = value if isinstance(value, str) else json.dumps(value, default=str)
    text = redact(" ".join(text.split()))
    return text if len(text) <= limit else text[: limit - 1] + "…"


def append_audit_entry(entry: AuditEntry) -> None:
    """Append one entry to output/audit_trail.json (a JSON array) without rewriting earlier entries.

    The file always ends with "]"; a new entry is written over that closing bracket and the bracket is
    re-added after it, so the write is a true append (O(entry), never truncates history) and the file stays
    valid JSON. An exclusive lock keeps concurrent requests / processes from interleaving writes. A file that
    doesn't end in "]" (e.g. hand-edited) is moved aside, never deleted, and a new trail is started.
    """
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    record = json.dumps(entry.model_dump(mode="json"), ensure_ascii=False)
    with open(AUDIT_LOCK_PATH, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if AUDIT_PATH.exists() and AUDIT_PATH.stat().st_size > 0:
            with open(AUDIT_PATH, "rb+") as f:
                f.seek(0, os.SEEK_END)
                end = f.tell()
                # find the closing bracket, skipping trailing whitespace
                pos = end - 1
                while pos >= 0:
                    f.seek(pos)
                    ch = f.read(1)
                    if not ch.isspace():
                        break
                    pos -= 1
                if ch == b"]":
                    prev = pos - 1  # is the array empty? (previous non-space character is "[")
                    while prev >= 0:
                        f.seek(prev)
                        before = f.read(1)
                        if not before.isspace():
                            break
                        prev -= 1
                    empty = prev >= 0 and before == b"["
                    f.seek(pos)
                    f.truncate()
                    f.write((("\n" if empty else ",\n") + record + "\n]\n").encode())
                    return
            AUDIT_PATH.rename(AUDIT_PATH.with_name(f"audit_trail.unreadable-{int(os.path.getmtime(AUDIT_PATH))}.json"))
        AUDIT_PATH.write_text("[\n" + record + "\n]\n", encoding="utf-8")


# --- Customer memory -------------------------------------------------------------------


def ensure_chat_index() -> None:
    """History is always read as "this user's messages, newest first", so index exactly that."""
    with connect(write=True) as conn:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages (user_id, id)")


def load_customer(user_id: int) -> CustomerContext | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.name, u.email, u.created_at, u.first_name, u.last_name,
                   COUNT(m.id) AS saved_messages, MAX(m.created_at) AS last_chat_at
            FROM users u LEFT JOIN chat_messages m ON m.user_id = u.id
            WHERE u.id = ?
            GROUP BY u.id
            """,
            (user_id,),
        ).fetchone()
    if row is None:
        return None
    first, last = row["first_name"], row["last_name"]
    if first is None:  # fall back to splitting the full name
        first, _, last = row["name"].partition(" ")
    return CustomerContext(
        user_id=row["id"],
        first_name=first,
        last_name=last or "",
        email=row["email"],
        member_since=row["created_at"],
        saved_messages=row["saved_messages"],
        last_chat_at=row["last_chat_at"],
    )


def resolve_current_product(product_id: str | None) -> CurrentProduct | None:
    """Turn the page's product_id into a real catalogue item with a fresh stock snapshot;
    a bogus id from the browser is ignored."""
    product = get_product(product_id) if product_id else None
    if product is None:
        return None
    return CurrentProduct(
        product_id=product.product_id,
        name=product.name,
        garment_type=product.garment_type,
        price=product.price,
        colors=product.colors,
        description=product.description,
        stock_by_size={s.size: s.quantity for s in product.inventory},
        total_stock=product.total_stock,
    )


# --- Chat history ------------------------------------------------------------------


def load_chat_history(user_id: int, limit: int = HISTORY_TURNS) -> list[ChatMessage]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, content, products_json FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    history = []
    for r in reversed(rows):
        products = [ProductCard.model_validate(p) for p in json.loads(r["products_json"] or "[]")]
        history.append(ChatMessage(role=r["role"], content=r["content"], products=products))
    return history


def save_chat_turn(user_id: int, message: str, reply: str, products: list[ProductCard]) -> None:
    with connect(write=True) as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)", (user_id, message)
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
            (user_id, reply, json.dumps([p.model_dump() for p in products])),
        )


# --- Model -------------------------------------------------------------------------


class ChatNotConfigured(Exception):
    """PORTKEY_API_KEY is missing, so the agent can't be built."""


def build_model() -> tuple[OpenAIResponsesModel, OpenAIResponsesModelSettings]:
    """Portkey-backed OpenAI Responses model, configured from the environment (same setup as HW3)."""
    portkey_key = os.getenv("PORTKEY_API_KEY")
    if not portkey_key:
        raise ChatNotConfigured("Set PORTKEY_API_KEY before using the chat assistant.")
    model = OpenAIResponsesModel(
        os.getenv("AGENT_MODEL", "gpt-5.6-luna"),
        provider=OpenAIProvider(
            base_url=os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1"), api_key=portkey_key
        ),
    )
    settings = OpenAIResponsesModelSettings(
        openai_reasoning_effort=os.getenv("AGENT_REASONING_EFFORT", "low"),
        timeout=60,
    )
    if os.getenv("PORTKEY_FORCE_REFRESH") == "1":  # benchmarking: skip Portkey's response cache
        settings["extra_headers"] = {"x-portkey-cache-force-refresh": "true"}
    return model, settings


# --- Agent tools ---------------------------------------------------------------------


@dataclass
class AgentDeps:
    """Per-request context the tools and dynamic instructions can see."""

    # Logged-in shopper (None for guests), loaded from users + chat_messages by the session cookie.
    customer: CustomerContext | None = None
    # Where the shopper is on the site; current_product is page.product_id checked against catalogue.
    page: PageContext = field(default_factory=PageContext)
    current_product: CurrentProduct | None = None
    # Every price and quantity a tool returned this turn; agent.py's output validator rejects
    # replies that quote a number not in these sets, so figures can only come from the database.
    seen_prices: set[float] = field(default_factory=set)
    seen_quantities: set[int] = field(default_factory=set)
    # Filled by show_products_on_page; run_chat() attaches it to the ChatReply for the website.
    page_results: PageResults | None = None

    def __post_init__(self) -> None:
        # The on-screen product's facts are sent with the question, so they count as looked up.
        if self.current_product:
            self.seen_prices.add(self.current_product.price)
            self.seen_quantities.update([self.current_product.total_stock, *self.current_product.stock_by_size.values()])


def stock_by_size(product_ids: list[str]) -> dict[str, dict[str, int]]:
    if not product_ids:
        return {}
    with connect() as conn:
        rows = conn.execute(
            f"SELECT product_id, size, quantity FROM inventory WHERE product_id IN ({','.join('?' * len(product_ids))})",
            product_ids,
        ).fetchall()
    out: dict[str, dict[str, int]] = {pid: {} for pid in product_ids}
    for r in rows:
        out[r["product_id"]][r["size"]] = r["quantity"]
    return {pid: dict(sorted(s.items(), key=lambda kv: size_key(kv[0]))) for pid, s in out.items()}


def _to_matches(products: list[ProductSummary]) -> list[ProductMatch]:
    stock = stock_by_size([p.product_id for p in products])
    return [
        ProductMatch(
            product_id=p.product_id,
            name=p.name,
            garment_type=p.garment_type,
            short_description=p.short_description,
            price=p.price,
            colors=p.colors,
            stock_by_size=stock.get(p.product_id, {}),
            sizes_in_stock=p.sizes_in_stock,
            total_stock=p.total_stock,
            stock_status=p.stock_status,
        )
        for p in products
    ]


def _remember(ctx: RunContext[AgentDeps], matches: list[ProductMatch] | list[ProductSummary]) -> None:
    for p in matches:
        ctx.deps.seen_prices.add(p.price)
        ctx.deps.seen_quantities.add(p.total_stock)
        if isinstance(p, ProductMatch):
            ctx.deps.seen_quantities.update(p.stock_by_size.values())


def search_products(
    ctx: RunContext[AgentDeps],
    query: str = "",
    garment_type: str | None = None,
    color: str | None = None,
    size: str | None = None,
    max_price: float | None = None,
    in_stock_only: bool = False,
) -> list[ProductMatch]:
    """Look up specific products (up to 8) to answer a question or find a product_id.

    Each result already has price, colors, a short description, and stock for every size, all read
    from the database now, so you can answer price, color, and stock questions from it directly.

    For browsing a category ("what hoodies do you have?"), use show_products_on_page instead.

    Args:
        query: Free-text keywords, e.g. "hockey", "Berkeley College", "vintage bulldog", "The Game".
        garment_type: Optional garment filter, e.g. "hoodie", "crewneck", "t-shirt", "quarter-zip", "fleece".
        color: Optional color filter, e.g. "navy", "gray", "white".
        size: Optional size the shopper needs (XS, S, M, L, XL, XXL); only products with that size in stock.
        max_price: Optional budget in dollars.
        in_stock_only: Skip products with no stock at all. Default False, so sold-out items still
            come back (with stock_status "out_of_stock") and you can tell the shopper.
    """
    found = find_products(query, garment_type, color, normalize_size(size), max_price, in_stock_only)
    matches = _to_matches(found[:MAX_SEARCH_RESULTS])
    if max_price is not None:  # the shopper's budget may be quoted back ("under $60")
        ctx.deps.seen_prices.add(float(max_price))
    _remember(ctx, matches)
    return matches


def show_products_on_page(
    ctx: RunContext[AgentDeps],
    title: str,
    query: str = "",
    garment_type: str | None = None,
    color: str | None = None,
    size: str | None = None,
    max_price: float | None = None,
) -> PageSearchSummary:
    """Search the catalogue and display ALL matches as product cards on the website's Products page.

    Use this when the shopper wants to browse a type or group of items ("what hoodies do you have?",
    "show me navy crewnecks", "anything for Davenport under $60?"). The website renders the full
    result list; you get back a summary to write a short reply from.

    Args:
        title: Short heading for the results, e.g. "Hoodies", "Navy crewnecks", "Davenport College gear".
        query: Free-text keywords (college, sport, design), or "" to match on filters alone.
        garment_type: Optional garment filter, e.g. "hoodie", "crewneck", "t-shirt", "quarter-zip", "fleece".
        color: Optional color filter.
        size: Optional size; only products with that size in stock.
        max_price: Optional budget in dollars.
    """
    size = normalize_size(size)
    found = find_products(query, garment_type, color, size, max_price)
    shown = found[:PAGE_RESULTS_LIMIT]
    title = title.strip() or "Search results"
    # Leave the page alone when nothing matched (it would show "No matches") or when no keyword or filter
    # was given: that is the whole catalogue, which the Products page already shows, so it's never worth
    # pulling the shopper away for (this is how off-topic requests used to hijack the page).
    unfiltered = not any([query.strip(), garment_type, color, size, max_price])
    note = None
    if unfiltered:
        shown, note = [], "Not displayed: give a keyword or filter. The Products page already lists everything."
    elif not shown:
        note = "Nothing matched, so the page was left unchanged."
    if shown:
        ctx.deps.page_results = PageResults(
            title=title,
            filters=SearchFilters(
                query=query or None, garment_type=garment_type, color=color, size=size, max_price=max_price
            ),
            total_matches=len(found),
            products=shown,
        )
    _remember(ctx, shown)
    ctx.deps.seen_quantities.update([len(found), len(shown)])
    if max_price is not None:  # the shopper's budget may be quoted back ("under $60")
        ctx.deps.seen_prices.add(float(max_price))
    prices = [p.price for p in found]
    return PageSearchSummary(
        title=title,
        displayed_on_page=bool(shown),
        note=note,
        total_matches=len(found),
        shown_on_page=len(shown),
        price_min=min(prices) if prices else None,
        price_max=max(prices) if prices else None,
        out_of_stock_count=sum(p.total_stock == 0 for p in found),
        top_matches=_to_matches(found[:5]),
    )


def normalize_size(size: str | None) -> str | None:
    if not size:
        return None
    size = size.upper().strip()
    aliases = {"XSMALL": "XS", "SMALL": "S", "MEDIUM": "M", "LARGE": "L", "XLARGE": "XL", "2XL": "XXL", "XXLARGE": "XXL"}
    size = aliases.get(size.replace("-", "").replace(" ", ""), size)
    if size not in SIZE_ORDER:
        raise ModelRetry(f"size must be one of {', '.join(SIZE_ORDER)}")
    return size


def _catalogue_row(conn: sqlite3.Connection, product_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
    if row is None:
        raise ModelRetry(f"No product with id {product_id!r}; use search_products to find valid ids.")
    return row


def get_product_description(ctx: RunContext[AgentDeps], product_id: str) -> ProductDescription:
    """What a product looks like: its catalogue description, garment type, and colors.

    Args:
        product_id: An id from search_products or the shopper's current product page.
    """
    with connect() as conn:
        row = _catalogue_row(conn, product_id)
    return ProductDescription(
        product_id=row["product_id"],
        name=row["name"],
        garment_type=row["garment_type"],
        description=row["description"],
        colors=json.loads(row["colors"]),
    )


def get_product_price(ctx: RunContext[AgentDeps], product_id: str) -> ProductPrice:
    """The current price of a product in US dollars. Call this before quoting any price.

    Args:
        product_id: An id from search_products or the shopper's current product page.
    """
    with connect() as conn:
        row = _catalogue_row(conn, product_id)
    ctx.deps.seen_prices.add(row["price"])
    return ProductPrice(product_id=row["product_id"], name=row["name"], price=row["price"])


def check_stock(ctx: RunContext[AgentDeps], product_id: str, size: str | None = None) -> StockLookup:
    """How many units of a product are in stock, for one size or for every size.

    Call this for any availability or "how many" question, even if stock was mentioned earlier in the chat.

    Args:
        product_id: An id from search_products or the shopper's current product page.
        size: Optional size (XS, S, M, L, XL, XXL). Omit to get every size.
    """
    size = normalize_size(size)
    with connect() as conn:
        row = _catalogue_row(conn, product_id)
        stock = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
        ).fetchall()
    by_size = {s["size"]: s["quantity"] for s in stock}
    total = sum(by_size.values())
    shown = [size] if size else sorted(by_size, key=size_key)
    sizes = [SizeAvailability(size=s, quantity=by_size.get(s, 0), status=stock_status(by_size.get(s, 0))) for s in shown]
    ctx.deps.seen_quantities.update([total, *(s.quantity for s in sizes)])
    return StockLookup(
        product_id=row["product_id"],
        name=row["name"],
        requested_size=size,
        size_offered=size in by_size if size else True,
        sizes=sizes,
        total_stock=total,
        status=sizes[0].status if size else stock_status(total),
    )


def get_customer_profile(ctx: RunContext[AgentDeps]) -> CustomerContext | None:
    """Who is chatting: the logged-in shopper's name, email, member-since date, and saved chat stats.

    Returns null when the shopper is a guest (not logged in). Use it when the shopper asks about
    their account ("what email am I using?", "have we talked before?") or you need their full name.
    """
    return ctx.deps.customer


# --- Accounts: password hashing, password rules, signed sessions, login throttling (stdlib only) ---

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000  # OWASP 2023+ recommendation for PBKDF2-HMAC-SHA256
LEGACY_ITERATIONS = 120_000  # seed users are stored as pbkdf2_sha256$salt$hash at this count

SESSION_COOKIE = "cc_session"
SESSION_TTL_SECONDS = 7 * 24 * 3600

SPECIAL_CHAR = re.compile(r"[^A-Za-z0-9]")
DIGIT = re.compile(r"\d")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# --- Passwords ---------------------------------------------------------------

def _pbkdf2(password: str, salt: str, iterations: int) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations).hex()


def hash_password(password: str) -> str:
    """Return pbkdf2_sha256$<iterations>$<salt>$<hex digest> with a fresh random salt."""
    salt = secrets.token_hex(16)
    return f"{ALGORITHM}${ITERATIONS}${salt}${_pbkdf2(password, salt, ITERATIONS)}"


def verify_password(password: str, stored: str) -> bool:
    parts = stored.split("$")
    if len(parts) == 4:
        algorithm, iterations, salt, digest = parts
        iterations = int(iterations)
    elif len(parts) == 3:  # seed format without an iteration count
        algorithm, salt, digest = parts
        iterations = LEGACY_ITERATIONS
    else:
        return False
    if algorithm != ALGORITHM:
        return False
    return hmac.compare_digest(_pbkdf2(password, salt, iterations), digest)


# Hashed once so logins for unknown emails take as long as real ones.
DUMMY_HASH = hash_password(secrets.token_hex(16))


def password_problems(password: str) -> list[str]:
    """Rules for new accounts; the frontend shows the same checklist."""
    problems = []
    if len(password) < 8:
        problems.append("at least 8 characters")
    if not DIGIT.search(password):
        problems.append("a number")
    if not SPECIAL_CHAR.search(password):
        problems.append("a special character")
    return problems


# --- Sessions ----------------------------------------------------------------

def _load_secret() -> bytes:
    """SESSION_SECRET env var, else a random secret persisted next to this file."""
    if env := os.environ.get("SESSION_SECRET"):
        return env.encode()
    path = Path(__file__).with_name(".session_secret")
    if not path.exists():
        path.write_text(secrets.token_hex(32))
        path.chmod(0o600)
    return path.read_text().strip().encode()


SECRET = _load_secret()


def _sign(payload: str) -> str:
    return hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()


def create_session_token(user_id: int) -> str:
    payload = f"{user_id}.{int(time.time()) + SESSION_TTL_SECONDS}"
    token = f"{payload}.{_sign(payload)}"
    return base64.urlsafe_b64encode(token.encode()).decode()


def read_session_token(token: str) -> int | None:
    """Return the user id if the token is authentic and unexpired."""
    try:
        user_id, expires, signature = base64.urlsafe_b64decode(token.encode()).decode().split(".")
        if not hmac.compare_digest(_sign(f"{user_id}.{expires}"), signature):
            return None
        if int(expires) < time.time():
            return None
        return int(user_id)
    except (ValueError, UnicodeDecodeError):
        return None


# --- Login throttling ---------------------------------------------------------

MAX_FAILURES = 5
LOCKOUT_SECONDS = 60
_failures: dict[str, list[float]] = {}


def is_locked_out(email: str) -> bool:
    recent = [t for t in _failures.get(email, []) if time.time() - t < LOCKOUT_SECONDS]
    _failures[email] = recent
    return len(recent) >= MAX_FAILURES


def record_failure(email: str) -> None:
    _failures.setdefault(email, []).append(time.time())


def clear_failures(email: str) -> None:
    _failures.pop(email, None)
