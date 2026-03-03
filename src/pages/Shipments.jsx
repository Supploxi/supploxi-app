import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  useColors, Card, StatCard, SectionTitle, Btn, Field, SearchInput, Badge, Select,
  DateRangePicker, useDateRange, Pagination, usePagination, useSort, SortHeader,
  Tabs, Modal, formatDate, formatNumber, formatPercent, Icons, Loading, Empty, Alert,
} from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import useIsMobile from '../hooks/useIsMobile'
import { STATUS_COLOR, SHIPMENT_GROUPS } from '../lib/reportana'
import { updateAllTrackings } from '../lib/track17'

const PAGE_SIZE = 25

// Human-readable labels for SHIPMENT_GROUPS keys
const GROUP_LABELS = {
  ALL: 'All',
  IN_TRANSIT: 'In Transit',
  CUSTOMS: 'Customs',
  LAST_MILE: 'Last Mile',
  DELIVERED: 'Delivered',
  NOT_FOUND: 'Not Found',
  EXCEPTIONS: 'Exceptions',
}

// Build a flat list of sidebar filter items from SHIPMENT_GROUPS
const FILTER_GROUPS = [
  { key: 'ALL', label: GROUP_LABELS.ALL, statuses: null },
  ...Object.entries(SHIPMENT_GROUPS).map(([key, statuses]) => ({
    key,
    label: GROUP_LABELS[key] || key,
    statuses,
  })),
]

