import { useState, type ReactNode } from 'react'
import { PageDetailsContext, type PageDetails } from './pageContext'

export function PageDetailsProvider({ children }: { children: ReactNode }) {
  const [details, setDetails] = useState<PageDetails>({})
  return <PageDetailsContext.Provider value={{ details, setDetails }}>{children}</PageDetailsContext.Provider>
}
