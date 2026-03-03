// Stripe integration for subscription management

import { loadStripe } from '@stripe/stripe-js'

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''

let stripePromise = null
export function getStripe() {
  if (!stripePromise && STRIPE_KEY) {
    stripePromise = loadStripe(STRIPE_KEY)
  }
  return stripePromise
}

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

// Create a checkout session via your backend
export async function createCheckoutSession(plan, interval = 'monthly') {
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, interval }),
  })
  if (!res.ok) throw new Error('Failed to create checkout session')
  const { sessionId } = await res.json()

  const stripe = await getStripe()
  if (!stripe) throw new Error('Stripe not initialized')

  const { error } = await stripe.redirectToCheckout({ sessionId })
  if (error) throw error
}

// Create a portal session for managing subscription
export async function createPortalSession() {
  const res = await fetch('/api/create-portal-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to create portal session')
  const { url } = await res.json()
  window.location.href = url
}

// Get current subscription details
export async function getSubscription() {
  const res = await fetch('/api/subscription', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to fetch subscription')
  return await res.json()
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