// Compute the number of days between two ISO date strings
function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return null
  try {
    const a = new Date(dateA)
    const b = new Date(dateB)
    const diff = Math.abs(b - a)
    return Math.round(diff / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

// Build CSV content from shipment rows
function buildCSV(shipments) {
  const headers = [
    'Tracking Number',
    'Carrier',
    'Status',
    'Last Event',
    'Last Update',
    'Order Number',
    'Origin',
    'Destination',
    'Shipped At',
    'Delivered At',
    'Estimated Delivery',
  ]

  const escape = (val) => {
    if (val == null) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  const rows = shipments.map(s => [
    escape(s.tracking_number),
    escape(s.carrier),
    escape(s.status),
    escape(s.last_event),
    escape(s.last_update),
    escape(s.order_number),
    escape(s.origin),
    escape(s.destination),
    escape(s.shipped_at),
    escape(s.delivered_at),
    escape(s.estimated_delivery),
  ].join(','))

  return [headers.join(','), ...rows].join('\n')
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const CARRIER_OPTIONS = ['SF Express', 'DHL', 'FedEx', 'UPS', 'USPS', 'YunExpress', 'Yanwen', 'China Post', 'Other']

export default function Shipments() {
  const c = useColors()
  const isMobile = useIsMobile()
  const { isViewer, user } = useAuth()

  // Data state
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null) // { text, variant }
  const [syncProgress, setSyncProgress] = useState(null) // "12 / 40 Checking"
  const [expandedId, setExpandedId] = useState(null)

  // Manual shipment creation
  const [showShipmentModal, setShowShipmentModal] = useState(false)
  const [shipmentForm, setShipmentForm] = useState({
    tracking_number: '', carrier: '', origin: '', destination: '', order_id: '', notes: '',
  })
  const [shipmentSaving, setShipmentSaving] = useState(false)
  const [shipmentError, setShipmentError] = useState('')
  const [ordersList, setOrdersList] = useState([])

  // Filter state
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState('ALL')
  const [dateRange, setDateRange] = useDateRange('shipments')

  // Sort state
  const { sortField, sortDir, onSort } = useSort('last_update', 'desc')

  // Load orders for shipment modal
  useEffect(() => {
    supabase.from('orders').select('id, order_number').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setOrdersList(data || []))
  }, [])

  // Load shipments from supabase
  useEffect(() => {
    loadShipments()
  }, [dateRange])

  async function loadShipments() {
    setLoading(true)
    try {
      let query = supabase
        .from('shipments')
        .select('*')
        .order('last_update', { ascending: false, nullsFirst: false })

      if (dateRange.from) {
        query = query.gte('created_at', dateRange.from + 'T00:00:00Z')
      }
      if (dateRange.to) {
        query = query.lte('created_at', dateRange.to + 'T23:59:59Z')
      }

      const { data, error } = await query

      if (error) throw error
      setShipments(data || [])
    } catch (err) {
      console.error('Failed to load shipments:', err)
      setShipments([])
    } finally {
      setLoading(false)
    }
  }

  // KPI computations
  const kpis = useMemo(() => {
    const total = shipments.length

    // Avg delivery days: for delivered shipments with both shipped_at and delivered_at
    const deliveredWithDates = shipments.filter(
      s => s.status === 'Delivered' && s.shipped_at && s.delivered_at
    )
    let avgDeliveryDays = 0
    if (deliveredWithDates.length > 0) {
      const totalDays = deliveredWithDates.reduce((sum, s) => {
        const days = daysBetween(s.shipped_at, s.delivered_at)
        return sum + (days || 0)
      }, 0)
      avgDeliveryDays = totalDays / deliveredWithDates.length
    }

    // On-time %: delivered within estimated_delivery
    const deliveredWithEstimate = shipments.filter(
      s => s.status === 'Delivered' && s.delivered_at && s.estimated_delivery
    )
    let onTimePercent = 0
    if (deliveredWithEstimate.length > 0) {
      const onTimeCount = deliveredWithEstimate.filter(s => {
        const delivered = new Date(s.delivered_at)
        const estimated = new Date(s.estimated_delivery)
        return delivered <= estimated
      }).length
      onTimePercent = (onTimeCount / deliveredWithEstimate.length) * 100
    }

    // In Customs count
    const inCustoms = shipments.filter(s => s.status === 'Customs').length

    return { total, avgDeliveryDays, onTimePercent, deliveredWithEstimate: deliveredWithEstimate.length, inCustoms }
  }, [shipments])

  // Compute counts per group
  const groupCounts = useMemo(() => {
    const counts = { ALL: shipments.length }
    for (const [key, statuses] of Object.entries(SHIPMENT_GROUPS)) {
      counts[key] = shipments.filter(s => statuses.includes(s.status)).length
    }
    return counts
  }, [shipments])

  // Client-side filtering: group, search
  const filtered = useMemo(() => {
    let result = [...shipments]

    // Group filter
    if (activeGroup !== 'ALL') {
      const statuses = SHIPMENT_GROUPS[activeGroup]
      if (statuses) {
        result = result.filter(s => statuses.includes(s.status))
      }
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(s =>
        (s.tracking_number || '').toLowerCase().includes(q) ||
        (s.carrier || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [shipments, activeGroup, search])

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

  // Sync tracking via 17Track
  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncMsg(null)
    setSyncProgress(null)

    try {
      // Load 17Track API key from settings
      const { data: settingsRow, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'track17')
        .single()

      if (settingsError || !settingsRow?.value) {
        setSyncMsg({ text: '17Track API key is not configured. Go to Settings to add your key.', variant: 'warning' })
        return
      }

      const config = typeof settingsRow.value === 'string'
        ? JSON.parse(settingsRow.value)
        : settingsRow.value

      const apiKey = config.api_key || config.apiKey || config

      if (!apiKey || typeof apiKey !== 'string') {
        setSyncMsg({ text: '17Track API key is invalid. Check your Settings.', variant: 'warning' })
        return
      }

      // Filter shipments that have a tracking number
      const trackable = shipments.filter(s => s.tracking_number)

      if (trackable.length === 0) {
        setSyncMsg({ text: 'No shipments with tracking numbers to sync.', variant: 'info' })
        return
      }

      // Call updateAllTrackings
      const { results, stats, registeredNumbers } = await updateAllTrackings(
        apiKey,
        trackable.map(s => ({
          id: s.id,
          tracking_number: s.tracking_number,
          status: s.status,
          registered_17track: s.registered_17track,
        })),
        (current, total, action) => {
          setSyncProgress(`${current} / ${total} -- ${action}`)
        }
      )

      // Update shipment records in supabase
      let updatedCount = 0
      for (const r of results) {
        const updates = {
          status: r.status,
          last_event: r.last_event || null,
          last_update: r.last_update || null,
        }

        // If newly delivered, set delivered_at
        if (r.status === 'Delivered' && r.currentStatus !== 'Delivered') {
          updates.delivered_at = r.last_update || new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('shipments')
          .update(updates)
          .eq('id', r.id)

        if (!updateError) updatedCount++
      }

      // Mark registered tracking numbers
      if (registeredNumbers.length > 0) {
        await supabase
          .from('shipments')
          .update({ registered_17track: true })
          .in('tracking_number', registeredNumbers)
      }

      setSyncProgress(null)
      setSyncMsg({
        text: `Sync complete: ${updatedCount} updated, ${stats.registered} newly registered, ${stats.noInfo} not found.`,
        variant: 'success',
      })

      // Reload shipments
      await loadShipments()
    } catch (err) {
      console.error('Sync error:', err)
      setSyncMsg({ text: `Sync failed: ${err.message}`, variant: 'danger' })
    } finally {
      setSyncing(false)
      setSyncProgress(null)
    }
  }, [shipments])

  // Export CSV
  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) return
    const csv = buildCSV(filtered)
    const date = new Date().toISOString().slice(0, 10)
    downloadCSV(csv, `supploxi-shipments-${date}.csv`)
  }, [filtered])

  // Toggle row expand
  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id)
  }, [])

  // Manual shipment creation
  function openNewShipment() {
    setShipmentForm({ tracking_number: '', carrier: '', origin: '', destination: '', order_id: '', notes: '' })
    setShipmentError('')
    setShowShipmentModal(true)
  }

  async function saveShipment() {
    if (!shipmentForm.tracking_number.trim()) { setShipmentError('Tracking number is required.'); return }
    setShipmentSaving(true)
    setShipmentError('')
    try {
      const selectedOrder = ordersList.find(o => o.id === shipmentForm.order_id)
      const { error: insErr } = await supabase.from('shipments').insert({
        tracking_number: shipmentForm.tracking_number.trim(),
        carrier: shipmentForm.carrier || null,
        origin: shipmentForm.origin.trim() || null,
        destination: shipmentForm.destination.trim() || null,
        order_id: shipmentForm.order_id || null,
        order_number: selectedOrder?.order_number || null,
        notes: shipmentForm.notes.trim() || null,
        status: 'Not Found',
        user_id: user?.id,
      })
      if (insErr) throw insErr
      setShowShipmentModal(false)
      await loadShipments()
    } catch (err) {
      console.error('Save shipment failed:', err)
      setShipmentError(err.message || 'Failed to add shipment.')
    } finally {
      setShipmentSaving(false)
    }
  }

  const filteredCount = filtered.length

  // -- Sidebar filter (desktop) --
  function renderSidebar() {
    return (
      <div style={{
        width: 200, flexShrink: 0,
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 12, padding: '12px 0',
        alignSelf: 'flex-start',
      }}>
        <p style={{
          color: c.textSecondary, fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.05em',
          padding: '4px 16px 8px', margin: 0,
        }}>
          Status Filter
        </p>
        {FILTER_GROUPS.map(g => {
          const isActive = activeGroup === g.key
          const count = groupCounts[g.key] || 0
          return (
            <button
              key={g.key}
              onClick={() => { setActiveGroup(g.key); setPage(1) }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '8px 16px', border: 'none',
                background: isActive ? c.accentMuted : 'transparent',
                color: isActive ? c.accent : c.text,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.1s',
                textAlign: 'left',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = c.surfaceHover }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span>{g.label}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, minWidth: 22, textAlign: 'right',
                color: isActive ? c.accent : c.textMuted,
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  // -- Mobile dropdown filter --
  function renderMobileFilter() {
    const options = FILTER_GROUPS.map(g => ({
      value: g.key,
      label: `${g.label} (${groupCounts[g.key] || 0})`,
    }))
    return (
      <Select
        value={activeGroup}
        onChange={v => { setActiveGroup(v); setPage(1) }}
        options={options}
        style={{ marginBottom: 0, flex: '0 0 auto', minWidth: 160 }}
      />
    )
  }

  // -- Detail expand panel --
  function renderDetailPanel(shipment) {
    return (
      <tr>
        <td colSpan={7} style={{ padding: 0 }}>
          <div style={{
            padding: '16px 20px', background: c.surfaceHover,
            borderBottom: `1px solid ${c.border}`,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <p style={{ color: c.textSecondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Last Event</p>
                <p style={{ color: c.text, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  {shipment.last_event || 'No event data available.'}
                </p>
              </div>
              <div>
                <p style={{ color: c.textSecondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Last Update</p>
                <p style={{ color: c.text, fontSize: 13, margin: 0 }}>
                  {formatDate(shipment.last_update)}
                </p>
              </div>
              <div>
                <p style={{ color: c.textSecondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Shipped At</p>
                <p style={{ color: c.text, fontSize: 13, margin: 0 }}>
                  {formatDate(shipment.shipped_at)}
                </p>
              </div>
              <div>
                <p style={{ color: c.textSecondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Delivered At</p>
                <p style={{ color: c.text, fontSize: 13, margin: 0 }}>
                  {formatDate(shipment.delivered_at)}
                </p>
              </div>
              <div>
                <p style={{ color: c.textSecondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Estimated Delivery</p>
                <p style={{ color: c.text, fontSize: 13, margin: 0 }}>
                  {formatDate(shipment.estimated_delivery)}
                </p>
              </div>
              <div>
                <p style={{ color: c.textSecondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Registered on 17Track</p>
                <p style={{ color: c.text, fontSize: 13, margin: 0 }}>
                  {shipment.registered_17track ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  // -- Mobile card detail --
  function renderMobileDetail(shipment) {
    return (
      <div style={{
        marginTop: 10, paddingTop: 10,
        borderTop: `1px solid ${c.border}`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <p style={{ color: c.textSecondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>Last Event</p>
            <p style={{ color: c.text, fontSize: 12, margin: 0, lineHeight: 1.4 }}>
              {shipment.last_event || 'No event data available.'}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <p style={{ color: c.textSecondary, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 2px' }}>Shipped</p>
              <p style={{ color: c.text, fontSize: 12, margin: 0 }}>{formatDate(shipment.shipped_at)}</p>
            </div>
            <div>
              <p style={{ color: c.textSecondary, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 2px' }}>Delivered</p>
              <p style={{ color: c.text, fontSize: 12, margin: 0 }}>{formatDate(shipment.delivered_at)}</p>
            </div>
            <div>
              <p style={{ color: c.textSecondary, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 2px' }}>Estimated</p>
              <p style={{ color: c.text, fontSize: 12, margin: 0 }}>{formatDate(shipment.estimated_delivery)}</p>
            </div>
            <div>
              <p style={{ color: c.textSecondary, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 2px' }}>17Track</p>
              <p style={{ color: c.text, fontSize: 12, margin: 0 }}>{shipment.registered_17track ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
            Shipments
          </h1>
          <p style={{ color: c.textMuted, fontSize: 12, margin: '2px 0 0' }}>
            {filteredCount === shipments.length
              ? `${shipments.length} shipment${shipments.length !== 1 ? 's' : ''}`
              : `${filteredCount} of ${shipments.length} shipments`
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
            <>
              <Btn
                variant="primary"
                size="sm"
                onClick={handleSync}
                loading={syncing}
                icon={<Icons.RefreshCw size={13} />}
              >
                {syncing ? 'Syncing...' : 'Sync Tracking'}
              </Btn>
              <Btn size="sm" onClick={openNewShipment} icon={<Icons.Plus size={13} />}>
                Add Shipment
              </Btn>
            </>
          )}
          <Btn
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            icon={<Icons.Download size={13} />}
          >
            Export CSV
          </Btn>
        </div>
      </div>

      {/* Sync message */}
      {syncMsg && (
        <Alert variant={syncMsg.variant} onClose={() => setSyncMsg(null)}>
          {syncMsg.text}
        </Alert>
      )}

      {/* Sync progress */}
      {syncProgress && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 8,
          background: c.infoMuted, color: c.info, fontSize: 13,
        }}>
          <Icons.Loader size={14} />
          {syncProgress}
        </div>
      )}

      {/* KPI row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 12,
      }}>
        <StatCard
          title="Total Shipments"
          value={formatNumber(kpis.total)}
          icon={<Icons.Package size={18} />}
        />
        <StatCard
          title="Avg Delivery Days"
          value={kpis.avgDeliveryDays > 0 ? kpis.avgDeliveryDays.toFixed(1) : '--'}
          subtitle={kpis.avgDeliveryDays > 0 ? 'shipped to delivered' : 'no data yet'}
          icon={<Icons.Truck size={18} />}
        />
        <StatCard
          title="On-Time %"
          value={kpis.deliveredWithEstimate > 0 ? formatPercent(kpis.onTimePercent) : '--'}
          subtitle={kpis.deliveredWithEstimate > 0 ? `${kpis.deliveredWithEstimate} with estimate` : 'no data yet'}
          icon={<Icons.Check size={18} />}
        />
        <StatCard
          title="In Customs"
          value={formatNumber(kpis.inCustoms)}
          subtitle="currently held"
          icon={<Icons.AlertTriangle size={18} />}
        />
      </div>

      {/* Filters toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search tracking #, carrier..."
          style={{ minWidth: 220, flex: isMobile ? '1 1 100%' : '0 1 280px' }}
        />
        {isMobile && renderMobileFilter()}
      </div>

      {/* Content: Sidebar + Table (desktop) or Cards (mobile) */}
      {loading ? <Loading text="Loading shipments..." /> : (
        <div style={{
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
        }}>
          {/* Sidebar (desktop only) */}
          {!isMobile && renderSidebar()}

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {paged.length === 0 ? (
              <Empty
                title="No shipments found"
                description={search || activeGroup !== 'ALL'
                  ? 'Try adjusting your filters or search terms.'
                  : 'Shipments will appear here once orders are fulfilled and tracking numbers are added.'
                }
              />
            ) : isMobile ? (
              /* Mobile card layout */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {paged.map(shipment => {
                  const isExpanded = expandedId === shipment.id
                  const statusColor = STATUS_COLOR[shipment.status] || '#71717A'
                  return (
                    <Card
                      key={shipment.id}
                      padding="14px 16px"
                      onClick={() => toggleExpand(shipment.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ color: c.text, fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>
                          {shipment.tracking_number || '--'}
                        </span>
                        <Badge style={{ background: statusColor + '1a', color: statusColor }}>
                          {shipment.status || 'Unknown'}
                        </Badge>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ color: c.textSecondary, fontSize: 12 }}>
                          {shipment.carrier || '--'}
                        </span>
                        <span style={{ color: c.textMuted, fontSize: 11, fontFamily: 'monospace' }}>
                          {shipment.order_number || '--'}
                        </span>
                      </div>
                      <div style={{
                        color: c.textSecondary, fontSize: 12, marginBottom: 4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {shipment.last_event || 'No event data'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: c.textMuted, fontSize: 11 }}>
                          {shipment.origin && shipment.destination
                            ? `${shipment.origin} -> ${shipment.destination}`
                            : shipment.origin || shipment.destination || '--'
                          }
                        </span>
                        <span style={{ color: c.textMuted, fontSize: 11 }}>
                          {formatDate(shipment.last_update)}
                        </span>
                      </div>
                      {isExpanded && renderMobileDetail(shipment)}
                    </Card>
                  )
                })}
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
                      <SortHeader label="Tracking #" field="tracking_number" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                      <SortHeader label="Carrier" field="carrier" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                      <SortHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                      <th style={{
                        padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                        color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                        borderBottom: `2px solid ${c.border}`, whiteSpace: 'nowrap',
                      }}>
                        Last Event
                      </th>
                      <SortHeader label="Last Update" field="last_update" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                      <SortHeader label="Order #" field="order_number" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                      <th style={{
                        padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                        color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
                        borderBottom: `2px solid ${c.border}`, whiteSpace: 'nowrap',
                      }}>
                        Route
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((shipment, i) => {
                      const isExpanded = expandedId === shipment.id
                      const statusColor = STATUS_COLOR[shipment.status] || '#71717A'
                      return [
                        <tr
                          key={shipment.id}
                          onClick={() => toggleExpand(shipment.id)}
                          style={{
                            cursor: 'pointer',
                            borderBottom: !isExpanded && i < paged.length - 1 ? `1px solid ${c.border}` : 'none',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = c.surfaceHover }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isExpanded
                                ? <Icons.ChevronDown size={12} style={{ color: c.textMuted, flexShrink: 0 }} />
                                : <Icons.ChevronRight size={12} style={{ color: c.textMuted, flexShrink: 0 }} />
                              }
                              <span style={{ color: c.text, fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>
                                {shipment.tracking_number || '--'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                            <span style={{ color: c.text, fontSize: 13 }}>
                              {shipment.carrier || '--'}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <Badge style={{ background: statusColor + '1a', color: statusColor }}>
                              {shipment.status || 'Unknown'}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px', maxWidth: 260 }}>
                            <div style={{
                              color: c.textSecondary, fontSize: 12,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {shipment.last_event || '--'}
                            </div>
                          </td>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                            <span style={{ color: c.textSecondary, fontSize: 12 }}>
                              {formatDate(shipment.last_update)}
                            </span>
                          </td>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                            <span style={{ color: c.text, fontSize: 13, fontFamily: 'monospace' }}>
                              {shipment.order_number || '--'}
                            </span>
                          </td>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                            <span style={{ color: c.textSecondary, fontSize: 12 }}>
                              {shipment.origin && shipment.destination
                                ? `${shipment.origin} -> ${shipment.destination}`
                                : shipment.origin || shipment.destination || '--'
                              }
                            </span>
                          </td>
                        </tr>,
                        isExpanded && renderDetailPanel(shipment),
                      ]
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ color: c.textMuted, fontSize: 12 }}>
                {filteredCount > 0
                  ? `${(page - 1) * PAGE_SIZE + 1}--${Math.min(page * PAGE_SIZE, filteredCount)} of ${filteredCount}`
                  : '0 shipments'
                }
              </span>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add Shipment Modal */}
      <Modal open={showShipmentModal} onClose={() => setShowShipmentModal(false)} title="Add Shipment" width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Field
            label="Tracking Number"
            value={shipmentForm.tracking_number}
            onChange={v => setShipmentForm(f => ({ ...f, tracking_number: v }))}
            placeholder="e.g. SF1234567890"
            required
          />
          <Select
            label="Carrier"
            value={shipmentForm.carrier}
            onChange={v => setShipmentForm(f => ({ ...f, carrier: v }))}
            options={CARRIER_OPTIONS}
            placeholder="Select carrier..."
          />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0, columnGap: 12 }}>
            <Field
              label="Origin"
              value={shipmentForm.origin}
              onChange={v => setShipmentForm(f => ({ ...f, origin: v }))}
              placeholder="e.g. Shenzhen, CN"
            />
            <Field
              label="Destination"
              value={shipmentForm.destination}
              onChange={v => setShipmentForm(f => ({ ...f, destination: v }))}
              placeholder="e.g. Los Angeles, US"
            />
          </div>
          <Select
            label="Order (optional)"
            value={shipmentForm.order_id}
            onChange={v => setShipmentForm(f => ({ ...f, order_id: v }))}
            options={ordersList.map(o => ({ value: o.id, label: o.order_number || o.id }))}
            placeholder="Link to an order..."
          />
          <Field
            label="Notes"
            value={shipmentForm.notes}
            onChange={v => setShipmentForm(f => ({ ...f, notes: v }))}
            placeholder="Optional notes..."
          />

          {shipmentError && (
            <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: c.dangerMuted, color: c.danger, marginTop: 4 }}>
              {shipmentError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowShipmentModal(false)}>Cancel</Btn>
            <Btn onClick={saveShipment} loading={shipmentSaving}>Add Shipment</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
