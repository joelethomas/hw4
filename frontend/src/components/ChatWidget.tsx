import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { fetchChatHistory, formatPrice, sendChatMessage, type ChatMessage, type PageContext, type PageName } from '../api'
import { useAuth } from '../authContext'
import { useChatResults } from '../chatResultsContext'
import { usePageDetailsState } from '../pageContext'
import OutOfStockBanner from './OutOfStockBanner'
import { suggestions } from '../suggestions'
import { onOpenDan } from '../chatControl'

// Local-only: a "shown on the page" link under replies that sent results to the Products page.
type Turn = ChatMessage & { page?: { title: string; total: number } }

const pageNames: Record<string, PageName> = {
  '/': 'home',
  '/products': 'products',
  '/about': 'about',
  '/login': 'login',
  '/create-account': 'create_account',
}

const greeting: Turn = {
  role: 'assistant',
  content: "Woof! I'm Dan, the Campus Customs bulldog. Ask me what's in stock in your size, what colors something comes in, or what to get for your college.",
  products: [],
}

// Replies are plain text, but older saved messages use **bold**; render just that, safely (no HTML).
function renderText(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}

export default function ChatWidget() {
  const { user } = useAuth()
  const { results, showResults } = useChatResults()
  const { details } = usePageDetailsState()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const productMatch = useMatch('/products/:productId')
  const productId = productMatch?.params.productId ?? null
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Turn[]>([greeting])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [hasSavedHistory, setHasSavedHistory] = useState(false)
  const [sentThisSession, setSentThisSession] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // Logged-in shoppers pick up their saved conversation; logging in or out starts fresh.
  useEffect(() => {
    let cancelled = false
    const load = user ? fetchChatHistory() : Promise.resolve([])
    load
      .then((history) => {
        if (cancelled) return
        setMessages([greeting, ...history])
        setHasSavedHistory(history.length > 0)
        setSentThisSession(false)
      })
      .catch(() => !cancelled && setMessages([greeting]))
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, sending])

  // "Ask Dan" buttons anywhere on the site open the chat (and optionally ask a question).
  const sendRef = useRef<(q: string) => void>(() => {})
  useEffect(
    () =>
      onOpenDan((question) => {
        setOpen(true)
        if (question) sendRef.current(question)
      }),
    [],
  )

  function currentPage(): PageContext {
    const onProducts = pathname === '/products'
    return {
      path: pathname,
      page: productId ? 'product' : (pageNames[pathname] ?? 'other'),
      product_id: productId,
      selected_size: productId ? (details.selected_size ?? null) : null,
      results_title: onProducts ? (results?.title ?? null) : null,
      search_text: onProducts && !results ? details.search_text || null : null,
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void send(input)
  }

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || sending) return
    setSentThisSession(true)
    const history: ChatMessage[] = messages.slice(1).map(({ role, content, products }) => ({ role, content, products }))
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text, products: [] }])
    setSending(true)
    try {
      const reply = await sendChatMessage(text, history, currentPage())
      const pageResults = reply.page_results
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: reply.reply,
          products: reply.products,
          page: pageResults ? { title: pageResults.title, total: pageResults.total_matches } : undefined,
        },
      ])
      if (pageResults) {
        showResults(pageResults)
        navigate('/products')
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `Sorry, something went wrong: ${(err as Error).message}`, products: [] },
      ])
    } finally {
      setSending(false)
    }
  }

  // Keep the latest send() for the "Ask Dan" listener (updated after render, not during it).
  useEffect(() => {
    sendRef.current = (q: string) => void send(q)
  })

  const last = messages[messages.length - 1]
  const quick =
    !sending && last.role === 'assistant'
      ? suggestions(
          {
            page: currentPage(),
            productId,
            loggedIn: Boolean(user),
            hasSavedHistory,
            lastCards: sentThisSession ? last.products : [],
            lastResults: sentThisSession ? (last.page ?? null) : null,
            pageResults: pathname === '/products' ? results : null,
          },
          !sentThisSession,
        ).filter((q) => !messages.some((m) => m.role === 'user' && m.content === q))
      : []

  return (
    <div className="chat">
      {open && (
        <section className="chat-panel" aria-label="Chat with Dan">
          <header className="chat-header">
            <img src="/brand/dan.png" alt="" className="chat-header-avatar" />
            <div className="chat-header-text">
              <span className="chat-name">Dan</span>
              <span className="chat-status">
                <span className="online-dot" /> Campus Customs bulldog · replies in seconds
              </span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat">
              ×
            </button>
          </header>
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`turn ${m.role}`}>
                <div className="turn-row">
                  {m.role === 'assistant' && <img src="/brand/dan.png" alt="" className="turn-avatar" />}
                  <div className={`bubble ${m.role}`}>{renderText(m.content)}</div>
                </div>
                {m.page && (
                  <Link to="/products" className="page-link">
                    ▦ {m.page.total} {m.page.total === 1 ? 'result' : 'results'} for “{m.page.title}” on the page →
                  </Link>
                )}
                {m.products.length > 0 && (
                  <div className="chat-cards">
                    {m.products.map((p) => {
                      const sizeOut = p.requested_size !== null && p.requested_size_quantity === 0
                      return (
                        <Link key={p.product_id} to={`/products/${p.product_id}`} className="chat-card">
                          <div className="img-wrap">
                            <img src={p.image_url} alt={p.name} />
                            {p.total_stock === 0 ? (
                              <OutOfStockBanner />
                            ) : (
                              sizeOut && <OutOfStockBanner size={p.requested_size} />
                            )}
                          </div>
                          <span className="chat-card-name">{p.name}</span>
                          <span className="chat-card-price">{formatPrice(p.price)}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="turn assistant">
                <div className="turn-row">
                  <img src="/brand/dan.png" alt="" className="turn-avatar" />
                  <div className="bubble assistant typing" aria-label="Dan is typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          {quick.length > 0 && (
            <div className="quick-replies" aria-label="Suggested questions">
              {quick.map((q) => (
                <button key={q} type="button" className="quick" onClick={() => void send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <form className="chat-input" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Dan anything about the gear…"
              maxLength={2000}
              autoFocus
            />
            <button type="submit" disabled={!input.trim() || sending}>
              Send
            </button>
          </form>
        </section>
      )}
      <button
        className={`chat-toggle${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat with Dan' : 'Chat with Dan'}
      >
        {open ? (
          <span className="toggle-close">×</span>
        ) : (
          <>
            <img src="/brand/dan.png" alt="" className="toggle-avatar" />
            <span className="toggle-label">Ask Dan</span>
          </>
        )}
      </button>
    </div>
  )
}
