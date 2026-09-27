// Context-aware quick replies for the chat (Problem 9, improvement 2). Deterministic and free:
// built from what's on screen, so no extra model call is needed to suggest questions.
import type { PageContext, PageResults, ProductCard } from './api'

export interface SuggestionContext {
  page: PageContext
  productId: string | null
  loggedIn: boolean
  hasSavedHistory: boolean
  // What the last assistant reply put on screen, for follow-ups.
  lastCards: ProductCard[]
  lastResults: { title: string; total: number } | null
  pageResults: PageResults | null
}

const MAX = 3

export function suggestions(c: SuggestionContext, isStart: boolean): string[] {
  const out: string[] = []
  const size = c.page.selected_size

  if (c.page.page === 'product' && c.productId) {
    out.push(size ? `Is this in stock in ${size}?` : 'What sizes are in stock?')
    out.push('What colors does it come in?')
    out.push('Show me similar items')
  } else if (!isStart && c.lastResults) {
    out.push('Only ones in stock in M', 'Under $60', 'Just the navy ones')
  } else if (!isStart && c.lastCards.length > 0) {
    const first = c.lastCards[0].name
    out.push(`What sizes does the ${first} come in?`, 'Show me similar items', 'Anything cheaper?')
  } else if (c.page.page === 'products' && c.pageResults) {
    out.push('Only ones in stock in M', 'Under $60', 'Show me crewnecks instead')
  } else {
    if (isStart && c.loggedIn && c.hasSavedHistory) out.push('What was I looking at last time?')
    out.push('What hoodies do you have?', 'Gear for my residential college', 'Gifts under $40')
  }
  return [...new Set(out)].slice(0, MAX)
}
