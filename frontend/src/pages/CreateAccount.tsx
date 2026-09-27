import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../authContext'
import { meetsRequirements, passwordStrength, requirements } from '../passwordStrength'

export default function CreateAccount() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const strength = passwordStrength(password)
  const passwordOk = meetsRequirements(password)
  const matches = confirm.length > 0 && confirm === password
  const canSubmit = passwordOk && matches && !submitting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      await register({ first_name: firstName, last_name: lastName, email, password })
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
        <h1>Welcome, {user.first_name}!</h1>
        <p>
          You're signed in as <strong>{user.email}</strong>. <Link to="/products">Start shopping</Link>
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
      <h1 className="display">Create your account</h1>
      <div className="row">
        <label>
          First name
          <input
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </label>
        <label>
          Last name
          <input
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </label>
      </div>
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      <div className="strength" aria-live="polite">
        <div className="strength-bar">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={n <= strength.score ? `filled s${strength.score}` : undefined} />
          ))}
        </div>
        <span className="strength-label">
          Password Strength: <strong>{password ? strength.label : '—'}</strong>
        </span>
      </div>
      <ul className="requirements">
        {requirements.map((r) => (
          <li key={r.label} className={r.test(password) ? 'met' : undefined}>
            {r.test(password) ? '✓' : '○'} {r.label}
          </li>
        ))}
      </ul>

      <label>
        Confirm password
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </label>
      {confirm && (
        <p className={matches ? 'match' : 'error'}>
          {matches ? '✓ Passwords match' : 'Passwords do not match'}
        </p>
      )}

      {error && <p className="error">{error}</p>}
      <button type="submit" className="button" disabled={!canSubmit}>
        {submitting ? 'Creating account…' : 'Create Account'}
      </button>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
      </form>
    </div>
  )
}
