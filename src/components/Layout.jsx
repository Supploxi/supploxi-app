// Supploxi Layout — Sidebar navigation + main content area

import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useColors, Icons } from './UI'
import useIsMobile from '../hooks/useIsMobile'

const NAV = [
  { section: 'MAIN' },
  { label: 'Dashboard', path: '/', icon: 'LayoutDashboard', perm: 'dashboard' },
  { label: 'Orders', path: '/orders', icon: 'ShoppingCart', perm: 'orders' },

  { section: 'OPERATIONS' },
  { label: 'Purchase Orders', path: '/purchase-orders', icon: 'ClipboardList', perm: 'purchase_orders' },
  { label: 'Suppliers', path: '/suppliers', icon: 'Users', perm: 'suppliers' },
  { label: 'Products', path: '/products', icon: 'Package', perm: 'products' },
  { label: 'Inventory', path: '/inventory', icon: 'Warehouse', perm: 'inventory' },
  { label: 'Shipments', path: '/shipments', icon: 'Truck', perm: 'shipments' },

  { section: 'FINANCE' },
  { label: 'Financials', path: '/financials', icon: 'DollarSign', perm: 'financials' },
  { label: 'Subscription', path: '/subscription', icon: 'CreditCard', perm: 'subscription' },

  { section: 'SETTINGS' },
  { label: 'Settings', path: '/settings', icon: 'Settings', perm: 'settings' },
]

export default function Layout({ children }) {
  const { user, profile, role, hasAccess, signOut, subscriptionPlan, subscriptionStatus, trialDaysRemaining } = useAuth()
  const { theme, toggle } = useTheme()
  const c = useColors()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const trialDays = trialDaysRemaining()

  function handleNav() {
    if (isMobile) setSidebarOpen(false)
  }

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  const planLabel = {
    trial: 'Trial',
    starter: 'Starter',
    growth: 'Growth',
    scale: 'Scale',
  }

  return (
    <div className="sp-app">
      {/* Mobile hamburger */}
      {isMobile && (
        <button className="sp-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <Icons.X size={20} /> : <Icons.Menu size={20} />}
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && (
        <div
          className={`sp-overlay ${sidebarOpen ? 'sp-overlay-visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sp-sidebar ${sidebarOpen ? 'sp-sidebar-open' : ''}`}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #00d4aa 0%, #00a886 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, color: '#0a0c14',
          }}>
            S
          </div>
          <div>
            <span style={{ color: c.text, fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>Supploxi</span>
            {subscriptionPlan && (
              <span style={{
                display: 'block', fontSize: 10, fontWeight: 600,
                color: subscriptionStatus === 'trial' ? c.warning : c.accent,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {planLabel[subscriptionPlan] || subscriptionPlan}
              </span>
            )}
          </div>
        </div>

        {/* Trial warning */}
        {subscriptionStatus === 'trial' && trialDays !== null && (
          <div style={{
            margin: '8px 12px', padding: '8px 12px', borderRadius: 8,
            background: c.warningMuted, fontSize: 12, color: c.warning, fontWeight: 500,
          }}>
            <strong>{trialDays}</strong> day{trialDays !== 1 ? 's' : ''} left in trial
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV.map((item, i) => {
            if (item.section) {
              return (
                <div key={i} className="sp-nav-section" style={{ marginTop: i > 0 ? 12 : 0 }}>
                  {item.section}
                </div>
              )
            }

            if (!hasAccess(item.perm)) return null

            const IconComponent = Icons[item.icon]
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={handleNav}
                className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}
              >
                {IconComponent && <IconComponent size={18} />}
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${c.border}` }}>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="sp-nav-item"
            style={{ marginBottom: 4 }}
          >
            {theme === 'dark' ? <Icons.Sun size={16} /> : <Icons.Moon size={16} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* User info */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="sp-nav-item"
              style={{ padding: '8px 12px' }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: c.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: c.accent, fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
                </div>
                <div style={{ fontSize: 11, color: c.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {role === 'admin' ? 'Admin' : role === 'operator' ? 'Operator' : 'Viewer'}
                </div>
              </div>
              <Icons.ChevronsUpDown size={14} style={{ color: c.textMuted, flexShrink: 0 }} />
            </button>

            {/* User dropdown */}
            {userMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setUserMenuOpen(false)} />
                <div style={{
                  position: 'absolute', bottom: '100%', left: 8, right: 8, marginBottom: 4,
                  background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8,
                  boxShadow: `0 8px 24px ${c.shadow}`, overflow: 'hidden', zIndex: 150,
                  animation: 'scaleIn 0.1s ease',
                }}>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/settings') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '10px 14px', background: 'none', border: 'none',
                      color: c.textSecondary, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = c.surfaceHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Icons.Settings size={14} /> Settings
                  </button>
                  <div style={{ height: 1, background: c.border }} />
                  <button
                    onClick={handleSignOut}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '10px 14px', background: 'none', border: 'none',
                      color: c.danger, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = c.dangerMuted}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Icons.LogOut size={14} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="sp-main">
        <div className="sp-main-content">
          {children}
        </div>
      </main>
    </div>
  )
}
