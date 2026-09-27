// Types mirror the Pydantic models in backend/models.py.

export interface SizeStock {
  size: string
  quantity: number
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

// One product card: the Products grid and chat page results both use this shape.
export interface ProductSummary {
  product_id: string
  name: string
  garment_type: string
  description: string
  short_description: string
  price: number
  image_url: string
  colors: string[]
  search_tags: string[]
  sizes_in_stock: string[]
  total_stock: number
  stock_status: StockStatus
}

export interface ProductDetail extends ProductSummary {
  inventory: SizeStock[]
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export const fetchProducts = () => getJson<ProductSummary[]>('/api/products')

export const fetchProduct = (productId: string) =>
  getJson<ProductDetail>(`/api/products/${encodeURIComponent(productId)}`)

export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
}

export interface RegisterInput {
  first_name: string
  last_name: string
  email: string
  password: string
}

// FastAPI errors come back as {"detail": "..."}; surface that message.
async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(typeof data?.detail === 'string' ? data.detail : `${res.status} ${res.statusText}`)
  }
  return (res.status === 204 ? undefined : res.json()) as Promise<T>
}

export const login = (email: string, password: string) =>
  postJson<User>('/api/auth/login', { email, password })

export const register = (input: RegisterInput) => postJson<User>('/api/auth/register', input)

export const logout = () => postJson<void>('/api/auth/logout')

export async function fetchCurrentUser(): Promise<User | null> {
  const res = await fetch('/api/auth/me')
  return res.ok ? (res.json() as Promise<User>) : null
}

export const formatPrice = (price: number) => `$${price.toFixed(2)}`

export interface ProductCard {
  product_id: string
  name: string
  garment_type: string
  price: number
  image_url: string
  total_stock: number
  requested_size: string | null
  requested_size_quantity: number | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  products: ProductCard[]
}

export interface SearchFilters {
  query: string | null
  garment_type: string | null
  color: string | null
  size: string | null
  max_price: number | null
}

// Chat search results for the Products page (mirrors PageResults in backend/models.py).
export interface PageResults {
  title: string
  filters: SearchFilters
  total_matches: number
  products: ProductSummary[]
}

export interface ChatReply {
  reply: string
  products: ProductCard[]
  page_results: PageResults | null
}

export type PageName = 'home' | 'products' | 'product' | 'about' | 'login' | 'create_account' | 'other'

// Where the shopper is when they send a message (mirrors PageContext in backend/models.py).
export interface PageContext {
  path: string
  page: PageName
  product_id: string | null
  selected_size: string | null
  results_title: string | null
  search_text: string | null
}

// Guests send recent turns as history; for logged-in shoppers the server reloads chat_messages.
export const sendChatMessage = (message: string, history: ChatMessage[], page: PageContext) =>
  postJson<ChatReply>('/api/chat', { message, history, page })

export const fetchChatHistory = () => getJson<ChatMessage[]>('/api/chat/history')
