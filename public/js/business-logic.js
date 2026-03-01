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
window.calcReorderAlert = (product) => {
  const stock = parseInt(product.stock_quantity) || 0
  const avgDaily = parseFloat(product.avg_daily_sales) || 1
  const leadTime = parseInt(product.lead_time_days) || 30
  const customsBuffer = 15
  const safetyBuffer = 7
  const totalLeadTime = leadTime + customsBuffer + safetyBuffer
  const daysLeft = stock / avgDaily
  const suggestedQty = Math.ceil(avgDaily * totalLeadTime * 1.3)

  let urgency = 'ok'
  if (daysLeft <= leadTime) urgency = 'critical'
  else if (daysLeft <= totalLeadTime) urgency = 'soon'
  else if (daysLeft <= totalLeadTime + 14) urgency = 'monitor'

  return {
    urgency,
    daysUntilStockout: Math.floor(daysLeft),
    suggestedQty,
    shouldOrder: urgency === 'critical' || urgency === 'soon',
    message: urgency === 'critical'
      ? `Order NOW \u2014 stockout in ${Math.floor(daysLeft)} days`
      : urgency === 'soon'
      ? `Order soon \u2014 ${Math.floor(daysLeft)} days left`
      : urgency === 'monitor'
      ? `Monitor \u2014 ${Math.floor(daysLeft)} days left`
      : `OK \u2014 ${Math.floor(daysLeft)} days of stock`
  }
}

// ---- 17Track Status Mapping ----
window.map17TrackStatus = (tag) => {
  const map = {
    NotFound: 'processing',
    InTransit: 'in_transit',
    Delivered: 'delivered',
    Undelivered: 'exception',
    Returning: 'exception',
    Expired: 'exception',
    PickedUp: 'in_transit',
    OutForDelivery: 'out_for_delivery',
    CustomsHold: 'customs'
  }
  return map[tag] || 'processing'
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
