import { useState, useEffect, useCallback } from 'react'
import { useColors, Card, SectionTitle, Btn, Field, Select, Textarea, Tabs, Badge, Modal, Alert, Checkbox, Icons, Loading, formatDate } from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import useIsMobile from '../hooks/useIsMobile'
import { testShopifyConnection } from '../lib/shopify'

// ─── Constants ──────────────────────────────────────────────────

const TAB_GENERAL = 'general'
const TAB_ACCOUNT = 'account'
const TAB_TEAM = 'team'
const TAB_GATEWAY = 'gateway'
const TAB_INTEGRATIONS = 'integrations'

const ALL_TABS = [
  { value: TAB_GENERAL, label: 'General' },
  { value: TAB_ACCOUNT, label: 'Account' },
  { value: TAB_TEAM, label: 'Team' },
  { value: TAB_GATEWAY, label: 'Payment Gateways' },
  { value: TAB_INTEGRATIONS, label: 'Integrations' },
]

const PERMISSION_MODULES = [
  { key: 'dashboard',       label: 'Dashboard' },
  { key: 'orders',          label: 'Orders' },
  { key: 'purchase_orders', label: 'Purchase Orders' },
  { key: 'suppliers',       label: 'Suppliers' },
  { key: 'products',        label: 'Products' },
  { key: 'inventory',       label: 'Inventory' },
  { key: 'shipments',       label: 'Shipments' },
  { key: 'financials',      label: 'Financials' },
  { key: 'settings',        label: 'Settings' },
]

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York',    label: 'Eastern (ET)' },
  { value: 'America/Chicago',     label: 'Central (CT)' },
  { value: 'America/Denver',      label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HST)' },
  { value: 'UTC',                 label: 'UTC' },
]

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
]

// ─── SecretField (show/hide password) ──────────────────────────

function SecretField({ label, value, onChange, placeholder, disabled }) {
  const [show, setShow] = useState(false)
  const c = useColors()
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label style={{ display: 'block', color: c.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1, background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 8,
            padding: '8px 12px', color: c.text, fontSize: 13, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box', opacity: disabled ? 0.5 : 1,
          }}
          onFocus={e => { e.target.style.borderColor = c.accent }}
          onBlur={e => { e.target.style.borderColor = c.border }}
        />
        <button
          onClick={() => setShow(s => !s)}
          style={{
            background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8,
            padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            color: c.textSecondary, flexShrink: 0, fontFamily: 'inherit',
          }}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}

// ─── Coming Soon Card ─────────────────────────────────────────

