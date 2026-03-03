// 17Track API v2.2 integration
// Docs: https://api.17track.net/en/doc

const PROXY_URL = import.meta.env.VITE_TRACK17_PROXY_URL || ''

// Status mapping from 17Track structured status to Supploxi statuses
function mapStatusFallback(status, subStatus) {
  switch (status) {
    case 'NotFound':         return 'NotFound'
    case 'InfoReceived':     return 'InfoReceived'
    case 'InTransit':
      if (subStatus === 'InTransit_PickedUp') return 'InfoReceived'
      if (subStatus === 'InTransit_Departure') return 'InTransit'
      if (subStatus === 'InTransit_Arrival') return 'InTransit'
      if (subStatus === 'InTransit_CustomsProcessing') return 'Customs'
      return 'InTransit'
    case 'AvailableForPickup': return 'AvailableForPickup'
    case 'OutForDelivery':   return 'OutForDelivery'
    case 'DeliveryFailure':  return 'AttemptFail'
    case 'Delivered':        return 'Delivered'
    case 'Exception':
      if (subStatus === 'Exception_Returning') return 'Exception'
      if (subStatus === 'Exception_Returned') return 'Exception'
      return 'Exception'
    case 'Expired':          return 'Expired'
    default:                 return 'InTransit'
  }
}

// Map status by event description text
export function mapStatusByDescription(description) {
  if (!description) return null
  const d = description.toLowerCase().trim()

  if (d.includes('delivered')) return 'Delivered'
  if (d.includes('out for delivery')) return 'OutForDelivery'
  if (d.includes('available for pickup')) return 'AvailableForPickup'
  if (d.includes('customs')) return 'Customs'
  if (d.includes('clearance')) return 'Customs'
  if (d.includes('held by customs')) return 'Customs'
  if (d.includes('delivery attempt') || d.includes('delivery failed')) return 'AttemptFail'
  if (d.includes('returned to sender') || d.includes('return to sender')) return 'Exception'
  if (d.includes('shipment information received')) return 'InfoReceived'
  if (d.includes('picked up')) return 'InfoReceived'
  if (d.includes('departed') || d.includes('in transit') || d.includes('arrived at')) return 'InTransit'

  return null
}

// Main mapping: text first, fallback to structured status
function mapStatus(status, subStatus, description) {
  const fromText = mapStatusByDescription(description)
  if (fromText) return fromText
  return mapStatusFallback(status, subStatus)
}

// Generic API call via Edge Function proxy
async function api(apiKey, endpoint, body) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, body }),
  })
  const data = await res.json()
  if (res.status === 401 || data?.error?.includes('invalid')) throw new Error('17Track API key is invalid or disabled.')
  if (res.status === 429) throw new Error('17Track rate limit exceeded. Please wait and try again.')
  if (!res.ok) throw new Error(data?.error || `17Track error (${res.status})`)
  return data
}

// Check remaining quota (free)
export async function getQuota() {
  const data = await api(null, '/getquota', {})
  return data.data || null
}

// Register tracking numbers (costs 1 quota per new tracking)
// Returns { accepted, alreadyExists, errors }
export async function registerTracking(apiKey, trackingNumbers) {
  if (!apiKey || !trackingNumbers.length) return { accepted: [], alreadyExists: 0, errors: 0 }
  const body = trackingNumbers.map(n => ({ number: n, auto_detection: true }))
  const data = await api(apiKey, '/register', body)
  const accepted = data.data?.accepted || []
  const rejected = data.data?.rejected || []
  // -18019901 = "already registered" — does not consume quota, not an error
  const alreadyExists = rejected.filter(r => r.error?.code === -18019901).length
  return { accepted, alreadyExists, errors: rejected.length - alreadyExists }
}

