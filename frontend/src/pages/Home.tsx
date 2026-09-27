import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts, formatPrice, type ProductSummary } from '../api'
import { openDan } from '../chatControl'
import ProductCard from '../components/ProductCard'
import CountUp from '../motion/CountUp'
import Marquee from '../motion/Marquee'
import Reveal from '../motion/Reveal'
import { useScrollProgress } from '../motion/useScrollProgress'
import { categoryOf } from '../search'

const img = (id: string) => `/media/products/${id}.jpg`

// Hero collage: each photo drifts at its own speed as the page scrolls (--speed × --progress).
const COLLAGE = [
  { id: 'basic-hoodie-big-yale', speed: -120, className: 'c1' },
  { id: '2025-yale-vs-harvard-t-shirt', speed: -220, className: 'c2' },
  { id: 'district-vit-hoodie-vintage-bulldog', speed: -60, className: 'c3' },
  { id: 'davenport-college-crewneck', speed: -180, className: 'c4' },
]

const CATEGORIES = [
  { to: '/products?cat=hoodie', title: 'Hoodies', blurb: 'Big Y, vintage bulldogs, and every sport', image: img('champion-reverse-weave-hoodie-1') },
  { to: '/products?cat=crewneck', title: 'Crewnecks', blurb: 'The classic Yale sweatshirt, reimagined', image: img('baseball-left-chest-crewneck') },
  { to: '/products?q=college', title: 'Your college', blurb: 'Crests for all 14 residential colleges', image: img('benjamin-franklin-t-shirt') },
]

function Hero() {
  const ref = useScrollProgress<HTMLElement>()
  return (
    <section className="home-hero" ref={ref}>
      <img className="hero-watermark" src="/brand/y-logo.png" alt="" aria-hidden />
      <div className="hero-copy">
        <Reveal variant="fade" delay={50}>
          <p className="kicker">Campus Customs · 57 Broadway, New Haven</p>
        </Reveal>
        <h1 className="hero-title">
          {['Bulldog blue,', 'worn every', 'day since', '1975.'].map((line, i) => (
            <Reveal key={line} as="span" variant="mask" delay={120 + i * 110} className="hero-line">
              {line}
            </Reveal>
          ))}
        </h1>
        <Reveal variant="up" delay={620}>
          <p className="hero-sub">
            Officially licensed Yale apparel from the shop right across from campus. Hoodies, crewnecks, and tees
            for students, alumni, and every Bulldog in the family.
          </p>
        </Reveal>
        <Reveal variant="up" delay={760} className="hero-ctas">
          <Link to="/products" className="button light">
            Shop the collection
          </Link>
          <button className="button outline-light" onClick={() => openDan()}>
            <img src="/brand/dan.png" alt="" className="btn-avatar" /> Ask Dan
          </button>
        </Reveal>
      </div>
      <div className="hero-collage" aria-hidden>
        {COLLAGE.map((c) => (
          <div key={c.id} className={`collage-card ${c.className}`} style={{ '--speed': c.speed } as CSSProperties}>
            <img src={img(c.id)} alt="" />
          </div>
        ))}
      </div>
      <div className="scroll-cue" aria-hidden>
        <span />
      </div>
    </section>
  )
}

