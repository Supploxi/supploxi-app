import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useColors, Card, SectionTitle, Btn, SearchInput, Badge, DateRangePicker,
  useDateRange, Pagination, usePagination, useSort, SortHeader, Select,
  formatUSD, formatDate, Icons, Loading, Empty,
} from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import useIsMobile from '../hooks/useIsMobile'

const PAGE_SIZE = 25

const PO_STATUSES = [
  'Draft',
  'Sent',
  'Confirmed',
  'In Production',
  'Shipped',
  'Delivered',
  'Cancelled',
]

function poStatusVariant(status) {
  if (!status) return 'muted'
  const s = status.toLowerCase()
  if (s === 'draft') return 'muted'
  if (s === 'sent') return 'info'
  if (s === 'confirmed') return 'default'
  if (s === 'in production') return 'warning'
  if (s === 'shipped') return 'info'
  if (s === 'delivered') return 'success'
  if (s === 'cancelled') return 'danger'
  return 'muted'
}

export default function PurchaseOrders() {
  const c = useColors()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { user, isViewer } = useAuth()

  // Data state
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // Filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dateRange, setDateRange] = useDateRange('purchase_orders')

  // Sort state
  const { sortField, sortDir, onSort } = useSort('created_at', 'desc')

  // Load purchase orders from Supabase
  useEffect(() => {
    loadPurchaseOrders()
  }, [dateRange, sortField, sortDir])

  async function loadPurchaseOrders() {
    setLoading(true)
    try {
      let query = supabase
        .from('purchase_orders')
        .select('*, suppliers(name)', { count: 'exact' })
        .order(sortField || 'created_at', { ascending: sortDir === 'asc' })

      if (dateRange.from) {
        query = query.gte('created_at', dateRange.from + 'T00:00:00Z')
      }
      if (dateRange.to) {
        query = query.lte('created_at', dateRange.to + 'T23:59:59Z')
      }

      const { data, count, error } = await query

      if (error) throw error
      setPurchaseOrders(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Failed to load purchase orders:', err)
      setPurchaseOrders([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // Client-side filtering (search, status)
  const filtered = useMemo(() => {
    let result = [...purchaseOrders]

    // Search filter — matches PO number or supplier name
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(po =>
        (po.po_number || '').toLowerCase().includes(q) ||
        (po.suppliers?.name || '').toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter(po => po.status === statusFilter)
    }

    return result
  }, [purchaseOrders, search, statusFilter])

  // Sort filtered results
  const sorted = useMemo(() => {
    if (!sortField) return filtered
    return [...filtered].sort((a, b) => {
      let va, vb
      // Handle joined supplier name sort
      if (sortField === 'supplier_name') {
        va = a.suppliers?.name
        vb = b.suppliers?.name
      } else {
        va = a[sortField]
        vb = b[sortField]
      }
      if (va == null) va = ''
      if (vb == null) vb = ''
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va
      }
      const sa = String(va).toLowerCase()
      const sb = String(vb).toLowerCase()
      if (sa < sb) return sortDir === 'asc' ? -1 : 1
      if (sa > sb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortField, sortDir])

  // Pagination
  const { page, setPage, totalPages, paged } = usePagination(sorted, PAGE_SIZE)

  // Create a new draft PO
  async function createNewPO() {
    setCreating(true)
    try {
      // Try to get next PO number from database RPC, fallback to timestamp-based
      let poNumber
      try {
        const { data, error: rpcError } = await supabase.rpc('next_po_number')
        if (rpcError) throw rpcError
        poNumber = data
      } catch {
        // Fallback: generate PO number from timestamp
        const now = new Date()
        const yr = String(now.getFullYear()).slice(-2)
        const mo = String(now.getMonth() + 1).padStart(2, '0')
        const seq = String(now.getTime()).slice(-4)
        poNumber = `PO-${yr}${mo}-${seq}`
      }

      // Create the draft PO
      const { data: newPO, error: insertError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          status: 'Draft',
          user_id: user?.id,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      navigate(`/purchase-orders/${newPO.id}`)
    } catch (err) {
      console.error('Failed to create purchase order:', err)
    } finally {
      setCreating(false)
    }
  }

  const filteredCount = filtered.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row', gap: 12,
      }}>
        <div>
          <h1 style={{ color: c.text, fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            Purchase Orders
          </h1>
          <p style={{ color: c.textMuted, fontSize: 12, margin: '2px 0 0' }}>
            {filteredCount === totalCount
              ? `${totalCount} purchase order${totalCount !== 1 ? 's' : ''}`
              : `${filteredCount} of ${totalCount} purchase orders`
            }
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
          />
          {!isViewer && (
            <Btn
              variant="primary"
              size="sm"
              onClick={createNewPO}
              loading={creating}
              icon={<Icons.Plus size={13} />}
            >
              New PO
            </Btn>
          )}
        </div>
      </div>

      {/* Filters toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search PO #, supplier..."
          style={{ minWidth: 220, flex: isMobile ? '1 1 100%' : '0 1 280px' }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            background: c.inputBg,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            padding: '8px 32px 8px 12px',
            color: statusFilter !== 'All' ? c.text : c.textSecondary,
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: 'pointer',
            outline: 'none',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b949e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          <option value="All">All Statuses</option>
          {PO_STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? <Loading text="Loading purchase orders..." /> : (
        <>
          {paged.length === 0 ? (
            <Empty
              title="No purchase orders found"
              description={search || statusFilter !== 'All'
                ? 'Try adjusting your filters or search terms.'
                : 'Create a new purchase order to get started.'
              }
            />
          ) : isMobile ? (
            /* Mobile card layout */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paged.map(po => (
                <Card
                  key={po.id}
                  hover
                  padding="14px 16px"
                  onClick={() => navigate(`/purchase-orders/${po.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: c.text, fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>
                      {po.po_number}
                    </span>
                    <Badge variant={poStatusVariant(po.status)}>
                      {po.status || 'Unknown'}
                    </Badge>
                  </div>
                  <div style={{ color: c.text, fontSize: 14, fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {po.suppliers?.name || '--'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: c.textSecondary, fontSize: 12 }}>
                      {po.item_count != null ? `${po.item_count} item${po.item_count !== 1 ? 's' : ''}` : '--'}
                    </span>
                    <span style={{ color: c.text, fontWeight: 700, fontSize: 15 }}>
                      {formatUSD(po.total)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: c.textMuted, fontSize: 12 }}>
                      {formatDate(po.created_at)}
                    </span>
                    {po.expected_delivery && (
                      <span style={{ color: c.textSecondary, fontSize: 11 }}>
                        ETA: {formatDate(po.expected_delivery)}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            /* Desktop table layout */
            <div style={{
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: c.surfaceHover }}>
                    <SortHeader label="PO #" field="po_number" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Supplier" field="supplier_name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Items" field="item_count" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Total" field="total" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Expected Delivery" field="expected_delivery" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Created" field="created_at" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  </tr>
                </thead>
                <tbody>
                  {paged.map((po, i) => (
                    <tr
                      key={po.id}
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: i < paged.length - 1 ? `1px solid ${c.border}` : 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = c.surfaceHover }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: c.text, fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>
                          {po.po_number}
                        </span>
                      </td>
                      <td style={{ padding: '12px', maxWidth: 220 }}>
                        <div style={{ color: c.text, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {po.suppliers?.name || '--'}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Badge variant={poStatusVariant(po.status)}>
                          {po.status || 'Unknown'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: c.textSecondary, fontSize: 13 }}>
                          {po.item_count != null ? po.item_count : '--'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: c.text, fontWeight: 600, fontSize: 13 }}>
                          {formatUSD(po.total)}
                        </span>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: c.textSecondary, fontSize: 12 }}>
                          {formatDate(po.expected_delivery)}
                        </span>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: c.textSecondary, fontSize: 12 }}>
                          {formatDate(po.created_at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: c.textMuted, fontSize: 12 }}>
              {filteredCount > 0
                ? `${(page - 1) * PAGE_SIZE + 1}--${Math.min(page * PAGE_SIZE, filteredCount)} of ${filteredCount}`
                : '0 purchase orders'
              }
            </span>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  )
}
