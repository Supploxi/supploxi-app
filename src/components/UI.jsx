// Supploxi Design System — UI Components
// Premium dark-first design inspired by Linear, Stripe, Vercel

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTheme } from '../context/ThemeContext'
import { format, parseISO, differenceInDays, isWeekend, addDays } from 'date-fns'

// ─── Theme Colors ──────────────────────────────────────────────
const themes = {
  dark: {
    bg: '#0a0c14',
    surface: '#0d1117',
    surfaceHover: '#161b22',
    border: '#21262d',
    borderLight: '#30363d',
    text: '#e6edf3',
    textSecondary: '#8b949e',
    textMuted: '#484f58',
    accent: '#00d4aa',
    accentHover: '#00eabb',
    accentMuted: 'rgba(0,212,170,0.12)',
    danger: '#f85149',
    dangerMuted: 'rgba(248,81,73,0.12)',
    warning: '#d29922',
    warningMuted: 'rgba(210,153,34,0.12)',
    success: '#3fb950',
    successMuted: 'rgba(63,185,80,0.12)',
    info: '#58a6ff',
    infoMuted: 'rgba(88,166,255,0.12)',
    overlay: 'rgba(0,0,0,0.6)',
    shadow: 'rgba(0,0,0,0.4)',
    inputBg: '#0d1117',
  },
  light: {
    bg: '#f6f8fa',
    surface: '#ffffff',
    surfaceHover: '#f3f4f6',
    border: '#d0d7de',
    borderLight: '#e5e7eb',
    text: '#1f2328',
    textSecondary: '#656d76',
    textMuted: '#8b949e',
    accent: '#00996b',
    accentHover: '#00b37e',
    accentMuted: 'rgba(0,153,107,0.08)',
    danger: '#cf222e',
    dangerMuted: 'rgba(207,34,46,0.08)',
    warning: '#9a6700',
    warningMuted: 'rgba(154,103,0,0.08)',
    success: '#1a7f37',
    successMuted: 'rgba(26,127,55,0.08)',
    info: '#0969da',
    infoMuted: 'rgba(9,105,218,0.08)',
    overlay: 'rgba(0,0,0,0.3)',
    shadow: 'rgba(0,0,0,0.08)',
    inputBg: '#ffffff',
  },
}

export function useColors() {
  const { theme } = useTheme()
  return themes[theme] || themes.dark
}

// ─── Inline SVG Icons ──────────────────────────────────────────
export const Icons = {
  Search: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  X: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  ChevronDown: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  ChevronUp: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m18 15-6-6-6 6"/></svg>,
  ChevronRight: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 18 6-6-6-6"/></svg>,
  ChevronLeft: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m15 18-6-6 6-6"/></svg>,
  ChevronsUpDown: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>,
  Loader: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sp-spin" {...p}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Inbox: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  Calendar: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>,
  ArrowLeft: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>,
  Save: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>,
  Trash: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Plus: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14"/><path d="M12 5v14"/></svg>,
  Info: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  AlertTriangle: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
  Check: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  Copy: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  Download: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  Upload: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>,
  ExternalLink: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>,
  Filter: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  MoreVertical: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
  Sun: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
  Moon: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
  Menu: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>,
  Settings: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  LogOut: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  User: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Package: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
  Truck: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 13.52 8H12"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>,
  DollarSign: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  BarChart: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>,
  ShoppingCart: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>,
  Users: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  ClipboardList: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>,
  Warehouse: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/></svg>,
  CreditCard: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>,
  LayoutDashboard: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>,
  RefreshCw: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>,
  Edit: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>,
  Eye: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>,
  Mail: (p) => <svg width={p?.size||16} height={p?.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
}

// ─── Badge ─────────────────────────────────────────────────────
export function Badge({ children, variant = 'default', style }) {
  const c = useColors()
  const variants = {
    default: { bg: c.accentMuted, color: c.accent },
    success: { bg: c.successMuted, color: c.success },
    danger: { bg: c.dangerMuted, color: c.danger },
    warning: { bg: c.warningMuted, color: c.warning },
    info: { bg: c.infoMuted, color: c.info },
    muted: { bg: c.surfaceHover, color: c.textSecondary },
  }
  const v = variants[variant] || variants.default
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 9999, fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
      background: v.bg, color: v.color, lineHeight: '18px',
      whiteSpace: 'nowrap', ...style,
    }}>
      {children}
    </span>
  )
}

