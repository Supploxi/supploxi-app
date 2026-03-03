// Supploxi — Invite Acceptance Page
// Accessed via /invite/:token — allows invited users to create an account and join a team

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useColors, Btn, Field, Alert, Icons, Loading } from '../components/UI'
import { supabase } from '../lib/supabase'

export default function Invite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const c = useColors()

  const [invitation, setInvitation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadInvitation()
  }, [token])

  async function loadInvitation() {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .single()

      if (err || !data) {
        setError('Invalid invitation link.')
        setLoading(false)
        return
      }

      if (data.accepted) {
        setError('This invitation has already been accepted.')
        setLoading(false)
        return
      }

      if (new Date(data.expires_at) < new Date()) {
        setError('This invitation has expired. Please ask your admin to send a new one.')
        setLoading(false)
        return
      }

      setInvitation(data)
      setEmail(data.email)
    } catch {
      setError('Failed to load invitation.')
    }
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!invitation) return
    setError('')
    setSubmitting(true)

    try {
      // 1. Create account
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: invitation.email,
        password,
      })

      if (authErr) throw authErr

      const userId = authData.user?.id
      if (!userId) throw new Error('Account creation failed')

      // 2. Create profile with invited role and permissions
      const { error: profileErr } = await supabase.from('profiles').insert({
        user_id: userId,
        email: invitation.email,
        full_name: fullName || invitation.email.split('@')[0],
        role: invitation.role || 'operator',
        permissions: invitation.permissions || ['dashboard', 'orders'],
        subscription_plan: 'starter',
        subscription_status: 'active',
      })

      if (profileErr) throw profileErr

      // 3. Mark invitation as accepted
      await supabase
        .from('invitations')
        .update({ accepted: true })
        .eq('id', invitation.id)

      setSuccess('Account created successfully! Redirecting...')
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setError(err.message || 'Failed to create account')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
        <Loading text="Loading invitation..." />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: c.bg, padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: c.surface,
        border: `1px solid ${c.border}`, borderRadius: 16, padding: 32,
        boxShadow: `0 8px 32px ${c.shadow}`,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #00d4aa 0%, #00a886 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 22, color: '#0a0c14',
          }}>
            S
          </div>
          <h1 style={{ color: c.text, fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Join Supploxi
          </h1>
          <p style={{ color: c.textSecondary, fontSize: 13, margin: '4px 0 0' }}>
            You've been invited to join a team
          </p>
        </div>

        {error && !invitation && (
          <div>
            <Alert variant="danger" style={{ marginBottom: 16 }}>{error}</Alert>
            <Btn variant="secondary" onClick={() => navigate('/login')} style={{ width: '100%' }}>
              Go to Login
            </Btn>
          </div>
        )}

        {invitation && (
          <>
            {/* Invitation details */}
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 20,
              background: c.accentMuted, border: `1px solid ${c.accent}20`,
            }}>
              <p style={{ color: c.textSecondary, fontSize: 12, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Invited as
              </p>
              <p style={{ color: c.text, fontSize: 14, fontWeight: 600, margin: 0, textTransform: 'capitalize' }}>
                {invitation.role || 'Team Member'}
              </p>
            </div>

            {error && <Alert variant="danger" style={{ marginBottom: 16 }}>{error}</Alert>}
            {success && <Alert variant="success" style={{ marginBottom: 16 }}>{success}</Alert>}

            <form onSubmit={handleSubmit}>
              <Field label="Email" type="email" value={email} readOnly disabled
                style={{ opacity: 0.7 }} />
              <Field label="Full Name" value={fullName} onChange={setFullName}
                placeholder="Your full name" />
              <Field label="Password" type="password" value={password} onChange={setPassword}
                placeholder="Create a password (min 6 chars)" required />

              <Btn type="submit" variant="primary" loading={submitting}
                style={{ width: '100%', marginTop: 8, padding: '10px 0', fontSize: 14 }}>
                Create Account
              </Btn>
            </form>

            <p style={{ color: c.textMuted, fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
              Already have an account?{' '}
              <span onClick={() => navigate('/login')}
                style={{ color: c.accent, cursor: 'pointer', fontWeight: 600 }}>
                Sign in
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
