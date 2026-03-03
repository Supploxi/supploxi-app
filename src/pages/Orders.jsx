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
import { ORDER_STATUS_LABELS } from '../lib/shopify'

const PAGE_SIZE = 25

// Map status labels to Badge variants
function statusVariant(status) {
  if (!status) return 'muted'
  const s = status.toLowerCase()
  if (s === 'paid') return 'success'
  if (s === 'cancelled' || s === 'refunded') return 'danger'
  if (s === 'pending payment' || s === 'partially paid' || s === 'payment authorized') return 'warning'
  if (s === 'partially refunded') return 'warning'
  return 'muted'
}

function fulfillmentVariant(status) {
  if (!status) return 'muted'
  const s = status.toLowerCase()
  if (s === 'fulfilled') return 'success'
  if (s === 'unfulfilled') return 'warning'
  if (s === 'partially fulfilled') return 'info'
  if (s === 'restocked') return 'muted'
  return 'muted'
}

export default function Orders() {
  const c = useColors()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { user, isViewer } = useAuth()

  // Data state
  const [orders, setOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  // Filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [tagFilter, setTagFilter] = useState('')
  const [allTags, setAllTags] = useState([])
  const [dateRange, setDateRange] = useDateRange('orders')

  // Sort state
  const { sortField, sortDir, onSort } = useSort('created_at', 'desc')

  // Load unique tags from orders
  useEffect(() => {
    supabase
      .from('orders')
      .select('tags')
      .not('tags', 'eq', '')
      .not('tags', 'is', null)
      .then(({ data }) => {
        if (!data) return
        const tagSet = new Set()
        data.forEach(row => {
          if (row.tags) {
            row.tags.split(',').forEach(t => {
              const trimmed = t.trim()
              if (trimmed) tagSet.add(trimmed)
            })
          }
        })
        setAllTags(Array.from(tagSet).sort())
      })
  }, [])

  // Load orders from Supabase
  useEffect(() => {
    loadOrders()
  }, [dateRange, sortField, sortDir])

  async function loadOrders() {
    setLoading(true)
    try {
      let query = supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .order(sortField || 'created_at', { ascending: sortDir === 'asc' })

      if (dateRange.from) {
        query = query.gte('created_at', dateRange.from + 'T00:00:00Z')
      }
      if (dateRange.to) {
        query = query.lte('created_at', dateRange.to + 'T23:59:59Z')
      }

      const { data, count, error } = await query

      if (error) throw error
      setOrders(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Failed to load orders:', err)
      setOrders([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // Client-side filtering (search, status, tag)
  const filtered = useMemo(() => {
    let result = [...orders]

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(o =>
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_email || '').toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter(o =>
        o.financial_status === statusFilter ||
        o.fulfillment_status === statusFilter ||
        o.status === statusFilter
      )
    }

    // Tag filter
    if (tagFilter) {
      result = result.filter(o => {
        if (!o.tags) return false
        const orderTags = o.tags.split(',').map(t => t.trim())
        return orderTags.includes(tagFilter)
      })
    }

    return result
  }, [orders, search, statusFilter, tagFilter])

  // Sort filtered results
  const sorted = useMemo(() => {
    if (!sortField) return filtered
    return [...filtered].sort((a, b) => {
      let va = a[sortField]
      let vb = b[sortField]
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

  // Sync orders from Shopify
  async function syncOrders() {
    setSyncing(true)
    setSyncMsg('')
    try {
      // Load Shopify settings
      const { data: settingsRow, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'shopify')
        .single()

      if (settingsError || !settingsRow?.value) {
        setSyncMsg('Shopify is not configured. Go to Settings to connect your store.')
        return
      }

      const shopifyConfig = typeof settingsRow.value === 'string'
        ? JSON.parse(settingsRow.value)
        : settingsRow.value

      if (!shopifyConfig.shop || !shopifyConfig.accessToken) {
        setSyncMsg('Shopify credentials are missing. Check your Settings.')
        return
      }

      // Get existing platform IDs to skip duplicates
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('platform_order_id')

      const existingIds = (existingOrders || []).map(o => o.platform_order_id).filter(Boolean)

      // Fetch from Shopify
      const { fetchOrders: shopifyFetchOrders } = await import('../lib/shopify')
      const shopifyOrders = await shopifyFetchOrders({
        shop: shopifyConfig.shop,
        accessToken: shopifyConfig.accessToken,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        existingIds,
      })

      if (!shopifyOrders.length) {
        setSyncMsg('No new orders found in Shopify for the selected date range.')
        await loadOrders()
        return
      }

      // Upsert orders
      let upsertedCount = 0
      for (const order of shopifyOrders) {
        const { items, trackings, ...orderData } = order

        // Upsert the order
        const { data: upserted, error: orderError } = await supabase
          .from('orders')
          .upsert(
            { ...orderData, user_id: user?.id },
            { onConflict: 'platform_order_id' }
          )
          .select('id')
          .single()

        if (orderError) {
          console.error('Order upsert error:', orderError)
          continue
        }

        const orderId = upserted.id

        // Upsert order items
        if (items && items.length > 0) {
          const itemRows = items.map(item => ({
            ...item,
            order_id: orderId,
          }))

          const { error: itemsError } = await supabase
            .from('order_items')
            .upsert(itemRows, { onConflict: 'order_id,sku' })

          if (itemsError) {
            console.error('Order items upsert error:', itemsError)
          }
        }

        upsertedCount++
      }

      setSyncMsg(`Sync complete: ${upsertedCount} order${upsertedCount !== 1 ? 's' : ''} imported from Shopify.`)
      await loadOrders()
    } catch (err) {
      console.error('Sync error:', err)
      setSyncMsg(`Sync failed: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const filteredCount = filtered.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div>
          <h1 style={{ color: c.text, fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Orders</h1>
          <p style={{ color: c.textMuted, fontSize: 12, margin: '2px 0 0' }}>
            {filteredCount === totalCount
              ? `${totalCount} order${totalCount !== 1 ? 's' : ''}`
              : `${filteredCount} of ${totalCount} orders`
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
              variant="secondary"
              size="sm"
              onClick={syncOrders}
              loading={syncing}
              icon={<Icons.RefreshCw size={13} />}
            >
              Sync Shopify
            </Btn>
          )}
        </div>
      </div>

      {/* Sync message */}
      {syncMsg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: syncMsg.includes('failed') || syncMsg.includes('not configured') || syncMsg.includes('missing')
            ? c.dangerMuted : c.successMuted,
          color: syncMsg.includes('failed') || syncMsg.includes('not configured') || syncMsg.includes('missing')
            ? c.danger : c.success,
        }}>
          {syncMsg}
        </div>
      )}

      {/* Filters toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search order #, customer, email..."
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
          {ORDER_STATUS_LABELS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            style={{
              background: c.inputBg,
              border: `1px solid ${c.border}`,
              borderRadius: 8,
              padding: '8px 32px 8px 12px',
              color: tagFilter ? c.text : c.textSecondary,
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b949e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
              minWidth: 130,
            }}
          >
            <option value="">All Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? <Loading text="Loading orders..." /> : (
        <>
          {paged.length === 0 ? (
            <Empty
              title="No orders found"
              description={search || statusFilter !== 'All' || tagFilter
                ? 'Try adjusting your filters or search terms.'
                : 'Sync your Shopify store to import orders.'
              }
            />
          ) : isMobile ? (
            /* Mobile card layout */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paged.map(order => (
                <Card
                  key={order.id}
                  hover
                  padding="14px 16px"
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: c.text, fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>
                      {order.order_number}
                    </span>
                    <Badge variant={statusVariant(order.financial_status)}>
                      {order.financial_status || 'Unknown'}
                    </Badge>
                  </div>
                  <div style={{ color: c.text, fontSize: 14, fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {order.customer_name || '--'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Badge variant={fulfillmentVariant(order.fulfillment_status)} style={{ fontSize: 10 }}>
                      {order.fulfillment_status || 'Unfulfilled'}
                    </Badge>
                    <span style={{ color: c.text, fontWeight: 700, fontSize: 15 }}>
                      {formatUSD(order.total)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: c.textMuted, fontSize: 12 }}>
                      {formatDate(order.created_at)}
                    </span>
                    {order.tags && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {order.tags.split(',').slice(0, 2).map(tag => (
                          <span key={tag.trim()} style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px',
                            borderRadius: 4, background: c.surfaceHover, color: c.textSecondary,
                            whiteSpace: 'nowrap',
                          }}>
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
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
                    <SortHeader label="Order #" field="order_number" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Customer" field="customer_name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Status" field="financial_status" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Fulfillment" field="fulfillment_status" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Total" field="total" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="Date" field="created_at" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  </tr>
                </thead>
                <tbody>
                  {paged.map((order, i) => (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
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
                          {order.order_number}
                        </span>
                      </td>
                      <td style={{ padding: '12px', maxWidth: 220 }}>
                        <div style={{ color: c.text, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {order.customer_name || '--'}
                        </div>
                        {order.customer_email && (
                          <div style={{ color: c.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                            {order.customer_email}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Badge variant={statusVariant(order.financial_status)}>
                          {order.financial_status || 'Unknown'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Badge variant={fulfillmentVariant(order.fulfillment_status)}>
                          {order.fulfillment_status || 'Unfulfilled'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: c.text, fontWeight: 600, fontSize: 13 }}>
                          {formatUSD(order.total)}
                        </span>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: c.textSecondary, fontSize: 12 }}>
                          {formatDate(order.created_at)}
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
                : '0 orders'
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