// ─── Card ──────────────────────────────────────────────────────
export function Card({ children, style, onClick, hover, padding = '20px' }) {
  const c = useColors()
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      style={{
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 12, padding,
        cursor: onClick ? 'pointer' : undefined,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        borderColor: hovered ? c.borderLight : c.border,
        boxShadow: hovered ? `0 4px 12px ${c.shadow}` : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── StatCard ──────────────────────────────────────────────────
export function StatCard({ title, value, subtitle, icon, trend, trendUp }) {
  const c = useColors()
  return (
    <Card padding="16px 20px">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: c.textSecondary, fontSize: 12, fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
          <p style={{ color: c.text, fontSize: 28, fontWeight: 700, margin: '6px 0 0', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{value}</p>
          {subtitle && <p style={{ color: c.textMuted, fontSize: 12, margin: '6px 0 0' }}>{subtitle}</p>}
          {trend !== undefined && (
            <p style={{ fontSize: 12, fontWeight: 600, margin: '6px 0 0', color: trendUp ? c.success : c.danger }}>
              {trendUp ? '+' : ''}{trend}
            </p>
          )}
        </div>
        {icon && (
          <div style={{ width: 36, height: 36, borderRadius: 8, background: c.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.accent, flexShrink: 0 }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── SectionTitle ──────────────────────────────────────────────
export function SectionTitle({ children, actions, style }) {
  const c = useColors()
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, ...style }}>
      <h2 style={{ color: c.text, fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>{children}</h2>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}

// ─── Btn ───────────────────────────────────────────────────────
export function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, style, type = 'button', icon, loading }) {
  const c = useColors()
  const [hover, setHover] = useState(false)

  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12, gap: 4 },
    md: { padding: '8px 16px', fontSize: 13, gap: 6 },
    lg: { padding: '10px 20px', fontSize: 14, gap: 8 },
  }
  const sz = sizes[size] || sizes.md

  const variants = {
    primary: { bg: c.accent, bgHover: c.accentHover, color: '#0a0c14', border: 'none' },
    secondary: { bg: 'transparent', bgHover: c.surfaceHover, color: c.text, border: `1px solid ${c.border}` },
    danger: { bg: c.dangerMuted, bgHover: c.danger, color: c.danger, colorHover: '#fff', border: 'none' },
    ghost: { bg: 'transparent', bgHover: c.surfaceHover, color: c.textSecondary, border: 'none' },
    outline: { bg: 'transparent', bgHover: c.accentMuted, color: c.accent, border: `1px solid ${c.accent}` },
  }
  const v = variants[variant] || variants.primary

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: sz.gap,
        padding: sz.padding, fontSize: sz.fontSize, fontWeight: 600,
        borderRadius: 8, border: v.border || 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: hover && !disabled ? v.bgHover : v.bg,
        color: hover && v.colorHover ? v.colorHover : v.color,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s', fontFamily: 'inherit', lineHeight: 1,
        whiteSpace: 'nowrap', ...style,
      }}
    >
      {loading ? <Icons.Loader size={sz.fontSize} /> : icon}
      {children}
    </button>
  )
}

// ─── Field ─────────────────────────────────────────────────────
export function Field({ label, value, onChange, type = 'text', placeholder, required, disabled, error, style, min, max, step, readOnly }) {
  const c = useColors()
  return (
    <div style={{ marginBottom: 12, ...style }}>
      {label && <label style={{ display: 'block', color: c.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}{required && <span style={{ color: c.danger }}> *</span>}</label>}
      <input
        type={type} value={value ?? ''} onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder} required={required} disabled={disabled} readOnly={readOnly}
        min={min} max={max} step={step}
        style={{
          width: '100%', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
          background: c.inputBg, color: c.text, border: `1px solid ${error ? c.danger : c.border}`,
          borderRadius: 8, outline: 'none', transition: 'border-color 0.15s',
          boxSizing: 'border-box', opacity: disabled ? 0.5 : 1,
        }}
        onFocus={e => { e.target.style.borderColor = c.accent }}
        onBlur={e => { e.target.style.borderColor = error ? c.danger : c.border }}
      />
      {error && <p style={{ color: c.danger, fontSize: 11, margin: '4px 0 0' }}>{error}</p>}
    </div>
  )
}

export function Select({ label, value, onChange, options = [], placeholder, required, disabled, style }) {
  const c = useColors()
  return (
    <div style={{ marginBottom: 12, ...style }}>
      {label && <label style={{ display: 'block', color: c.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}{required && <span style={{ color: c.danger }}> *</span>}</label>}
      <select
        value={value ?? ''} onChange={e => onChange?.(e.target.value)}
        required={required} disabled={disabled}
        style={{
          width: '100%', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
          background: c.inputBg, color: c.text, border: `1px solid ${c.border}`,
          borderRadius: 8, outline: 'none', cursor: 'pointer',
          boxSizing: 'border-box', appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b949e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
          paddingRight: 32, opacity: disabled ? 0.5 : 1,
        }}
        onFocus={e => { e.target.style.borderColor = c.accent }}
        onBlur={e => { e.target.style.borderColor = c.border }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => typeof o === 'object'
          ? <option key={o.value} value={o.value}>{o.label}</option>
          : <option key={o} value={o}>{o}</option>
        )}
      </select>
    </div>
  )
}

export function Textarea({ label, value, onChange, placeholder, rows = 3, disabled, style }) {
  const c = useColors()
  return (
    <div style={{ marginBottom: 12, ...style }}>
      {label && <label style={{ display: 'block', color: c.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>}
      <textarea
        value={value ?? ''} onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder} rows={rows} disabled={disabled}
        style={{
          width: '100%', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
          background: c.inputBg, color: c.text, border: `1px solid ${c.border}`,
          borderRadius: 8, outline: 'none', resize: 'vertical',
          boxSizing: 'border-box', opacity: disabled ? 0.5 : 1,
        }}
        onFocus={e => { e.target.style.borderColor = c.accent }}
        onBlur={e => { e.target.style.borderColor = c.border }}
      />
    </div>
  )
}

export function Checkbox({ label, checked, onChange, disabled }) {
  const c = useColors()
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${checked ? c.accent : c.border}`,
        background: checked ? c.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s', flexShrink: 0,
      }}>
        {checked && <Icons.Check size={12} style={{ color: '#0a0c14' }} />}
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange?.(e.target.checked)} disabled={disabled} style={{ display: 'none' }} />
      <span style={{ fontSize: 13, color: c.text }}>{label}</span>
    </label>
  )
}

// ─── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 520 }) {
  const c = useColors()
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: c.overlay, backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.15s ease',
    }} onClick={onClose}>
      <div style={{
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 16, width: '90vw', maxWidth: width,
        maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: `0 24px 48px ${c.shadow}`,
        animation: 'scaleIn 0.15s ease',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${c.border}` }}>
          <h3 style={{ color: c.text, fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: c.textSecondary, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
            <Icons.X size={18} />
          </button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

// ─── Loading ───────────────────────────────────────────────────
export function Loading({ text = 'Loading...' }) {
  const c = useColors()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
      <Icons.Loader size={24} style={{ color: c.accent }} />
      <p style={{ color: c.textSecondary, fontSize: 13 }}>{text}</p>
    </div>
  )
}

// ─── Empty ─────────────────────────────────────────────────────
export function Empty({ title = 'No data', description, action }) {
  const c = useColors()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 8 }}>
      <Icons.Inbox size={32} style={{ color: c.textMuted }} />
      <p style={{ color: c.textSecondary, fontSize: 14, fontWeight: 600 }}>{title}</p>
      {description && <p style={{ color: c.textMuted, fontSize: 13 }}>{description}</p>}
      {action}
    </div>
  )
}

// ─── Alert ─────────────────────────────────────────────────────
export function Alert({ variant = 'info', children, onClose, style }) {
  const c = useColors()
  const variants = {
    info: { bg: c.infoMuted, color: c.info, icon: <Icons.Info size={16} /> },
    success: { bg: c.successMuted, color: c.success, icon: <Icons.Check size={16} /> },
    warning: { bg: c.warningMuted, color: c.warning, icon: <Icons.AlertTriangle size={16} /> },
    danger: { bg: c.dangerMuted, color: c.danger, icon: <Icons.AlertTriangle size={16} /> },
  }
  const v = variants[variant] || variants.info
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
      background: v.bg, borderRadius: 8, color: v.color, fontSize: 13, lineHeight: 1.5,
      ...style,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{v.icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && (
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: v.color, cursor: 'pointer', padding: 0, flexShrink: 0 }}>
          <Icons.X size={14} />
        </button>
      )}
    </div>
  )
}

