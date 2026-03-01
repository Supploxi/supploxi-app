// =============================================
// SUPPLOXI V2 — Layout Renderer
// Renders sidebar + navbar on all authenticated pages
// =============================================

window.initLayout = async (config = {}) => {
  const { page = '', title = '' } = config
  const user = await window.requireAuth()

  // Fetch unread notifications count
  const { data: notifs } = await window._sb
    .from('notifications')
    .select('id')
    .eq('user_id', user.id)
    .eq('read', false)
  const unreadCount = notifs?.length || 0

  // Navigation items grouped by section
  const navItems = [
    { id: 'dashboard', icon: '\u229E', label: 'Dashboard', href: '/dashboard.html', section: 'MENU' },
    { id: 'suppliers', icon: '\uD83C\uDFED', label: 'Suppliers', href: '/suppliers.html', section: 'MENU' },
    { id: 'purchase-orders', icon: '\uD83D\uDCCB', label: 'Purchase Orders', href: '/purchase-orders.html', section: 'MENU' },
    { id: 'shipments', icon: '\u2708\uFE0F', label: 'Shipments', href: '/shipments.html', section: 'MENU' },
    { id: 'products', icon: '\uD83D\uDCE6', label: 'Products', href: '/products.html', section: 'MENU' },
    { id: 'inventory', icon: '\uD83D\uDDC3\uFE0F', label: 'Inventory', href: '/inventory.html', section: 'MENU' },
    { id: 'financials', icon: '\uD83D\uDCB0', label: 'Financials', href: '/financials.html', section: 'FINANCE' },
    { id: 'tariffs', icon: '\uD83C\uDFDB\uFE0F', label: 'Tariff Tracker', href: '/tariffs.html', section: 'FINANCE' },
    { id: 'reports', icon: '\uD83D\uDCCA', label: 'Reports', href: '/reports.html', section: 'FINANCE' },
    { id: 'integrations', icon: '\uD83D\uDD17', label: 'Integrations', href: '/integrations.html', section: 'SETTINGS' },
    { id: 'settings', icon: '\u2699\uFE0F', label: 'Settings', href: '/settings.html', section: 'SETTINGS' },
  ]

  // Group items by section
  const sections = {}
  navItems.forEach(item => {
    if (!sections[item.section]) sections[item.section] = []
    sections[item.section].push(item)
  })

  // Build nav HTML
  let navHtml = ''
  Object.entries(sections).forEach(([section, items]) => {
    navHtml += `<div class="nav-section-title">${section}</div>`
    items.forEach(item => {
      navHtml += `<a href="${item.href}" class="nav-item ${page === item.id ? 'active' : ''}">
        <span>${item.icon}</span>
        <span>${item.label}</span>
      </a>`
    })
  })

  // User initials
  const initials = (user.email || 'U').substring(0, 2).toUpperCase()

  // Notification badge HTML
  const notifBadge = unreadCount > 0
    ? `<span class="notification-badge">${unreadCount > 9 ? '9+' : unreadCount}</span>`
    : ''

  // Inject sidebar + navbar into DOM
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <span class="logo-text"><span>S</span>upploxi</span>
      </div>
      <nav class="sidebar-nav">${navHtml}</nav>
      <div class="sidebar-footer">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--green-dim);border:1px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--green)">${initials}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${window.escapeHtml(user.email)}</div>
          </div>
          <button onclick="window.signOut()" title="Sign out" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px">\u21E5</button>
        </div>
      </div>
    </div>
    <header class="navbar">
      <span class="navbar-title">${window.escapeHtml(title)}</span>
      <div class="navbar-actions">
        <div class="notification-btn" onclick="window.location.href='/notifications.html'">
          \uD83D\uDD14
          ${notifBadge}
        </div>
        <div style="width:32px;height:32px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0a0c14;cursor:pointer">${initials}</div>
      </div>
    </header>
  `)
}
