import { Link } from 'react-router-dom'
import { openDan } from '../chatControl'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src="/brand/y-logo.png" alt="" />
          <p className="footer-title">Campus Customs</p>
          <p>Officially licensed Yale apparel, on Broadway since 1975.</p>
        </div>
        <div>
          <p className="footer-head">Shop</p>
          <Link to="/products?cat=hoodie">Hoodies</Link>
          <Link to="/products?cat=crewneck">Crewnecks</Link>
          <Link to="/products?cat=tshirt">T-shirts</Link>
          <Link to="/products?cat=quarterzip">Quarter-zips</Link>
          <Link to="/products?cat=jacket">Jackets &amp; fleece</Link>
        </div>
        <div>
          <p className="footer-head">Campus Customs</p>
          <Link to="/about">About us</Link>
          <Link to="/create-account">Create an account</Link>
          <Link to="/login">Log in</Link>
          <button className="footer-link" onClick={() => openDan()}>
            Chat with Dan
          </button>
        </div>
        <div>
          <p className="footer-head">Visit</p>
          <p>
            57 Broadway
            <br />
            New Haven, CT 06511
          </p>
          <p className="footer-note">Right across from campus.</p>
        </div>
      </div>
      <div className="footer-base">
        <span>© {new Date().getFullYear()} Campus Customs · Yale Bulldog Blue</span>
        <span>Boola Boola</span>
      </div>
    </footer>
  )
}
