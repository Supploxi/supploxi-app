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

  // SVG icons (16x16, stroke-based, currentColor)
  const icons = {
    dashboard: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="9.5" y="1.5" width="5" height="5" rx="1"/><rect x="1.5" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/></svg>',
    suppliers: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5.5 6.5h5M5.5 9.5h3"/></svg>',
    'purchase-orders': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 1.5h8a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 13V3A1.5 1.5 0 0 1 4 1.5z"/><path d="M5.5 5h5M5.5 8h5M5.5 11h3"/></svg>',
    shipments: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 10L8 2.5 14.5 10"/><path d="M4 8.5v5h8v-5"/></svg>',
    products: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4.5l6-3 6 3v7l-6 3-6-3z"/><path d="M2 4.5L8 7.5 14 4.5"/><path d="M8 7.5V14.5"/></svg>',
    inventory: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5h12v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5z"/><path d="M5.5 3.5V2"/><path d="M10.5 3.5V2"/><path d="M5.5 7.5h5"/><path d="M5.5 10.5h3"/></svg>',
    financials: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v7"/><path d="M6 6.5c0-.8.9-1.5 2-1.5s2 .7 2 1.5-.9 1.5-2 1.5-2 .7-2 1.5.9 1.5 2 1.5 2-.7 2-1.5"/></svg>',
    tariffs: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13.5h12"/><path d="M4 13.5V6.5"/><path d="M8 13.5V3.5"/><path d="M12 13.5V8.5"/></svg>',
    reports: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2.5v11h12"/><path d="M5 10.5l3-3 2 2 4-4"/></svg>',
    integrations: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="5" r="2.5"/><circle cx="11" cy="11" r="2.5"/><path d="M7 6.5l2 3"/></svg>',
    settings: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>',
  }

  // Navigation items grouped by section
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', href: '/dashboard.html', section: 'MENU' },
    { id: 'suppliers', label: 'Suppliers', href: '/suppliers.html', section: 'MENU' },
    { id: 'purchase-orders', label: 'Purchase Orders', href: '/purchase-orders.html', section: 'MENU' },
    { id: 'shipments', label: 'Shipments', href: '/shipments.html', section: 'MENU' },
    { id: 'products', label: 'Products', href: '/products.html', section: 'MENU' },
    { id: 'inventory', label: 'Inventory', href: '/inventory.html', section: 'MENU' },
    { id: 'financials', label: 'Financials', href: '/financials.html', section: 'FINANCE' },
    { id: 'tariffs', label: 'Tariff Tracker', href: '/tariffs.html', section: 'FINANCE' },
    { id: 'reports', label: 'Reports', href: '/reports.html', section: 'FINANCE' },
    { id: 'integrations', label: 'Integrations', href: '/integrations.html', section: 'SETTINGS' },
    { id: 'settings', label: 'Settings', href: '/settings.html', section: 'SETTINGS' },
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
        ${icons[item.id] || ''}<span>${item.label}</span>
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
          <button onclick="window.signOut()" title="Sign out" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;display:flex"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3"/><path d="M10.5 11.5L14 8l-3.5-3.5"/><path d="M14 8H6"/></svg></button>
        </div>
      </div>
    </div>
    <header class="navbar">
      <span class="navbar-title">${window.escapeHtml(title)}</span>
      <div class="navbar-actions">
        <div class="notification-btn" onclick="window.showToast('Notifications coming soon','info')" title="Notifications">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6a4 4 0 0 1 8 0c0 4 1.5 5.5 1.5 5.5H2.5S4 10 4 6z"/><path d="M6.5 13a1.5 1.5 0 0 0 3 0"/></svg>
          ${notifBadge}
        </div>
        <div style="width:32px;height:32px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0a0c14;cursor:pointer">${initials}</div>
      </div>
    </header>
  `)
}
