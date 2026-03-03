// Shopify Admin API integration

const API_VERSION = '2024-01'

function getHeaders(accessToken) {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken,
  }
}

function buildUrl(shop, path) {
  const base = shop.replace(/\/$/, '')
  const domain = base.includes('myshopify.com') ? base : `https://${base}.myshopify.com`
  return `${domain}/admin/api/${API_VERSION}${path}`
}

// Shopify order status to Supploxi internal status
export const SHOPIFY_STATUS_MAP = {
  pending:          'Pending Payment',
  authorized:       'Payment Authorized',
  partially_paid:   'Partially Paid',
  paid:             'Paid',
  partially_refunded: 'Partially Refunded',
  refunded:         'Refunded',
  voided:           'Cancelled',
}

export const SHOPIFY_FULFILLMENT_MAP = {
  unfulfilled: 'Unfulfilled',
  partial:     'Partially Fulfilled',
  fulfilled:   'Fulfilled',
  restocked:   'Restocked',
}

export const ORDER_STATUS_LABELS = [
  'All',
  'Pending Payment',
  'Paid',
  'Unfulfilled',
  'Partially Fulfilled',
  'Fulfilled',
  'Cancelled',
  'Refunded',
]

export function mapShopifyFinancialStatus(status) {
  if (!status) return 'Paid'
  return SHOPIFY_STATUS_MAP[status] || status
}

export function mapShopifyFulfillmentStatus(status) {
  if (!status) return 'Unfulfilled'
  return SHOPIFY_FULFILLMENT_MAP[status] || status
}

// Detect payment method from gateway name
export function mapPaymentMethod(gateway = '') {
  const s = gateway.toLowerCase()
  if (s.includes('paypal')) return 'PayPal'
  if (s.includes('stripe')) return 'Credit Card'
  if (s.includes('credit') || s.includes('card')) return 'Credit Card'
  if (s.includes('manual') || s.includes('cash')) return 'Manual'
  if (s.includes('shopify_payments')) return 'Shopify Payments'
  return gateway || 'Other'
}

// Extract tracking numbers from fulfillments
export function extractTrackingFromOrder(order) {
  const trackings = []
  for (const f of (order.fulfillments || [])) {
    if (f.tracking_number) {
      trackings.push({
        tracking_number: f.tracking_number,
        carrier: f.tracking_company || '',
        tracking_url: f.tracking_url || '',
      })
    }
    for (const t of (f.tracking_numbers || [])) {
      if (t && !trackings.some(tr => tr.tracking_number === t)) {
        trackings.push({
          tracking_number: t,
          carrier: f.tracking_company || '',
          tracking_url: '',
        })
      }
    }
  }
  return trackings
}

