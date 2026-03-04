import { useState, useEffect, useMemo } from 'react'
import { useColors, Card, SectionTitle, Btn, Field, Select, Textarea, SearchInput, Badge, Modal, ConfirmModal, Pagination, usePagination, formatUSD, Icons, Loading, Empty } from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import useIsMobile from '../hooks/useIsMobile'

const COUNTRIES = [
  'China', 'Hong Kong', 'Taiwan', 'Vietnam', 'India', 'Bangladesh',
  'Thailand', 'Indonesia', 'South Korea', 'Japan', 'Malaysia',
  'Philippines', 'Pakistan', 'Cambodia', 'Sri Lanka', 'Turkey',
  'Mexico', 'Brazil', 'United States', 'Canada', 'United Kingdom',
  'Germany', 'Italy', 'France', 'Spain', 'Portugal', 'Netherlands',
  'Australia', 'New Zealand', 'Singapore', 'UAE', 'Other',
]

const PAYMENT_TERMS = [
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 60', label: 'Net 60' },
  { value: 'Prepaid', label: 'Prepaid' },
  { value: '50% Deposit', label: '50% Deposit' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
]

function StarRating({ value, onChange, readOnly }) {
  const c = useColors()
  const [hovered, setHovered] = useState(0)
  const rating = parseInt(value) || 0

  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(star => {
        const filled = readOnly ? star <= rating : star <= (hovered || rating)
        return (
          <svg
            key={star}
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill={filled ? c.warning : 'none'}
            stroke={filled ? c.warning : c.textMuted}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ cursor: readOnly ? 'default' : 'pointer', transition: 'all 0.1s' }}
            onClick={() => { if (!readOnly && onChange) onChange(star === rating ? 0 : star) }}
            onMouseEnter={() => { if (!readOnly) setHovered(star) }}
            onMouseLeave={() => { if (!readOnly) setHovered(0) }}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )
      })}
    </div>
  )
}

const emptyForm = () => ({
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  country: '',
  city: '',
  website: '',
  payment_terms: '',
  lead_time_days: '',
  currency: 'USD',
  notes: '',
  category: '',
  score: 0,
  status: 'active',
})