function ComingSoonCard({ title, description }) {
  const c = useColors()
  return (
    <div style={{
      background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12,
      padding: '20px 24px', opacity: 0.6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: c.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</div>
          <div style={{ color: c.textMuted, fontSize: 12 }}>{description}</div>
        </div>
        <Badge variant="default">Coming Soon</Badge>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export default function Settings() {
  const { user, profile, role, isViewer } = useAuth()
  const c = useColors()
  const isMobile = useIsMobile()

  const isAdmin = role === 'admin'

  // ─── State ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(TAB_GENERAL)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Settings data (loaded from supabase 'settings' table as key-value JSON)
  const [shopify, setShopify] = useState({ shop_url: '', access_token: '' })
  const [gatewayFees, setGatewayFees] = useState({
    shopify_payments: '', paypal: '', credit_card: '', manual: '',
  })
  const [general, setGeneral] = useState({
    company_name: '', default_currency: 'USD', timezone: 'America/New_York',
  })

  // Account / Profile
  const [profileForm, setProfileForm] = useState({
    full_name: '', timezone: 'America/New_York',
  })
  const [profileSaving, setProfileSaving] = useState(false)

  // Integrations
  const [testingShopify, setTestingShopify] = useState(false)
  const [shopifyResult, setShopifyResult] = useState(null)

  // Team
  const [teamMembers, setTeamMembers] = useState([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [invitations, setInvitations] = useState([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('operator')
  const [invitePerms, setInvitePerms] = useState(PERMISSION_MODULES.map(m => m.key))
  const [inviting, setInviting] = useState(false)

  // ─── Load settings on mount ──────────────────────────────────
  useEffect(() => { loadAllSettings() }, [])

  async function loadAllSettings() {
    setLoading(true)
    try {
      const { data } = await supabase.from('settings').select('*')
      const map = {}
      ;(data || []).forEach(r => { map[r.key] = r.value })

      if (map.shopify) {
        try { setShopify(typeof map.shopify === 'string' ? JSON.parse(map.shopify) : map.shopify) } catch {}
      }
      if (map.gateway_fees) {
        try { setGatewayFees(typeof map.gateway_fees === 'string' ? JSON.parse(map.gateway_fees) : map.gateway_fees) } catch {}
      }
      if (map.general) {
        try { setGeneral(typeof map.general === 'string' ? JSON.parse(map.general) : map.general) } catch {}
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }

    // Initialize profile form
    setProfileForm({
      full_name: profile?.full_name || '',
      timezone: profile?.timezone || general?.timezone || 'America/New_York',
    })

    setLoading(false)
  }

  async function saveProfile() {
    setProfileSaving(true)
    setError('')
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name.trim(),
          timezone: profileForm.timezone,
        })
        .eq('user_id', user?.id)
      if (err) throw err
      flash('Profile updated successfully.')
    } catch (e) {
      setError('Failed to update profile: ' + (e.message || 'Unknown error'))
    }
    setProfileSaving(false)
  }

  // ─── Save helpers ─────────────────────────────────────────────

  function flash(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function saveSetting(key, value) {
    if (isViewer) return
    setSaving(true)
    setError('')
    try {
      const { error: err } = await supabase
        .from('settings')
        .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' })
      if (err) throw err
      flash('Settings saved successfully.')
    } catch (e) {
      setError('Failed to save: ' + (e.message || 'Unknown error'))
    }
    setSaving(false)
  }

  // ─── Test Shopify connection ──────────────────────────────────

  async function handleTestShopify() {
    setTestingShopify(true)
    setError('')
    setShopifyResult(null)
    try {
      const result = await testShopifyConnection({
        shop: shopify.shop_url,
        accessToken: shopify.access_token,
      })
      setShopifyResult(result)
      flash('Shopify connection successful: ' + (result.name || result.domain || 'OK'))
    } catch (e) {
      setError('Shopify connection failed: ' + e.message)
    }
    setTestingShopify(false)
  }

  // ─── Team management ─────────────────────────────────────────

  const loadTeam = useCallback(async () => {
    if (!isAdmin) return
    setTeamLoading(true)
    try {
      // Load team members (operators and viewers under same org)
      const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'operator', 'viewer'])
        .order('created_at')
      setTeamMembers(members || [])

      // Load pending invitations
      const { data: invites } = await supabase
        .from('invitations')
        .select('*')
        .eq('accepted', false)
        .order('created_at', { ascending: false })
      setInvitations(invites || [])
    } catch (e) {
      console.error('Failed to load team:', e)
    }
    setTeamLoading(false)
  }, [isAdmin])

  useEffect(() => {
    if (activeTab === TAB_TEAM && isAdmin) loadTeam()
  }, [activeTab, isAdmin, loadTeam])

  function toggleInvitePerm(key) {
    setInvitePerms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 48; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
  }

  async function handleInvite() {
    if (isViewer || !isAdmin) return
    if (!inviteEmail.trim()) { setError('Email is required.'); return }
    setInviting(true)
    setError('')
    try {
      const token = generateToken()

      const { error: err } = await supabase.from('invitations').insert({
        user_id: user?.id,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        token,
        accepted: false,
      })
      if (err) throw err

      flash('Invitation created successfully.')
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('operator')
      setInvitePerms(PERMISSION_MODULES.map(m => m.key))
      await loadTeam()
    } catch (e) {
      setError('Failed to create invitation: ' + (e.message || 'Unknown error'))
    }
    setInviting(false)
  }

  async function resendInvitation(inv) {
    if (isViewer || !isAdmin) return
    setError('')
    try {
      const newToken = generateToken()
      const { error: err } = await supabase
        .from('invitations')
        .update({ token: newToken })
        .eq('id', inv.id)
      if (err) throw err
      flash('Invitation resent with new token.')
      await loadTeam()
    } catch (e) {
      setError('Failed to resend invitation: ' + (e.message || 'Unknown error'))
    }
  }

  async function revokeInvitation(inv) {
    if (isViewer || !isAdmin) return
    setError('')
    try {
      const { error: err } = await supabase
        .from('invitations')
        .delete()
        .eq('id', inv.id)
      if (err) throw err
      flash('Invitation revoked.')
      await loadTeam()
    } catch (e) {
      setError('Failed to revoke invitation: ' + (e.message || 'Unknown error'))
    }
  }

  // ─── Loading state ───────────────────────────────────────────

  if (loading) return <Loading text="Loading settings..." />

  // ─── Determine visible tabs ──────────────────────────────────

  const visibleTabs = isAdmin
    ? ALL_TABS
    : ALL_TABS.filter(t => t.value !== TAB_TEAM)

  // ─── General Tab ──────────────────────────────────────────────

  function renderGeneral() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <SectionTitle>Company Details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Field
              label="Company Name"
              value={general.company_name}
              onChange={v => setGeneral(g => ({ ...g, company_name: v }))}
              placeholder="Your Company LLC"
              disabled={isViewer}
              readOnly={isViewer}
            />
            <Select
              label="Default Currency"
              value={general.default_currency}
              onChange={v => setGeneral(g => ({ ...g, default_currency: v }))}
              options={CURRENCY_OPTIONS}
              disabled={isViewer}
            />
            <Select
              label="Timezone"
              value={general.timezone}
              onChange={v => setGeneral(g => ({ ...g, timezone: v }))}
              options={TIMEZONE_OPTIONS}
              disabled={isViewer}
            />
            {!isViewer && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <Btn onClick={() => saveSetting('general', general)} loading={saving}>
                  Save General Settings
                </Btn>
              </div>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // ─── Account Tab ──────────────────────────────────────────────

  function renderAccount() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <SectionTitle>Profile</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Field
              label="Full Name"
              value={profileForm.full_name}
              onChange={v => setProfileForm(f => ({ ...f, full_name: v }))}
              placeholder="Your full name"
            />
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', color: c.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email
              </label>
              <div style={{
                padding: '8px 12px', fontSize: 13, borderRadius: 8,
                background: c.surfaceHover, border: `1px solid ${c.border}`,
                color: c.textSecondary, cursor: 'not-allowed',
              }}>
                {profile?.email || user?.email || '—'}
              </div>
            </div>
            <Select
              label="Timezone"
              value={profileForm.timezone}
              onChange={v => setProfileForm(f => ({ ...f, timezone: v }))}
              options={TIMEZONE_OPTIONS}
            />
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', color: c.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Role
              </label>
              <div style={{ color: c.text, fontSize: 13, textTransform: 'capitalize' }}>{role || '—'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Btn onClick={saveProfile} loading={profileSaving}>
                Save Changes
              </Btn>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // ─── Team Tab ─────────────────────────────────────────────────

  function renderTeam() {
    if (!isAdmin) {
      return <Alert variant="warning">Only administrators can manage team members.</Alert>
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Team members list */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ color: c.text, fontSize: 14, fontWeight: 700 }}>Team Members</div>
              <div style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
                Manage accounts and access permissions for your team.
              </div>
            </div>
            <Btn onClick={() => setShowInviteModal(true)}>Invite Member</Btn>
          </div>

          {teamLoading ? (
            <div style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Loading...</div>
          ) : teamMembers.length === 0 ? (
            <div style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>
              No team members found. Click "Invite Member" to add someone.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {teamMembers.map((m, idx) => {
                const isOwner = m.role === 'admin'
                return (
                  <div key={m.user_id || m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    borderTop: idx > 0 ? `1px solid ${c.border}` : 'none',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: isOwner ? c.successMuted : c.surfaceHover,
                      border: `1px solid ${isOwner ? c.success + '40' : c.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, color: isOwner ? c.success : c.textMuted, fontWeight: 700, flexShrink: 0,
                    }}>
                      {(m.full_name || m.email || '?')[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          color: c.text, fontSize: 13, fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {m.full_name || m.email}
                        </span>
                        {isOwner && <Badge variant="success">ADMIN</Badge>}
                        {m.role === 'operator' && <Badge variant="default">OPERATOR</Badge>}
                        {m.role === 'viewer' && <Badge variant="warning">VIEWER</Badge>}
                      </div>
                      <div style={{ color: c.textMuted, fontSize: 12, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.email}
                        {!isOwner && Array.isArray(m.permissions) && (
                          <span style={{ marginLeft: 8, opacity: 0.7 }}>
                            {m.permissions.length}/{PERMISSION_MODULES.length} modules
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <Card>
            <SectionTitle>Pending Invitations</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {invitations.map((inv, idx) => {
                return (
                  <div key={inv.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    borderTop: idx > 0 ? `1px solid ${c.border}` : 'none',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: c.surfaceHover, border: `1px solid ${c.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, color: c.textMuted, fontWeight: 700, flexShrink: 0,
                    }}>
                      {(inv.email || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          color: c.text, fontSize: 13, fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {inv.email}
                        </span>
                        {inv.role === 'operator' && <Badge variant="default">OPERATOR</Badge>}
                        {inv.role === 'viewer' && <Badge variant="warning">VIEWER</Badge>}
                        <Badge variant="info">PENDING</Badge>
                      </div>
                      <div style={{ color: c.textMuted, fontSize: 12, marginTop: 1 }}>
                        Invited {formatDate(inv.created_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Btn variant="secondary" size="sm" onClick={() => resendInvitation(inv)}>
                        Resend
                      </Btn>
                      <Btn variant="danger" size="sm" onClick={() => revokeInvitation(inv)}>
                        Revoke
                      </Btn>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Invite Modal */}
        <Modal
          open={showInviteModal}
          onClose={() => { setShowInviteModal(false); setError('') }}
          title="Invite Team Member"
          width={560}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Field
              label="Email Address"
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder="colleague@company.com"
              required
            />
            <Select
              label="Role"
              value={inviteRole}
              onChange={setInviteRole}
              options={[
                { value: 'operator', label: 'Operator -- can create and edit data' },
                { value: 'viewer', label: 'Viewer -- read-only access' },
              ]}
            />

            <div style={{ marginTop: 8 }}>
              <label style={{
                display: 'block', color: c.textSecondary, fontSize: 12, fontWeight: 600,
                marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Module Permissions
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 8,
              }}>
                {PERMISSION_MODULES.map(m => (
                  <Checkbox
                    key={m.key}
                    label={m.label}
                    checked={invitePerms.includes(m.key)}
                    onChange={() => toggleInvitePerm(m.key)}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button
                  onClick={() => setInvitePerms(PERMISSION_MODULES.map(m => m.key))}
                  style={{
                    background: 'none', border: 'none', color: c.accent, fontSize: 11,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                  }}
                >
                  Select All
                </button>
                <span style={{ color: c.textMuted, fontSize: 11 }}>|</span>
                <button
                  onClick={() => setInvitePerms([])}
                  style={{
                    background: 'none', border: 'none', color: c.accent, fontSize: 11,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {error && <Alert variant="danger" style={{ marginTop: 12 }}>{error}</Alert>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Btn variant="secondary" onClick={() => { setShowInviteModal(false); setError('') }}>
                Cancel
              </Btn>
              <Btn onClick={handleInvite} loading={inviting} disabled={!inviteEmail.trim()}>
                Send Invitation
              </Btn>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // ─── Gateway Fees Tab ─────────────────────────────────────────

  function renderGatewayFees() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <SectionTitle>Payment Processing Fees</SectionTitle>
          <div style={{
            background: c.infoMuted, border: `1px solid ${c.info}30`, borderRadius: 8,
            padding: '10px 12px', fontSize: 12, color: c.textSecondary, marginBottom: 16, lineHeight: 1.5,
          }}>
            Configure the percentage fee charged by each payment gateway. These rates are used
            to calculate net revenue and accurate profit margins on your orders.
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 12,
          }}>
            <Field
              label="Shopify Payments %"
              value={gatewayFees.shopify_payments}
              onChange={v => setGatewayFees(g => ({ ...g, shopify_payments: v }))}
              type="number"
              placeholder="2.9"
              min="0"
              max="100"
              step="0.01"
              disabled={isViewer}
              readOnly={isViewer}
            />
            <Field
              label="PayPal %"
              value={gatewayFees.paypal}
              onChange={v => setGatewayFees(g => ({ ...g, paypal: v }))}
              type="number"
              placeholder="3.49"
              min="0"
              max="100"
              step="0.01"
              disabled={isViewer}
              readOnly={isViewer}
            />
            <Field
              label="Credit Card %"
              value={gatewayFees.credit_card}
              onChange={v => setGatewayFees(g => ({ ...g, credit_card: v }))}
              type="number"
              placeholder="2.9"
              min="0"
              max="100"
              step="0.01"
              disabled={isViewer}
              readOnly={isViewer}
            />
            <Field
              label="Manual / Other %"
              value={gatewayFees.manual}
              onChange={v => setGatewayFees(g => ({ ...g, manual: v }))}
              type="number"
              placeholder="0"
              min="0"
              max="100"
              step="0.01"
              disabled={isViewer}
              readOnly={isViewer}
            />
          </div>
          {!isViewer && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Btn onClick={() => saveSetting('gateway_fees', gatewayFees)} loading={saving}>
                Save Gateway Fees
              </Btn>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // ─── Integrations Tab ────────────────────────────────────────

  function renderIntegrations() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Shopify */}
        <Card>
          <SectionTitle>Shopify</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{
              background: c.infoMuted, border: `1px solid ${c.info}30`, borderRadius: 8,
              padding: '10px 12px', fontSize: 12, color: c.textSecondary, marginBottom: 12, lineHeight: 1.5,
            }}>
              Connect your Shopify store to sync orders, products, and inventory automatically.
              You will need a custom app with read/write access to orders and products.
            </div>
            <Field
              label="Shop URL"
              value={shopify.shop_url}
              onChange={v => setShopify(s => ({ ...s, shop_url: v }))}
              placeholder="your-store.myshopify.com"
              disabled={isViewer}
              readOnly={isViewer}
            />
            <SecretField
              label="Access Token"
              value={shopify.access_token}
              onChange={v => setShopify(s => ({ ...s, access_token: v }))}
              placeholder="shpat_..."
              disabled={isViewer}
            />
            {shopifyResult && (
              <div style={{
                background: c.successMuted, border: `1px solid ${c.success}30`, borderRadius: 8,
                padding: '10px 12px', fontSize: 12, color: c.success, marginBottom: 12,
              }}>
                Connected to: {shopifyResult.name || shopifyResult.domain || 'Shopify store'}
                {shopifyResult.plan_name && ` (${shopifyResult.plan_name})`}
              </div>
            )}
            {!isViewer && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Btn
                  variant="outline"
                  onClick={handleTestShopify}
                  loading={testingShopify}
                  disabled={!shopify.shop_url || !shopify.access_token}
                >
                  Test Connection
                </Btn>
                <Btn
                  onClick={() => saveSetting('shopify', shopify)}
                  loading={saving}
                  disabled={!shopify.shop_url || !shopify.access_token}
                >
                  Save
                </Btn>
              </div>
            )}
          </div>
        </Card>

        {/* Coming Soon platforms */}
        <ComingSoonCard title="BigCommerce" description="Sync orders and products from your BigCommerce store." />
        <ComingSoonCard title="WooCommerce" description="Connect your WooCommerce store for order and inventory sync." />
        <ComingSoonCard title="Squarespace" description="Import orders and products from Squarespace Commerce." />
        <ComingSoonCard title="Wix" description="Sync your Wix e-commerce store with Supploxi." />

        {/* Help text */}
        <div style={{
          textAlign: 'center', padding: '16px 0', fontSize: 13, color: c.textMuted,
        }}>
          Need help integrating your platform? Contact us at{' '}
          <a href="mailto:support@supploxi.com" style={{ color: c.accent, fontWeight: 600 }}>
            support@supploxi.com
          </a>
        </div>
      </div>
    )
  }

  // ─── Tab content router ───────────────────────────────────────

  function renderActiveTab() {
    switch (activeTab) {
      case TAB_GENERAL:      return renderGeneral()
      case TAB_ACCOUNT:      return renderAccount()
      case TAB_TEAM:         return renderTeam()
      case TAB_GATEWAY:      return renderGatewayFees()
      case TAB_INTEGRATIONS: return renderIntegrations()
      default:               return null
    }
  }

  // ─── Main render ──────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ color: c.text, fontSize: 22, fontWeight: 700, margin: 0 }}>Settings</h1>

      {success && <Alert variant="success" onClose={() => setSuccess('')}>{success}</Alert>}
      {error && activeTab !== TAB_TEAM && <Alert variant="danger" onClose={() => setError('')}>{error}</Alert>}

      <Tabs
        tabs={visibleTabs}
        active={activeTab}
        onChange={tab => { setActiveTab(tab); setError(''); setSuccess('') }}
      />

      {renderActiveTab()}
    </div>
  )
}
