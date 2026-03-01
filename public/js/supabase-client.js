// Supploxi — Shared Supabase Client
const SUPABASE_URL = 'https://nmlnwcclgufxjkklqntl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tbG53Y2NsZ3VmeGpra2xxbnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzk3MDgsImV4cCI6MjA4Nzk1NTcwOH0.8z2qgjtqUJpd0qrG7DmFPHGokvU-73iyFMwrF3IXML4';

const { createClient } = supabase;
window._supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getCurrentUser() {
  const { data: { session } } = await window._supabase.auth.getSession();
  return session?.user || null;
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/index.html';
    return null;
  }
  return user;
}

async function signOut() {
  await window._supabase.auth.signOut();
  window.location.href = '/index.html';
}

// Helpers
function formatCurrency(n) {
  if (n == null) return '$0.00';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function daysBetween(a, b) {
  const d1 = new Date(a), d2 = new Date(b);
  return Math.ceil((d2 - d1) / 86400000);
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showToast(msg, type) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show ' + (type || 'success');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function countryFlag(code) {
  const flags = { China: '🇨🇳', India: '🇮🇳', Vietnam: '🇻🇳', Bangladesh: '🇧🇩', Turkey: '🇹🇷', 'United States': '🇺🇸', USA: '🇺🇸', Other: '🌍' };
  return flags[code] || '🌍';
}

function statusBadge(status) {
  const colors = {
    active: '#00d4aa', inactive: '#ff4757', 'on hold': '#f59e0b',
    draft: '#8b8fa8', sent: '#3b82f6', confirmed: '#00d4aa', 'in production': '#f59e0b',
    shipped: '#3b82f6', received: '#00d4aa', cancelled: '#ff4757',
    pending: '#f59e0b', processing: '#3b82f6',
    'in transit': '#3b82f6', customs: '#f59e0b', 'out for delivery': '#00d4aa',
    delivered: '#00d4aa', exception: '#ff4757'
  };
  const c = colors[(status || '').toLowerCase()] || '#8b8fa8';
  return `<span class="badge" style="background:${c}20;color:${c};border:1px solid ${c}40">${escapeHtml(status || 'N/A')}</span>`;
}

function calculateReorderSuggestion(product) {
  const avgDaily = product.avg_daily_sales || 1;
  const daysOfStockLeft = product.stock_quantity / avgDaily;
  const totalLeadTime = (product.lead_time_days || 30) + 15;
  const safetyBuffer = 7;
  const reorderNow = daysOfStockLeft <= (totalLeadTime + safetyBuffer);
  const suggestedQty = Math.ceil(avgDaily * totalLeadTime * 1.2);

  return {
    reorderNow,
    daysUntilStockout: Math.floor(daysOfStockLeft),
    suggestedQty,
    urgency: daysOfStockLeft < totalLeadTime ? 'critical' :
             daysOfStockLeft < totalLeadTime + 14 ? 'soon' : 'ok'
  };
}
