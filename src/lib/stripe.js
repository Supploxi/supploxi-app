// Stripe integration for subscription management

const API_URL = 'https://app.supploxi.com'

// Subscription plans
export const PLANS = {
  starter: {
    name: 'Starter',
    description: 'For small sellers getting started',
    monthly: 19,
    annual: 152,
    features: [
      'Up to 100 orders/month',
      'Up to 5 suppliers',
      'Basic shipment tracking',
      'Email support',
    ],
  },
  growth: {
    name: 'Growth',
    description: 'For growing businesses',
    monthly: 49,
    annual: 392,
    features: [
      'Up to 500 orders/month',
      'Unlimited suppliers',
      'Advanced tracking & analytics',
      'Purchase order management',
      'Priority support',
    ],
  },
  scale: {
    name: 'Scale',
    description: 'For high-volume operations',
    monthly: 99,
    annual: 792,
    features: [
      'Unlimited orders',
      'Unlimited suppliers',
      'Full analytics suite',
      'Tariff monitoring',
      'API access',
      'Dedicated support',
    ],
  },
}

const priceMap = {
  starter: {
    monthly: 'price_1T6vGBJDNMtBbglVaRq3E8NE',
    annual: 'price_1T6vGBJDNMtBbglV7Mh2YOSL',
  },
  growth: {
    monthly: 'price_1T6vKDJDNMtBbglVgbg2APTq',
    annual: 'price_1T6vKDJDNMtBbglVe65kShxP',
  },
  scale: {
    monthly: 'price_1T6vLfJDNMtBbglV4RAbg1r4',
    annual: 'price_1T6vLfJDNMtBbglV51rpZDMe',
  },
}

export const createCheckoutSession = async (plan, interval, userId, userEmail) => {
  const priceId = priceMap[plan]?.[interval]
  if (!priceId) throw new Error('Invalid plan or interval')
  const res = await fetch(`${API_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId, userId, userEmail, plan, interval }),
  })
  const data = await res.json()
  if (data.url) window.location.href = data.url
  else throw new Error(data.error || 'Failed to create checkout session')
}

export const createPortalSession = async (userId) => {
  const res = await fetch(`${API_URL}/api/create-portal-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  const data = await res.json()
  if (data.url) window.location.href = data.url
  else throw new Error(data.error || 'Failed to create portal session')
}

// Format price for display
export function formatPlanPrice(plan, interval = 'monthly') {
  const config = PLANS[plan]
  if (!config) return '$0'
  const price = interval === 'annual' ? config.annual : config.monthly
  return `$${price}`
}

export function formatPlanMonthly(plan, interval = 'monthly') {
  const config = PLANS[plan]
  if (!config) return '$0/mo'
  if (interval === 'annual') {
    return `$${Math.round(config.annual / 12)}/mo`
  }
  return `$${config.monthly}/mo`
}
