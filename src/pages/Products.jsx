import { useState, useEffect, useMemo } from 'react'
import { useColors, Card, SectionTitle, Btn, Field, Select, Textarea, SearchInput, Badge, Modal, ConfirmModal, Pagination, usePagination, formatUSD, Icons, Loading, Empty, Checkbox } from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import useIsMobile from '../hooks/useIsMobile'

const CATEGORIES = [
  'Electronics', 'Accessories', 'Phone Cases', 'Clothing', 'Home & Garden',
  'Beauty & Health', 'Toys & Games', 'Sports & Outdoors', 'Auto Parts',
  'Pet Supplies', 'Office Supplies', 'Jewelry', 'Bags & Luggage',
  'Tools & Hardware', 'Kitchen', 'Baby Products', 'Other',
]

const ORIGIN_COUNTRIES = [
  'China', 'Hong Kong', 'Taiwan', 'Vietnam', 'India', 'Bangladesh',
  'Thailand', 'Indonesia', 'South Korea', 'Japan', 'Malaysia',
  'Philippines', 'Cambodia', 'Turkey', 'Mexico', 'United States', 'Other',
]

const emptyForm = () => ({
  name: '',
  sku: '',
  category: '',
  description: '',
  image_url: '',
  unit_cost: '',
  price_usd: '',
  weight_kg: '',
  hs_code: '',
  country_of_origin: '',
  supplier_id: '',
  min_order_qty: '',
  stock_quantity: '',
  reorder_point: '',
  active: true,
})

function calcMargin(price, cost) {
  const p = parseFloat(price) || 0
  const c = parseFloat(cost) || 0
  if (p <= 0) return null
  return ((p - c) / p * 100)
}

function marginVariant(margin) {
  if (margin === null || margin === undefined) return 'muted'
  if (margin >= 50) return 'success'
  if (margin >= 20) return 'default'
  if (margin >= 0) return 'warning'
  return 'danger'
}