// Fetch orders with pagination
export async function fetchOrders({ shop, accessToken, dateFrom, dateTo, existingIds = [] }) {
  const headers = getHeaders(accessToken)
  const existingSet = new Set(existingIds.map(String))
  const allOrders = []
  let pageInfo = null

  while (true) {
    let url
    if (pageInfo) {
      url = pageInfo
    } else {
      const params = new URLSearchParams({
        limit: '250',
        status: 'any',
        order: 'created_at desc',
      })
      if (dateFrom) params.set('created_at_min', dateFrom + 'T00:00:00-00:00')
      if (dateTo) params.set('created_at_max', dateTo + 'T23:59:59-00:00')
      url = buildUrl(shop, `/orders.json?${params}`)
    }

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Shopify error ${res.status}: ${txt}`)
    }
    const data = await res.json()
    const orders = data.orders || []
    if (!orders.length) break

    const newOrders = orders.filter(o => !existingSet.has(String(o.id)))
    allOrders.push(...newOrders)

    // If all orders in page already exist, stop
    if (newOrders.length === 0 && orders.length > 0) break

    // Check for next page via Link header
    const link = res.headers.get('Link')
    if (link && link.includes('rel="next"')) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/)
      pageInfo = match ? match[1] : null
    } else {
      pageInfo = null
    }
    if (!pageInfo) break
    await new Promise(r => setTimeout(r, 500))
  }

  return allOrders.map(syncOrder)
}

// Map a Shopify order to Supploxi format
export function syncOrder(o) {
  const shipping = o.shipping_address || o.billing_address || {}
  const trackings = extractTrackingFromOrder(o)
  const paymentMethod = mapPaymentMethod(o.gateway || '')

  const items = (o.line_items || []).map(i => ({
    product_name: i.title || '',
    sku: i.sku || '',
    quantity: i.quantity || 1,
    unit_price: parseFloat(i.price) || 0,
    unit_cost: 0,
    shopify_product_id: i.product_id,
    shopify_variant_id: i.variant_id,
    customization: {},
  }))

  return {
    platform_order_id: String(o.id),
    platform: 'shopify',
    order_number: o.name || `#${o.order_number || o.id}`,
    created_at: o.created_at,
    financial_status: mapShopifyFinancialStatus(o.financial_status),
    fulfillment_status: mapShopifyFulfillmentStatus(o.fulfillment_status),
    status: o.cancelled_at ? 'Cancelled' : mapShopifyFinancialStatus(o.financial_status),
    customer_name: `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || (o.customer?.first_name ? `${o.customer.first_name} ${o.customer.last_name || ''}`.trim() : ''),
    customer_email: o.email || o.contact_email || '',
    customer_phone: shipping.phone || o.phone || '',
    customer_address: shipping.address1 || '',
    customer_city: shipping.city || '',
    customer_state: shipping.province_code || shipping.province || '',
    customer_zip: shipping.zip || '',
    customer_country: shipping.country_code || shipping.country || 'US',
    subtotal: parseFloat(o.subtotal_price) || 0,
    shipping: parseFloat(o.total_shipping_price_set?.shop_money?.amount) || 0,
    tax: parseFloat(o.total_tax) || 0,
    total: parseFloat(o.total_price) || 0,
    discount: parseFloat(o.total_discounts) || 0,
    payment_method: paymentMethod,
    notes: o.note || '',
    tags: o.tags || '',
    items,
    trackings: trackings.map(t => ({
      tracking_number: t.tracking_number,
      carrier: t.carrier,
      status: 'Pending',
    })),
  }
}

// Fetch products with pagination
export async function fetchProducts({ shop, accessToken, maxProducts = 3000 }) {
  const headers = getHeaders(accessToken)
  const all = []
  let pageInfo = null

  while (true) {
    let url
    if (pageInfo) {
      url = pageInfo
    } else {
      const params = new URLSearchParams({ limit: '250', status: 'active' })
      url = buildUrl(shop, `/products.json?${params}`)
    }

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Shopify error ${res.status}: ${txt}`)
    }
    const data = await res.json()
    const products = data.products || []
    if (!products.length) break

    all.push(...products)
    if (all.length >= maxProducts) break

    const link = res.headers.get('Link')
    if (link && link.includes('rel="next"')) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/)
      pageInfo = match ? match[1] : null
    } else {
      pageInfo = null
    }
    if (!pageInfo) break
    await new Promise(r => setTimeout(r, 300))
  }

  return all.map(p => ({
    shopify_product_id: p.id,
    name: p.title || '',
    sku: p.variants?.[0]?.sku || '',
    category: p.product_type || '',
    image_url: p.image?.src || '',
    price_usd: parseFloat(p.variants?.[0]?.price) || 0,
    variants: (p.variants || []).map(v => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      price: parseFloat(v.price) || 0,
      inventory_quantity: v.inventory_quantity || 0,
    })),
  }))
}

// Update inventory for a variant
export async function updateInventory({ shop, accessToken, inventoryItemId, locationId, quantity }) {
  const headers = getHeaders(accessToken)
  const url = buildUrl(shop, '/inventory_levels/set.json')
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available: quantity,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Shopify inventory update error ${res.status}: ${txt}`)
  }
  return await res.json()
}

// Test connection
export async function testShopifyConnection({ shop, accessToken }) {
  const headers = getHeaders(accessToken)
  const url = buildUrl(shop, '/shop.json')
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Error ${res.status}`)
  const data = await res.json()
  return data.shop
}
