// Supploxi — Financials Page
// P&L overview, revenue trends, cost breakdown, payment distribution, expense management

import { useState, useEffect, useMemo } from 'react'
import {
  useColors, Card, StatCard, SectionTitle, Btn, Field, Select,
  DateRangePicker, useDateRange, Modal, ConfirmModal, Pagination,
  usePagination, formatUSD, formatDate, formatPercent, Icons, Loading, Empty,
} from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import useIsMobile from '../hooks/useIsMobile'
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'

const PAGE_SIZE = 15

const EXPENSE_CATEGORIES = [
  'Freight & Shipping',
  'Customs & Duties',
  'Warehouse & Storage',
  'Platform Fees',
  'Advertising',
  'Software & Tools',
  'Packaging Supplies',
  'Returns & Refunds',
  'Other',
]

const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map(cat => ({ value: cat, label: cat }))

const COST_PIE_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#71717a']
const PAYMENT_PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

const EMPTY_EXPENSE = {
  category: '',
  description: '',
  amount: '',
  date: '',
  recurring: false,
}

export default function Financials() {
  const c = useColors()
  const { user, isViewer } = useAuth()
  const isMobile = useIsMobile()
  const [dateRange, setDateRange] = useDateRange('financials')

  // Data state
  const [orders, setOrders] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  // Expense modal state
  const [expenseModal, setExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ ...EMPTY_EXPENSE })
  const [editingExpenseId, setEditingExpenseId] = useState(null)
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [expenseError, setExpenseError] = useState('')

  // Delete confirm modal
  const [deleteModal, setDeleteModal] = useState(false)
  const [deletingExpenseId, setDeletingExpenseId] = useState(null)

  // ── Fetch data ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [ordersRes, expensesRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .gte('created_at', `${dateRange.from}T00:00:00`)
            .lte('created_at', `${dateRange.to}T23:59:59`)
            .order('created_at', { ascending: false }),
          supabase
            .from('expenses')
            .select('*')
            .gte('date', dateRange.from)
            .lte('date', dateRange.to)
            .order('date', { ascending: false }),
        ])

        if (!cancelled) {
          setOrders(ordersRes.data || [])
          setExpenses(expensesRes.data || [])
        }
      } catch (err) {
        console.error('Financials data load failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, dateRange.from, dateRange.to])

  // ── Revenue calculations ────────────────────────────────────────
  const revenueBreakdown = useMemo(() => {
    let orderSubtotals = 0
    let shippingIncome = 0
    let taxCollected = 0

    orders.forEach(o => {
      orderSubtotals += parseFloat(o.subtotal) || 0
      shippingIncome += parseFloat(o.shipping_revenue) || parseFloat(o.shipping_charged) || 0
      taxCollected += parseFloat(o.tax) || parseFloat(o.tax_collected) || 0
    })

    return { orderSubtotals, shippingIncome, taxCollected }
  }, [orders])

  const totalRevenue = useMemo(
    () => revenueBreakdown.orderSubtotals + revenueBreakdown.shippingIncome + revenueBreakdown.taxCollected,
    [revenueBreakdown],
  )

  // ── Cost calculations ───────────────────────────────────────────
  const costBreakdown = useMemo(() => {
    let productCosts = 0
    let shippingCosts = 0
    let gatewayFees = 0
    let customsDuties = 0

    orders.forEach(o => {
      productCosts += parseFloat(o.product_cost) || parseFloat(o.cost_of_goods) || 0
      shippingCosts += parseFloat(o.shipping_cost) || 0
      gatewayFees += parseFloat(o.gateway_fee) || parseFloat(o.transaction_fee) || 0
      customsDuties += parseFloat(o.customs_duty) || parseFloat(o.duties) || 0
    })

    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

    return { productCosts, shippingCosts, gatewayFees, customsDuties, expenses: totalExpenses }
  }, [orders, expenses])

  const totalCosts = useMemo(
    () => costBreakdown.productCosts + costBreakdown.shippingCosts + costBreakdown.gatewayFees + costBreakdown.customsDuties + costBreakdown.expenses,
    [costBreakdown],
  )

  const netProfit = totalRevenue - totalCosts
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  // ── Revenue trend chart (6-month rolling by month) ─────────────
  const revenueTrendData = useMemo(() => {
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        revenue: 0,
      })
    }

    orders.forEach(o => {
      const created = o.created_at || ''
      const monthKey = created.slice(0, 7)
      const entry = months.find(m => m.key === monthKey)
      if (entry) {
        entry.revenue += (parseFloat(o.subtotal) || 0)
          + (parseFloat(o.shipping_revenue) || parseFloat(o.shipping_charged) || 0)
          + (parseFloat(o.tax) || parseFloat(o.tax_collected) || 0)
      }
    })

    return months
  }, [orders])

  // ── Cost breakdown pie data ─────────────────────────────────────
  const costPieData = useMemo(() => {
    const items = [
      { name: 'Product Costs', value: costBreakdown.productCosts },
      { name: 'Shipping Costs', value: costBreakdown.shippingCosts },
      { name: 'Gateway Fees', value: costBreakdown.gatewayFees },
      { name: 'Customs Duties', value: costBreakdown.customsDuties },
      { name: 'Expenses', value: costBreakdown.expenses },
    ]
    return items.filter(i => i.value > 0)
  }, [costBreakdown])

  // ── Payment method distribution pie data ────────────────────────
  const paymentPieData = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      const method = o.payment_method || 'Unknown'
      if (!map[method]) map[method] = 0
      map[method]++
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [orders])

  // ── Expenses pagination ─────────────────────────────────────────
  const { page, setPage, totalPages, paged: pagedExpenses } = usePagination(expenses, PAGE_SIZE)

  // ── Expense CRUD ────────────────────────────────────────────────
  function openAddExpense() {
    setEditingExpenseId(null)
    setExpenseForm({ ...EMPTY_EXPENSE, date: new Date().toISOString().slice(0, 10) })
    setExpenseError('')
    setExpenseModal(true)
  }

  function openEditExpense(expense) {
    setEditingExpenseId(expense.id)
    setExpenseForm({
      category: expense.category || '',
      description: expense.description || '',
      amount: expense.amount != null ? String(expense.amount) : '',
      date: expense.date || '',
      recurring: !!expense.recurring,
    })
    setExpenseError('')
    setExpenseModal(true)
  }

  function closeExpenseModal() {
    setExpenseModal(false)
    setEditingExpenseId(null)
    setExpenseForm({ ...EMPTY_EXPENSE })
    setExpenseError('')
  }

  async function saveExpense() {
    if (!expenseForm.category) { setExpenseError('Category is required.'); return }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) { setExpenseError('Amount must be greater than zero.'); return }
    if (!expenseForm.date) { setExpenseError('Date is required.'); return }

    setExpenseSaving(true)
    setExpenseError('')

    try {
      const payload = {
        category: expenseForm.category,
        description: expenseForm.description.trim(),
        amount: parseFloat(expenseForm.amount),
        date: expenseForm.date,
        recurring: expenseForm.recurring,
        user_id: user?.id,
      }

      if (editingExpenseId) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingExpenseId)
        if (error) throw error

        setExpenses(prev => prev.map(e => e.id === editingExpenseId ? { ...e, ...payload } : e))
      } else {
        const { data, error } = await supabase
          .from('expenses')
          .insert(payload)
          .select()
          .single()
        if (error) throw error

        setExpenses(prev => [data, ...prev])
      }

      closeExpenseModal()
    } catch (err) {
      console.error('Save expense failed:', err)
      setExpenseError(err.message || 'Failed to save expense.')
    } finally {
      setExpenseSaving(false)
    }
  }

  function openDeleteExpense(id) {
    setDeletingExpenseId(id)
    setDeleteModal(true)
  }

  async function confirmDeleteExpense() {
    if (!deletingExpenseId) return

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', deletingExpenseId)
      if (error) throw error

      setExpenses(prev => prev.filter(e => e.id !== deletingExpenseId))
    } catch (err) {
      console.error('Delete expense failed:', err)
    } finally {
      setDeleteModal(false)
      setDeletingExpenseId(null)
    }
  }

  // ── Custom chart tooltips ───────────────────────────────────────
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
          {formatUSD(d.value)}
        </p>
      </div>
    )
  }

  function PaymentPieTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0]
    const total = paymentPieData.reduce((s, item) => s + item.value, 0)
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0'
    return (
      <div style={{
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 8, padding: '8px 12px', fontSize: 12,
        boxShadow: `0 4px 12px ${c.shadow}`,
      }}>
        <p style={{ color: c.text, margin: 0, fontWeight: 600 }}>{d.name}</p>
        <p style={{ color: c.textSecondary, margin: '2px 0 0' }}>
          {d.value} order{d.value !== 1 ? 's' : ''} ({pct}%)
        </p>
      </div>
    )
  }

  // ── P&L line item helper ────────────────────────────────────────
  function PnlRow({ label, amount, bold, indent, color }) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 0',
        marginLeft: indent ? 16 : 0,
      }}>
        <span style={{
          color: color || c.text,
          fontSize: bold ? 14 : 13,
          fontWeight: bold ? 700 : 400,
        }}>
          {label}
        </span>
        <span style={{
          color: color || c.text,
          fontSize: bold ? 14 : 13,
          fontWeight: bold ? 700 : 500,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatUSD(amount)}
        </span>
      </div>
    )
  }

  // ── Pie legend helper ───────────────────────────────────────────
  function PieLegend({ data, colors }) {
    return (
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8,
        justifyContent: 'center', marginTop: 8,
      }}>
        {data.map((entry, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: colors[i % colors.length], flexShrink: 0,
            }} />
            <span style={{ color: c.textSecondary, whiteSpace: 'nowrap' }}>
              {entry.name}
            </span>
          </div>
        ))}
      </div>
    )
  }

  // ── Loading state ───────────────────────────────────────────────
  if (loading) {
    return <Loading text="Loading financials..." />
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 12, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ color: c.text, fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            Financials
          </h1>
          <p style={{ color: c.textMuted, fontSize: 12, margin: '2px 0 0' }}>
            Profit and loss overview for the selected period
          </p>
        </div>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
        />
      </div>

      {/* KPI Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}>
        <StatCard
          title="Total Revenue"
          value={formatUSD(totalRevenue)}
          icon={<Icons.DollarSign size={18} />}
          subtitle={`${orders.length} order${orders.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          title="Total Costs"
          value={formatUSD(totalCosts)}
          icon={<Icons.CreditCard size={18} />}
        />
        <StatCard
          title="Net Profit"
          value={formatUSD(netProfit)}
          icon={<Icons.BarChart size={18} />}
          subtitle={netProfit >= 0 ? 'Profitable' : 'Loss'}
        />
        <StatCard
          title="Profit Margin"
          value={formatPercent(profitMargin)}
          icon={<Icons.BarChart size={18} />}
          subtitle={profitMargin >= 20 ? 'Healthy margin' : profitMargin >= 0 ? 'Thin margin' : 'Negative margin'}
        />
      </div>

      {/* P&L Statement */}
      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Profit & Loss Statement</SectionTitle>

        {/* Revenue section */}
        <div style={{
          padding: '8px 12px', background: c.successMuted,
          borderRadius: 8, marginBottom: 8,
        }}>
          <span style={{ color: c.success, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Revenue
          </span>
        </div>
        <div style={{ padding: '0 4px', marginBottom: 12 }}>
          <PnlRow label="Order Subtotals" amount={revenueBreakdown.orderSubtotals} indent />
          <PnlRow label="Shipping Income" amount={revenueBreakdown.shippingIncome} indent />
          <PnlRow label="Tax Collected" amount={revenueBreakdown.taxCollected} indent />
          <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 4, paddingTop: 4 }}>
            <PnlRow label="Total Revenue" amount={totalRevenue} bold color={c.success} />
          </div>
        </div>

        {/* Costs section */}
        <div style={{
          padding: '8px 12px', background: c.dangerMuted,
          borderRadius: 8, marginBottom: 8,
        }}>
          <span style={{ color: c.danger, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Costs
          </span>
        </div>
        <div style={{ padding: '0 4px', marginBottom: 12 }}>
          <PnlRow label="Product Costs (COGS)" amount={costBreakdown.productCosts} indent />
          <PnlRow label="Shipping Costs" amount={costBreakdown.shippingCosts} indent />
          <PnlRow label="Gateway / Transaction Fees" amount={costBreakdown.gatewayFees} indent />
          <PnlRow label="Customs Duties" amount={costBreakdown.customsDuties} indent />
          <PnlRow label="Operating Expenses" amount={costBreakdown.expenses} indent />
          <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 4, paddingTop: 4 }}>
            <PnlRow label="Total Costs" amount={totalCosts} bold color={c.danger} />
          </div>
        </div>

        {/* Profit */}
        <div style={{
          padding: '12px 16px', borderRadius: 8,
          background: netProfit >= 0 ? c.successMuted : c.dangerMuted,
          border: `1px solid ${netProfit >= 0 ? c.success : c.danger}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              color: netProfit >= 0 ? c.success : c.danger,
              fontSize: 16, fontWeight: 700,
            }}>
              Net Profit
            </span>
            <span style={{
              color: netProfit >= 0 ? c.success : c.danger,
              fontSize: 20, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatUSD(netProfit)}
            </span>
          </div>
          <p style={{
            color: netProfit >= 0 ? c.success : c.danger,
            fontSize: 12, margin: '4px 0 0', opacity: 0.8,
          }}>
            Margin: {formatPercent(profitMargin)}
          </p>
        </div>
      </Card>

      {/* Charts row: Revenue Trend + Cost Breakdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Revenue Trend Line Chart */}
        <Card>
          <SectionTitle>Revenue Trend (6 Months)</SectionTitle>
          {revenueTrendData.every(m => m.revenue === 0) ? (
            <Empty title="No revenue data" description="No orders found for the past 6 months." />
          ) : (
            <div style={{ width: '100%', height: isMobile ? 240 : 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: c.textMuted, fontSize: 11 }}
                    axisLine={{ stroke: c.border }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: c.textMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                    width={52}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={c.accent}
                    strokeWidth={2}
                    dot={{ r: 4, fill: c.accent, stroke: c.surface, strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: c.accent, stroke: c.surface, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Cost Breakdown Pie Chart */}
        <Card>
          <SectionTitle>Cost Breakdown</SectionTitle>
          {costPieData.length === 0 ? (
            <Empty title="No cost data" description="No costs recorded for this period." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', height: isMobile ? 200 : 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 40 : 50}
                      outerRadius={isMobile ? 70 : 85}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                    >
                      {costPieData.map((entry, i) => (
                        <Cell key={i} fill={COST_PIE_COLORS[i % COST_PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <PieLegend data={costPieData} colors={COST_PIE_COLORS} />
            </div>
          )}
        </Card>
      </div>

      {/* Payment Method Distribution */}
      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Payment Method Distribution</SectionTitle>
        {paymentPieData.length === 0 ? (
          <Empty title="No payment data" description="No orders with payment methods found." />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            gap: 24,
          }}>
            <div style={{ width: isMobile ? '100%' : 280, height: 220, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                  >
                    {paymentPieData.map((entry, i) => (
                      <Cell key={i} fill={PAYMENT_PIE_COLORS[i % PAYMENT_PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PaymentPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, width: '100%' }}>
              {paymentPieData.map((entry, i) => {
                const totalOrders = paymentPieData.reduce((s, item) => s + item.value, 0)
                const pct = totalOrders > 0 ? ((entry.value / totalOrders) * 100).toFixed(1) : '0.0'
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: i < paymentPieData.length - 1 ? `1px solid ${c.border}` : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: PAYMENT_PIE_COLORS[i % PAYMENT_PIE_COLORS.length],
                        flexShrink: 0,
                      }} />
                      <span style={{ color: c.text, fontSize: 13, fontWeight: 500 }}>
                        {entry.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: c.textSecondary, fontSize: 12 }}>
                        {entry.value} order{entry.value !== 1 ? 's' : ''}
                      </span>
                      <span style={{ color: c.text, fontSize: 13, fontWeight: 600, minWidth: 44, textAlign: 'right' }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Expenses Section */}
      <Card padding="0">
        <div style={{ padding: '16px 20px 0' }}>
          <SectionTitle
            actions={
              !isViewer ? (
                <Btn size="sm" onClick={openAddExpense} icon={<Icons.Plus size={14} />}>
                  Add Expense
                </Btn>
              ) : null
            }
          >
            Expenses
          </SectionTitle>
        </div>

        {pagedExpenses.length === 0 ? (
          <div style={{ padding: '0 20px 20px' }}>
            <Empty
              title="No expenses"
              description="No expenses recorded for the selected period."
              action={!isViewer ? (
                <Btn size="sm" variant="outline" onClick={openAddExpense} icon={<Icons.Plus size={14} />}>
                  Add Expense
                </Btn>
              ) : undefined}
            />
          </div>
        ) : isMobile ? (
          /* Mobile card layout */
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pagedExpenses.map(expense => (
              <div
                key={expense.id}
                style={{
                  padding: '12px 14px', borderRadius: 8,
                  border: `1px solid ${c.border}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px',
                    borderRadius: 9999, background: c.accentMuted, color: c.accent,
                  }}>
                    {expense.category}
                  </span>
                  <span style={{ color: c.text, fontSize: 14, fontWeight: 700 }}>
                    {formatUSD(expense.amount)}
                  </span>
                </div>
                {expense.description && (
                  <p style={{ color: c.text, fontSize: 13, margin: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {expense.description}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: c.textMuted, fontSize: 11 }}>
                      {formatDate(expense.date)}
                    </span>
                    {expense.recurring && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1px 6px',
                        borderRadius: 4, background: c.infoMuted, color: c.info,
                      }}>
                        Recurring
                      </span>
                    )}
                  </div>
                  {!isViewer && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Btn variant="ghost" size="sm" onClick={() => openEditExpense(expense)}>
                        <Icons.Edit size={13} />
                      </Btn>
                      <Btn variant="ghost" size="sm" onClick={() => openDeleteExpense(expense.id)}>
                        <Icons.Trash size={13} style={{ color: c.danger }} />
                      </Btn>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop table */
          <div style={{ borderTop: `1px solid ${c.border}`, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: c.surfaceHover }}>
                  <th style={{
                    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                    color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: `2px solid ${c.border}`,
                  }}>Category</th>
                  <th style={{
                    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                    color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: `2px solid ${c.border}`,
                  }}>Description</th>
                  <th style={{
                    padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600,
                    color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: `2px solid ${c.border}`,
                  }}>Amount</th>
                  <th style={{
                    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                    color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: `2px solid ${c.border}`,
                  }}>Date</th>
                  <th style={{
                    padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600,
                    color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: `2px solid ${c.border}`,
                  }}>Recurring</th>
                  {!isViewer && (
                    <th style={{
                      padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600,
                      color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                      borderBottom: `2px solid ${c.border}`,
                      width: 80,
                    }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pagedExpenses.map((expense, i) => (
                  <tr
                    key={expense.id}
                    style={{
                      borderBottom: i < pagedExpenses.length - 1 ? `1px solid ${c.border}` : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = c.surfaceHover }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px',
                        borderRadius: 9999, background: c.accentMuted, color: c.accent,
                        whiteSpace: 'nowrap',
                      }}>
                        {expense.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: c.text, fontSize: 13, maxWidth: 300 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {expense.description || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: c.text, whiteSpace: 'nowrap' }}>
                      {formatUSD(expense.amount)}
                    </td>
                    <td style={{ padding: '10px 12px', color: c.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(expense.date)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {expense.recurring ? (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px',
                          borderRadius: 9999, background: c.infoMuted, color: c.info,
                        }}>
                          Yes
                        </span>
                      ) : (
                        <span style={{ color: c.textMuted, fontSize: 12 }}>No</span>
                      )}
                    </td>
                    {!isViewer && (
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <Btn variant="ghost" size="sm" onClick={() => openEditExpense(expense)}>
                            <Icons.Edit size={13} />
                          </Btn>
                          <Btn variant="ghost" size="sm" onClick={() => openDeleteExpense(expense.id)}>
                            <Icons.Trash size={13} style={{ color: c.danger }} />
                          </Btn>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '0 20px' }}>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* Expense Add/Edit Modal */}
      <Modal
        open={expenseModal}
        onClose={closeExpenseModal}
        title={editingExpenseId ? 'Edit Expense' : 'Add Expense'}
        width={480}
      >
        <Select
          label="Category"
          value={expenseForm.category}
          onChange={v => setExpenseForm(f => ({ ...f, category: v }))}
          options={CATEGORY_OPTIONS}
          placeholder="Select category..."
          required
        />
        <Field
          label="Description"
          value={expenseForm.description}
          onChange={v => setExpenseForm(f => ({ ...f, description: v }))}
          placeholder="Brief description of the expense"
        />
        <Field
          label="Amount (USD)"
          type="number"
          value={expenseForm.amount}
          onChange={v => setExpenseForm(f => ({ ...f, amount: v }))}
          placeholder="0.00"
          min="0"
          step="0.01"
          required
        />
        <Field
          label="Date"
          type="date"
          value={expenseForm.date}
          onChange={v => setExpenseForm(f => ({ ...f, date: v }))}
          required
        />

        {/* Recurring toggle */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', fontSize: 13, color: c.text,
          }}>
            <div
              onClick={() => setExpenseForm(f => ({ ...f, recurring: !f.recurring }))}
              style={{
                width: 18, height: 18, borderRadius: 4,
                border: `1.5px solid ${expenseForm.recurring ? c.accent : c.border}`,
                background: expenseForm.recurring ? c.accent : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', flexShrink: 0, cursor: 'pointer',
              }}
            >
              {expenseForm.recurring && <Icons.Check size={12} style={{ color: '#0a0c14' }} />}
            </div>
            <span onClick={() => setExpenseForm(f => ({ ...f, recurring: !f.recurring }))}>
              Recurring expense (monthly)
            </span>
          </label>
        </div>

        {expenseError && (
          <p style={{ color: c.danger, fontSize: 12, marginBottom: 12 }}>{expenseError}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Btn variant="secondary" onClick={closeExpenseModal}>Cancel</Btn>
          <Btn onClick={saveExpense} loading={expenseSaving} icon={<Icons.Save size={14} />}>
            {editingExpenseId ? 'Update' : 'Save'}
          </Btn>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={deleteModal}
        onClose={() => { setDeleteModal(false); setDeletingExpenseId(null) }}
        onConfirm={confirmDeleteExpense}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