// ─── SearchInput ───────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search...', style }) {
  const c = useColors()
  return (
    <div style={{ position: 'relative', ...style }}>
      <Icons.Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: c.textMuted, pointerEvents: 'none' }} />
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 12px 8px 32px', fontSize: 13, fontFamily: 'inherit',
          background: c.inputBg, color: c.text, border: `1px solid ${c.border}`,
          borderRadius: 8, outline: 'none', boxSizing: 'border-box',
        }}
        onFocus={e => { e.target.style.borderColor = c.accent }}
        onBlur={e => { e.target.style.borderColor = c.border }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', padding: 2,
        }}>
          <Icons.X size={12} />
        </button>
      )}
    </div>
  )
}

// ─── SortHeader ────────────────────────────────────────────────
export function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const c = useColors()
  const active = sortField === field
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
        color: active ? c.accent : c.textSecondary, cursor: 'pointer',
        textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
        borderBottom: `2px solid ${c.border}`, userSelect: 'none',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {active
          ? (sortDir === 'asc' ? <Icons.ChevronUp size={12} /> : <Icons.ChevronDown size={12} />)
          : <Icons.ChevronsUpDown size={12} style={{ opacity: 0.3 }} />
        }
      </span>
    </th>
  )
}

// ─── Tooltip ───────────────────────────────────────────────────
export function Tooltip({ children, text }) {
  const c = useColors()
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
          background: c.text, color: c.bg, whiteSpace: 'nowrap', pointerEvents: 'none',
          zIndex: 1000,
        }}>
          {text}
        </span>
      )}
    </span>
  )
}

