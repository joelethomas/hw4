import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../authContext'
import Marquee from '../motion/Marquee'

const mainLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Shop' },
  { to: '/about', label: 'About Us' },
]

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link active' : 'nav-link')

const ANNOUNCEMENTS = [
  'Officially licensed Yale merchandise',
  'On Broadway since 1975',
  'Visit us at 57 Broadway, New Haven',
  'Gear for all 14 residential colleges',
  'Questions? Ask Dan, our bulldog, anytime',
]

export default function NavBar() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)

  // Over the Home hero the bar is transparent; it turns solid once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const overHero = pathname === '/' && !scrolled

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <div className={`site-header${overHero ? ' over-hero' : ''}${scrolled ? ' scrolled' : ''}`}>
      <Marquee items={ANNOUNCEMENTS} className="announcement" />
      <header className="navbar">
        <Link to="/" className="brand" aria-label="Campus Customs home">
          <img src="/brand/y-logo.png" alt="" className="brand-mark" />
          <span className="brand-text">
            <span className="brand-name">Campus Customs</span>
            <span className="brand-sub">Yale Bulldog Blue</span>
          </span>
        </Link>
        <nav>
          {mainLinks.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              {label}
            </NavLink>
          ))}
          <span className="nav-divider" aria-hidden />
          {!loading && user && (
            <>
              <span className="nav-user">Hi, {user.first_name}</span>
              <button className="nav-link nav-button" onClick={handleLogout}>
                Log Out
              </button>
            </>
          )}
          {!loading && !user && (
            <>
              <NavLink to="/login" className={linkClass}>
                Log In
              </NavLink>
              <NavLink to="/create-account" className={({ isActive }) => `nav-cta${isActive ? ' active' : ''}`}>
                Create Account
              </NavLink>
            </>
          )}
        </nav>
      </header>
    </div>
  )
}
