// =============================================
// SUPPLOXI V2 — Supabase Client & Shared Helpers
// =============================================

// Toast container
const toastContainer = document.createElement('div')
toastContainer.className = 'toast-container'
document.body.appendChild(toastContainer)

// Initialize Supabase
const { createClient } = supabase
window._sb = createClient(
  'https://nmlnwcclgufxjkklqntl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tbG53Y2NsZ3VmeGpra2xxbnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzk3MDgsImV4cCI6MjA4Nzk1NTcwOH0.8z2qgjtqUJpd0qrG7DmFPHGokvU-73iyFMwrF3IXML4'
)

// =============================================
// AUTH HELPERS
// =============================================

window.getUser = async () => {
  const { data: { user } } = await window._sb.auth.getUser()
  return user
}

window.requireAuth = async () => {
  const user = await window.getUser()
  if (!user) { window.location.href = '/' }
  return user
}

window.signOut = async () => {
  await window._sb.auth.signOut()
  window.location.href = '/'
}

// =============================================
// TOAST NOTIFICATIONS
// =============================================

window.showToast = (message, type = 'success') => {
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  const icons = { success: '\u2713', error: '\u2715', warning: '\u26A0', info: '\u2139' }
  toast.innerHTML = `<span style="font-size:18px">${icons[type] || '\u2139'}</span><span>${message}</span>`
  toastContainer.appendChild(toast)
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s ease reverse'
    setTimeout(() => toast.remove(), 280)
  }, 3500)
}

// =============================================
// FORMATTING HELPERS
// =============================================

window.formatCurrency = (val) => {
  const num = parseFloat(val) || 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

window.formatDate = (d) => {
  if (!d) return '\u2014'
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

window.formatRelativeTime = (d) => {
  if (!d) return '\u2014'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

window.escapeHtml = (str) => {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// =============================================
// STATUS BADGE GENERATOR
// =============================================

window.getStatusBadge = (status) => {
  const map = {
    active: ['badge-green', 'Active'],
    inactive: ['badge-gray', 'Inactive'],
    draft: ['badge-gray', 'Draft'],
    sent: ['badge-blue', 'Sent'],
    confirmed: ['badge-blue', 'Confirmed'],
    in_production: ['badge-purple', 'In Production'],
    shipped: ['badge-blue', 'Shipped'],
    received: ['badge-green', 'Received'],
    cancelled: ['badge-red', 'Cancelled'],
    processing: ['badge-gray', 'Processing'],
    in_transit: ['badge-blue', 'In Transit'],
    customs: ['badge-orange', 'In Customs'],
    out_for_delivery: ['badge-purple', 'Out for Delivery'],
    delivered: ['badge-green', 'Delivered'],
    exception: ['badge-red', 'Exception'],
    pending: ['badge-orange', 'Pending'],
    paid: ['badge-green', 'Paid'],
    partial: ['badge-blue', 'Partial'],
    on_hold: ['badge-orange', 'On Hold'],
  }
  const [cls, label] = map[status] || ['badge-gray', status || 'Unknown']
  return `<span class="badge ${cls}">${label}</span>`
}

// =============================================
// PO NUMBER GENERATOR
// =============================================

window.generatePONumber = () => {
  const year = new Date().getFullYear()
  const rand = String(Math.floor(Math.random() * 9000) + 1000)
  return `PO-${year}-${rand}`
}