// ─── Tabs ──────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  const c = useColors()
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${c.border}`, marginBottom: 16 }}>
      {tabs.map(t => {
        const isActive = active === t.value
        return (
          <button key={t.value} onClick={() => onChange(t.value)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            color: isActive ? c.accent : c.textSecondary, background: 'none', border: 'none',
            borderBottom: `2px solid ${isActive ? c.accent : 'transparent'}`,
            cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1,
          }}>
            {t.label}{t.count !== undefined && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>({t.count})</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─── DateRangePicker ───────────────────────────────────────────
export function DateRangePicker({ from, to, onChange, style }) {
  const c = useColors()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icons.Calendar size={14} style={{ color: c.textMuted }} />
        <input type="date" value={from || ''} onChange={e => onChange({ from: e.target.value, to })}
          style={{ padding: '6px 8px', fontSize: 12, background: c.inputBg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>
      <span style={{ color: c.textMuted, fontSize: 12 }}>to</span>
      <input type="date" value={to || ''} onChange={e => onChange({ from, to: e.target.value })}
        style={{ padding: '6px 8px', fontSize: 12, background: c.inputBg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit' }}
      />
    </div>
  )
}

// ─── useDateRange Hook ─────────────────────────────────────────
export function useDateRange(key = 'default') {
  const storageKey = `supploxi-daterange-${key}`
  const [range, setRange] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved)
    } catch {}
    return { from: daysAgo(30), to: today() }
  })

  const update = useCallback((newRange) => {
    const r = typeof newRange === 'function' ? newRange(range) : newRange
    setRange(r)
    localStorage.setItem(storageKey, JSON.stringify(r))
  }, [range, storageKey])

  return [range, update]
}

// ─── Pagination ────────────────────────────────────────────────
export function Pagination({ page, totalPages, onPageChange, style }) {
  const c = useColors()
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '12px 0', ...style }}>
      <Btn variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        <Icons.ChevronLeft size={14} />
      </Btn>
      <span style={{ color: c.textSecondary, fontSize: 12, padding: '0 8px' }}>
        {page} of {totalPages}
      </span>
      <Btn variant="ghost" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        <Icons.ChevronRight size={14} />
      </Btn>
    </div>
  )
}

// ─── Format Helpers ────────────────────────────────────────────
export function formatUSD(val) {
  const n = parseFloat(val) || 0
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function formatNumber(val) {
  const n = parseFloat(val) || 0
  return n.toLocaleString('en-US')
}

export function formatPercent(val, decimals = 1) {
  const n = parseFloat(val) || 0
  return `${n.toFixed(decimals)}%`
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    return format(d, 'MM/dd/yyyy')
  } catch { return '-' }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    return format(d, 'MM/dd/yyyy hh:mm a')
  } catch { return '-' }
}

export function daysSince(dateStr) {
  if (!dateStr) return null
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    return differenceInDays(new Date(), d)
  } catch { return null }
}

export function businessDaysBetween(startDate, endDate) {
  if (!startDate || !endDate) return null
  try {
    let start = typeof startDate === 'string' ? parseISO(startDate) : startDate
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate
    let count = 0
    while (start <= end) {
      if (!isWeekend(start)) count++
      start = addDays(start, 1)
    }
    return count
  } catch { return null }
}

export function dateLocal(dateStr) {
  if (!dateStr) return ''
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    return format(d, 'yyyy-MM-dd')
  } catch { return '' }
}

export function today() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function daysAgo(n) {
  return format(addDays(new Date(), -n), 'yyyy-MM-dd')
}

// ─── useSort Hook ──────────────────────────────────────────────
export function useSort(defaultField = '', defaultDir = 'desc') {
  const [sortField, setSortField] = useState(defaultField)
  const [sortDir, setSortDir] = useState(defaultDir)

  const onSort = useCallback((field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }, [sortField])

  const sortFn = useCallback((a, b) => {
    if (!sortField) return 0
    let va = a[sortField], vb = b[sortField]
    if (va == null) va = ''
    if (vb == null) vb = ''
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va
    }
    const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase()
    if (sa < sb) return sortDir === 'asc' ? -1 : 1
    if (sa > sb) return sortDir === 'asc' ? 1 : -1
    return 0
  }, [sortField, sortDir])

  return { sortField, sortDir, onSort, sortFn }
}

// ─── usePagination Hook ───────────────────────────────────────
export function usePagination(items, perPage = 25) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(items.length / perPage) || 1

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [items.length, totalPages, page])

  const paged = useMemo(() => {
    const start = (page - 1) * perPage
    return items.slice(start, start + perPage)
  }, [items, page, perPage])

  return { page, setPage: (p) => setPage(Math.max(1, Math.min(p, totalPages))), totalPages, paged }
}

// ─── ConfirmModal ──────────────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title = 'Confirm', message = 'Are you sure?', confirmText = 'Confirm', variant = 'danger' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={400}>
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant={variant} onClick={onConfirm}>{confirmText}</Btn>
      </div>
    </Modal>
  )
}

// ─── Toast / Notification ──────────────────────────────────────
export function Toast({ message, variant = 'success', onClose }) {
  const c = useColors()
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const variants = {
    success: { bg: c.success, icon: <Icons.Check size={14} /> },
    danger: { bg: c.danger, icon: <Icons.X size={14} /> },
    warning: { bg: c.warning, icon: <Icons.AlertTriangle size={14} /> },
    info: { bg: c.info, icon: <Icons.Info size={14} /> },
  }
  const v = variants[variant] || variants.success

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
      background: v.bg, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600,
      boxShadow: `0 8px 24px ${c.shadow}`, animation: 'slideIn 0.2s ease',
    }}>
      {v.icon}
      {message}
    </div>
  )
}
