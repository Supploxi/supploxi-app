// Supploxi — Login / Sign Up Page

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useColors, Btn, Field, Alert, Icons } from '../components/UI'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const c = useColors()

  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const from = location.state?.from?.pathname || '/'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        await signUp(email, password)
        setSuccess('Account created! Check your email to confirm.')
        setMode('login')
      } else {
        await signIn(email, password)
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: c.bg, padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: c.surface,
        border: `1px solid ${c.border}`, borderRadius: 16, padding: 32,
        boxShadow: `0 8px 32px ${c.shadow}`,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #00d4aa 0%, #00a886 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 22, color: '#0a0c14',
          }}>
            S
          </div>
          <h1 style={{ color: c.text, fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Supploxi
          </h1>
          <p style={{ color: c.textSecondary, fontSize: 13, margin: '4px 0 0' }}>
            Supply Chain Management
          </p>
        </div>

        {/* Tab toggle */}
        <div style={{
          display: 'flex', background: c.surfaceHover, borderRadius: 8,
          padding: 3, marginBottom: 20, gap: 2,
        }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                background: mode === m ? c.surface : 'transparent',
                color: mode === m ? c.text : c.textSecondary,
                border: 'none', borderRadius: 6, cursor: 'pointer',
                boxShadow: mode === m ? `0 1px 3px ${c.shadow}` : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {error && <Alert variant="danger" style={{ marginBottom: 16 }}>{error}</Alert>}
        {success && <Alert variant="success" style={{ marginBottom: 16 }}>{success}</Alert>}

        <form onSubmit={handleSubmit}>
          <Field label="Email" type="email" value={email} onChange={setEmail}
            placeholder="you@company.com" required />
          <Field label="Password" type="password" value={password} onChange={setPassword}
            placeholder="Enter your password" required />

          <Btn type="submit" variant="primary" loading={loading}
            style={{ width: '100%', marginTop: 8, padding: '10px 0', fontSize: 14 }}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Btn>
        </form>

        {mode === 'signup' && (
          <p style={{ color: c.textMuted, fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
            By creating an account you agree to our Terms of Service.
            You'll start with a free 14-day trial.
          </p>
        )}
      </div>
    </div>
  )
}
