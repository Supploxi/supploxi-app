// Shipment tracking statuses for Supploxi

export const TRACKING_STATUSES = [
  'InfoReceived',
  'InTransit',
  'Customs',
  'OutForDelivery',
  'Delivered',
  'AvailableForPickup',
  'AttemptFail',
  'Expired',
  'Exception',
  'NotFound',
  'Pending',
]

export const STATUS_CONFIG = {
  InfoReceived:       { label: 'Info Received',        color: '#3b82f6', group: 'in_transit' },
  InTransit:          { label: 'In Transit',           color: '#8b5cf6', group: 'in_transit' },
  Customs:            { label: 'Customs',              color: '#f59e0b', group: 'in_transit' },
  OutForDelivery:     { label: 'Out for Delivery',     color: '#06b6d4', group: 'in_transit' },
  Delivered:          { label: 'Delivered',             color: '#22c55e', group: 'delivered' },
  AvailableForPickup: { label: 'Available for Pickup', color: '#f59e0b', group: 'delivered' },
  AttemptFail:        { label: 'Delivery Failed',      color: '#ef4444', group: 'exception' },
  Expired:            { label: 'Expired',              color: '#dc2626', group: 'exception' },
  Exception:          { label: 'Exception',            color: '#dc2626', group: 'exception' },
  NotFound:           { label: 'Not Found',            color: '#71717A', group: 'pending' },
  Pending:            { label: 'Pending',              color: '#71717A', group: 'pending' },
}

export const STATUS_COLOR = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.color])
)

export function getStatusLabel(status) {
  return STATUS_CONFIG[status]?.label || status
}

export function getStatusGroup(status) {
  return STATUS_CONFIG[status]?.group || 'pending'
}

export const CUSTOMS_STATUSES = ['Customs']

export function isCustomsHold(status) {
  return CUSTOMS_STATUSES.includes(status)
}

export function isException(status) {
  return ['AttemptFail', 'Expired', 'Exception'].includes(status)
}

export function isDelivered(status) {
  return status === 'Delivered'
}

export const SHIPMENT_GROUPS = {
  IN_TRANSIT:   ['InfoReceived', 'InTransit'],
  CUSTOMS:      ['Customs'],
  LAST_MILE:    ['OutForDelivery', 'AvailableForPickup'],
  DELIVERED:    ['Delivered'],
  NOT_FOUND:    ['NotFound', 'Pending'],
  EXCEPTIONS:   ['AttemptFail', 'Expired', 'Exception'],
}

export const NO_UPDATE_DAYS = 15
