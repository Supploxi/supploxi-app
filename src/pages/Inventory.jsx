// Supploxi — Inventory Page
// Stock levels overview and inventory movement tracking

import { useState, useEffect, useMemo } from 'react'
import {
  useColors, Card, StatCard, SectionTitle, Btn, Field, Select, SearchInput,
  Badge, Modal, Tabs, Pagination, usePagination, formatUSD, formatDate,
  formatNumber, Icons, Loading, Empty,
} from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import useIsMobile from '../hooks/useIsMobile'

const PAGE_SIZE = 25

// Movement types that add to stock
const INBOUND_TYPES = ['purchase_in', 'return_in', 'adjustment_in']
// Movement types that subtract from stock
const OUTBOUND_TYPES = ['sale_out', 'damage_out', 'adjustment_out']

// All movement type options for the select dropdown
const MOVEMENT_TYPE_OPTIONS = [
  { value: 'purchase_in', label: 'Purchase In' },
  { value: 'sale_out', label: 'Sale Out' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'return_in', label: 'Return In' },
  { value: 'damage_out', label: 'Damage Out' },
]

// Map movement type to Badge variant
function movementTypeVariant(type) {
  if (type === 'purchase_in') return 'success'
  if (type === 'sale_out') return 'info'
  if (type === 'adjustment' || type === 'adjustment_in' || type === 'adjustment_out') return 'warning'
  if (type === 'return_in') return 'default'
  if (type === 'damage_out') return 'danger'
  return 'muted'
}

// Human-readable label for movement type
function movementTypeLabel(type) {
  if (type === 'purchase_in') return 'Purchase In'
  if (type === 'sale_out') return 'Sale Out'
  if (type === 'adjustment') return 'Adjustment'
  if (type === 'adjustment_in') return 'Adjustment In'
  if (type === 'adjustment_out') return 'Adjustment Out'
  if (type === 'return_in') return 'Return In'
  if (type === 'damage_out') return 'Damage Out'
  return type || 'Unknown'
}

// Determine stock status based on current stock vs reorder_point
function getStockStatus(currentStock, reorderPoint) {
  if (currentStock <= 0) return { label: 'Out of Stock', variant: 'danger' }
  if (reorderPoint && currentStock < reorderPoint) return { label: 'Low', variant: 'warning' }
  return { label: 'In Stock', variant: 'success' }
}

// Compute the effective quantity change for a movement
function effectiveQuantity(movement) {
  const qty = parseFloat(movement.quantity) || 0
  const type = movement.type || ''

  // For "adjustment" type, the quantity sign determines direction
  if (type === 'adjustment') return qty

  if (INBOUND_TYPES.includes(type)) return Math.abs(qty)
  if (OUTBOUND_TYPES.includes(type)) return -Math.abs(qty)

  // Fallback: use the raw quantity as-is
  return qty
}

