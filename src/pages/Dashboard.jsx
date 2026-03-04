// Supploxi — Dashboard Page
// KPI overview, revenue chart, shipment distribution, recent orders

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useColors, Card, StatCard, SectionTitle, Btn, DateRangePicker,
  useDateRange, formatUSD, formatNumber, formatPercent, formatDate,
  Icons, Loading, Empty,
} from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import useIsMobile from '../hooks/useIsMobile'
import { SHIPMENT_GROUPS, STATUS_COLOR } from '../lib/reportana'
import {
  LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

// Labels for each shipment group shown in the pie chart
const SHIPMENT_GROUP_LABELS = {
  IN_TRANSIT:  'In Transit',
  CUSTOMS:     'Customs',
  LAST_MILE:   'Last Mile',
  DELIVERED:   'Delivered',
  NOT_FOUND:   'Pending / Not Found',
  EXCEPTIONS:  'Exceptions',
}

// Fixed palette for pie slices keyed by group
const SHIPMENT_GROUP_COLORS = {
  IN_TRANSIT:  '#8b5cf6',
  CUSTOMS:     '#f59e0b',
  LAST_MILE:   '#06b6d4',
  DELIVERED:   '#22c55e',
  NOT_FOUND:   '#71717a',
  EXCEPTIONS:  '#ef4444',
}

export default function Dashboard() {
  const c = useColors()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [dateRange, setDateRange] = useDateRange('dashboard')

  const [orders, setOrders] = useState([])
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)

  // ── Fetch data ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [ordersRes, shipmentsRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*, customers(name, email)')
            .gte('created_at', `${dateRange.from}T00:00:00.000Z`)
            .lte('created_at', `${dateRange.to}T23:59:59.999Z`)
            .order('created_at', { ascending: false }),
          supabase
            .from('shipments')
            .select('*'),
        ])

        if (!cancelled) {
          setOrders(ordersRes.data || [])
          setShipments(shipmentsRes.data || [])
        }
      } catch (err) {
        console.error('Dashboard data load failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, dateRange.from, dateRange.to])

  // ── KPI calculations ──────────────────────────────────────────
  const totalRevenue = useMemo(
    () => orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0),
    [orders],
  )

  const totalOrders = orders.length

  const avgOrderValue = useMemo(
    () => (totalOrders > 0 ? totalRevenue / totalOrders : 0),
    [totalRevenue, totalOrders],
  )

  const pendingShipments = useMemo(
    () => shipments.filter(s => {
      const pendingStatuses = [
        ...SHIPMENT_GROUPS.IN_TRANSIT,
        ...SHIPMENT_GROUPS.CUSTOMS,
        ...SHIPMENT_GROUPS.LAST_MILE,
        ...SHIPMENT_GROUPS.NOT_FOUND,
      ]
      return pendingStatuses.includes(s.status)
    }).length,
    [shipments],
  )

  // ── Revenue chart data (aggregate by day) ─────────────────────
  const revenueChartData = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      const day = (o.created_at || '').slice(0, 10)
      if (!day) return
      if (!map[day]) map[day] = 0
      map[day] += parseFloat(o.total) || 0
    })

    // Build sorted array of each day within date range
    const result = []
    const start = new Date(dateRange.from)
    const end = new Date(dateRange.to)
    const cursor = new Date(start)

    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10)
      result.push({
        date: key,
        label: `${String(cursor.getMonth() + 1).padStart(2, '0')}/${String(cursor.getDate()).padStart(2, '0')}`,
        revenue: map[key] || 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    return result
  }, [orders, dateRange.from, dateRange.to])

  // ── Shipment status distribution (pie) ────────────────────────
  const shipmentPieData = useMemo(() => {
    const counts = {}
    Object.keys(SHIPMENT_GROUPS).forEach(g => { counts[g] = 0 })

    shipments.forEach(s => {
      for (const [group, statuses] of Object.entries(SHIPMENT_GROUPS)) {
        if (statuses.includes(s.status)) {
          counts[group]++
          return
        }
      }
      // If status doesn't match any group, bucket into NOT_FOUND
      counts.NOT_FOUND++
    })

    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([group, count]) => ({
        name: SHIPMENT_GROUP_LABELS[group] || group,
        value: count,
        color: SHIPMENT_GROUP_COLORS[group] || '#71717a',
      }))
  }, [shipments])

  // ── Recent orders (last 10) ───────────────────────────────────
  const recentOrders = useMemo(() => orders.slice(0, 10), [orders])

  // ── Custom Recharts tooltip ───────────────────────────────────
  function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 8, padding: '8px 12px', fontSize: 12,
        boxShadow: `0 4px 12px ${c.shadow}`,
      }}>
        <p style={{ color: c.textSecondary, margin: 0, marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || c.accent, margin: 0, fontWeight: 600 }}>
            {formatUSD(p.value)}
          </p>
        ))}
      </div>
    )
  }

  function PieTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0]
    return (
      <div style={{
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 8, padding: '8px 12px', fontSize: 12,
        boxShadow: `0 4px 12px ${c.shadow}`,
      }}>
        <p style={{ color: c.text, margin: 0, fontWeight: 600 }}>{d.name}</p>
        <p style={{ color: c.textSecondary, margin: '2px 0 0' }}>
          {formatNumber(d.value)} shipment{d.value !== 1 ? 's' : ''}
        </p>
      </div>
    )
  }

  // ── Loading state ─────────────────────────────────────────────
  if (loading) {
    return <Loading text="Loading dashboard..." />
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="sp-page-header">
        <h1 className="sp-page-title">Dashboard</h1>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
        />
      </div>

      {/* KPI Row */}
      <div className="sp-grid-stats" style={{ marginBottom: 24 }}>
        <StatCard
          title="Total Revenue"
          value={formatUSD(totalRevenue)}
          icon={<Icons.DollarSign size={18} />}
          subtitle={`${formatNumber(totalOrders)} order${totalOrders !== 1 ? 's' : ''} in range`}
        />
        <StatCard
          title="Total Orders"
          value={formatNumber(totalOrders)}
          icon={<Icons.ShoppingCart size={18} />}
        />
        <StatCard
          title="Avg Order Value"
          value={formatUSD(avgOrderValue)}
          icon={<Icons.BarChart size={18} />}
        />
        <StatCard
          title="Pending Shipments"
          value={formatNumber(pendingShipments)}
          icon={<Icons.Truck size={18} />}
          subtitle={`of ${formatNumber(shipments.length)} total`}
        />
      </div>

      {/* Charts row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Revenue Line Chart */}
        <Card>
          <SectionTitle>Revenue Over Time</SectionTitle>
          {revenueChartData.length === 0 ? (
            <Empty title="No revenue data" description="No orders found in the selected date range." />
          ) : (
            <div style={{ width: '100%', height: isMobile ? 240 : 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: c.textMuted, fontSize: 11 }}
                    axisLine={{ stroke: c.border }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: c.textMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(v >= 1000 ? 0 : 1)}k`}
                    width={52}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={c.accent}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: c.accent, stroke: c.surface, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Shipment Status Pie Chart */}
        <Card>
          <SectionTitle>Shipment Status</SectionTitle>
          {shipmentPieData.length === 0 ? (
            <Empty title="No shipments" description="No shipment data available." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', height: isMobile ? 200 : 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={shipmentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 40 : 50}
                      outerRadius={isMobile ? 70 : 85}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                    >
                      {shipmentPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8,
                justifyContent: 'center', marginTop: 8,
              }}>
                {shipmentPieData.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: entry.color, flexShrink: 0,
                    }} />
                    <span style={{ color: c.textSecondary, whiteSpace: 'nowrap' }}>
                      {entry.name} ({formatNumber(entry.value)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card padding="0">
        <div style={{ padding: '16px 20px 0' }}>
          <SectionTitle
            actions={
              <Btn variant="ghost" size="sm" onClick={() => navigate('/orders')}>
                View All <Icons.ChevronRight size={14} />
              </Btn>
            }
          >
            Recent Orders
          </SectionTitle>
        </div>

        {recentOrders.length === 0 ? (
          <div style={{ padding: '0 20px 20px' }}>
            <Empty
              title="No orders yet"
              description="Orders from the selected date range will appear here."
            />
          </div>
        ) : isMobile ? (
          /* Mobile card layout */
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentOrders.map(order => (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                style={{
                  padding: '12px 14px', borderRadius: 8,
                  border: `1px solid ${c.border}`, cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = c.borderLight }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = c.border }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ color: c.accent, fontSize: 13, fontWeight: 600 }}>
                    {order.order_number || `#${String(order.id).slice(0, 8)}`}
                  </span>
                  <span style={{ color: c.text, fontSize: 13, fontWeight: 700 }}>
                    {formatUSD(order.total)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: c.textSecondary, fontSize: 12 }}>
                    {order.customers?.name || order.customers?.email || '-'}
                  </span>
                  <span style={{ color: c.textMuted, fontSize: 11 }}>
                    {formatDate(order.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop table */
          <div className="sp-table-container" style={{ border: 'none', borderTop: `1px solid ${c.border}` }}>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Status</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr
                    key={order.id}
                    className="sp-clickable"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td>
                      <span style={{ color: c.accent, fontWeight: 600 }}>
                        {order.order_number || `#${String(order.id).slice(0, 8)}`}
                      </span>
                    </td>
                    <td style={{ color: c.text }}>
                      {order.customers?.name || order.customers?.email || '-'}
                    </td>
                    <td style={{ color: c.textSecondary }}>
                      {formatDate(order.created_at)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: c.text }}>
                      {formatUSD(order.total)}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px',
                        borderRadius: 9999, fontSize: 11, fontWeight: 600,
                        background: order.status === 'fulfilled' ? c.successMuted
                          : order.status === 'cancelled' ? c.dangerMuted
                          : order.status === 'processing' ? c.infoMuted
                          : c.warningMuted,
                        color: order.status === 'fulfilled' ? c.success
                          : order.status === 'cancelled' ? c.danger
                          : order.status === 'processing' ? c.info
                          : c.warning,
                        textTransform: 'capitalize',
                      }}>
                        {order.status || 'pending'}
                      </span>
                    </td>
                    <td>
                      <Icons.ChevronRight size={14} style={{ color: c.textMuted }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
