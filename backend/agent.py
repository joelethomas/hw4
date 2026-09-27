"""Campus Customs shop agent: wiring and entry point.

The FastAPI app (main.py) calls run_chat() for every message sent from the website's chat widget.
For a quick check from the terminal (run from backend/):
    ../.venv/bin/python agent.py "Do you have any navy hoodies in medium?"
"""

import asyncio
import os
import re
import ssl
import sys
import time
import uuid
from datetime import UTC, datetime
from functools import cache
from pathlib import Path

from dotenv import load_dotenv

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

import openai  # noqa: E402
from pydantic_ai import Agent, ModelRetry, RunContext  # noqa: E402
from pydantic_ai.messages import (  # noqa: E402
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.usage import UsageLimits  # noqa: E402

from models import (  # noqa: E402
    AgentReply,
    AuditEntry,
    AuditToolCall,
    AuditToolResult,
    ChatMessage,
    ChatReply,
    TokenUsage,
)
from tools import (  # noqa: E402
    HISTORY_TURNS,
    SIZE_ORDER,
    AgentDeps,
    append_audit_entry,
    build_model,
    check_stock,
    get_customer_profile,
    get_product_description,
    get_product_price,
    product_cards,
    search_products,
    shorten,
    show_products_on_page,
)

BACKEND_DIR = Path(__file__).resolve().parent
PROMPT_PATH = BACKEND_DIR / "prompts" / "prompt.md"
# Note: uvicorn --reload watches .py files only; restart the server (or add --reload-include "*.md")
# after editing prompts/prompt.md, because the agent is built once and cached.

# Nearest .env wins (load_dotenv never overrides a value already set): backend/, the project root (hw4/),
# then up to two more parent folders, e.g. a course-level "AI Foundations/.env" holding PORTKEY_API_KEY.
for folder in (BACKEND_DIR, *list(BACKEND_DIR.parents)[:3]):
    load_dotenv(folder / ".env")

# A chat turn needs at most a few lookups; this caps runaway tool loops and cost.
CHAT_LIMITS = UsageLimits(request_limit=8, tool_calls_limit=12)

TRANSIENT_ERRORS = (ssl.SSLError, openai.APIConnectionError)  # APITimeoutError is a subclass
TRANSIENT_ATTEMPTS = 3

# "$68", "$32.00"  /  "12 in stock", "only 3 left", "5 units available"
PRICE_PATTERN = re.compile(r"\$\s?(\d+(?:\.\d{1,2})?)")
QUANTITY_PATTERN = re.compile(r"\b(\d+)\s+(?:units?\s+|pieces?\s+|of them\s+)?(?:left|in stock|available|remaining)\b", re.I)


@cache
def get_agent() -> Agent[AgentDeps, AgentReply]:
    """Built on first use, so the API (products/auth) still starts without a model key."""
    model, settings = build_model()
    agent = Agent(
        model,
        deps_type=AgentDeps,
        output_type=AgentReply,
        # `instructions`, not `system_prompt`: PydanticAI omits system_prompt whenever message_history
        # is passed, so every follow-up turn used to run without this prompt (Problem 9). Instructions
        # are sent on every request, static text first, then the per-message context below, so the
        # long unchanging prefix is what the provider's prompt cache sees.
        instructions=PROMPT_PATH.read_text(encoding="utf-8"),
        model_settings=settings,
        tools=[
            search_products,
            show_products_on_page,
            get_product_description,
            get_product_price,
            check_stock,
            get_customer_profile,
        ],
        retries=2,  # tool ModelRetry and the output validator each get two retries
    )

    @agent.instructions
    def shopper_context(ctx: RunContext[AgentDeps]) -> str:
        """Per-request context: who is chatting and what page they're looking at."""
        return "\n".join(["## Current context", customer_line(ctx.deps), *page_lines(ctx.deps)])

    @agent.output_validator
    def numbers_come_from_tools(ctx: RunContext[AgentDeps], output: AgentReply) -> AgentReply:
        """Reject a reply that quotes a price or stock count no tool returned during this turn."""
        prices = {float(p) for p in PRICE_PATTERN.findall(output.reply)}
        if unknown := prices - ctx.deps.seen_prices:
            raise ModelRetry(
                f"Your reply quotes {', '.join(f'${p:g}' for p in sorted(unknown))}, which no tool returned this turn. "
                "Call get_product_price (or search_products) and quote only those prices."
            )
        quantities = {int(q) for q in QUANTITY_PATTERN.findall(output.reply)}
        if unknown_q := quantities - ctx.deps.seen_quantities:
            raise ModelRetry(
                f"Your reply states stock counts {sorted(unknown_q)} that no tool returned this turn. "
                "Call check_stock and quote only its quantities."
            )
        return output

    return agent


PAGE_LABELS = {
    "home": "the Home page",
    "products": "the Products page",
    "product": "a product page",
    "about": "the About Us page",
    "login": "the Log In page",
    "create_account": "the Create Account page",
    "other": "the website",
}


def customer_line(deps: AgentDeps) -> str:
    c = deps.customer
    if c is None:
        return (
            "- Shopper: a guest (not logged in). Their chat is not saved. If they ask about an account, "
            "order history, or who they are, explain they're not logged in and can use Log In / Create Account."
        )
    returning = (
        f"a returning customer with {c.saved_messages} saved chat messages (last chat {c.last_chat_at} UTC)"
        if c.is_returning
        else "chatting for the first time"
    )
    return (
        f"- Shopper: logged in as {c.first_name} {c.last_name} <{c.email}>, member since {c.member_since} UTC, "
        f"{returning}. Their recent conversation is in the message history above."
    )


def page_lines(deps: AgentDeps) -> list[str]:
    p = deps.page
    lines = [f"- Page: {PAGE_LABELS[p.page]} ({p.path})."]
    if deps.current_product:
        cp = deps.current_product
        stock = ", ".join(f"{s}: {q}" for s, q in cp.stock_by_size.items())
        lines.append(
            f"- On screen: the product page for \"{cp.name}\" (product_id '{cp.product_id}'). "
            "\"This\", \"it\", and \"this one\" mean this product unless the shopper names another."
        )
        lines.append(
            f"- On-screen product facts, read from the database for this message (answer from these directly, "
            f"no tool call needed): {cp.garment_type}; price ${cp.price:g}; colors: {', '.join(cp.colors)}; "
            f"stock by size: {stock} (total {cp.total_stock}). Description: {cp.description}"
        )
        if p.selected_size in SIZE_ORDER:
            lines.append(f"- They have size {p.selected_size} selected on that page.")
    if p.results_title:
        lines.append(f"- The Products page is showing your earlier chat results: \"{p.results_title}\".")
    if p.search_text:
        lines.append(f"- They typed \"{p.search_text}\" into the Products page search box.")
    return lines


def to_model_history(history: list[ChatMessage]) -> list[ModelMessage]:
    """Replay recent chat turns as plain text; product ids are appended so "this one" can resolve."""
    messages: list[ModelMessage] = []
    for turn in history[-HISTORY_TURNS:]:
        if turn.role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=turn.content)]))
        else:
            text = turn.content
            if turn.products:
                text += "\n[Products shown: " + ", ".join(p.product_id for p in turn.products) + "]"
            messages.append(ModelResponse(parts=[TextPart(content=text)]))
    return messages


