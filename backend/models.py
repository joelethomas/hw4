"""Pydantic / PydanticAI structured types for the Campus Customs API and shop agent."""

from typing import Literal

from pydantic import BaseModel, Field, computed_field

StockStatus = Literal["in_stock", "low_stock", "out_of_stock"]


# --- Catalogue ---------------------------------------------------------------


class SizeStock(BaseModel):
    size: str
    quantity: int


class ProductSummary(BaseModel):
    """One product card: used by the Products page grid AND by chat search results on the page.

    Every field is read from the database; the chat agent never writes any of it.
    """

    product_id: str
    name: str
    garment_type: str
    description: str
    short_description: str = Field(description="First sentence of description, trimmed for a card.")
    price: float
    image_url: str
    colors: list[str]
    search_tags: list[str] = Field(description="Catalogue keywords; the Products page search matches on them too.")
    sizes_in_stock: list[str]
    total_stock: int
    stock_status: StockStatus


class ProductDetail(ProductSummary):
    """Full product data for the single-item page."""

    inventory: list[SizeStock]


# --- Accounts ----------------------------------------------------------------


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserPublic(BaseModel):
    """What the API returns about a user; never includes password_hash."""

    id: int
    first_name: str
    last_name: str
    email: str


# --- Chat --------------------------------------------------------------------


class ProductCard(BaseModel):
    """A compact product card shown under an assistant reply in the chat widget.

    Always built from the database (never from model text), so name, price, image, and stock
    are guaranteed real. Old chat_messages.products_json rows carry these same keys.
    """

    product_id: str
    name: str
    garment_type: str
    price: float
    image_url: str
    total_stock: int
    # Set when the shopper asked about a specific size, so the card can show "Out of stock in XL".
    requested_size: str | None = None
    requested_size_quantity: int | None = None


class ChatMessage(BaseModel):
    """One turn of conversation, as sent by the widget and returned from chat history."""

    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = []


PageName = Literal["home", "products", "product", "about", "login", "create_account", "other"]


class PageContext(BaseModel):
    """Where the shopper is on the site when they send a message (sent by the chat widget)."""

    path: str = Field(default="/", max_length=200)
    page: PageName = "other"
    # Product page: the item on screen, so "do you have this in pink?" resolves to it.
    product_id: str | None = Field(default=None, max_length=200)
    # Product page: the size button the shopper has selected, if any.
    selected_size: str | None = Field(default=None, max_length=10)
    # Products page: the chat results currently displayed (Problem 7), if any.
    results_title: str | None = Field(default=None, max_length=120)
    # Products page: text typed into the page's own search box, if any.
    search_text: str | None = Field(default=None, max_length=120)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # Guests send their recent turns; logged-in history is loaded from chat_messages instead.
    history: list[ChatMessage] = Field(default=[], max_length=40)
    page: PageContext = PageContext()


class CustomerContext(BaseModel):
    """What the agent knows about a logged-in shopper. Built server-side from the session cookie,
    never from anything the browser claims, and never includes password_hash."""

    user_id: int
    first_name: str
    last_name: str
    email: str
    member_since: str = Field(description="users.created_at (UTC), e.g. 2026-09-19 11:34:09")
    saved_messages: int = Field(description="Messages already in chat_messages for this user.")
    last_chat_at: str | None = Field(description="Timestamp of their most recent saved message, if any.")

    @computed_field
    @property
    def is_returning(self) -> bool:
        return self.saved_messages > 0


class CurrentProduct(BaseModel):
    """The product page the shopper is on, resolved against catalogue (unknown ids are dropped).

    Carries a fresh database snapshot so "this" questions can be answered without a tool call.
    """

    product_id: str
    name: str
    garment_type: str
    price: float
    colors: list[str]
    description: str
    stock_by_size: dict[str, int]
    total_stock: int


class SearchFilters(BaseModel):
    """The search the agent ran, echoed to the page so shoppers see what was matched."""

    query: str | None = None
    garment_type: str | None = None
    color: str | None = None
    size: str | None = None
    max_price: float | None = None


class PageResults(BaseModel):
    """Chat search results the website renders on the Products page (Problem 7 API contract)."""

    title: str = Field(description='Heading for the results, e.g. "Hoodies" or "Navy crewnecks under $60".')
    filters: SearchFilters
    total_matches: int
    products: list[ProductSummary]


class ChatReply(BaseModel):
    reply: str
    products: list[ProductCard]
    # Set when the agent called show_products_on_page; the frontend shows these on the Products page.
    page_results: PageResults | None = None


