import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchProducts, formatPrice, type ProductSummary, type SearchFilters } from '../api'
import { useChatResults } from '../chatResultsContext'
import ProductCard from '../components/ProductCard'
import { usePageDetails } from '../pageContext'
import {
  buildIndex,
  CATEGORIES,
  categoryCounts,
  COLOR_FAMILIES,
  search,
  type CategoryId,
  type ColorFamily,
  type Filters,
  type SortKey,
} from '../search'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const PRICES = [40, 60, 80]
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'relevance', label: 'Best match' },
  { id: 'price_asc', label: 'Price: low to high' },
  { id: 'price_desc', label: 'Price: high to low' },
  { id: 'name', label: 'Name: A–Z' },
]

// Filters live in the URL (?q=&cat=&color=&size=&max=&stock=1&sort=) so Back, reload, and shared links keep them.
function readFilters(params: URLSearchParams): Filters {
  const max = Number(params.get('max'))
  return {
    q: params.get('q') ?? '',
    category: (params.get('cat') as CategoryId) || null,
    color: (params.get('color') as ColorFamily) || null,
    size: params.get('size') || null,
    maxPrice: Number.isFinite(max) && max > 0 ? max : null,
    inStock: params.get('stock') === '1',
    sort: (params.get('sort') as SortKey) || 'relevance',
  }
}

function writeFilters(f: Filters): Record<string, string> {
  const out: Record<string, string> = {}
  if (f.q) out.q = f.q
  if (f.category) out.cat = f.category
  if (f.color) out.color = f.color
  if (f.size) out.size = f.size
  if (f.maxPrice != null) out.max = String(f.maxPrice)
  if (f.inStock) out.stock = '1'
  if (f.sort !== 'relevance') out.sort = f.sort
  return out
}

function filterChips(f: SearchFilters): string[] {
  return [
    f.query && `“${f.query}”`,
    f.garment_type,
    f.color,
    f.size && `Size ${f.size}`,
    f.max_price != null && `Under ${formatPrice(f.max_price)}`,
  ].filter((c): c is string => Boolean(c))
}

export default function Products() {
  const { results, version, clearResults } = useChatResults()
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [params, setParams] = useSearchParams()
  // The search box keeps its own state so fast typing never waits on (or loses keys to) a URL update.
  const [q, setQ] = useState(() => params.get('q') ?? '')
  const urlFilters = useMemo(() => readFilters(params), [params])
  const filters = useMemo(() => ({ ...urlFilters, q }), [urlFilters, q])
  const searchRef = useRef<HTMLInputElement>(null)
  usePageDetails(null, q.trim() || null)

  // Merge into the *latest* URL params, so several quick changes in a row all stick.
  function update(patch: Partial<Filters>) {
    if (patch.q !== undefined) setQ(patch.q)
    setParams((prev) => writeFilters({ ...readFilters(prev), ...patch }), { replace: true })
  }

  function clearAll() {
    setQ('')
    setParams({}, { replace: true })
  }

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // A new chat search scrolls the results into view.
  useEffect(() => {
    if (version > 0) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [version])

  // "/" focuses the search box, as on most shopping sites.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const index = useMemo(() => buildIndex(products), [products])
  const visible = useMemo(() => search(index, filters), [index, filters])
  const counts = useMemo(() => categoryCounts(index, filters), [index, filters])
  const active = params.toString() !== ''

  if (results) {
    const shown = results.products.length
    return (
      <div className="container">
        <section className="results-header" key={`h${version}`}>
          <div>
            <p className="kicker dark results-eyebrow">
              <img src="/brand/dan.png" alt="" className="kicker-avatar" /> Dan found these for you
            </p>
            <h1 className="display">{results.title}</h1>
            <p className="muted">
              {results.total_matches === 0
                ? 'No matches. Try asking the assistant for something broader.'
                : `${results.total_matches} ${results.total_matches === 1 ? 'match' : 'matches'}` +
                  (shown < results.total_matches ? `, showing the first ${shown}` : '')}
            </p>
            <div className="chips">
              {filterChips(results.filters).map((c) => (
                <span key={c} className="chip">
                  {c}
                </span>
              ))}
            </div>
          </div>
          <button className="button ghost" onClick={clearResults}>
            Show all products
          </button>
        </section>
        <div className="grid" key={`g${version}`}>
          {results.products.map((p, i) => (
            <ProductCard key={p.product_id} product={p} index={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <p className="kicker dark">Shop Campus Customs</p>
          <h1 className="display">All Yale gear</h1>
          {!loading && !error && (
            <p className="muted result-count" aria-live="polite">
              {visible.length === products.length
                ? `${products.length} products`
                : `${visible.length} of ${products.length} products`}
            </p>
          )}
        </div>
        <div className="search-wrap">
          <input
            ref={searchRef}
            className="search"
            type="search"
            placeholder="Search hoodies, colleges, sports…  ( / )"
            aria-label="Search products"
            value={q}
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>
      </div>

      <div className="filters" role="group" aria-label="Filter products">
        <div className="filter-chips">
          <button className={`fchip${!filters.category ? ' on' : ''}`} onClick={() => update({ category: null })}>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`fchip${filters.category === c.id ? ' on' : ''}`}
              onClick={() => update({ category: filters.category === c.id ? null : c.id })}
              disabled={!counts[c.id] && filters.category !== c.id}
            >
              {c.label} <span className="count">{counts[c.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="filter-row">
          <select aria-label="Color" value={filters.color ?? ''} onChange={(e) => update({ color: (e.target.value as ColorFamily) || null })}>
            <option value="">Any color</option>
            {COLOR_FAMILIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Size in stock" value={filters.size ?? ''} onChange={(e) => update({ size: e.target.value || null })}>
            <option value="">Any size</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                Size {s} in stock
              </option>
            ))}
          </select>
          <select
            aria-label="Maximum price"
            value={filters.maxPrice ?? ''}
            onChange={(e) => update({ maxPrice: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Any price</option>
            {PRICES.map((p) => (
              <option key={p} value={p}>
                Under ${p}
              </option>
            ))}
          </select>
          <label className="toggle">
            <input type="checkbox" checked={filters.inStock} onChange={(e) => update({ inStock: e.target.checked })} />
            In stock only
          </label>
          <select aria-label="Sort" className="sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {active && (
            <button className="link-button" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {loading && <p>Loading products…</p>}
      {error && <p className="error">Couldn't load products ({error}). Is the backend running?</p>}
      {!loading && !error && visible.length === 0 && (
        <div className="empty">
          <h2>No products match those filters</h2>
          <p className="muted">Try removing a filter, or ask the assistant in the chat for help.</p>
          <button className="button ghost" onClick={clearAll}>
            Clear all filters
          </button>
        </div>
      )}
      <div className="grid">
        {visible.map((p, i) => (
          <ProductCard key={p.product_id} product={p} index={i} />
        ))}
      </div>
    </div>
  )
}
