// Supploxi -- Purchase Order Detail / Edit Page

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useColors, Card, SectionTitle, Btn, Field, Select, Textarea, Badge,
  Modal, Alert, formatUSD, formatDate, Icons, Loading,
} from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { sendPurchaseOrder } from '../lib/email'
import useIsMobile from '../hooks/useIsMobile'

// ─── Constants ────────────────────────────────────────────────

const PO_STATUSES = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'In Production', label: 'In Production' },
  { value: 'Shipped', label: 'Shipped' },
  { value: 'Delivered', label: 'Delivered' },
  { value: 'Cancelled', label: 'Cancelled' },
]

const STATUS_FLOW = ['Draft', 'Sent', 'Confirmed', 'In Production', 'Shipped', 'Delivered']

const PAYMENT_TERMS = [
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 60', label: 'Net 60' },
  { value: 'Net 90', label: 'Net 90' },
  { value: '50/50', label: '50% Deposit / 50% on Shipment' },
  { value: '30/70', label: '30% Deposit / 70% on Shipment' },
  { value: 'T/T in Advance', label: 'T/T in Advance' },
  { value: 'L/C', label: 'Letter of Credit' },
  { value: 'COD', label: 'Cash on Delivery' },
]

function statusBadgeVariant(status) {
  const map = {
    'Draft': 'muted',
    'Sent': 'info',
    'Confirmed': 'default',
    'In Production': 'warning',
    'Shipped': 'info',
    'Delivered': 'success',
    'Cancelled': 'danger',
  }
  return map[status] || 'muted'
}

function allowedTransitions(current) {
  if (current === 'Cancelled') return ['Cancelled']
  const idx = STATUS_FLOW.indexOf(current)
  const next = []
  if (idx >= 0 && idx < STATUS_FLOW.length - 1) {
    next.push(STATUS_FLOW[idx + 1])
  }
  next.push(current)
  next.push('Cancelled')
  return [...new Set(next)]
}

// ─── Component ────────────────────────────────────────────────

