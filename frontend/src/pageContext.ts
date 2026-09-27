import { createContext, useContext, useEffect } from 'react'

// Page-local details a page wants the chat assistant to know (sent inside PageContext).
export interface PageDetails {
  selected_size?: string | null
  search_text?: string | null
}

export interface PageDetailsState {
  details: PageDetails
  setDetails: (details: PageDetails) => void
}

export const PageDetailsContext = createContext<PageDetailsState | null>(null)

export function usePageDetailsState() {
  const ctx = useContext(PageDetailsContext)
  if (!ctx) throw new Error('usePageDetailsState must be used inside PageDetailsProvider')
  return ctx
}

/** Report this page's details to the chat while mounted; cleared when the page unmounts. */
export function usePageDetails(selectedSize: string | null | undefined, searchText?: string | null) {
  const { setDetails } = usePageDetailsState()
  useEffect(() => {
    setDetails({ selected_size: selectedSize ?? null, search_text: searchText ?? null })
  }, [selectedSize, searchText, setDetails])
  useEffect(() => () => setDetails({}), [setDetails])
}
