import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { openDan } from '../chatControl'
import Reveal from '../motion/Reveal'
import { useScrollProgress } from '../motion/useScrollProgress'

const img = (id: string) => `/media/products/${id}.jpg`

function Story({ image, flip, kicker, title, children }: {
  image: string
  flip?: boolean
  kicker: string
  title: string
  children: React.ReactNode
}) {
  const ref = useScrollProgress<HTMLElement>()
  return (
    <section className={`story${flip ? ' flip' : ''}`} ref={ref}>
      <div className="story-media">
        <img src={image} alt="" style={{ '--speed': -60 } as CSSProperties} loading="lazy" />
      </div>
      <Reveal variant={flip ? 'left' : 'right'} className="story-copy">
        <p className="kicker dark">{kicker}</p>
        <h2 className="display">{title}</h2>
        {children}
      </Reveal>
    </section>
  )
}

export default function About() {
  return (
    <>
      <section className="page-hero">
        <Reveal variant="fade">
          <p className="kicker">About Campus Customs</p>
        </Reveal>
        <h1 className="page-hero-title">
          <Reveal as="span" variant="mask" className="hero-line">
            A Yale shop,
          </Reveal>
          <Reveal as="span" variant="mask" delay={120} className="hero-line">
            right across from campus.
          </Reveal>
        </h1>
      </section>

      <Story image={img('yale-grandpa-crewneck')} kicker="Since 1975" title="It started with one storefront on Broadway.">
        <p>
          Campus Customs opened in 1975 as a Yale memorabilia shop directly across from campus, and we're still in
          that same spot at 57 Broadway. Generations of students, alumni, and families have walked through our door
          looking for something blue.
        </p>
        <p>We still run it the same way: officially licensed gear, honest advice, and real customer service.</p>
      </Story>

      <Story flip image={img('davenport-college-crewneck')} kicker="What we carry" title="From the Big Y to your college crest.">
        <p>
          Crewnecks, hoodies, quarter-zips, fleece, and tees, with designs for Yale athletics, all 14 residential
          colleges, and the graduate and professional schools. Some of our best sellers are classics that have
          been around for decades, and there's always something new on the shelf.
        </p>
        <Link to="/products" className="text-link">
          Browse the collection →
        </Link>
      </Story>

      <Story image={img('district-vit-crewneck-vintage-bulldog')} kicker="Why we do it" title="Wearing Yale blue is a way of saying where you belong.">
        <p>
          Your college, your team, your class year, or the kid you're cheering for. We want every Bulldog to find
          something that feels like theirs, whether that's in person on Broadway or online with a little help from
          Dan, our resident bulldog.
        </p>
        <button className="button" onClick={() => openDan()}>
          <img src="/brand/dan.png" alt="" className="btn-avatar" /> Ask Dan
        </button>
      </Story>

      <section className="visit">
        <Reveal variant="left" className="visit-copy">
          <p className="kicker">Visit us</p>
          <h2 className="display light">57 Broadway, New Haven, CT 06511.</h2>
          <p>Stop in, say hi, and try something on.</p>
        </Reveal>
        <Reveal variant="right" className="visit-art">
          <img src="/brand/y-logo.png" alt="" />
        </Reveal>
      </section>
    </>
  )
}