export default function Products() {
  const { user, isViewer } = useAuth()
  const c = useColors()
  const isMobile = useIsMobile()

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [viewProduct, setViewProduct] = useState(null)
  const [toast, setToast] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function load() {
    setLoading(true)
    const [prodRes, suppRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('suppliers').select('id, name').eq('active', true).order('name'),
    ])
    if (prodRes.error) console.error('Failed to load products:', prodRes.error.message)
    if (suppRes.error) console.error('Failed to load suppliers:', suppRes.error.message)
    setProducts(prodRes.data || [])
    setSuppliers(suppRes.data || [])
    setLoading(false)
  }

  const supplierMap = useMemo(() => {
    const map = {}
    suppliers.forEach(s => { map[s.id] = s.name })
    return map
  }, [suppliers])

  const supplierOptions = useMemo(() => {
    return suppliers.map(s => ({ value: s.id, label: s.name }))
  }, [suppliers])

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    )
  }, [products, search])

  const { page, setPage, totalPages, paged } = usePagination(filtered, 25)

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setShowModal(true)
  }

  function openEdit(product) {
    setEditing(product)
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      description: product.description || '',
      image_url: product.image_url || '',
      unit_cost: product.unit_cost ?? '',
      price_usd: product.price_usd ?? '',
      weight_kg: product.weight_kg ?? '',
      hs_code: product.hs_code || '',
      country_of_origin: product.country_of_origin || '',
      supplier_id: product.supplier_id || '',
      min_order_qty: product.min_order_qty ?? '',
      stock_quantity: product.stock_quantity ?? '',
      reorder_point: product.reorder_point ?? '',
      active: product.active !== false,
    })
    setError('')
    setShowModal(true)
  }

  async function save() {
    if (isViewer) return
    if (!form.name.trim()) { setError('Product name is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category || null,
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        unit_cost: form.unit_cost !== '' ? parseFloat(form.unit_cost) || 0 : null,
        price_usd: form.price_usd !== '' ? parseFloat(form.price_usd) || 0 : null,
        weight_kg: form.weight_kg !== '' ? parseFloat(form.weight_kg) || null : null,
        hs_code: form.hs_code.trim() || null,
        country_of_origin: form.country_of_origin || null,
        supplier_id: form.supplier_id || null,
        min_order_qty: form.min_order_qty !== '' ? parseInt(form.min_order_qty) || null : null,
        stock_quantity: form.stock_quantity !== '' ? parseInt(form.stock_quantity) || 0 : 0,
        reorder_point: form.reorder_point !== '' ? parseInt(form.reorder_point) || 0 : 0,
        active: form.active,
      }
      if (editing) {
        const { error: updErr } = await supabase.from('products').update(payload).eq('id', editing.id)
        if (updErr) throw updErr
      } else {
        const { error: insErr } = await supabase.from('products').insert(payload)
        if (insErr) throw insErr
      }
      await load()
      setShowModal(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(product) {
    if (isViewer) return
    const { error: updErr } = await supabase.from('products').update({ active: !product.active }).eq('id', product.id)
    if (!updErr) {
      setProducts(arr => arr.map(p => p.id === product.id ? { ...p, active: !p.active } : p))
    }
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
  }

  async function handleDelete() {
    if (isViewer || !confirmDelete) return
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', confirmDelete.id)
        .eq('user_id', user.id)

      if (error) throw error

      setProducts(prev => prev.filter(p => p.id !== confirmDelete.id))
      setConfirmDelete(null)
      showToast('Product deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      setConfirmDelete(null)
      showToast('Failed to delete product: ' + err.message, 'error')
    }
  }

  async function syncShopify() {
    if (isViewer) return
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

      const shop = shopifyConfig.shop_url || shopifyConfig.shop
      const accessToken = shopifyConfig.access_token || shopifyConfig.accessToken
      if (!shop || !accessToken) {
        setSyncMsg('Shopify credentials are missing. Check your Settings.')
        return
      }

      // Dynamic import to keep bundle split
      const { fetchProducts } = await import('../lib/shopify')

      const shopifyProducts = await fetchProducts({
        shop,
        accessToken,
      })

      if (!shopifyProducts.length) {
        setSyncMsg('No products found in your Shopify store.')
        return
      }

      // Upsert products by shopify_product_id
      let upserted = 0
      for (const sp of shopifyProducts) {
        const row = {
          name: sp.name,
          sku: sp.sku || null,
          category: sp.category || null,
          image_url: sp.image_url || null,
          price_usd: sp.price_usd || null,
          shopify_product_id: String(sp.shopify_product_id),
          active: true,
        }

        // Check if product already exists by shopify_product_id
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('shopify_product_id', String(sp.shopify_product_id))
          .maybeSingle()

        if (existing) {
          await supabase.from('products').update(row).eq('id', existing.id)
        } else {
          await supabase.from('products').insert(row)
        }
        upserted++
      }

      await load()
      setSyncMsg(`Synced ${upserted} product${upserted !== 1 ? 's' : ''} from Shopify.`)
    } catch (e) {
      console.error('Shopify product sync failed:', e)
      setSyncMsg(`Sync failed: ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const formMargin = calcMargin(form.price_usd, form.unit_cost)

  if (loading) return <Loading text="Loading products..." />

  // ─── Desktop Table ──────────────────────────────────────────────
  function renderTable() {
    return (
      <Card padding="0" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Image', 'Name', 'SKU', 'Category', 'Cost', 'Price', 'Margin', 'Supplier', 'Active'].map(header => (
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
              {paged.map(p => {
                const margin = calcMargin(p.price_usd, p.unit_cost)
                return (
                  <tr
                    key={p.id}
                    onClick={() => setViewProduct(p)}
                    style={{
                      cursor: 'pointer',
                      opacity: p.active !== false ? 1 : 0.55,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = c.surfaceHover }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '8px 14px', borderBottom: `1px solid ${c.border}` }}>
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          style={{
                            width: 36, height: 36, borderRadius: 6, objectFit: 'cover',
                            background: c.surfaceHover, border: `1px solid ${c.border}`,
                          }}
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      ) : (
                        <div style={{
                          width: 36, height: 36, borderRadius: 6, background: c.surfaceHover,
                          border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: c.textMuted,
                        }}>
                          <Icons.Package size={16} />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text, fontWeight: 600, maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.textSecondary, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {p.sku || '\u2014'}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.textSecondary }}>
                      {p.category || '\u2014'}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.textSecondary, whiteSpace: 'nowrap' }}>
                      {p.unit_cost != null ? formatUSD(p.unit_cost) : '\u2014'}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {p.price_usd != null ? formatUSD(p.price_usd) : '\u2014'}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}` }}>
                      {margin !== null ? (
                        <Badge variant={marginVariant(margin)}>
                          {margin.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span style={{ fontSize: 13, color: c.textMuted }}>{'\u2014'}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.textSecondary, maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.supplier_id ? (supplierMap[p.supplier_id] || '\u2014') : '\u2014'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}` }}>
                      <Badge variant={p.active !== false ? 'success' : 'muted'}>
                        {p.active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    {!isViewer && (
                      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, textAlign: 'right', whiteSpace: 'nowrap' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <Btn variant="ghost" size="sm" onClick={() => openEdit(p)}>
                            <Icons.Edit size={13} />
                          </Btn>
                          <Btn variant="ghost" size="sm" onClick={() => setViewProduct(p)} title="View details">
                            <Icons.Eye size={13} />
                          </Btn>
                          <Btn variant="ghost" size="sm" onClick={() => setConfirmDelete(p)} style={{ color: c.danger }}>
                            <Icons.Trash size={13} />
                          </Btn>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  // ─── Mobile Card List ──────────────────────────────────────────
  function renderCards() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {paged.map(p => {
          const margin = calcMargin(p.price_usd, p.unit_cost)
          return (
            <Card
              key={p.id}
              onClick={() => setViewProduct(p)}
              hover
              style={{ opacity: p.active !== false ? 1 : 0.55, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    style={{
                      width: 48, height: 48, borderRadius: 8, objectFit: 'cover',
                      background: c.surfaceHover, border: `1px solid ${c.border}`, flexShrink: 0,
                    }}
                    onError={e => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: 8, background: c.surfaceHover,
                    border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: c.textMuted, flexShrink: 0,
                  }}>
                    <Icons.Package size={20} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ color: c.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <Badge variant={p.active !== false ? 'success' : 'muted'}>
                      {p.active !== false ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {p.sku && (
                    <div style={{ color: c.textSecondary, fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>
                      {p.sku}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: c.textSecondary, marginBottom: 8 }}>
                {p.category && <span>{p.category}</span>}
                {p.unit_cost != null && <span>Cost: {formatUSD(p.unit_cost)}</span>}
                {p.price_usd != null && <span style={{ color: c.text, fontWeight: 600 }}>Price: {formatUSD(p.price_usd)}</span>}
                {margin !== null && (
                  <Badge variant={marginVariant(margin)} style={{ fontSize: 10 }}>
                    {margin.toFixed(1)}% margin
                  </Badge>
                )}
              </div>

              {p.supplier_id && supplierMap[p.supplier_id] && (
                <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 8 }}>
                  Supplier: {supplierMap[p.supplier_id]}
                </div>
              )}

              {!isViewer && (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                  <Btn variant="ghost" size="sm" onClick={() => setViewProduct(p)}>View</Btn>
                  <Btn variant="secondary" size="sm" onClick={() => openEdit(p)}>Edit</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setConfirmDelete(p)} style={{ color: c.danger }}>
                    <Icons.Trash size={12} />
                  </Btn>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: c.text, fontSize: 20, fontWeight: 700, margin: 0 }}>Products</h1>
          <p style={{ color: c.textMuted, fontSize: 11, margin: '2px 0 0' }}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}{search ? ' found' : ''}
          </p>
        </div>
        {!isViewer && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" onClick={syncShopify} loading={syncing} icon={<Icons.RefreshCw size={14} />}>
              Sync Shopify
            </Btn>
            <Btn onClick={openNew} icon={<Icons.Plus size={14} />}>Add Product</Btn>
          </div>
        )}
      </div>

      {/* Sync message */}
      {syncMsg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: syncMsg.includes('failed') || syncMsg.includes('not configured') || syncMsg.includes('missing') || syncMsg.includes('No products')
            ? c.dangerMuted : c.successMuted,
          color: syncMsg.includes('failed') || syncMsg.includes('not configured') || syncMsg.includes('missing') || syncMsg.includes('No products')
            ? c.danger : c.success,
        }}>
          {syncMsg}
        </div>
      )}

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name, SKU, or category..."
        style={{ maxWidth: 420 }}
      />

      {/* Content */}
      {filtered.length === 0 ? (
        <Empty
          title={search ? 'No products match your search' : 'No products yet'}
          description={search ? 'Try a different search term' : 'Add your first product or sync from Shopify to get started'}
          action={!isViewer && !search ? <Btn onClick={openNew} icon={<Icons.Plus size={14} />}>Add Product</Btn> : undefined}
        />
      ) : (
        <>
          {isMobile ? renderCards() : renderTable()}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Add / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? `Edit Product - ${editing.name}` : 'Add Product'} width={640}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

          {/* Basic Info */}
          <SectionTitle style={{ marginBottom: 8 }}>Basic Information</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0, columnGap: 12 }}>
            <Field
              label="Product Name"
              value={form.name}
              onChange={v => setForm(f => ({ ...f, name: v }))}
              required
              readOnly={isViewer}
              placeholder="e.g. Wireless Bluetooth Earbuds"
            />
            <Field
              label="SKU"
              value={form.sku}
              onChange={v => setForm(f => ({ ...f, sku: v }))}
              readOnly={isViewer}
              placeholder="e.g. WBE-001-BLK"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0, columnGap: 12 }}>
            <Select
              label="Category"
              value={form.category}
              onChange={v => setForm(f => ({ ...f, category: v }))}
              options={CATEGORIES}
              placeholder="Select category..."
              disabled={isViewer}
            />
            <Field
              label="Image URL"
              value={form.image_url}
              onChange={v => setForm(f => ({ ...f, image_url: v }))}
              readOnly={isViewer}
              placeholder="https://..."
            />
          </div>

          {/* Image Preview */}
          {form.image_url && (
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <img
                src={form.image_url}
                alt="Product preview"
                style={{
                  maxWidth: 120, maxHeight: 120, borderRadius: 8, objectFit: 'cover',
                  border: `1px solid ${c.border}`, background: c.surfaceHover,
                }}
                onError={e => { e.target.style.display = 'none' }}
              />
            </div>
          )}

          <Textarea
            label="Description"
            value={form.description}
            onChange={v => setForm(f => ({ ...f, description: v }))}
            placeholder="Product description..."
            rows={3}
            disabled={isViewer}
          />

          {/* Pricing */}
          <SectionTitle style={{ marginBottom: 8 }}>Pricing</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 0, columnGap: 12 }}>
            <Field
              label="Unit Cost (USD)"
              value={form.unit_cost}
              onChange={v => setForm(f => ({ ...f, unit_cost: v }))}
              type="number"
              min="0"
              step="0.01"
              readOnly={isViewer}
              placeholder="0.00"
            />
            <Field
              label="Selling Price (USD)"
              value={form.price_usd}
              onChange={v => setForm(f => ({ ...f, price_usd: v }))}
              type="number"
              min="0"
              step="0.01"
              readOnly={isViewer}
              placeholder="0.00"
            />
            <div style={{ marginBottom: 12 }}>
              <label style={{
                display: 'block', color: c.textSecondary, fontSize: 12, fontWeight: 600,
                marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Margin
              </label>
              <div style={{
                padding: '8px 12px', fontSize: 13, borderRadius: 8,
                background: c.surfaceHover, border: `1px solid ${c.border}`,
                color: formMargin !== null
                  ? (formMargin >= 50 ? c.success : formMargin >= 20 ? c.accent : formMargin >= 0 ? c.warning : c.danger)
                  : c.textMuted,
                fontWeight: 700,
              }}>
                {formMargin !== null ? `${formMargin.toFixed(1)}%` : '--'}
              </div>
            </div>
          </div>

          {/* Shipping & Customs */}
          <SectionTitle style={{ marginBottom: 8 }}>Shipping & Customs</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 0, columnGap: 12 }}>
            <Field
              label="Weight (kg)"
              value={form.weight_kg}
              onChange={v => setForm(f => ({ ...f, weight_kg: v }))}
              type="number"
              min="0"
              step="0.01"
              readOnly={isViewer}
              placeholder="0.00"
            />
            <Field
              label="HS Code"
              value={form.hs_code}
              onChange={v => setForm(f => ({ ...f, hs_code: v }))}
              readOnly={isViewer}
              placeholder="e.g. 8518.30.20"
            />
            <Select
              label="Country of Origin"
              value={form.country_of_origin}
              onChange={v => setForm(f => ({ ...f, country_of_origin: v }))}
              options={ORIGIN_COUNTRIES}
              placeholder="Select country..."
              disabled={isViewer}
            />
          </div>

          {/* Supplier & Ordering */}
          <SectionTitle style={{ marginBottom: 8 }}>Supplier & Ordering</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0, columnGap: 12 }}>
            <Select
              label="Supplier"
              value={form.supplier_id}
              onChange={v => setForm(f => ({ ...f, supplier_id: v }))}
              options={supplierOptions}
              placeholder="Select supplier..."
              disabled={isViewer}
            />
            <Field
              label="Min Order Qty"
              value={form.min_order_qty}
              onChange={v => setForm(f => ({ ...f, min_order_qty: v }))}
              type="number"
              min="1"
              readOnly={isViewer}
              placeholder="e.g. 100"
            />
          </div>

          {/* Inventory */}
          <SectionTitle style={{ marginBottom: 8 }}>Inventory</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0, columnGap: 12 }}>
            <Field
              label="Initial Stock"
              value={form.stock_quantity}
              onChange={v => setForm(f => ({ ...f, stock_quantity: v }))}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              readOnly={isViewer}
              placeholder="0"
              title="Current units available in your warehouse"
            />
            <Field
              label="Reorder Point"
              value={form.reorder_point}
              onChange={v => setForm(f => ({ ...f, reorder_point: v }))}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              readOnly={isViewer}
              placeholder="0"
              title="System will alert you when stock falls below this number"
            />
          </div>

          {/* Active Toggle */}
          <SectionTitle style={{ marginBottom: 8 }}>Status</SectionTitle>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['Active', 'Inactive'].map(status => (
              <button
                key={status}
                onClick={() => { if (!isViewer) setForm(f => ({ ...f, active: status === 'Active' })) }}
                style={{
                  padding: '7px 14px', borderRadius: 8, cursor: isViewer ? 'default' : 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                  background: (status === 'Active') === form.active ? c.successMuted : c.surfaceHover,
                  border: `1px solid ${(status === 'Active') === form.active ? c.success + '60' : c.border}`,
                  color: (status === 'Active') === form.active ? c.success : c.textMuted,
                  transition: 'all 0.15s',
                }}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: c.dangerMuted, color: c.danger, marginTop: 4,
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            {editing && !isViewer && (
              <Btn variant="danger" size="sm" onClick={() => { setShowModal(false); setConfirmDelete(editing) }} style={{ marginRight: 'auto' }}>
                <Icons.Trash size={13} style={{ marginRight: 4 }} />Delete
              </Btn>
            )}
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
            {!isViewer && <Btn onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Create Product'}</Btn>}
          </div>
        </div>
      </Modal>

      {/* View Product Modal */}
      <Modal open={!!viewProduct} onClose={() => setViewProduct(null)} title="Product Details" width={560}>
        {viewProduct && (() => {
          const vm = calcMargin(viewProduct.price_usd, viewProduct.unit_cost)
          const row = (label, value, badge) => (
            <div>
              <div style={{ color: c.textSecondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
              {badge ? <Badge variant={badge}>{value}</Badge> : <div style={{ color: c.text, fontSize: 14, fontWeight: 500 }}>{value || '--'}</div>}
            </div>
          )
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header: image + name + status */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {viewProduct.image_url ? (
                  <img src={viewProduct.image_url} alt={viewProduct.name}
                    style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: `1px solid ${c.border}`, background: c.surfaceHover }}
                    onError={e => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <div style={{ width: 80, height: 80, borderRadius: 10, background: c.surfaceHover, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted }}>
                    <Icons.Package size={32} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ color: c.text, fontSize: 18, fontWeight: 700, margin: 0 }}>{viewProduct.name}</h3>
                  {viewProduct.sku && <div style={{ color: c.textSecondary, fontSize: 13, fontFamily: 'monospace', marginTop: 4 }}>{viewProduct.sku}</div>}
                  <div style={{ marginTop: 6 }}>
                    <Badge variant={viewProduct.active !== false ? 'success' : 'muted'}>
                      {viewProduct.active !== false ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Description */}
              {viewProduct.description && (
                <p style={{ color: c.textSecondary, fontSize: 13, lineHeight: 1.6, margin: 0, padding: '8px 12px', background: c.surfaceHover, borderRadius: 8 }}>
                  {viewProduct.description}
                </p>
              )}

              {/* Detail grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                {row('Category', viewProduct.category)}
                {row('Supplier', viewProduct.supplier_id ? (supplierMap[viewProduct.supplier_id] || '--') : '--')}
                {row('Unit Cost', viewProduct.unit_cost != null ? formatUSD(viewProduct.unit_cost) : '--')}
                {row('Selling Price', viewProduct.price_usd != null ? formatUSD(viewProduct.price_usd) : '--')}
                {row('Margin', vm !== null ? `${vm.toFixed(1)}%` : '--', vm !== null ? marginVariant(vm) : null)}
                {row('HTS Code', viewProduct.hs_code)}
                {row('Country of Origin', viewProduct.country_of_origin)}
                {row('Weight', viewProduct.weight_kg != null ? `${viewProduct.weight_kg} kg` : '--')}
                {row('Min Order Qty', viewProduct.min_order_qty != null ? String(viewProduct.min_order_qty) : '--')}
                {row('Current Stock', viewProduct.stock_quantity != null ? String(viewProduct.stock_quantity) : '--')}
                {row('Reorder Point', viewProduct.reorder_point != null ? String(viewProduct.reorder_point) : '--')}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                {!isViewer && (
                  <Btn variant="secondary" onClick={() => { const p = viewProduct; setViewProduct(null); openEdit(p) }}>
                    Edit Product
                  </Btn>
                )}
                <Btn variant="ghost" onClick={() => setViewProduct(null)}>Close</Btn>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? c.danger : c.success,
          color: '#fff', padding: '10px 20px',
          borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {toast.message}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
