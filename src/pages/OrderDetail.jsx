// Supploxi — Order Detail / Edit Page

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useColors, Card, SectionTitle, Btn, Field, Select, Textarea, Badge,
  Modal, Alert, Tabs, formatUSD, formatDate, formatDateTime, Icons, Loading,
} from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import useIsMobile from '../hooks/useIsMobile'

// ─── Constants ────────────────────────────────────────────────

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'returned', label: 'Returned' },
]

const FULFILLMENT_STATUSES = [
  { value: 'unfulfilled', label: 'Unfulfilled' },
  { value: 'partial', label: 'Partially Fulfilled' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'returned', label: 'Returned' },
]

const PLATFORMS = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'walmart', label: 'Walmart' },
  { value: 'ebay', label: 'eBay' },
  { value: 'etsy', label: 'Etsy' },
  { value: 'tiktok', label: 'TikTok Shop' },
  { value: 'website', label: 'Website' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Other' },
]

const CARRIERS = [
  'USPS', 'UPS', 'FedEx', 'DHL', 'Amazon Logistics', 'OnTrac', 'LaserShip', 'Other',
]

function statusBadgeVariant(status) {
  const map = {
    pending: 'warning',
    confirmed: 'info',
    processing: 'info',
    shipped: 'default',
    delivered: 'success',
    cancelled: 'danger',
    refunded: 'danger',
    returned: 'muted',
  }
  return map[status] || 'muted'
}

function fulfillmentBadgeVariant(status) {
  const map = {
    unfulfilled: 'warning',
    partial: 'info',
    fulfilled: 'success',
    returned: 'danger',
  }
  return map[status] || 'muted'
}

function shipmentBadgeVariant(status) {
  const map = {
    pending: 'warning',
    in_transit: 'info',
    out_for_delivery: 'default',
    delivered: 'success',
    exception: 'danger',
    returned: 'muted',
  }
  return map[status] || 'muted'
}

function labelForStatus(value, options) {
  const match = options.find(o => o.value === value)
  return match ? match.label : value || '-'
}