export default function Suppliers() {
  const { user, isViewer } = useAuth()
  const c = useColors()
  const isMobile = useIsMobile()

  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [supplierStats, setSupplierStats] = useState({})
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: fetchErr } = await supabase
      .from('suppliers')
      .select('*')
      .order('company_name')
    if (fetchErr) {
      console.error('Failed to load suppliers:', fetchErr.message)
    }
    setSuppliers(data || [])
    setLoading(false)
  }

  async function loadSupplierStats(supplierId) {
    setStatsLoading(true)
    try {
      const [ordersRes, posRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId),
      ])
      setSupplierStats({
        totalOrders: ordersRes.count || 0,
        totalPOs: posRes.count || 0,
      })
    } catch (e) {
      console.error('Failed to load supplier stats:', e.message)
      setSupplierStats({ totalOrders: 0, totalPOs: 0 })
    } finally {
      setStatsLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers
    const q = search.toLowerCase()
    return suppliers.filter(s =>
      (s.company_name || '').toLowerCase().includes(q) ||
      (s.contact_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.country || '').toLowerCase().includes(q)
    )
  }, [suppliers, search])

  const { page, setPage, totalPages, paged } = usePagination(filtered, 25)

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setSupplierStats({})
    setShowModal(true)
  }

  function openEdit(supplier) {
    setEditing(supplier)
    setForm({
      company_name: supplier.company_name || '',
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      country: supplier.country || '',
      city: supplier.city || '',
      website: supplier.website || '',
      payment_terms: supplier.payment_terms || '',
      lead_time_days: supplier.lead_time_days ?? '',
      currency: supplier.currency || 'USD',
      notes: supplier.notes || '',
      category: supplier.category || '',
      score: supplier.score || 0,
      status: supplier.status || 'active',
    })
    setError('')
    loadSupplierStats(supplier.id)
    setShowModal(true)
  }

  function duplicateSupplier(supplier) {
    setEditing(null)
    setForm({
      company_name: '',
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      country: supplier.country || '',
      city: supplier.city || '',
      website: supplier.website || '',
      payment_terms: supplier.payment_terms || '',
      lead_time_days: supplier.lead_time_days ?? '',
      currency: supplier.currency || 'USD',
      notes: supplier.notes || '',
      category: supplier.category || '',
      score: supplier.score || 0,
      status: 'active',
    })
    setError('')
    setSupplierStats({})
    setShowModal(true)
  }

  async function save() {
    if (isViewer) return
    if (!form.company_name.trim()) { setError('Supplier name is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        country: form.country || null,
        city: form.city.trim() || null,
        website: form.website.trim() || null,
        payment_terms: form.payment_terms || null,
        lead_time_days: form.lead_time_days !== '' ? parseInt(form.lead_time_days) || null : null,
        currency: form.currency || 'USD',
        notes: form.notes.trim() || null,
        category: form.category.trim() || null,
        score: parseInt(form.score) || 0,
        status: form.status,
      }
      if (editing) {
        const { error: updErr } = await supabase.from('suppliers').update(payload).eq('id', editing.id)
        if (updErr) throw updErr
      } else {
        payload.user_id = user?.id
        const { error: insErr } = await supabase.from('suppliers').insert(payload)
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

  async function toggleActive(supplier) {
    if (isViewer) return
    const newStatus = supplier.status === 'active' ? 'inactive' : 'active'
    const { error: updErr } = await supabase.from('suppliers').update({ status: newStatus }).eq('id', supplier.id)
    if (!updErr) {
      setSuppliers(arr => arr.map(s => s.id === supplier.id ? { ...s, status: newStatus } : s))
    }
  }

  async function handleDelete() {
    if (isViewer || !confirmDelete) return
    const { error: delErr } = await supabase.from('suppliers').delete().eq('id', confirmDelete.id)
    if (!delErr) {
      setSuppliers(arr => arr.filter(s => s.id !== confirmDelete.id))
    }
    setConfirmDelete(null)
  }

  function renderCategoryTag(category) {
    if (!category) return null
    return (
      <Badge variant="muted" style={{ fontSize: 10 }}>{category}</Badge>
    )
  }

  if (loading) return <Loading text="Loading suppliers..." />

  // ─── Desktop Table Row ────────────────────────────────────────
  function renderTable() {
    return (
      <Card padding="0" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Contact', 'Email', 'Country', 'Lead Time', 'Rating', 'Status'].map(header => (
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
              {paged.map(s => (
                <tr
                  key={s.id}
                  onClick={() => !isViewer && openEdit(s)}
                  style={{
                    cursor: isViewer ? 'default' : 'pointer',
                    opacity: s.status === 'active' ? 1 : 0.55,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = c.surfaceHover }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text, fontWeight: 600 }}>
                    {s.company_name}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.textSecondary }}>
                    {s.contact_name || '\u2014'}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.textSecondary }}>
                    {s.email || '\u2014'}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.textSecondary }}>
                    {s.country || '\u2014'}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.textSecondary, whiteSpace: 'nowrap' }}>
                    {s.lead_time_days ? `${s.lead_time_days} days` : '\u2014'}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}` }}>
                    <StarRating value={s.score} readOnly />
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}` }}>
                    <Badge variant={s.status === 'active' ? 'success' : 'muted'}>
                      {s.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  {!isViewer && (
                    <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, textAlign: 'right', whiteSpace: 'nowrap' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <Btn variant="ghost" size="sm" onClick={() => openEdit(s)}>
                          <Icons.Edit size={13} />
                        </Btn>
                        <Btn variant="ghost" size="sm" onClick={() => duplicateSupplier(s)} title="Duplicate supplier">
                          <Icons.Copy size={13} />
                        </Btn>
                        <Btn variant="ghost" size="sm" onClick={() => toggleActive(s)} title={s.status === 'active' ? 'Deactivate' : 'Activate'}>
                          {s.status === 'active'
                            ? <Icons.Eye size={13} />
                            : <Icons.Eye size={13} style={{ opacity: 0.4 }} />
                          }
                        </Btn>
                        <Btn variant="ghost" size="sm" onClick={() => setConfirmDelete(s)} style={{ color: c.danger }}>
                          <Icons.Trash size={13} />
                        </Btn>
                      </div>
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

  // ─── Mobile Card List ─────────────────────────────────────────
  function renderCards() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {paged.map(s => (
          <Card
            key={s.id}
            onClick={() => !isViewer && openEdit(s)}
            hover
            style={{ opacity: s.status === 'active' ? 1 : 0.55, cursor: isViewer ? 'default' : 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ color: c.text, fontWeight: 700, fontSize: 14 }}>{s.company_name}</div>
                {s.contact_name && <div style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>{s.contact_name}</div>}
              </div>
              <Badge variant={s.status === 'active' ? 'success' : 'muted'}>
                {s.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: c.textSecondary, marginBottom: 8 }}>
              {s.email && <span>{s.email}</span>}
              {s.country && <span>{s.country}</span>}
              {s.lead_time_days && <span>{s.lead_time_days} days lead time</span>}
            </div>

            <div style={{ marginBottom: 8 }}>
              <StarRating value={s.score} readOnly />
            </div>

            {renderCategoryTag(s.category)}

            {!isViewer && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                <Btn variant="secondary" size="sm" onClick={() => openEdit(s)}>Edit</Btn>
                <Btn variant="ghost" size="sm" onClick={() => duplicateSupplier(s)}>
                  <Icons.Copy size={12} style={{ marginRight: 3 }} />Duplicate
                </Btn>
                <Btn variant="ghost" size="sm" onClick={() => toggleActive(s)}>
                  {s.status === 'active' ? 'Deactivate' : 'Activate'}
                </Btn>
                <Btn variant="ghost" size="sm" onClick={() => setConfirmDelete(s)} style={{ color: c.danger }}>
                  <Icons.Trash size={12} />
                </Btn>
              </div>
            )}
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: c.text, fontSize: 20, fontWeight: 700, margin: 0 }}>Suppliers</h1>
          <p style={{ color: c.textMuted, fontSize: 11, margin: '2px 0 0' }}>
            {filtered.length} supplier{filtered.length !== 1 ? 's' : ''}{search ? ` found` : ''}
          </p>
        </div>
        {!isViewer && <Btn onClick={openNew} icon={<Icons.Plus size={14} />}>Add Supplier</Btn>}
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name, contact, email, or country..."
        style={{ maxWidth: 420 }}
      />

      {/* Content */}
      {filtered.length === 0 ? (
        <Empty
          title={search ? 'No suppliers match your search' : 'No suppliers yet'}
          description={search ? 'Try a different search term' : 'Add your first supplier to get started'}
          action={!isViewer && !search ? <Btn onClick={openNew} icon={<Icons.Plus size={14} />}>Add Supplier</Btn> : undefined}
        />
      ) : (
        <>
          {isMobile ? renderCards() : renderTable()}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Add / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? `Edit Supplier - ${editing.company_name}` : 'Add Supplier'} width={640}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

          {/* Stats for existing supplier */}
          {editing && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{ background: c.surfaceHover, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 18 }}>
                  {statsLoading ? '...' : supplierStats.totalOrders ?? 0}
                </div>
                <div style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>Total Orders</div>
              </div>
              <div style={{ background: c.surfaceHover, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ color: c.info, fontWeight: 700, fontSize: 18 }}>
                  {statsLoading ? '...' : supplierStats.totalPOs ?? 0}
                </div>
                <div style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>Total POs</div>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <SectionTitle style={{ marginBottom: 8 }}>Basic Information</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0, columnGap: 12 }}>
            <Field
              label="Supplier Name"
              value={form.company_name}
              onChange={v => setForm(f => ({ ...f, company_name: v }))}
              required
              readOnly={isViewer}
              placeholder="e.g. Shenzhen Electronics Co."
            />
            <Field
              label="Contact Name"
              value={form.contact_name}
              onChange={v => setForm(f => ({ ...f, contact_name: v }))}
              readOnly={isViewer}
              placeholder="e.g. John Zhang"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0, columnGap: 12 }}>
            <Field
              label="Email"
              value={form.email}
              onChange={v => setForm(f => ({ ...f, email: v }))}
              type="email"
              readOnly={isViewer}
              placeholder="supplier@example.com"
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={v => setForm(f => ({ ...f, phone: v }))}
              readOnly={isViewer}
              placeholder="+86 123 4567 8900"
            />
          </div>

          {/* Location */}
          <SectionTitle style={{ marginBottom: 8 }}>Location</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0, columnGap: 12 }}>
            <Select
              label="Country"
              value={form.country}
              onChange={v => setForm(f => ({ ...f, country: v }))}
              options={COUNTRIES}
              placeholder="Select country..."
              disabled={isViewer}
            />
            <Field
              label="City"
              value={form.city}
              onChange={v => setForm(f => ({ ...f, city: v }))}
              readOnly={isViewer}
              placeholder="e.g. Shenzhen"
            />
          </div>
          {/* Terms & Logistics */}
          <SectionTitle style={{ marginBottom: 8 }}>Terms & Logistics</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 0, columnGap: 12 }}>
            <Select
              label="Payment Terms"
              value={form.payment_terms}
              onChange={v => setForm(f => ({ ...f, payment_terms: v }))}
              options={PAYMENT_TERMS}
              placeholder="Select..."
              disabled={isViewer}
            />
            <Field
              label="Lead Time (days)"
              value={form.lead_time_days}
              onChange={v => setForm(f => ({ ...f, lead_time_days: v }))}
              type="number"
              min="0"
              readOnly={isViewer}
              placeholder="e.g. 14"
            />
            <Select
              label="Currency"
              value={form.currency}
              onChange={v => setForm(f => ({ ...f, currency: v }))}
              options={CURRENCIES}
              disabled={isViewer}
            />
          </div>
          <Field
            label="Website"
            value={form.website}
            onChange={v => setForm(f => ({ ...f, website: v }))}
            readOnly={isViewer}
            placeholder="https://..."
          />

          {/* Category */}
          <SectionTitle style={{ marginBottom: 8 }}>Category</SectionTitle>
          <Field
            label="Category"
            value={form.category}
            onChange={v => setForm(f => ({ ...f, category: v }))}
            readOnly={isViewer}
            placeholder="e.g. Electronics"
          />

          {/* Score */}
          <SectionTitle style={{ marginBottom: 8 }}>Score</SectionTitle>
          <div style={{ marginBottom: 12 }}>
            <StarRating
              value={form.score}
              onChange={v => setForm(f => ({ ...f, score: v }))}
              readOnly={isViewer}
            />
            <span style={{ color: c.textSecondary, fontSize: 12, marginLeft: 8 }}>
              {form.score > 0 ? `${form.score} / 5` : 'Not rated'}
            </span>
          </div>

          {/* Status Toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['active', 'inactive'].map(st => (
              <button
                key={st}
                onClick={() => { if (!isViewer) setForm(f => ({ ...f, status: st })) }}
                style={{
                  padding: '7px 14px', borderRadius: 8, cursor: isViewer ? 'default' : 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                  background: form.status === st ? c.successMuted : c.surfaceHover,
                  border: `1px solid ${form.status === st ? c.success + '60' : c.border}`,
                  color: form.status === st ? c.success : c.textMuted,
                  transition: 'all 0.15s',
                }}
              >
                {st === 'active' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>

          {/* Notes */}
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={v => setForm(f => ({ ...f, notes: v }))}
            placeholder="Internal notes about this supplier..."
            rows={3}
            disabled={isViewer}
          />

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
            {!isViewer && <Btn onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Create Supplier'}</Btn>}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${confirmDelete?.company_name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
