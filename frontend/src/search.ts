// Products-page search, filters, and sorting (Problem 9, improvement 1). Pure functions, no React,
// so they run instantly on the 102 loaded products and can be tested with plain Node.

export interface Searchable {
  product_id: string
  name: string
  garment_type: string
  description: string
  colors: string[]
  search_tags: string[]
  price: number
  sizes_in_stock: string[]
  total_stock: number
}

// Phrases shoppers type many ways, collapsed to one token on both the query and product side.
const PHRASES: [RegExp, string][] = [
  [/\b(quarter[\s-]?zips?|1\s*\/\s*4[\s-]?zips?|1 4 zips?)\b/g, ' quarterzip '],
  [/\b(full[\s-]?zips?)\b/g, ' fullzip '],
  [/\b(t[\s-]?shirts?|tees?)\b/g, ' tshirt '],
  [/\b(crew[\s-]?necks?)\b/g, ' crewneck '],
  [/\b(hoodies?|hooded|hoods?)\b/g, ' hoodie '],
  [/\b(sweat[\s-]?shirts?)\b/g, ' sweatshirt '],
  [/\b(grey)\b/g, ' gray '],
]

// "yale" and "college" appear on nearly every item, so they only filter out products with sparse text.
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'of', 'in', 'with', 'yale', 'college', 'show', 'me', 'any', 'some'])

function fold(word: string): string {
  // Light plural folding: jackets -> jacket, colleges -> college (but not "dress" -> "dres").
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word
}

export function tokenize(text: string, dropStopWords = false): string[] {
  let t = ` ${text.toLowerCase()} `
  for (const [re, rep] of PHRASES) t = t.replace(re, rep)
  return t
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 || /\d/.test(w))
    .map(fold)
    .filter((w) => !(dropStopWords && STOP.has(w)))
}

// --- Categories -------------------------------------------------------------------

export const CATEGORIES = [
  { id: 'hoodie', label: 'Hoodies' },
  { id: 'crewneck', label: 'Crewnecks' },
  { id: 'tshirt', label: 'T-shirts' },
  { id: 'quarterzip', label: 'Quarter-zips' },
  { id: 'jacket', label: 'Jackets & fleece' },
  { id: 'performance', label: 'Performance' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export function categoryOf(p: Searchable): CategoryId | 'other' {
  const words = new Set(tokenize(`${p.garment_type} ${p.name}`))
  if (words.has('quarterzip')) return 'quarterzip'
  if (words.has('hoodie')) return 'hoodie'
  if (words.has('jacket') || words.has('fleece')) return 'jacket'
  if (words.has('performance')) return 'performance'
  if (words.has('tshirt')) return 'tshirt'
  if (words.has('crewneck') || words.has('sweatshirt')) return 'crewneck'
  return 'other'
}

// --- Colors -----------------------------------------------------------------------

export const COLOR_FAMILIES = ['Navy', 'Blue', 'Gray', 'Black', 'White', 'Red', 'Green'] as const
export type ColorFamily = (typeof COLOR_FAMILIES)[number]

export function colorFamilies(p: Searchable): Set<ColorFamily> {
  const out = new Set<ColorFamily>()
  for (const c of p.colors.map((x) => x.toLowerCase())) {
    if (c.includes('navy')) out.add('Navy')
    else if (c.includes('blue')) out.add('Blue')
    if (/gr[ae]y|heather|charcoal|silver/.test(c)) out.add('Gray')
    if (c.includes('black')) out.add('Black')
    if (c.includes('white')) out.add('White')
    if (/red|maroon|crimson/.test(c)) out.add('Red')
    if (c.includes('green')) out.add('Green')
  }
  return out
}

// --- Search + filter + sort ----------------------------------------------------------

export type SortKey = 'relevance' | 'price_asc' | 'price_desc' | 'name'

export interface Filters {
  q: string
  category: CategoryId | null
  color: ColorFamily | null
  size: string | null
  maxPrice: number | null
  inStock: boolean
  sort: SortKey
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  category: null,
  color: null,
  size: null,
  maxPrice: null,
  inStock: false,
  sort: 'relevance',
}

interface Indexed<T> {
  p: T
  name: Set<string>
  all: Set<string>
  category: CategoryId | 'other'
  colors: Set<ColorFamily>
}

export function buildIndex<T extends Searchable>(products: T[]): Indexed<T>[] {
  return products.map((p) => ({
    p,
    name: new Set(tokenize(p.name)),
    all: new Set(tokenize([p.name, p.garment_type, p.description, ...p.colors, ...p.search_tags].join(' '))),
    category: categoryOf(p),
    colors: colorFamilies(p),
  }))
}

function matches(words: Set<string>, term: string): boolean {
  if (words.has(term)) return true
  // Prefix match for partial typing ("berk" -> berkeley), only for 3+ letters.
  if (term.length >= 3) for (const w of words) if (w.startsWith(term)) return true
  return false
}

/** Every query word must match (AND); name matches rank above description matches. */
export function search<T extends Searchable>(index: Indexed<T>[], f: Filters): T[] {
  const terms = tokenize(f.q, true)
  const scored: [number, T][] = []
  for (const item of index) {
    const { p } = item
    if (f.category && item.category !== f.category) continue
    if (f.color && !item.colors.has(f.color)) continue
    if (f.size && !p.sizes_in_stock.includes(f.size)) continue
    if (f.maxPrice != null && p.price > f.maxPrice) continue
    if (f.inStock && p.total_stock === 0) continue
    if (!terms.every((t) => matches(item.all, t))) continue
    const score = terms.reduce((s, t) => s + (matches(item.name, t) ? 2 : 1), 0)
    scored.push([score, p])
  }
  const byName = (a: T, b: T) => a.name.localeCompare(b.name)
  const sorters: Record<SortKey, (a: [number, T], b: [number, T]) => number> = {
    relevance: (a, b) => b[0] - a[0] || byName(a[1], b[1]),
    price_asc: (a, b) => a[1].price - b[1].price || byName(a[1], b[1]),
    price_desc: (a, b) => b[1].price - a[1].price || byName(a[1], b[1]),
    name: (a, b) => byName(a[1], b[1]),
  }
  return scored.sort(sorters[f.sort]).map(([, p]) => p)
}

/** How many products each category would show with the other filters applied (for chip counts). */
export function categoryCounts<T extends Searchable>(index: Indexed<T>[], f: Filters): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of search(index, { ...f, category: null })) {
    const c = categoryOf(p)
    counts[c] = (counts[c] ?? 0) + 1
  }
  return counts
}
