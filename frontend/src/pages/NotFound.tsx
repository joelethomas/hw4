import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="page-hero compact">
      <p className="kicker">404</p>
      <h1 className="page-hero-title">This page ran off the field.</h1>
      <p className="hero-sub">
        <Link to="/" className="button light">
          Head back home
        </Link>
      </p>
    </section>
  )
}
