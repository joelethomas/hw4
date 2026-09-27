import { useState, type ReactNode } from 'react'
import type { PageResults } from './api'
import { ChatResultsContext } from './chatResultsContext'

const STORAGE_KEY = 'cc_chat_results'

function load(): PageResults | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PageResults) : null
  } catch {
    return null
  }
}

// Holds the latest chat search so results survive opening a product and coming back (and page reloads).
export function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<PageResults | null>(load)
  const [version, setVersion] = useState(0)

  function showResults(next: PageResults) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setResults(next)
    setVersion((v) => v + 1)
  }

  function clearResults() {
    sessionStorage.removeItem(STORAGE_KEY)
    setResults(null)
  }

  return (
    <ChatResultsContext.Provider value={{ results, version, showResults, clearResults }}>
      {children}
    </ChatResultsContext.Provider>
  )
}
