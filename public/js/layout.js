// Supploxi — Shared Layout (Sidebar + Navbar)
function renderLayout(activePage) {
  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    suppliers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 0v1a3 3 0 006 0V7m0 0v1a3 3 0 006 0V7H3l2-4h14l2 4"/><path d="M5 21V10.9M19 21V10.9"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>',
    shipments: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    products: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>',
    financials: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>'
  };

  const pages = [
    { id: 'dashboard', label: 'Dashboard', href: '/dashboard.html' },
    { id: 'suppliers', label: 'Suppliers', href: '/suppliers.html' },
    { id: 'orders', label: 'Purchase Orders', href: '/purchase-orders.html' },
    { id: 'shipments', label: 'Shipments', href: '/shipments.html' },
    { id: 'products', label: 'Products', href: '/products.html' },
    { id: 'financials', label: 'Financials', href: '/financials.html' },
    { id: 'settings', label: 'Settings', href: '/settings.html' },
  ];

  const titles = {};
  pages.forEach(p => titles[p.id] = p.label);

  // Sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-logo"><h1>Suppl<span>oxi</span></h1></div>
    <nav class="sidebar-nav">
      ${pages.map(p => `<a href="${p.href}" class="${p.id === activePage ? 'active' : ''}">${icons[p.id] || ''}${p.label}</a>`).join('')}
    </nav>
    <div class="sidebar-user">
      <div class="sidebar-user-avatar" id="userAvatar">?</div>
      <div class="sidebar-user-info"><p id="userEmail">Loading...</p></div>
      <button class="btn-signout" onclick="signOut()" title="Sign Out">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>
    </div>
  `;
  document.body.prepend(sidebar);

  // Navbar
  const navbar = document.createElement('nav');
  navbar.className = 'navbar';
  navbar.innerHTML = `
    <h2>${titles[activePage] || 'Dashboard'}</h2>
    <div class="navbar-actions">
      <div class="quick-add-wrap">
        <button class="btn-quick-add" id="quickAddBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Quick Add
        </button>
        <div class="quick-add-dropdown" id="quickAddDropdown">
          <a href="/suppliers.html?action=add">Add Supplier</a>
          <a href="/purchase-orders.html?action=add">New Order</a>
          <a href="/shipments.html?action=add">Add Shipment</a>
        </div>
      </div>
    </div>
  `;
  document.body.prepend(navbar);

  // Quick add dropdown
  document.getElementById('quickAddBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('quickAddDropdown').classList.toggle('show');
  });
  document.addEventListener('click', () => {
    document.getElementById('quickAddDropdown').classList.remove('show');
  });

  // Fill user info
  getCurrentUser().then(user => {
    if (user) {
      const email = user.email || '';
      document.getElementById('userEmail').textContent = email;
      document.getElementById('userAvatar').textContent = email.substring(0, 2).toUpperCase();
    }
  });
}