class ProductMatch(BaseModel):
    """A search_products result: complete enough to answer most price / stock / look questions
    without a follow-up lookup (Problem 9: fewer model round trips)."""

    product_id: str
    name: str
    garment_type: str
    short_description: str
    price: float
    colors: list[str]
    stock_by_size: dict[str, int] = Field(description="Units on hand per size, XS to XXL; 0 = out of stock.")
    sizes_in_stock: list[str]
    total_stock: int
    stock_status: StockStatus


class PageSearchSummary(BaseModel):
    """What show_products_on_page returns to the model: a summary, not all 48 cards."""

    title: str
    total_matches: int
    displayed_on_page: bool = Field(description="False when the page was left unchanged (no matches, or no filters).")
    note: str | None = None
    shown_on_page: int
    price_min: float | None
    price_max: float | None
    out_of_stock_count: int
    top_matches: list[ProductMatch] = Field(description="The first few matches, for naming highlights.")


# --- Agent lookup results (Problem 6) ------------------------------------------------


class ProductDescription(BaseModel):
    """get_product_description: what the item looks like, straight from catalogue."""

    product_id: str
    name: str
    garment_type: str
    description: str
    colors: list[str]


class ProductPrice(BaseModel):
    """get_product_price: the one authoritative price for a product."""

    product_id: str
    name: str
    price: float = Field(description="Price in US dollars, from catalogue.price.")
    currency: Literal["USD"] = "USD"


class SizeAvailability(BaseModel):
    size: str
    quantity: int = Field(description="Units on hand from inventory.quantity; 0 means out of stock.")
    status: StockStatus


class StockLookup(BaseModel):
    """check_stock: stock for one product, overall or for a single requested size."""

    product_id: str
    name: str
    requested_size: str | None = Field(description="The size asked about, or null for all sizes.")
    size_offered: bool = Field(description="False if the product has no inventory row for requested_size.")
    sizes: list[SizeAvailability] = Field(
        description="Just the requested size when one was asked for, otherwise every size XS to XXL."
    )
    total_stock: int = Field(description="Units across all sizes.")
    status: StockStatus = Field(
        description="Status of the requested size if one was given, otherwise of the product overall."
    )


class AgentReply(BaseModel):
    """The agent's structured final answer (PydanticAI output_type)."""

    reply: str = Field(
        description="The message to show the shopper: friendly, concise plain text (no markdown tables)."
    )
    product_ids: list[str] = Field(
        default=[],
        max_length=6,
        description=(
            "product_ids from tool results to show as cards under the reply, most relevant first. "
            "Only ids returned by your tools; empty if none apply."
        ),
    )
    size: str | None = Field(
        default=None,
        description="The size the shopper asked about (XS-XXL), if any, so product cards show that size's stock.",
    )
    update_page: bool = Field(
        default=False,
        description=(
            "True only if the shopper asked to browse or see a group of items this turn AND your reply introduces "
            "the show_products_on_page results. False for declines, off-topic requests, and answers about items "
            "already shown. The Products page changes only when this is true."
        ),
    )


# --- Audit trail (Problem 12) -------------------------------------------------------------


class AuditToolCall(BaseModel):
    tool_name: str
    args: dict[str, object] = Field(description="Arguments the model passed (long values shortened, PII redacted).")


class AuditToolResult(BaseModel):
    tool_name: str
    outcome: Literal["ok", "retry"] = Field(description="ok = tool returned; retry = ModelRetry / validator pushback.")
    summary: str = Field(description="Short version of what the tool returned or why it was retried.")


class TokenUsage(BaseModel):
    input_tokens: int
    cached_input_tokens: int = 0
    output_tokens: int


class AuditEntry(BaseModel):
    """One record in output/audit_trail.json, appended at every step of every chat turn (never rewritten)."""

    entry_id: str
    run_id: str = Field(description="Groups every entry from one chat turn.")
    timestamp: str = Field(description="UTC time the step was recorded, ISO 8601.")
    elapsed_seconds: float = Field(description="Seconds since the turn started.")
    iteration: int = Field(description="Agent-loop step within the turn (0 = run_start).")
    event: Literal["run_start", "model_response", "tool_results", "run_end", "run_error"]
    model_name: str
    user_id: int | None = Field(default=None, description="Logged-in shopper id; null for guests. Never name/email.")
    page: str | None = Field(default=None, description="Site path the message was sent from (run_start only).")
    user_request: str | None = Field(default=None, description="Shopper message, shortened and redacted (run_start).")
    tool_calls: list[AuditToolCall] = []
    tool_results: list[AuditToolResult] = []
    stop_reason: str | None = Field(default=None, description="Why the model stopped / the run ended or failed.")
    usage: TokenUsage | None = None
    reply_summary: str | None = Field(default=None, description="Start of the final reply (run_end only).")
    page_updated: bool | None = Field(default=None, description="Whether the reply changed the Products page.")