export default function PurchaseOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const c = useColors()
  const { isViewer } = useAuth()
  const isMobile = useIsMobile()

  // Data state
  const [po, setPo] = useState(null)
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')

  // Edit state
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState(null)

  // Send state
  const [sending, setSending] = useState(false)

  // Add item modal
  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  // ─── Load Data ────────────────────────────────────────────

  const loadPO = useCallback(async () => {
    setLoadingData(true)
    setError('')

    try {
      const { data: poData, error: poErr } = await supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(*)')
        .eq('id', id)
        .single()

      if (poErr) throw poErr
      if (!poData) throw new Error('Purchase order not found')

      setPo(poData)

      const { data: itemsData } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', id)
        .order('id', { ascending: true })

      setItems(itemsData || [])

      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, company_name, email, contact_name')
        .order('company_name', { ascending: true })

      setSuppliers(suppliersData || [])

      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, sku, cost_price')
        .order('name', { ascending: true })

      setProducts(productsData || [])
    } catch (err) {
      setError(err.message || 'Failed to load purchase order')
    } finally {
      setLoadingData(false)
    }
  }, [id])

  useEffect(() => {
    if (id) loadPO()
  }, [id, loadPO])

  // ─── Field Updaters ───────────────────────────────────────

  function updatePO(field, value) {
    setPo(prev => ({ ...prev, [field]: value }))
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

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index))
    setDirty(true)
  }

  function addItemFromProduct(product) {
    const newItem = {
      _isNew: true,
      purchase_order_id: id,
      product_id: product.id,
      name: product.name,
      quantity: 1,
      unit_cost: product.cost_price || 0,
    }
    setItems(prev => [...prev, newItem])
    setDirty(true)
    setAddItemModalOpen(false)
    setProductSearch('')
  }

  function addBlankItem() {
    const newItem = {
      _isNew: true,
      purchase_order_id: id,
      product_id: null,
      name: '',
      quantity: 1,
      unit_cost: 0,
    }
    setItems(prev => [...prev, newItem])
    setDirty(true)
    setAddItemModalOpen(false)
    setProductSearch('')
  }

  // ─── Calculations ─────────────────────────────────────────

  const subtotal = items.reduce((sum, it) => {
    return sum + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_cost) || 0))
  }, 0)

  const total = subtotal

  // ─── Save ─────────────────────────────────────────────────

  async function handleSave() {
    if (isViewer || !po) return
    setSaving(true)
    setSaveMessage(null)

    try {
      const { error: poErr } = await supabase
        .from('purchase_orders')
        .update({
          supplier_id: po.supplier_id || null,
          status: po.status,
          payment_terms: po.payment_terms || null,
          expected_delivery: po.expected_delivery || null,
          notes: po.notes || null,
          total_value: total,
        })
        .eq('id', id)

      if (poErr) throw poErr

      // Delete removed items (items that existed in DB but are no longer in list)
      const currentItemIds = items.filter(it => it.id && !it._isNew).map(it => it.id)
      if (currentItemIds.length > 0) {
        await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', id)
          .not('id', 'in', `(${currentItemIds.join(',')})`)
      } else {
        // All original items removed -- delete everything for this PO
        await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', id)
      }

      // Upsert items
      for (const item of items) {
        const qty = parseInt(item.quantity) || 0
        const cost = parseFloat(item.unit_cost) || 0
        if (item._isNew) {
          const { error: insErr } = await supabase
            .from('purchase_order_items')
            .insert({
              purchase_order_id: id,
              product_id: item.product_id || null,
              name: item.name,
              quantity: qty,
              unit_cost: cost,
              total: qty * cost,
            })
          if (insErr) throw insErr
        } else {
          const { error: updErr } = await supabase
            .from('purchase_order_items')
            .update({
              name: item.name,
              quantity: qty,
              unit_cost: cost,
              total: qty * cost,
            })
            .eq('id', item.id)
          if (updErr) throw updErr
        }
      }

      setDirty(false)
      setSaveMessage({ variant: 'success', text: 'Purchase order saved successfully.' })

      // Reload to sync IDs for newly inserted items
      await loadPO()
    } catch (err) {
      setSaveMessage({ variant: 'danger', text: err.message || 'Failed to save purchase order.' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Send to Supplier ─────────────────────────────────────

  async function handleSendToSupplier() {
    if (isViewer || !po) return

    const supplier = suppliers.find(s => s.id === po.supplier_id) || po.supplier
    if (!supplier || !supplier.email) {
      setSaveMessage({
        variant: 'danger',
        text: 'Cannot send: the selected supplier does not have an email address on file.',
      })
      return
    }

    setSending(true)
    setSaveMessage(null)

    try {
      // Save first to persist any unsaved changes
      const { error: poErr } = await supabase
        .from('purchase_orders')
        .update({
          supplier_id: po.supplier_id || null,
          status: 'Sent',
          payment_terms: po.payment_terms || null,
          expected_delivery: po.expected_delivery || null,
          notes: po.notes || null,
          total_value: total,
        })
        .eq('id', id)

      if (poErr) throw poErr

      // Persist items before sending
      for (const item of items) {
        const qty = parseInt(item.quantity) || 0
        const cost = parseFloat(item.unit_cost) || 0
        if (item._isNew) {
          await supabase
            .from('purchase_order_items')
            .insert({
              purchase_order_id: id,
              product_id: item.product_id || null,
              name: item.name,
              quantity: qty,
              unit_cost: cost,
              total: qty * cost,
            })
        } else {
          await supabase
            .from('purchase_order_items')
            .update({
              name: item.name,
              quantity: qty,
              unit_cost: cost,
              total: qty * cost,
            })
            .eq('id', item.id)
        }
      }

      const poEmailData = {
        po_number: po.po_number,
        supplier_name: supplier.company_name || '',
        items: items.map(it => ({
          name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_cost,
        })),
        subtotal,
        total,
        notes: po.notes || '',
        expected_delivery: po.expected_delivery ? formatDate(po.expected_delivery) : '',
      }

      await sendPurchaseOrder(supplier.email, poEmailData)

      setPo(prev => ({ ...prev, status: 'Sent', sent_at: new Date().toISOString() }))
      setDirty(false)
      setSaveMessage({ variant: 'success', text: `Purchase order sent to ${supplier.email} successfully.` })

      await loadPO()
    } catch (err) {
      setSaveMessage({ variant: 'danger', text: err.message || 'Failed to send purchase order.' })
    } finally {
      setSending(false)
    }
  }

  // ─── Render Guards ────────────────────────────────────────

  if (loadingData) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <Loading text="Loading purchase order..." />
      </div>
    )
  }

  if (error || !po) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <Btn variant="ghost" onClick={() => navigate('/purchase-orders')} icon={<Icons.ArrowLeft size={16} />}>
          Back to Purchase Orders
        </Btn>
        <div style={{ marginTop: 24 }}>
          <Alert variant="danger">{error || 'Purchase order not found.'}</Alert>
        </div>
      </div>
    )
  }

  // ─── Supplier Options ─────────────────────────────────────

  const supplierOptions = suppliers.map(s => ({
    value: s.id,
    label: s.company_name + (s.contact_name ? ` (${s.contact_name})` : ''),
  }))

  // ─── Allowed Status Transitions ───────────────────────────

  const statusOptions = allowedTransitions(po.status || 'Draft').map(s => ({
    value: s,
    label: s,
  }))

  // ─── Product Autocomplete ─────────────────────────────────

  const filteredProducts = products.filter(p => {
    if (!productSearch) return true
    const q = productSearch.toLowerCase()
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    )
  })

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
            value={po[field] ?? ''}
            onChange={e => updatePO(field, e.target.value)}
            step={step || '0.01'}
            min="0"
            style={{
              width: 110, textAlign: 'right', padding: '4px 8px', fontSize: 13,
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
          <Btn variant="ghost" size="sm" onClick={() => navigate('/purchase-orders')} icon={<Icons.ArrowLeft size={16} />}>
            Purchase Orders
          </Btn>
          <h1 style={{
            color: c.text, fontSize: isMobile ? 20 : 24, fontWeight: 800,
            margin: 0, letterSpacing: '-0.02em',
          }}>
            {po.po_number || `PO #${id.slice(0, 8)}`}
          </h1>
          <Badge variant={statusBadgeVariant(po.status)}>
            {po.status || 'Draft'}
          </Badge>
          {po.sent_at && (
            <span style={{ color: c.textMuted, fontSize: 12 }}>
              Sent {formatDate(po.sent_at)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isViewer && (
            <Btn
              variant="primary"
              icon={<Icons.Save size={14} />}
              onClick={handleSave}
              loading={saving}
              disabled={!dirty}
            >
              Save
            </Btn>
          )}
          {!isViewer && (
            <Btn
              variant="outline"
              icon={<Icons.Mail size={14} />}
              onClick={handleSendToSupplier}
              loading={sending}
            >
              Send to Supplier
            </Btn>
          )}
        </div>
      </div>

      {/* Save / Send message */}
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

      {/* Two-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 380px',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* PO Info Card */}
          <Card>
            <SectionTitle>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.ClipboardList size={18} style={{ color: c.accent }} />
                PO Information
              </span>
            </SectionTitle>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 12,
            }}>
              <Field
                label="PO Number"
                value={po.po_number || ''}
                readOnly
                disabled
              />
              <Select
                label="Supplier"
                value={po.supplier_id || ''}
                onChange={v => updatePO('supplier_id', v)}
                options={supplierOptions}
                placeholder="Select supplier"
                disabled={isViewer}
                required
              />
              <Select
                label="Status"
                value={po.status || 'Draft'}
                onChange={v => updatePO('status', v)}
                options={statusOptions}
                disabled={isViewer}
              />
              <Select
                label="Payment Terms"
                value={po.payment_terms || ''}
                onChange={v => updatePO('payment_terms', v)}
                options={PAYMENT_TERMS}
                placeholder="Select payment terms"
                disabled={isViewer}
              />
              <Field
                label="Expected Delivery"
                type="date"
                value={po.expected_delivery ? po.expected_delivery.slice(0, 10) : ''}
                onChange={v => updatePO('expected_delivery', v)}
                disabled={isViewer}
              />
            </div>

            <div style={{ marginTop: 4 }}>
              <Textarea
                label="Notes"
                value={po.notes || ''}
                onChange={v => updatePO('notes', v)}
                placeholder="Internal notes, special instructions, shipping preferences..."
                rows={3}
                disabled={isViewer}
              />
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
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
              <FinRow label="Subtotal" value={subtotal} />
              <FinRow
                label="Total"
                value={total}
                bold
                border
              />
            </div>
          </Card>

          {/* Supplier Info Mini Card */}
          {po.supplier && (
            <Card>
              <SectionTitle>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.Users size={18} style={{ color: c.accent }} />
                  Supplier Details
                </span>
              </SectionTitle>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: c.textSecondary, fontSize: 12 }}>Name</span>
                  <span style={{ color: c.text, fontSize: 13, fontWeight: 600 }}>
                    {po.supplier.company_name || '-'}
                  </span>
                </div>
                {po.supplier.contact_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: c.textSecondary, fontSize: 12 }}>Contact</span>
                    <span style={{ color: c.text, fontSize: 13 }}>
                      {po.supplier.contact_name}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: c.textSecondary, fontSize: 12 }}>Email</span>
                  <span style={{ color: po.supplier.email ? c.text : c.danger, fontSize: 13 }}>
                    {po.supplier.email || 'No email on file'}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Timestamps Card */}
          <Card>
            <SectionTitle>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.Calendar size={18} style={{ color: c.accent }} />
                Dates
              </span>
            </SectionTitle>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: c.textSecondary, fontSize: 12 }}>Created</span>
                <span style={{ color: c.text, fontSize: 13 }}>{formatDate(po.created_at)}</span>
              </div>
              {po.sent_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: c.textSecondary, fontSize: 12 }}>Sent</span>
                  <span style={{ color: c.text, fontSize: 13 }}>{formatDate(po.sent_at)}</span>
                </div>
              )}
              {po.expected_delivery && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: c.textSecondary, fontSize: 12 }}>Expected Delivery</span>
                  <span style={{ color: c.text, fontSize: 13 }}>{formatDate(po.expected_delivery)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: c.textSecondary, fontSize: 12 }}>Last Updated</span>
                <span style={{ color: c.text, fontSize: 13 }}>{formatDate(po.updated_at)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Items Section -- Full Width Below */}
      <div style={{ marginTop: 20 }}>
        <Card padding="0">
          <div style={{ padding: '20px 20px 12px' }}>
            <SectionTitle
              style={{ marginBottom: 0 }}
              actions={
                !isViewer && (
                  <Btn
                    variant="secondary"
                    size="sm"
                    icon={<Icons.Plus size={14} />}
                    onClick={() => setAddItemModalOpen(true)}
                  >
                    Add Item
                  </Btn>
                )
              }
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.Package size={18} style={{ color: c.accent }} />
                Items ({items.length})
              </span>
            </SectionTitle>
          </div>

          {items.length === 0 ? (
            <div style={{
              padding: '32px 20px', textAlign: 'center', color: c.textMuted, fontSize: 13,
            }}>
              No items added to this purchase order yet.
              {!isViewer && (
                <div style={{ marginTop: 12 }}>
                  <Btn
                    variant="outline"
                    size="sm"
                    icon={<Icons.Plus size={14} />}
                    onClick={() => setAddItemModalOpen(true)}
                  >
                    Add First Item
                  </Btn>
                </div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Name', 'Qty', 'Unit Cost', 'Total', ...(isViewer ? [] : [''])].map(h => (
                      <th key={h || '_actions'} style={{
                        padding: '8px 16px',
                        textAlign: h === 'Name' ? 'left' : (h === '' ? 'center' : 'right'),
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
                    const unitCost = parseFloat(item.unit_cost) || 0
                    const lineTotal = qty * unitCost
                    return (
                      <tr key={item.id || `new-${idx}`} style={{
                        borderBottom: `1px solid ${c.border}`,
                      }}>
                        {/* Name */}
                        <td style={{ padding: '10px 16px' }}>
                          {!isViewer ? (
                            <input
                              type="text"
                              value={item.name || ''}
                              onChange={e => updateItem(idx, 'name', e.target.value)}
                              placeholder="Item name"
                              style={{
                                width: '100%', minWidth: 140, padding: '4px 8px',
                                fontSize: 13, fontFamily: 'inherit', background: c.inputBg,
                                color: c.text, border: `1px solid ${c.border}`,
                                borderRadius: 6, outline: 'none', boxSizing: 'border-box',
                              }}
                              onFocus={e => { e.target.style.borderColor = c.accent }}
                              onBlur={e => { e.target.style.borderColor = c.border }}
                            />
                          ) : (
                            <span style={{ color: c.text, fontWeight: 500 }}>
                              {item.name || '-'}
                            </span>
                          )}
                        </td>
                        {/* Qty */}
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          {!isViewer ? (
                            <input
                              type="number"
                              value={item.quantity ?? ''}
                              onChange={e => updateItem(idx, 'quantity', e.target.value)}
                              min="0"
                              step="1"
                              style={{
                                width: 70, textAlign: 'right', padding: '4px 8px',
                                fontSize: 13, fontFamily: 'inherit', background: c.inputBg,
                                color: c.text, border: `1px solid ${c.border}`,
                                borderRadius: 6, outline: 'none',
                              }}
                              onFocus={e => { e.target.style.borderColor = c.accent }}
                              onBlur={e => { e.target.style.borderColor = c.border }}
                            />
                          ) : (
                            <span style={{
                              color: c.text, fontVariantNumeric: 'tabular-nums',
                            }}>
                              {qty}
                            </span>
                          )}
                        </td>
                        {/* Unit Cost */}
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          {!isViewer ? (
                            <input
                              type="number"
                              value={item.unit_cost ?? ''}
                              onChange={e => updateItem(idx, 'unit_cost', e.target.value)}
                              min="0"
                              step="0.01"
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
                              color: c.text, fontVariantNumeric: 'tabular-nums',
                            }}>
                              {formatUSD(unitCost)}
                            </span>
                          )}
                        </td>
                        {/* Line Total */}
                        <td style={{
                          padding: '10px 16px', color: c.text, textAlign: 'right',
                          fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                        }}>
                          {formatUSD(lineTotal)}
                        </td>
                        {/* Remove */}
                        {!isViewer && (
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <button
                              onClick={() => removeItem(idx)}
                              title="Remove item"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: c.textMuted, padding: 4, borderRadius: 4,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = c.danger }}
                              onMouseLeave={e => { e.currentTarget.style.color = c.textMuted }}
                            >
                              <Icons.Trash size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{
                      padding: '10px 16px', textAlign: 'right', color: c.textSecondary,
                      fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      Subtotal
                    </td>
                    <td style={{
                      padding: '10px 16px', textAlign: 'right', color: c.text,
                      fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    }}>
                      {formatUSD(subtotal)}
                    </td>
                    {!isViewer && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add Item Modal */}
      <Modal
        open={addItemModalOpen}
        onClose={() => {
          setAddItemModalOpen(false)
          setProductSearch('')
        }}
        title="Add Item"
        width={520}
      >
        <div style={{ marginBottom: 12 }}>
          <Field
            label="Search Products"
            value={productSearch}
            onChange={setProductSearch}
            placeholder="Search by name or SKU..."
          />
        </div>

        {filteredProducts.length > 0 ? (
          <div style={{
            maxHeight: 320, overflowY: 'auto', border: `1px solid ${c.border}`,
            borderRadius: 8,
          }}>
            {filteredProducts.map(p => (
              <div
                key={p.id}
                onClick={() => addItemFromProduct(p)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: `1px solid ${c.border}`,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = c.surfaceHover }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <div style={{ color: c.text, fontSize: 13, fontWeight: 600 }}>
                    {p.name}
                  </div>
                  {p.sku && (
                    <div style={{ color: c.textMuted, fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>
                      {p.sku}
                    </div>
                  )}
                </div>
                <span style={{ color: c.textSecondary, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  {formatUSD(p.cost_price || 0)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: 24, textAlign: 'center', color: c.textMuted, fontSize: 13,
            border: `1px solid ${c.border}`, borderRadius: 8,
          }}>
            {products.length === 0
              ? 'No products found in your catalog.'
              : 'No products match your search.'}
          </div>
        )}

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 16, paddingTop: 16, borderTop: `1px solid ${c.border}`,
        }}>
          <Btn
            variant="ghost"
            size="sm"
            icon={<Icons.Plus size={14} />}
            onClick={addBlankItem}
          >
            Add Blank Item
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => {
              setAddItemModalOpen(false)
              setProductSearch('')
            }}
          >
            Cancel
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
          <Btn variant="secondary" onClick={loadPO}>
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
