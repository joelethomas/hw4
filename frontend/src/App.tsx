import { useEffect } from 'react'
import { Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import ChatWidget from './components/ChatWidget'
import Footer from './components/Footer'
import NavBar from './components/NavBar'
import About from './pages/About'
import CreateAccount from './pages/CreateAccount'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import ProductDetail from './pages/ProductDetail'
import Products from './pages/Products'

export default function App() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  // A new page starts at the top; Back/Forward (POP) keeps the browser's own scroll restoration.
  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo({ top: 0 })
  }, [pathname, navigationType])

  return (
    <>
      <NavBar />
      <main className={`page${pathname === '/' ? ' page-home' : ''}`} key={pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <ChatWidget />
    </>
  )
}