export default function Inventory() {
  const c = useColors()
  const { user, isViewer } = useAuth()
  const isMobile = useIsMobile()

  // Data state
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  // Tab state
  const [activeTab, setActiveTab] = useState('stock')

  // Stock Levels tab state
  const [stockSearch, setStockSearch] = useState('')

  // Movements tab state
  const [movementTypeFilter, setMovementTypeFilter] = useState('')

  // Adjust Stock modal state
  const [adjustModal, setAdjustModal] = useState(false)
  const [adjustProduct, setAdjustProduct] = useState(null)
  const [adjustForm, setAdjustForm] = useState({ quantity: '', notes: '' })
  const [adjustSaving, setAdjustSaving] = useState(false)
  const [adjustError, setAdjustError] = useState('')

  // Add Movement modal state
  const [addModal, setAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ product_id: '', type: '', quantity: '', notes: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  // ── Load data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [productsRes, movementsRes] = await Promise.all([
          supabase
            .from('products')
            .select('*')
            .order('name'),
          supabase
            .from('inventory_movements')
            .select('*')
            .order('created_at', { ascending: false }),
        ])

        if (!cancelled) {
          setProducts(productsRes.data || [])
          setMovements(movementsRes.data || [])
        }
      } catch (err) {
        console.error('Inventory data load failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user])

  // ── Build stock levels from movements ─────────────────────────
  const stockByProduct = useMemo(() => {
    const map = {}
    movements.forEach(m => {
      const pid = m.product_id
      if (!pid) return
      if (!map[pid]) map[pid] = 0
      map[pid] += effectiveQuantity(m)
    })
    return map
  }, [movements])

  // ── Enriched product list with stock data ─────────────────────
  const stockLevels = useMemo(() => {
    return products.map(p => {
      const currentStock = stockByProduct[p.id] || 0
      const costPrice = parseFloat(p.cost_price) || 0
      const stockValue = currentStock * costPrice
      const reorderPoint = parseInt(p.reorder_point) || 0
      const status = getStockStatus(currentStock, reorderPoint)
      return {
        ...p,
        currentStock,
        costPrice,
        stockValue,
        reorderPoint,
        status,
      }
    })
  }, [products, stockByProduct])

  // ── Filtered stock levels ─────────────────────────────────────
  const filteredStock = useMemo(() => {
    if (!stockSearch.trim()) return stockLevels
    const q = stockSearch.toLowerCase().trim()
    return stockLevels.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    )
  }, [stockLevels, stockSearch])

  // ── KPI calculations ──────────────────────────────────────────
  const totalProducts = products.length

  const totalStockValue = useMemo(
    () => stockLevels.reduce((sum, p) => sum + p.stockValue, 0),
    [stockLevels],
  )

  const lowStockCount = useMemo(
    () => stockLevels.filter(p => p.status.label === 'Low').length,
    [stockLevels],
  )

  const outOfStockCount = useMemo(
    () => stockLevels.filter(p => p.status.label === 'Out of Stock').length,
    [stockLevels],
  )

  // ── Filtered movements ────────────────────────────────────────
  const filteredMovements = useMemo(() => {
    if (!movementTypeFilter) return movements
    return movements.filter(m => m.type === movementTypeFilter)
  }, [movements, movementTypeFilter])

  // ── Product lookup map ────────────────────────────────────────
  const productMap = useMemo(() => {
    const map = {}
    products.forEach(p => { map[p.id] = p })
    return map
  }, [products])

  // ── Pagination for stock levels ───────────────────────────────
  const stockPagination = usePagination(filteredStock, PAGE_SIZE)

  // ── Pagination for movements ──────────────────────────────────
  const movementsPagination = usePagination(filteredMovements, PAGE_SIZE)

  // ── Adjust stock modal actions ────────────────────────────────
  function openAdjustModal(product) {
    setAdjustProduct(product)
    setAdjustForm({ quantity: '', notes: '' })
    setAdjustError('')
    setAdjustModal(true)
  }

  async function saveAdjustment() {
    if (isViewer) return
    const qty = parseFloat(adjustForm.quantity)
    if (!qty || qty === 0) {
      setAdjustError('Quantity must be a non-zero number (positive to add, negative to subtract)')
      return
    }
    if (!adjustProduct) return

    setAdjustSaving(true)
    setAdjustError('')
    try {
      const payload = {
        product_id: adjustProduct.id,
        type: 'adjustment',
        quantity: qty,
        notes: adjustForm.notes.trim() || null,
        created_at: new Date().toISOString(),
      }

      const { error: insErr } = await supabase
        .from('inventory_movements')
        .insert(payload)

      if (insErr) throw insErr

      // Refresh movements
      const { data: freshMovements } = await supabase
        .from('inventory_movements')
        .select('*')
        .order('created_at', { ascending: false })

      setMovements(freshMovements || [])
      setAdjustModal(false)
    } catch (e) {
      setAdjustError(e.message)
    } finally {
      setAdjustSaving(false)
    }
  }

  // ── Add Movement modal actions ────────────────────────────────
  function openAddModal() {
    setAddForm({ product_id: '', type: '', quantity: '', notes: '' })
    setAddError('')
    setAddModal(true)
  }

  async function saveMovement() {
    if (isViewer) return
    if (!addForm.product_id) {
      setAddError('Please select a product')
      return
    }
    if (!addForm.type) {
      setAddError('Please select a movement type')
      return
    }
    const qty = parseFloat(addForm.quantity)
    if (!qty || qty === 0) {
      setAddError('Quantity must be a non-zero number')
      return
    }

    setAddSaving(true)
    setAddError('')
    try {
      const payload = {
        product_id: addForm.product_id,
        type: addForm.type,
        quantity: qty,
        notes: addForm.notes.trim() || null,
        created_at: new Date().toISOString(),
      }

      const { error: insErr } = await supabase
        .from('inventory_movements')
        .insert(payload)

      if (insErr) throw insErr

      // Refresh movements
      const { data: freshMovements } = await supabase
        .from('inventory_movements')
        .select('*')
        .order('created_at', { ascending: false })

      setMovements(freshMovements || [])
      setAddModal(false)
    } catch (e) {
      setAddError(e.message)
    } finally {
      setAddSaving(false)
    }
  }

  // ── Product options for select dropdown ───────────────────────
  const productOptions = useMemo(() => {
    return products.map(p => ({
      value: p.id,
      label: `${p.name}${p.sku ? ` (${p.sku})` : ''}`,
    }))
  }, [products])

  // ── Movement type filter options ──────────────────────────────
  const movementFilterOptions = [
    { value: '', label: 'All Types' },
    ...MOVEMENT_TYPE_OPTIONS,
  ]

  // ── Loading state ─────────────────────────────────────────────
  if (loading) {
    return <Loading text="Loading inventory..." />
  }

  // ── Render Stock Levels Tab (Desktop Table) ───────────────────
  function renderStockTable() {
    return (
      <Card padding="0" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'SKU', 'Current Stock', 'Cost Price', 'Stock Value', 'Reorder Point', 'Status'].map(header => (
                  <th key={header} style={{
                    padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                    color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: `2px solid ${c.border}`, whiteSpace: 'nowrap',
                  }}>
                    {header}
                  </th>
                ))}
                {!isViewer && (
                  <th style={{
                    padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600,
                    color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: `2px solid ${c.border}`, whiteSpace: 'nowrap',
                  }}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {stockPagination.paged.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: i < stockPagination.paged.length - 1 ? `1px solid ${c.border}` : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = c.surfaceHover }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '10px 14px', fontSize: 13, color: c.text, fontWeight: 600 }}>
                    {p.name || '--'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: c.textSecondary, fontFamily: 'monospace' }}>
                    {p.sku || '--'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: c.text, fontWeight: 600 }}>
                    {formatNumber(p.currentStock)}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: c.textSecondary, whiteSpace: 'nowrap' }}>
                    {formatUSD(p.costPrice)}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: c.text, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatUSD(p.stockValue)}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: c.textSecondary }}>
                    {p.reorderPoint > 0 ? formatNumber(p.reorderPoint) : '--'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Badge variant={p.status.variant}>
                      {p.status.label}
                    </Badge>
                  </td>
                  {!isViewer && (
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Btn variant="ghost" size="sm" onClick={() => openAdjustModal(p)}>
                        Adjust
                      </Btn>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  // ── Render Stock Levels Tab (Mobile Cards) ────────────────────
  function renderStockCards() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stockPagination.paged.map(p => (
          <Card key={p.id} padding="14px 16px">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ color: c.text, fontWeight: 700, fontSize: 14 }}>{p.name || '--'}</div>
                {p.sku && <div style={{ color: c.textSecondary, fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>{p.sku}</div>}
              </div>
              <Badge variant={p.status.variant}>
                {p.status.label}
              </Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 8 }}>
              <div>
                <span style={{ color: c.textSecondary }}>Stock: </span>
                <span style={{ color: c.text, fontWeight: 600 }}>{formatNumber(p.currentStock)}</span>
              </div>
              <div>
                <span style={{ color: c.textSecondary }}>Cost Price: </span>
                <span style={{ color: c.text, fontWeight: 600 }}>{formatUSD(p.costPrice)}</span>
              </div>
              <div>
                <span style={{ color: c.textSecondary }}>Value: </span>
                <span style={{ color: c.text, fontWeight: 600 }}>{formatUSD(p.stockValue)}</span>
              </div>
              <div>
                <span style={{ color: c.textSecondary }}>Min Qty: </span>
                <span style={{ color: c.text, fontWeight: 600 }}>{p.reorderPoint > 0 ? formatNumber(p.reorderPoint) : '--'}</span>
              </div>
            </div>

            {!isViewer && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Btn variant="secondary" size="sm" onClick={() => openAdjustModal(p)}>
                  Adjust Stock
                </Btn>
              </div>
            )}
          </Card>
        ))}
      </div>
    )
  }

  // ── Render Movements Tab (Desktop Table) ──────────────────────
  function renderMovementsTable() {
    return (
      <Card padding="0" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Product', 'Type', 'Quantity', 'Notes'].map(header => (
                  <th key={header} style={{
                    padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                    color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: `2px solid ${c.border}`, whiteSpace: 'nowrap',
                  }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movementsPagination.paged.map((m, i) => {
                const product = productMap[m.product_id]
                const qty = parseFloat(m.quantity) || 0
                const isPositive = effectiveQuantity(m) > 0
                return (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: i < movementsPagination.paged.length - 1 ? `1px solid ${c.border}` : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = c.surfaceHover }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 14px', fontSize: 13, color: c.textSecondary, whiteSpace: 'nowrap' }}>
                      {formatDate(m.created_at)}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: c.text, fontWeight: 600 }}>
                      {product?.name || '--'}
                      {product?.sku && (
                        <span style={{ color: c.textMuted, fontWeight: 400, fontSize: 11, marginLeft: 6, fontFamily: 'monospace' }}>
                          {product.sku}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Badge variant={movementTypeVariant(m.type)}>
                        {movementTypeLabel(m.type)}
                      </Badge>
                    </td>
                    <td style={{
                      padding: '10px 14px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                      color: isPositive ? c.success : c.danger,
                    }}>
                      {isPositive ? '+' : ''}{formatNumber(qty)}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: c.textSecondary, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.notes || '--'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  // ── Render Movements Tab (Mobile Cards) ───────────────────────
  function renderMovementsCards() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {movementsPagination.paged.map(m => {
          const product = productMap[m.product_id]
          const qty = parseFloat(m.quantity) || 0
          const isPositive = effectiveQuantity(m) > 0
          return (
            <Card key={m.id} padding="14px 16px">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ color: c.text, fontWeight: 700, fontSize: 14 }}>
                    {product?.name || '--'}
                  </div>
                  <div style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>
                    {formatDate(m.created_at)}
                  </div>
                </div>
                <Badge variant={movementTypeVariant(m.type)}>
                  {movementTypeLabel(m.type)}
                </Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 15, fontWeight: 700,
                  color: isPositive ? c.success : c.danger,
                }}>
                  {isPositive ? '+' : ''}{formatNumber(qty)}
                </span>
                {m.notes && (
                  <span style={{ color: c.textSecondary, fontSize: 12, maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.notes}
                  </span>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div>
          <h1 style={{ color: c.text, fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Inventory</h1>
          <p style={{ color: c.textMuted, fontSize: 12, margin: '2px 0 0' }}>
            {totalProducts} product{totalProducts !== 1 ? 's' : ''} tracked
          </p>
        </div>
        {!isViewer && (
          <Btn onClick={openAddModal} icon={<Icons.Plus size={14} />}>
            Add Movement
          </Btn>
        )}
      </div>

      {/* KPI Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 12,
      }}>
        <StatCard
          title="Total Products"
          value={formatNumber(totalProducts)}
          icon={<Icons.Package size={18} />}
        />
        <StatCard
          title="Total Stock Value"
          value={formatUSD(totalStockValue)}
          icon={<Icons.DollarSign size={18} />}
        />
        <StatCard
          title="Low Stock Items"
          value={formatNumber(lowStockCount)}
          icon={<Icons.AlertTriangle size={18} />}
          subtitle={lowStockCount > 0 ? 'Below reorder point' : undefined}
        />
        <StatCard
          title="Out of Stock"
          value={formatNumber(outOfStockCount)}
          icon={<Icons.Warehouse size={18} />}
          subtitle={outOfStockCount > 0 ? 'Needs restocking' : undefined}
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { value: 'stock', label: 'Stock Levels', count: filteredStock.length },
          { value: 'movements', label: 'Movements', count: filteredMovements.length },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Stock Levels Tab */}
      {activeTab === 'stock' && (
        <>
          {/* Search */}
          <SearchInput
            value={stockSearch}
            onChange={setStockSearch}
            placeholder="Search by product name or SKU..."
            style={{ maxWidth: 420 }}
          />

          {filteredStock.length === 0 ? (
            <Empty
              title={stockSearch ? 'No products match your search' : 'No products found'}
              description={stockSearch ? 'Try a different search term' : 'Add products and record inventory movements to see stock levels here.'}
            />
          ) : (
            <>
              {isMobile ? renderStockCards() : renderStockTable()}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: c.textMuted, fontSize: 12 }}>
                  {filteredStock.length > 0
                    ? `${(stockPagination.page - 1) * PAGE_SIZE + 1}--${Math.min(stockPagination.page * PAGE_SIZE, filteredStock.length)} of ${filteredStock.length}`
                    : '0 products'
                  }
                </span>
                <Pagination
                  page={stockPagination.page}
                  totalPages={stockPagination.totalPages}
                  onPageChange={stockPagination.setPage}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* Movements Tab */}
      {activeTab === 'movements' && (
        <>
          {/* Filter toolbar */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Select
              value={movementTypeFilter}
              onChange={setMovementTypeFilter}
              options={movementFilterOptions}
              placeholder="All Types"
              style={{ marginBottom: 0, minWidth: 180, maxWidth: 240 }}
            />
          </div>

          {filteredMovements.length === 0 ? (
            <Empty
              title={movementTypeFilter ? 'No movements match this filter' : 'No inventory movements yet'}
              description={movementTypeFilter ? 'Try selecting a different movement type.' : 'Record your first inventory movement to start tracking stock.'}
              action={!isViewer && !movementTypeFilter ? (
                <Btn onClick={openAddModal} icon={<Icons.Plus size={14} />}>
                  Add Movement
                </Btn>
              ) : undefined}
            />
          ) : (
            <>
              {isMobile ? renderMovementsCards() : renderMovementsTable()}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: c.textMuted, fontSize: 12 }}>
                  {filteredMovements.length > 0
                    ? `${(movementsPagination.page - 1) * PAGE_SIZE + 1}--${Math.min(movementsPagination.page * PAGE_SIZE, filteredMovements.length)} of ${filteredMovements.length}`
                    : '0 movements'
                  }
                </span>
                <Pagination
                  page={movementsPagination.page}
                  totalPages={movementsPagination.totalPages}
                  onPageChange={movementsPagination.setPage}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* Adjust Stock Modal */}
      <Modal
        open={adjustModal}
        onClose={() => setAdjustModal(false)}
        title={adjustProduct ? `Adjust Stock - ${adjustProduct.name}` : 'Adjust Stock'}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Current stock info */}
          {adjustProduct && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16,
            }}>
              <div style={{ background: c.surfaceHover, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 18 }}>
                  {formatNumber(adjustProduct.currentStock)}
                </div>
                <div style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>Current Stock</div>
              </div>
              <div style={{ background: c.surfaceHover, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ color: c.info, fontWeight: 700, fontSize: 18 }}>
                  {formatUSD(adjustProduct.stockValue)}
                </div>
                <div style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>Stock Value</div>
              </div>
            </div>
          )}

          <Field
            label="Quantity (+ to add, - to subtract)"
            value={adjustForm.quantity}
            onChange={v => setAdjustForm(f => ({ ...f, quantity: v }))}
            type="number"
            placeholder="e.g. 50 or -10"
            required
          />
          <Field
            label="Notes"
            value={adjustForm.notes}
            onChange={v => setAdjustForm(f => ({ ...f, notes: v }))}
            placeholder="Reason for adjustment..."
          />

          {adjustError && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: c.dangerMuted, color: c.danger, marginTop: 4,
            }}>
              {adjustError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => setAdjustModal(false)}>Cancel</Btn>
            <Btn onClick={saveAdjustment} loading={adjustSaving}>Save Adjustment</Btn>
          </div>
        </div>
      </Modal>

      {/* Add Movement Modal */}
      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title="Add Movement"
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Select
            label="Product"
            value={addForm.product_id}
            onChange={v => setAddForm(f => ({ ...f, product_id: v }))}
            options={productOptions}
            placeholder="Select product..."
            required
          />
          <Select
            label="Movement Type"
            value={addForm.type}
            onChange={v => setAddForm(f => ({ ...f, type: v }))}
            options={MOVEMENT_TYPE_OPTIONS}
            placeholder="Select type..."
            required
          />
          <Field
            label="Quantity"
            value={addForm.quantity}
            onChange={v => setAddForm(f => ({ ...f, quantity: v }))}
            type="number"
            placeholder="e.g. 100"
            required
            min="1"
          />
          <Field
            label="Notes"
            value={addForm.notes}
            onChange={v => setAddForm(f => ({ ...f, notes: v }))}
            placeholder="Optional notes..."
          />

          {addError && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: c.dangerMuted, color: c.danger, marginTop: 4,
            }}>
              {addError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => setAddModal(false)}>Cancel</Btn>
            <Btn onClick={saveMovement} loading={addSaving}>Add Movement</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