// Get tracking status (FREE, does not consume quota)
// Returns { results: [...], notRegistered: [...] }
export async function getTrackingStatus(apiKey, trackingNumbers) {
  if (!apiKey || !trackingNumbers.length) return { results: [], notRegistered: [] }
  const body = trackingNumbers.map(n => ({ number: n }))
  const data = await api(apiKey, '/gettrackinfo', body)
  if (data.code !== 0) return { results: [], notRegistered: trackingNumbers }

  const results = (data.data?.accepted || []).map(item => {
    const trackInfo = item.track_info || {}
    const latestStatus = trackInfo.latest_status || {}
    const latestEvent = trackInfo.latest_event || {}
    const description = latestEvent.description || ''
    return {
      tracking_number: item.number,
      status: mapStatus(latestStatus.status || 'NotFound', latestStatus.sub_status || '', description),
      last_event: description,
      last_update: latestEvent.time_iso || latestEvent.time_utc || null,
    }
  })

  // -18019902 = "not registered" — needs to be registered first
  const notRegistered = (data.data?.rejected || [])
    .filter(r => r.error?.code === -18019902)
    .map(r => r.number)

  return { results, notRegistered }
}

// Batch update with quota optimization
// shipments = [{ id, tracking_number, status, registered_17track }]
// Returns { results, stats, registeredNumbers }
export async function updateAllTrackings(apiKey, shipments, onProgress) {
  if (!apiKey) return { results: [], stats: { withInfo: 0, noInfo: 0, registered: 0, noResponse: 0 }, registeredNumbers: [] }

  const BATCH = 40
  const allResults = []
  let totalRegistered = 0
  let totalNoResponse = 0
  const registeredNumbers = []

  for (let i = 0; i < shipments.length; i += BATCH) {
    const batch = shipments.slice(i, i + BATCH)
    const nums = batch.map(r => r.tracking_number).filter(Boolean)
    if (!nums.length) continue

    if (onProgress) onProgress(Math.min(i + BATCH, shipments.length), shipments.length, 'Checking')

    // Separate: already registered vs not registered
    const alreadyRegistered = batch.filter(r => r.registered_17track).map(r => r.tracking_number).filter(Boolean)
    const notRegistered = batch.filter(r => !r.registered_17track).map(r => r.tracking_number).filter(Boolean)

    let statuses = []

    // 1. Query already registered (FREE)
    if (alreadyRegistered.length > 0) {
      const { results } = await getTrackingStatus(apiKey, alreadyRegistered)
      statuses.push(...results)
      await new Promise(r => setTimeout(r, 400))
    }

    // 2. For unregistered, try query first (may already be in 17track without flag)
    if (notRegistered.length > 0) {
      const { results: infoResults, notRegistered: needsRegistration } = await getTrackingStatus(apiKey, notRegistered)
      statuses.push(...infoResults)

      for (const r of infoResults) {
        registeredNumbers.push(r.tracking_number)
      }

      await new Promise(r => setTimeout(r, 400))

      // 3. Register ONLY those truly not in 17track (costs quota)
      if (needsRegistration.length > 0) {
        if (onProgress) onProgress(Math.min(i + BATCH, shipments.length), shipments.length, `Registering ${needsRegistration.length} new`)
        const reg = await registerTracking(apiKey, needsRegistration)
        totalRegistered += reg.accepted.length
        registeredNumbers.push(...reg.accepted.map(a => a.number))

        // Wait for 17track to process newly registered
        await new Promise(r => setTimeout(r, 2500))

        // Try to query newly registered
        const retry = await getTrackingStatus(apiKey, needsRegistration)
        statuses.push(...retry.results)
        totalNoResponse += needsRegistration.length - retry.results.length
        await new Promise(r => setTimeout(r, 400))
      }
    }

    // 4. Map results with original shipment
    statuses.forEach(s => {
      const shipment = batch.find(r => r.tracking_number === s.tracking_number)
      if (shipment) {
        allResults.push({ id: shipment.id, currentStatus: shipment.status, ...s })
      }
    })

    if (i + BATCH < shipments.length) await new Promise(r => setTimeout(r, 600))
  }

  const withInfo = allResults.filter(r => r.status !== 'NotFound').length
  const noInfo = allResults.filter(r => r.status === 'NotFound').length

  return {
    results: allResults,
    stats: { withInfo, noInfo, registered: totalRegistered, noResponse: totalNoResponse },
    registeredNumbers,
  }
}
