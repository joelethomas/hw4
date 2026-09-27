import { createContext, useContext } from 'react'
import type { PageResults } from './api'

export interface ChatResultsState {
  results: PageResults | null
  // Bumped on every new search so the page can replay its entrance animation.
  version: number
  showResults: (results: PageResults) => void
  clearResults: () => void
}

export const ChatResultsContext = createContext<ChatResultsState | null>(null)

export function useChatResults() {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used inside ChatResultsProvider')
  return ctx
}
