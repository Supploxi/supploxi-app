import express from 'express'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'

const app = express()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

app.use(cors({ origin: ['https://app.supploxi.com', 'http://localhost:5173'] }))
app.use('/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.post('/api/create-checkout-session', async (req, res) => {
  const { priceId, userId, userEmail, plan, interval } = req.body
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: userEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { userId, plan, interval }
      },
      metadata: { userId, plan, interval },
      success_url: 'https://app.supploxi.com/subscription?success=true',
      cancel_url: 'https://app.supploxi.com/subscription?cancelled=true',
    })
    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/create-portal-session', async (req, res) => {
  const { userId } = req.body
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: 'https://app.supploxi.com/subscription',
    })
    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  const getPlan = (priceId) => {
    const map = {
      'price_1T6vGBJDNMtBbglVaRq3E8NE': 'starter',
      'price_1T6vGBJDNMtBbglV7Mh2YOSL': 'starter',
      'price_1T6vKDJDNMtBbglVgbg2APTq': 'growth',
      'price_1T6vKDJDNMtBbglVe65kShxP': 'growth',
      'price_1T6vLfJDNMtBbglV4RAbg1r4': 'scale',
      'price_1T6vLfJDNMtBbglV51rpZDMe': 'scale',
    }
    return map[priceId] || 'starter'
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata.userId
      const subscription = await stripe.subscriptions.retrieve(session.subscription)
      const priceId = subscription.items.data[0].price.id
      await supabase.from('profiles').update({
        subscription_plan: getPlan(priceId),
        subscription_status: 'trialing',
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
      }).eq('user_id', userId)
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object
      const { data: profile } = await supabase
        .from('profiles').select('user_id')
        .eq('stripe_customer_id', sub.customer).single()
      if (profile) {
        await supabase.from('profiles').update({
          subscription_plan: getPlan(sub.items.data[0].price.id),
          subscription_status: sub.status,
        }).eq('user_id', profile.user_id)
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const { data: profile } = await supabase
        .from('profiles').select('user_id')
        .eq('stripe_customer_id', sub.customer).single()
      if (profile) {
        await supabase.from('profiles').update({
          subscription_plan: 'starter',
          subscription_status: 'canceled',
        }).eq('user_id', profile.user_id)
      }
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const { data: profile } = await supabase
        .from('profiles').select('user_id')
        .eq('stripe_customer_id', invoice.customer).single()
      if (profile) {
        await supabase.from('profiles').update({
          subscription_status: 'past_due',
        }).eq('user_id', profile.user_id)
      }
      break
    }
  }
  res.json({ received: true })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
