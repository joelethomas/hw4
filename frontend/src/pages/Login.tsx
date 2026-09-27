import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../authContext'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/products')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (user) {
    return (
      <div className="auth auth-solo">
        <h1>You're logged in</h1>
        <p>
          Signed in as <strong>{user.email}</strong>. <Link to="/products">Start shopping</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <img src="/brand/y-logo.png" alt="" />
        <p className="kicker">Campus Customs</p>
        <h2 className="display light">Save your chats with Dan and pick up where you left off.</h2>
      </aside>
      <form className="auth" onSubmit={handleSubmit}>
      <h1 className="display">Welcome back</h1>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="button" disabled={submitting}>
        {submitting ? 'Logging in…' : 'Log In'}
      </button>
      <p>
        New here? <Link to="/create-account">Create an account</Link>
      </p>
      </form>
    </div>
  )
}