class AuditRun:
    """Writes one AuditEntry per agent-loop step of a chat turn to output/audit_trail.json (append-only)."""

    def __init__(self, deps: AgentDeps) -> None:
        self.run_id = uuid.uuid4().hex[:12]
        self.started = time.perf_counter()
        self.iteration = 0
        self.user_id = deps.customer.user_id if deps.customer else None
        self.model_name = os.getenv("AGENT_MODEL", "gpt-5.6-luna")

    def record(self, event: str, **fields: object) -> None:
        try:
            append_audit_entry(
                AuditEntry(
                    entry_id=uuid.uuid4().hex,
                    run_id=self.run_id,
                    timestamp=datetime.now(UTC).isoformat(timespec="milliseconds"),
                    elapsed_seconds=round(time.perf_counter() - self.started, 2),
                    iteration=self.iteration,
                    event=event,
                    model_name=self.model_name,
                    user_id=self.user_id,
                    **fields,
                )
            )
        except OSError:  # auditing must never break a shopper's chat
            pass
        self.iteration += 1


def _short_arg(value: object) -> object:
    # Keep numbers / booleans / null as JSON values; shorten and redact everything else.
    return value if value is None or isinstance(value, (bool, int, float)) else shorten(value, 120)


def _stop_reason(calls: list[ToolCallPart], finish_reason: str | None) -> str:
    """Why this model step ended: calling tools, or handing back the final structured answer."""
    names = [c.tool_name for c in calls]
    if "final_result" in names:
        what = "final answer (final_result output tool)"
    elif names:
        what = "tool calls: " + ", ".join(names)
    else:
        what = "text only"
    return f"{what}; provider finish_reason={finish_reason}"


