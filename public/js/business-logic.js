// =============================================
// SUPPLOXI V2 — Business Logic Functions
// =============================================

// ---- Landed Cost Calculation ----
window.calcLandedCost = (cost, shipping, duties) =>
  (parseFloat(cost) || 0) + (parseFloat(shipping) || 0) + (parseFloat(duties) || 0)

// ---- Margin Calculation ----
window.calcMargin = (selling, landed) => {
  const s = parseFloat(selling) || 0
  const l = parseFloat(landed) || 0
  if (s === 0) return 0
  return ((s - l) / s * 100)
}

// ---- Reorder Alert Calculation ----
// Accepts optional settings from user_settings table:
//   ai_reorder_enabled, include_customs_buffer, customs_buffer_days, safety_stock_days
window.calcReorderAlert = (product, settings) => {
  const s = settings || {}

  // If AI reorder is disabled, return neutral result
  if (s.ai_reorder_enabled === false) {
    return { urgency: 'ok', daysUntilStockout: 0, suggestedQty: 0, shouldOrder: false, message: '' }
  }

  const stock = parseInt(product.stock_quantity) || 0
  const avgDaily = parseFloat(product.avg_daily_sales) || 1
  const supplierLeadTime = parseInt(product.lead_time_days) || 30
  const customsBuffer = (s.include_customs_buffer !== false) ? (parseInt(s.customs_buffer_days) || 15) : 0
  const safetyBuffer = parseInt(s.safety_stock_days) || 7
  const totalLeadTime = supplierLeadTime + customsBuffer + safetyBuffer
  const daysLeft = stock / avgDaily
  const suggestedQty = Math.ceil(avgDaily * totalLeadTime * 1.3)

  let urgency = 'ok'
  let message = ''

  if (daysLeft <= 0) {
    urgency = 'critical'
    message = 'Out of stock'
  } else if (daysLeft <= supplierLeadTime) {
    urgency = 'critical'
    message = `Order NOW — will run out before supplier can deliver (${Math.floor(daysLeft)}d left, need ${supplierLeadTime}d)`
  } else if (daysLeft <= totalLeadTime) {
    urgency = 'soon'
    message = `Order soon — ${Math.floor(daysLeft)} days left, needs ${totalLeadTime} days total`
  } else if (daysLeft <= totalLeadTime * 1.3) {
    urgency = 'monitor'
    message = `Monitor — ${Math.floor(daysLeft)} days left`
  } else {
    message = `OK — ${Math.floor(daysLeft)} days of stock`
  }

  return {
    urgency,
    daysUntilStockout: Math.floor(daysLeft),
    suggestedQty,
    shouldOrder: urgency === 'critical' || urgency === 'soon',
    message
  }
}

// ---- Auto Tracking Status Mapping ----
// Maps 17Track v2.2 track_info.latest_status.status strings to Supploxi statuses
window.map17TrackStatus = (codeOrTag, tag) => {
  // Numeric status codes (legacy fallback)
  const numericMap = {
    0: 'processing',      // NotFound
    10: 'in_transit',     // InTransit
    20: 'exception',      // Expired
    30: 'in_transit',     // PickedUp
    35: 'exception',      // Undelivered
    40: 'delivered',      // Delivered
    50: 'exception',      // Alert
  }
  if (typeof codeOrTag === 'number' && numericMap[codeOrTag] !== undefined) {
    return numericMap[codeOrTag]
  }

  // String status tags (track_info.latest_status.status)
  const stringMap = {
    NotFound: 'processing',
    InTransit: 'in_transit',
    Delivered: 'delivered',
    Undelivered: 'exception',
    Returning: 'exception',
    Expired: 'exception',
    PickedUp: 'in_transit',
    OutForDelivery: 'out_for_delivery',
    CustomsHold: 'customs',
    Alert: 'exception',
  }
  const tagStr = tag || (typeof codeOrTag === 'string' ? codeOrTag : null)
  if (tagStr && stringMap[tagStr]) {
    return stringMap[tagStr]
  }

  return 'processing'
}

// ---- Supplier Score Calculation ----
window.calcSupplierScore = (onTimeRate, defectRate, leadTimeDiff) => {
  let score = 100
  score -= (100 - (parseFloat(onTimeRate) || 100)) * 0.5
  score -= (parseFloat(defectRate) || 0) * 2
  if (leadTimeDiff > 0) score -= Math.min(leadTimeDiff * 2, 20)
  return Math.max(0, Math.min(100, Math.round(score)))
}

// ---- Country Flag Emoji ----
window.getCountryFlag = (code) => {
  const flags = {
    CN: '\uD83C\uDDE8\uD83C\uDDF3',
    US: '\uD83C\uDDFA\uD83C\uDDF8',
    IN: '\uD83C\uDDEE\uD83C\uDDF3',
    VN: '\uD83C\uDDFB\uD83C\uDDF3',
    BD: '\uD83C\uDDE7\uD83C\uDDE9',
    TR: '\uD83C\uDDF9\uD83C\uDDF7',
    PK: '\uD83C\uDDF5\uD83C\uDDF0',
    MX: '\uD83C\uDDF2\uD83C\uDDFD',
    TH: '\uD83C\uDDF9\uD83C\uDDED',
    ID: '\uD83C\uDDEE\uD83C\uDDE9'
  }
  return flags[code?.toUpperCase()] || '\uD83C\uDF10'
}