// ─── Component ────────────────────────────────────────────────

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const c = useColors()
  const { isViewer } = useAuth()
  const isMobile = useIsMobile()

  // Data state
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [shipments, setShipments] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')

  // Edit state
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState(null)

  // Tracking modal
  const [trackingModalOpen, setTrackingModalOpen] = useState(false)
  const [newTracking, setNewTracking] = useState({ tracking_number: '', carrier: '', status: 'pending' })
  const [addingTracking, setAddingTracking] = useState(false)

  // Tabs
  const [activeTab, setActiveTab] = useState('details')

  // ─── Load Data ────────────────────────────────────────────

  const loadOrder = useCallback(async () => {
    setLoadingData(true)
    setError('')

    try {
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()

      if (orderErr) throw orderErr
      if (!orderData) throw new Error('Order not found')

      setOrder(orderData)

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id)
        .order('id', { ascending: true })

      setItems(itemsData || [])

      const { data: shipmentsData } = await supabase
        .from('shipments')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: false })

      setShipments(shipmentsData || [])

      const { data: logData } = await supabase
        .from('activity_log')
        .select('*')
        .eq('entity_type', 'order')
        .eq('entity_id', id)
        .order('created_at', { ascending: false })
        .limit(50)

      setActivityLog(logData || [])
    } catch (err) {
      setError(err.message || 'Failed to load order')
    } finally {
      setLoadingData(false)
    }
  }, [id])

  useEffect(() => {
    if (id) loadOrder()
  }, [id, loadOrder])

  // ─── Field Updaters ───────────────────────────────────────

  function updateOrder(field, value) {
    setOrder(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  function updateItem(index, field, value) {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setDirty(true)
  }

  // ─── Profit Calculation ───────────────────────────────────

  function calcProfit(o) {
    if (!o) return 0
    const total = parseFloat(o.total) || 0
    const gatewayFee = parseFloat(o.gateway_fee) || 0
    const productCost = parseFloat(o.product_cost) || 0
    const shippingCost = parseFloat(o.shipping_cost) || 0
    const customsDuty = parseFloat(o.customs_duty) || 0
    const adjustments = parseFloat(o.adjustments) || 0
    return total - gatewayFee - productCost - shippingCost - customsDuty + adjustments
  }

  const profit = calcProfit(order)
  const profitMargin = order && parseFloat(order.total)
    ? ((profit / parseFloat(order.total)) * 100).toFixed(1)
    : '0.0'

  // ─── Save ─────────────────────────────────────────────────

  async function handleSave() {
    if (isViewer || !order) return
    setSaving(true)
    setSaveMessage(null)

    try {
      const computedProfit = calcProfit(order)

      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          status: order.status,
          fulfillment_status: order.fulfillment_status,
          platform: order.platform,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_phone: order.customer_phone,
          shipping_address: order.shipping_address,
          shipping_city: order.shipping_city,
          shipping_state: order.shipping_state,
          shipping_zip: order.shipping_zip,
          shipping_country: order.shipping_country,
          notes: order.notes,
          subtotal: parseFloat(order.subtotal) || 0,
          shipping: parseFloat(order.shipping) || 0,
          tax: parseFloat(order.tax) || 0,
          discount: parseFloat(order.discount) || 0,
          total: parseFloat(order.total) || 0,
          gateway_fee: parseFloat(order.gateway_fee) || 0,
          product_cost: parseFloat(order.product_cost) || 0,
          shipping_cost: parseFloat(order.shipping_cost) || 0,
          customs_duty: parseFloat(order.customs_duty) || 0,
          adjustments: parseFloat(order.adjustments) || 0,
          profit: computedProfit,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (orderErr) throw orderErr

      for (const item of items) {
        const { error: itemErr } = await supabase
          .from('order_items')
          .update({
            unit_cost: parseFloat(item.unit_cost) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        if (itemErr) throw itemErr
      }

      await supabase.from('activity_log').insert({
        entity_type: 'order',
        entity_id: id,
        action: 'updated',
        description: 'Order details updated',
        created_at: new Date().toISOString(),
      })

      setDirty(false)
      setSaveMessage({ variant: 'success', text: 'Order saved successfully.' })

      const { data: logData } = await supabase
        .from('activity_log')
        .select('*')
        .eq('entity_type', 'order')
        .eq('entity_id', id)
        .order('created_at', { ascending: false })
        .limit(50)

      setActivityLog(logData || [])
    } catch (err) {
      setSaveMessage({ variant: 'danger', text: err.message || 'Failed to save order.' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Add Tracking ─────────────────────────────────────────

  async function handleAddTracking() {
    if (!newTracking.tracking_number.trim() || !newTracking.carrier) return
    setAddingTracking(true)

    try {
      const { data, error: shipErr } = await supabase
        .from('shipments')
        .insert({
          order_id: id,
          tracking_number: newTracking.tracking_number.trim(),
          carrier: newTracking.carrier,
          status: newTracking.status || 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (shipErr) throw shipErr

      setShipments(prev => [data, ...prev])
      setTrackingModalOpen(false)
      setNewTracking({ tracking_number: '', carrier: '', status: 'pending' })

      await supabase.from('activity_log').insert({
        entity_type: 'order',
        entity_id: id,
        action: 'tracking_added',
        description: `Tracking added: ${newTracking.carrier} ${newTracking.tracking_number.trim()}`,
        created_at: new Date().toISOString(),
      })
    } catch (err) {
      setSaveMessage({ variant: 'danger', text: err.message || 'Failed to add tracking.' })
    } finally {
      setAddingTracking(false)
    }
  }

  // ─── Render Helpers ───────────────────────────────────────

  if (loadingData) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <Loading text="Loading order..." />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <Btn variant="ghost" onClick={() => navigate('/orders')} icon={<Icons.ArrowLeft size={16} />}>
          Back to Orders
        </Btn>
        <div style={{ marginTop: 24 }}>
          <Alert variant="danger">{error || 'Order not found.'}</Alert>
        </div>
      </div>
    )
  }

  // ─── Items Subtotal from line items ───────────────────────

  const itemsSubtotal = items.reduce((sum, it) => {
    return sum + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0))
  }, 0)

  const itemsTotalCost = items.reduce((sum, it) => {
    return sum + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_cost) || 0))
  }, 0)

  // ─── Financial Summary Row ────────────────────────────────

  function FinRow({ label, value, bold, color, border, editable, field, step }) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0',
        borderTop: border ? `1px solid ${c.border}` : 'none',
      }}>
        <span style={{
          fontSize: 13, color: bold ? c.text : c.textSecondary,
          fontWeight: bold ? 700 : 400,
        }}>
          {label}
        </span>
        {editable && !isViewer ? (
          <input
            type="number"
            value={order[field] ?? ''}
            onChange={e => updateOrder(field, e.target.value)}
            step={step || '0.01'}
            style={{
              width: 100, textAlign: 'right', padding: '4px 8px', fontSize: 13,
              fontFamily: 'inherit', background: c.inputBg, color: color || c.text,
              border: `1px solid ${c.border}`, borderRadius: 6, outline: 'none',
              fontWeight: bold ? 700 : 400,
            }}
            onFocus={e => { e.target.style.borderColor = c.accent }}
            onBlur={e => { e.target.style.borderColor = c.border }}
          />
        ) : (
          <span style={{
            fontSize: 13, fontWeight: bold ? 700 : 400,
            color: color || (bold ? c.text : c.textSecondary),
            fontVariantNumeric: 'tabular-nums',
          }}>
            {typeof value === 'number' ? formatUSD(value) : value}
          </span>
        )}
      </div>
    )
  }

  // ─── Main Render ──────────────────────────────────────────

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
        alignItems: 'center', gap: 12, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Btn variant="ghost" size="sm" onClick={() => navigate('/orders')} icon={<Icons.ArrowLeft size={16} />}>
            Orders
          </Btn>
          <h1 style={{
            color: c.text, fontSize: isMobile ? 20 : 24, fontWeight: 800,
            margin: 0, letterSpacing: '-0.02em',
          }}>
            Order {order.order_number || `#${id.slice(0, 8)}`}
          </h1>
          <Badge variant={statusBadgeVariant(order.status)}>
            {labelForStatus(order.status, ORDER_STATUSES)}
          </Badge>
          <Badge variant={fulfillmentBadgeVariant(order.fulfillment_status)}>
            {labelForStatus(order.fulfillment_status, FULFILLMENT_STATUSES)}
          </Badge>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {dirty && !isViewer && (
            <Btn
              variant="primary"
              icon={<Icons.Save size={14} />}
              onClick={handleSave}
              loading={saving}
            >
              Save Changes
            </Btn>
          )}
        </div>
      </div>

      {/* Save message */}
      {saveMessage && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant={saveMessage.variant} onClose={() => setSaveMessage(null)}>
            {saveMessage.text}
          </Alert>
        </div>
      )}

      {/* Viewer banner */}
      {isViewer && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="info">
            You have view-only access. Editing is disabled.
          </Alert>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { value: 'details', label: 'Details' },
          { value: 'activity', label: 'Activity', count: activityLog.length },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'details' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 380px',
          gap: 20,
          alignItems: 'start',
        }}>
          {/* ═══ LEFT COLUMN ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Order Info Card */}
            <Card>
              <SectionTitle>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.ShoppingCart size={18} style={{ color: c.accent }} />
                  Order Information
                </span>
              </SectionTitle>

              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 12,
              }}>
                <Field
                  label="Order Number"
                  value={order.order_number || ''}
                  readOnly
                  disabled
                />
                <Field
                  label="Order Date"
                  value={formatDateTime(order.order_date || order.created_at)}
                  readOnly
                  disabled
                />
                <Select
                  label="Platform"
                  value={order.platform || ''}
                  onChange={v => updateOrder('platform', v)}
                  options={PLATFORMS}
                  placeholder="Select platform"
                  disabled={isViewer}
                />
                <Select
                  label="Status"
                  value={order.status || ''}
                  onChange={v => updateOrder('status', v)}
                  options={ORDER_STATUSES}
                  placeholder="Select status"
                  disabled={isViewer}
                />
                <Select
                  label="Fulfillment Status"
                  value={order.fulfillment_status || ''}
                  onChange={v => updateOrder('fulfillment_status', v)}
                  options={FULFILLMENT_STATUSES}
                  placeholder="Select fulfillment"
                  disabled={isViewer}
                />
              </div>
            </Card>

            {/* Customer Info Card */}
            <Card>
              <SectionTitle>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.User size={18} style={{ color: c.accent }} />
                  Customer Information
                </span>
              </SectionTitle>

              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 12,
              }}>
                <Field
                  label="Customer Name"
                  value={order.customer_name || ''}
                  onChange={v => updateOrder('customer_name', v)}
                  placeholder="Full name"
                  disabled={isViewer}
                />
                <Field
                  label="Email"
                  type="email"
                  value={order.customer_email || ''}
                  onChange={v => updateOrder('customer_email', v)}
                  placeholder="email@example.com"
                  disabled={isViewer}
                />
                <Field
                  label="Phone"
                  value={order.customer_phone || ''}
                  onChange={v => updateOrder('customer_phone', v)}
                  placeholder="(555) 000-0000"
                  disabled={isViewer}
                />
              </div>

              <div style={{ marginTop: 4 }}>
                <p style={{
                  color: c.textSecondary, fontSize: 12, fontWeight: 600,
                  marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Shipping Address
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 12,
                }}>
                  <Field
                    label="Street Address"
                    value={order.shipping_address || ''}
                    onChange={v => updateOrder('shipping_address', v)}
                    placeholder="123 Main St"
                    disabled={isViewer}
                    style={{ gridColumn: isMobile ? undefined : '1 / -1' }}
                  />
                  <Field
                    label="City"
                    value={order.shipping_city || ''}
                    onChange={v => updateOrder('shipping_city', v)}
                    placeholder="City"
                    disabled={isViewer}
                  />
                  <Field
                    label="State"
                    value={order.shipping_state || ''}
                    onChange={v => updateOrder('shipping_state', v)}
                    placeholder="State"
                    disabled={isViewer}
                  />
                  <Field
                    label="ZIP Code"
                    value={order.shipping_zip || ''}
                    onChange={v => updateOrder('shipping_zip', v)}
                    placeholder="00000"
                    disabled={isViewer}
                  />
                  <Field
                    label="Country"
                    value={order.shipping_country || ''}
                    onChange={v => updateOrder('shipping_country', v)}
                    placeholder="US"
                    disabled={isViewer}
                  />
                </div>
              </div>
            </Card>

            {/* Items Card */}
            <Card padding="0">
              <div style={{ padding: '20px 20px 12px' }}>
                <SectionTitle style={{ marginBottom: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icons.Package size={18} style={{ color: c.accent }} />
                    Items ({items.length})
                  </span>
                </SectionTitle>
              </div>

              {items.length === 0 ? (
                <div style={{ padding: '16px 20px 20px', color: c.textMuted, fontSize: 13 }}>
                  No items found for this order.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%', borderCollapse: 'collapse', fontSize: 13,
                  }}>
                    <thead>
                      <tr>
                        {['Product', 'SKU', 'Qty', 'Unit Price', 'Unit Cost', 'Total'].map(h => (
                          <th key={h} style={{
                            padding: '8px 16px', textAlign: h === 'Product' ? 'left' : 'right',
                            fontSize: 11, fontWeight: 600, color: c.textSecondary,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                            borderBottom: `2px solid ${c.border}`, borderTop: `1px solid ${c.border}`,
                            whiteSpace: 'nowrap',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => {
                        const qty = parseFloat(item.quantity) || 0
                        const unitPrice = parseFloat(item.unit_price) || 0
                        const lineTotal = qty * unitPrice
                        return (
                          <tr key={item.id || idx} style={{
                            borderBottom: `1px solid ${c.border}`,
                          }}>
                            <td style={{
                              padding: '10px 16px', color: c.text, fontWeight: 500,
                              maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {item.product_name || '-'}
                            </td>
                            <td style={{
                              padding: '10px 16px', color: c.textSecondary, textAlign: 'right',
                              fontFamily: 'monospace', fontSize: 12,
                            }}>
                              {item.sku || '-'}
                            </td>
                            <td style={{
                              padding: '10px 16px', color: c.text, textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                            }}>
                              {qty}
                            </td>
                            <td style={{
                              padding: '10px 16px', color: c.text, textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                            }}>
                              {formatUSD(unitPrice)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              {!isViewer ? (
                                <input
                                  type="number"
                                  value={item.unit_cost ?? ''}
                                  onChange={e => updateItem(idx, 'unit_cost', e.target.value)}
                                  step="0.01"
                                  min="0"
                                  style={{
                                    width: 90, textAlign: 'right', padding: '4px 8px',
                                    fontSize: 13, fontFamily: 'inherit', background: c.inputBg,
                                    color: c.text, border: `1px solid ${c.border}`,
                                    borderRadius: 6, outline: 'none',
                                  }}
                                  onFocus={e => { e.target.style.borderColor = c.accent }}
                                  onBlur={e => { e.target.style.borderColor = c.border }}
                                />
                              ) : (
                                <span style={{
                                  color: c.textSecondary, fontVariantNumeric: 'tabular-nums',
                                }}>
                                  {formatUSD(parseFloat(item.unit_cost) || 0)}
                                </span>
                              )}
                            </td>
                            <td style={{
                              padding: '10px 16px', color: c.text, textAlign: 'right',
                              fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                            }}>
                              {formatUSD(lineTotal)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{
                          padding: '10px 16px', textAlign: 'right', color: c.textSecondary,
                          fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          Items Total
                        </td>
                        <td style={{
                          padding: '10px 16px', textAlign: 'right', color: c.textSecondary,
                          fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                        }}>
                          {formatUSD(itemsTotalCost)}
                        </td>
                        <td style={{
                          padding: '10px 16px', textAlign: 'right', color: c.text,
                          fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        }}>
                          {formatUSD(itemsSubtotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>

            {/* Notes Card */}
            <Card>
              <SectionTitle>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.ClipboardList size={18} style={{ color: c.accent }} />
                  Notes
                </span>
              </SectionTitle>
              <Textarea
                value={order.notes || ''}
                onChange={v => updateOrder('notes', v)}
                placeholder="Internal notes about this order..."
                rows={4}
                disabled={isViewer}
              />
            </Card>
          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Financial Summary Card */}
            <Card>
              <SectionTitle>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.DollarSign size={18} style={{ color: c.accent }} />
                  Financial Summary
                </span>
              </SectionTitle>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Revenue section */}
                <p style={{
                  color: c.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', margin: '0 0 4px',
                }}>
                  Revenue
                </p>
                <FinRow label="Subtotal" value={parseFloat(order.subtotal) || 0} />
                <FinRow label="Shipping" value={parseFloat(order.shipping) || 0} />
                <FinRow label="Tax" value={parseFloat(order.tax) || 0} />
                <FinRow label="Discount" value={-(parseFloat(order.discount) || 0)} />
                <FinRow
                  label="Total"
                  value={parseFloat(order.total) || 0}
                  bold
                  border
                />

                {/* Cost section */}
                <p style={{
                  color: c.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', margin: '16px 0 4px',
                }}>
                  Costs
                </p>
                <FinRow
                  label="Gateway Fee"
                  editable={true}
                  field="gateway_fee"
                  value={parseFloat(order.gateway_fee) || 0}
                />
                <FinRow
                  label="Product Cost"
                  editable={true}
                  field="product_cost"
                  value={parseFloat(order.product_cost) || 0}
                />
                <FinRow
                  label="Shipping Cost"
                  editable={true}
                  field="shipping_cost"
                  value={parseFloat(order.shipping_cost) || 0}
                />
                <FinRow
                  label="Customs Duty"
                  editable={true}
                  field="customs_duty"
                  value={parseFloat(order.customs_duty) || 0}
                />
                <FinRow
                  label="Adjustments"
                  editable={true}
                  field="adjustments"
                  value={parseFloat(order.adjustments) || 0}
                />

                {/* Profit */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0 4px', borderTop: `1px solid ${c.border}`, marginTop: 8,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
                    Profit
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: 18, fontWeight: 800,
                      color: profit >= 0 ? c.success : c.danger,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.02em',
                    }}>
                      {formatUSD(profit)}
                    </span>
                    <span style={{
                      display: 'block', fontSize: 11,
                      color: profit >= 0 ? c.success : c.danger,
                      fontWeight: 600, marginTop: 2,
                    }}>
                      {profitMargin}% margin
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tracking / Shipments Card */}
            <Card>
              <SectionTitle
                actions={
                  !isViewer && (
                    <Btn
                      variant="secondary"
                      size="sm"
                      icon={<Icons.Plus size={14} />}
                      onClick={() => setTrackingModalOpen(true)}
                    >
                      Add Tracking
                    </Btn>
                  )
                }
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.Truck size={18} style={{ color: c.accent }} />
                  Shipments ({shipments.length})
                </span>
              </SectionTitle>

              {shipments.length === 0 ? (
                <div style={{
                  padding: '20px 0', textAlign: 'center', color: c.textMuted, fontSize: 13,
                }}>
                  No shipments tracked yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {shipments.map((s, idx) => (
                    <div key={s.id || idx} style={{
                      padding: '12px 14px', borderRadius: 8,
                      background: c.surfaceHover, border: `1px solid ${c.border}`,
                    }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 6,
                      }}>
                        <span style={{
                          color: c.text, fontSize: 13, fontWeight: 600,
                          fontFamily: 'monospace',
                        }}>
                          {s.tracking_number}
                        </span>
                        <Badge variant={shipmentBadgeVariant(s.status)}>
                          {(s.status || 'pending').replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ color: c.textSecondary, fontSize: 12 }}>
                          {s.carrier || '-'}
                        </span>
                        <span style={{ color: c.textMuted, fontSize: 11 }}>
                          {formatDate(s.created_at)}
                        </span>
                      </div>
                      {s.estimated_delivery && (
                        <div style={{ marginTop: 4 }}>
                          <span style={{ color: c.textMuted, fontSize: 11 }}>
                            Est. delivery: {formatDate(s.estimated_delivery)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </div>
        </div>
      )}

      {/* ═══ ACTIVITY TAB ═══ */}
      {activeTab === 'activity' && (
        <Card>
          <SectionTitle>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icons.ClipboardList size={18} style={{ color: c.accent }} />
              Activity Log
            </span>
          </SectionTitle>

          {activityLog.length === 0 ? (
            <div style={{
              padding: '24px 0', textAlign: 'center', color: c.textMuted, fontSize: 13,
            }}>
              No activity recorded for this order.
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Timeline line */}
              <div style={{
                position: 'absolute', left: 7, top: 8, bottom: 8,
                width: 2, background: c.border, borderRadius: 1,
              }} />

              {activityLog.map((entry, idx) => (
                <div key={entry.id || idx} style={{
                  position: 'relative', paddingBottom: idx < activityLog.length - 1 ? 20 : 0,
                }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute', left: -20, top: 4,
                    width: 10, height: 10, borderRadius: '50%',
                    background: entry.action === 'created' ? c.success
                      : entry.action === 'tracking_added' ? c.info
                      : c.accent,
                    border: `2px solid ${c.surface}`,
                  }} />

                  <div style={{ paddingLeft: 8 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-start', gap: 12, flexWrap: 'wrap',
                    }}>
                      <div>
                        <span style={{
                          color: c.text, fontSize: 13, fontWeight: 600,
                        }}>
                          {(entry.action || '').replace(/_/g, ' ')}
                        </span>
                        {entry.description && (
                          <p style={{
                            color: c.textSecondary, fontSize: 12, margin: '2px 0 0',
                            lineHeight: 1.5,
                          }}>
                            {entry.description}
                          </p>
                        )}
                        {entry.user_email && (
                          <p style={{
                            color: c.textMuted, fontSize: 11, margin: '2px 0 0',
                          }}>
                            by {entry.user_email}
                          </p>
                        )}
                      </div>
                      <span style={{
                        color: c.textMuted, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {formatDateTime(entry.created_at)}
                      </span>
                    </div>

                    {entry.changes && typeof entry.changes === 'object' && (
                      <div style={{
                        marginTop: 8, padding: '8px 12px', borderRadius: 6,
                        background: c.surfaceHover, border: `1px solid ${c.border}`,
                      }}>
                        {Object.entries(entry.changes).map(([key, val]) => (
                          <div key={key} style={{
                            display: 'flex', gap: 8, fontSize: 12, padding: '2px 0',
                          }}>
                            <span style={{ color: c.textMuted, minWidth: 100 }}>
                              {key.replace(/_/g, ' ')}:
                            </span>
                            {val && typeof val === 'object' && val.from !== undefined ? (
                              <span style={{ color: c.textSecondary }}>
                                <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                                  {String(val.from || '-')}
                                </span>
                                {' '}
                                <Icons.ChevronRight size={10} style={{ verticalAlign: 'middle' }} />
                                {' '}
                                <span style={{ color: c.text, fontWeight: 500 }}>
                                  {String(val.to || '-')}
                                </span>
                              </span>
                            ) : (
                              <span style={{ color: c.text }}>
                                {String(val ?? '-')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ═══ ADD TRACKING MODAL ═══ */}
      <Modal
        open={trackingModalOpen}
        onClose={() => {
          setTrackingModalOpen(false)
          setNewTracking({ tracking_number: '', carrier: '', status: 'pending' })
        }}
        title="Add Tracking Number"
        width={440}
      >
        <Field
          label="Tracking Number"
          value={newTracking.tracking_number}
          onChange={v => setNewTracking(prev => ({ ...prev, tracking_number: v }))}
          placeholder="Enter tracking number"
          required
        />
        <Select
          label="Carrier"
          value={newTracking.carrier}
          onChange={v => setNewTracking(prev => ({ ...prev, carrier: v }))}
          options={CARRIERS}
          placeholder="Select carrier"
          required
        />
        <Select
          label="Status"
          value={newTracking.status}
          onChange={v => setNewTracking(prev => ({ ...prev, status: v }))}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'in_transit', label: 'In Transit' },
            { value: 'out_for_delivery', label: 'Out for Delivery' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'exception', label: 'Exception' },
            { value: 'returned', label: 'Returned' },
          ]}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Btn
            variant="secondary"
            onClick={() => {
              setTrackingModalOpen(false)
              setNewTracking({ tracking_number: '', carrier: '', status: 'pending' })
            }}
          >
            Cancel
          </Btn>
          <Btn
            variant="primary"
            icon={<Icons.Plus size={14} />}
            onClick={handleAddTracking}
            loading={addingTracking}
            disabled={!newTracking.tracking_number.trim() || !newTracking.carrier}
          >
            Add Tracking
          </Btn>
        </div>
      </Modal>

      {/* Sticky Save Bar (when dirty) */}
      {dirty && !isViewer && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 32px', background: c.surface,
          borderTop: `1px solid ${c.border}`,
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12,
          zIndex: 100, boxShadow: `0 -4px 12px ${c.shadow}`,
        }}>
          <span style={{ color: c.textSecondary, fontSize: 13, marginRight: 'auto' }}>
            <Icons.AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            You have unsaved changes
          </span>
          <Btn variant="secondary" onClick={loadOrder}>
            Discard
          </Btn>
          <Btn
            variant="primary"
            icon={<Icons.Save size={14} />}
            onClick={handleSave}
            loading={saving}
          >
            Save Changes
          </Btn>
        </div>
      )}
    </div>
  )
}