async def _run_audited(agent: Agent[AgentDeps, AgentReply], message: str, history: list[ChatMessage],
                       deps: AgentDeps, audit: AuditRun) -> AgentReply:
    """Run the agent loop node by node, auditing every model response and every batch of tool results."""
    async with agent.iter(
        message, deps=deps, message_history=to_model_history(history), usage_limits=CHAT_LIMITS
    ) as run:
        async for node in run:
            if Agent.is_call_tools_node(node):
                response = node.model_response
                calls = [p for p in response.parts if isinstance(p, ToolCallPart)]
                audit.record(
                    "model_response",
                    tool_calls=[
                        AuditToolCall(tool_name=p.tool_name, args={k: _short_arg(v) for k, v in p.args_as_dict().items()})
                        for p in calls
                    ],
                    stop_reason=_stop_reason(calls, response.finish_reason),
                    usage=TokenUsage(
                        input_tokens=response.usage.input_tokens,
                        cached_input_tokens=response.usage.cache_read_tokens,
                        output_tokens=response.usage.output_tokens,
                    ),
                )
            elif Agent.is_model_request_node(node):
                results = [
                    AuditToolResult(
                        tool_name=p.tool_name or "unknown",
                        outcome="ok" if isinstance(p, ToolReturnPart) else "retry",
                        summary=shorten(p.model_response_str() if isinstance(p, ToolReturnPart) else str(p.content)),
                    )
                    for p in node.request.parts
                    if isinstance(p, (ToolReturnPart, RetryPromptPart))
                ]
                if results:
                    audit.record("tool_results", tool_results=results)
    usage = run.usage() if callable(run.usage) else run.usage
    audit.usage = TokenUsage(
        input_tokens=usage.input_tokens, cached_input_tokens=usage.cache_read_tokens, output_tokens=usage.output_tokens
    )
    return run.result.output


async def run_chat(message: str, history: list[ChatMessage], deps: AgentDeps) -> ChatReply:
    # Amounts the shopper typed ("under $60") may be echoed back; they aren't catalogue prices.
    deps.seen_prices.update(float(p) for p in PRICE_PATTERN.findall(message))
    audit = AuditRun(deps)
    audit.record("run_start", page=deps.page.path, user_request=shorten(message))
    # Transient TLS / connection drops: retry with a short back-off, and before the last attempt rebuild
    # the agent so it gets a fresh HTTP connection pool (one immediate retry reused the broken connection
    # and failed again during the Problem 11 live check).
    for attempt in range(TRANSIENT_ATTEMPTS):
        try:
            output = await _run_audited(get_agent(), message, history, deps, audit)
            break
        except TRANSIENT_ERRORS as exc:
            last = attempt == TRANSIENT_ATTEMPTS - 1
            audit.record("run_error", stop_reason=shorten(
                f"{type(exc).__name__}: {exc}" + ("" if last else f" (retrying, attempt {attempt + 2})")
            ))
            if last:
                raise
            deps.page_results = None
            if attempt == TRANSIENT_ATTEMPTS - 2:
                get_agent.cache_clear()
            await asyncio.sleep(0.4 * (attempt + 1))
        except Exception as exc:  # limits, content filter, config: audit, then let main.py map it
            audit.record("run_error", stop_reason=shorten(f"{type(exc).__name__}: {exc}"))
            raise

    if deps.page_results is not None and not output.update_page:
        deps.page_results = None  # the agent searched but its final answer isn't a browse reply
    if deps.page_results is not None:
        # The results go to the Products page, so the chat bubble doesn't repeat them as cards.
        reply = ChatReply(reply=output.reply, products=[], page_results=deps.page_results)
    else:
        # Cards are rebuilt from the database, so a hallucinated id simply never shows up.
        reply = ChatReply(reply=output.reply, products=product_cards(output.product_ids, output.size))
    audit.record(
        "run_end",
        stop_reason="final answer returned via the AgentReply output tool (final_result)",
        usage=getattr(audit, "usage", None),
        reply_summary=shorten(reply.reply, 160),
        page_updated=reply.page_results is not None,
        tool_results=[AuditToolResult(tool_name="product_cards", outcome="ok",
                                      summary=shorten([p.product_id for p in reply.products]))] if reply.products else [],
    )
    return reply


if __name__ == "__main__":
    question = " ".join(sys.argv[1:]) or "What hoodies do you have?"
    reply = asyncio.run(run_chat(question, [], AgentDeps()))  # as a guest on no particular page
    print(reply.reply)
    for card in reply.products:
        print(f"  - {card.name} (${card.price:.0f}) [{card.product_id}]")