function PinnedGallery({ products }: { products: ProductSummary[] }) {
  const ref = useScrollProgress<HTMLElement>()
  return (
    <section className="pinned" ref={ref} aria-label="The collection">
      <div className="pinned-sticky">
        <div className="pinned-head">
          <p className="kicker dark">The collection</p>
          <h2 className="display">Something for every Bulldog.</h2>
          <Link to="/products" className="text-link">
            Browse all styles →
          </Link>
        </div>
        <div className="pinned-track">
          {products.map((p) => (
            <Link key={p.product_id} to={`/products/${p.product_id}`} className="pinned-card">
              <div className="pinned-media">
                <img src={p.image_url} alt={p.name} loading="lazy" />
              </div>
              <div className="pinned-meta">
                <span>{p.name}</span>
                <span className="price">{formatPrice(p.price)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function MeetDan() {
  const ref = useScrollProgress<HTMLElement>()
  return (
    <section className="meet-dan" ref={ref}>
      <div className="mask-frame">
        <img src={img('district-vit-hoodie-vintage-sailor-bulldog')} alt="" className="mask-img" />
      </div>
      <Reveal variant="up" className="dan-card">
        <img src="/brand/dan.png" alt="Dan the bulldog" className="dan-portrait" />
        <p className="kicker dark">Meet Dan</p>
        <h2 className="display">Our bulldog knows every shelf.</h2>
        <p>
          Ask Dan what's in stock in your size, what colors a hoodie comes in, or what to get for your residential
          college. He'll pull the right gear onto the page for you.
        </p>
        <button className="button" onClick={() => openDan()}>
          Chat with Dan
        </button>
      </Reveal>
    </section>
  )
}

export default function Home() {
  const [products, setProducts] = useState<ProductSummary[]>([])

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
  }, [])

  const inStock = useMemo(() => products.filter((p) => p.stock_status !== 'out_of_stock'), [products])
  // One of each kind first, so the gallery shows the range of the shop.
  const gallery = useMemo(() => {
    const seen = new Set<string>()
    const firsts = inStock.filter((p) => {
      const c = categoryOf(p)
      if (seen.has(c)) return false
      seen.add(c)
      return true
    })
    return [...firsts, ...inStock.filter((p) => !firsts.includes(p))].slice(0, 10)
  }, [inStock])
  const featured = useMemo(() => inStock.filter((p) => /bulldog|game|big yale/i.test(p.name)).slice(0, 4), [inStock])

  return (
    <>
      <Hero />

      <Marquee className="ticker" items={['Boola Boola', 'Bulldog Blue', 'For God, for Country, and for Yale', 'Since 1975', 'Beat Harvard']} />

      <section className="section">
        <Reveal className="section-head">
          <p className="kicker dark">Shop by category</p>
          <h2 className="display">Start with a classic.</h2>
        </Reveal>
        <div className="category-grid">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.title} delay={i * 120} variant="up">
              <Link to={c.to} className="category-card">
                <img src={c.image} alt="" loading="lazy" />
                <div className="category-overlay">
                  <h3>{c.title}</h3>
                  <p>{c.blurb}</p>
                  <span className="text-link light">Shop {c.title.toLowerCase()} →</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {gallery.length > 0 && <PinnedGallery products={gallery} />}

      <section className="stats">
        {[
          { n: 1975, label: 'Opened across from campus', plain: true },
          { n: products.length || 102, label: 'Styles on the shelf' },
          { n: 14, label: 'Residential colleges represented' },
          { n: 6, label: 'Sizes, XS to XXL' },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 100} className="stat">
            <span className="stat-number">{s.plain ? s.n : <CountUp to={s.n} />}</span>
            <span className="stat-label">{s.label}</span>
          </Reveal>
        ))}
      </section>

      <MeetDan />

      {featured.length > 0 && (
        <section className="section">
          <Reveal className="section-head row-head">
            <div>
              <p className="kicker dark">Fan favorites</p>
              <h2 className="display">Bulldog pride, front and center.</h2>
            </div>
            <Link to="/products" className="text-link">
              Shop everything →
            </Link>
          </Reveal>
          <div className="grid">
            {featured.map((p, i) => (
              <Reveal key={p.product_id} delay={i * 90}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="visit">
        <Reveal variant="left" className="visit-copy">
          <p className="kicker">Visit the shop</p>
          <h2 className="display light">57 Broadway, New Haven.</h2>
          <p>
            Right across from campus, where Campus Customs has been outfitting Yale since 1975. Stop in, try
            something on, and say hi.
          </p>
          <Link to="/about" className="button light">
            Our story
          </Link>
        </Reveal>
        <Reveal variant="right" className="visit-art">
          <img src="/brand/y-logo.png" alt="" />
        </Reveal>
      </section>
    </>
  )
}
