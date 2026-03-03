// Supploxi — Subscription Management Page
// Stripe plan selection, billing interval toggle, current plan banner, FAQ

import { useState } from 'react'
import { useColors, Card, SectionTitle, Btn, Badge, Alert, Icons } from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { PLANS, createCheckoutSession, createPortalSession, formatPlanPrice, formatPlanMonthly } from '../lib/stripe'
import useIsMobile from '../hooks/useIsMobile'

const PLAN_KEYS = Object.keys(PLANS)

const FAQ_ITEMS = [
  {
    question: 'When does my trial end?',
    answer: 'Your free trial lasts 14 days from the date you signed up. You will not be charged during the trial period. When it expires, choose a plan to continue using Supploxi.',
  },
  {
    question: 'Can I change plans later?',
    answer: 'Yes. You can upgrade or downgrade your plan at any time from this page or through the Stripe customer portal. Changes take effect immediately and billing is prorated.',
  },
  {
    question: 'How does annual billing work?',
    answer: 'Annual plans are billed once per year at a 33% discount compared to monthly billing. You can switch between monthly and annual billing at any time.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our payment processor, Stripe. All transactions are secured with industry-standard encryption.',
  },
  {
    question: 'How do I cancel my subscription?',
    answer: 'You can cancel anytime by clicking "Manage Subscription" to open the Stripe customer portal. Your access continues until the end of your current billing period. No refunds are issued for partial periods.',
  },
  {
    question: 'What happens to my data if I cancel?',
    answer: 'Your data is retained for 30 days after cancellation. During that window you can resubscribe and pick up where you left off. After 30 days, data may be permanently deleted.',
  },
]

export default function Subscription() {
  const c = useColors()
  const { user, subscriptionPlan, subscriptionStatus, trialDaysRemaining, profile } = useAuth()
  const isMobile = useIsMobile()

  const [interval, setInterval] = useState('monthly')
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedFaq, setExpandedFaq] = useState(null)

  const trialDays = trialDaysRemaining()
  const isTrialExpired = subscriptionStatus === 'expired' || (subscriptionStatus === 'trial' && trialDays === 0)
  const isActive = subscriptionStatus === 'active'
  const isTrial = subscriptionStatus === 'trial' && !isTrialExpired

  // Determine which plan key matches the current subscription
  const currentPlanKey = subscriptionPlan && PLAN_KEYS.includes(subscriptionPlan) ? subscriptionPlan : null

  async function handleChoosePlan(planKey) {
    setError(null)
    setLoadingPlan(planKey)
    try {
      await createCheckoutSession(planKey, interval, user?.id, user?.email)
    } catch (err) {
      setError(err.message || 'Failed to start checkout. Please try again.')
    } finally {
      setLoadingPlan(null)
    }
  }

  async function handleManageSubscription() {
    setError(null)
    setPortalLoading(true)
    try {
      await createPortalSession(user?.id)
    } catch (err) {
      setError(err.message || 'Failed to open billing portal. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  function getStatusBadge() {
    if (isTrialExpired) return <Badge variant="danger">Expired</Badge>
    if (isTrial) return <Badge variant="warning">Trial</Badge>
    if (isActive) return <Badge variant="success">Active</Badge>
    return <Badge variant="muted">{subscriptionStatus || 'Unknown'}</Badge>
  }

  function getPlanDisplayName() {
    if (currentPlanKey) return PLANS[currentPlanKey].name
    if (subscriptionPlan === 'trial') return 'Free Trial'
    return subscriptionPlan || 'None'
  }

  function getButtonLabel(planKey) {
    if (currentPlanKey === planKey && isActive) return 'Current Plan'
    if (currentPlanKey && isActive) {
      const currentIdx = PLAN_KEYS.indexOf(currentPlanKey)
      const targetIdx = PLAN_KEYS.indexOf(planKey)
      return targetIdx > currentIdx ? 'Upgrade' : 'Downgrade'
    }
    return 'Choose Plan'
  }

  function getButtonVariant(planKey) {
    if (currentPlanKey === planKey && isActive) return 'secondary'
    return 'primary'
  }

  function isButtonDisabled(planKey) {
    return currentPlanKey === planKey && isActive
  }

  // Annual savings calculation
  function getAnnualSavings(planKey) {
    const plan = PLANS[planKey]
    if (!plan) return 0
    const monthlyTotal = plan.monthly * 12
    return monthlyTotal - plan.annual
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Page Title */}
      <h1 style={{
        color: c.text, fontSize: isMobile ? 22 : 28, fontWeight: 700,
        margin: '0 0 24px', letterSpacing: '-0.02em',
      }}>
        Subscription
      </h1>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" onClose={() => setError(null)} style={{ marginBottom: 20 }}>
          {error}
        </Alert>
      )}

      {/* Trial Expired Warning */}
      {isTrialExpired && (
        <Alert variant="warning" style={{ marginBottom: 20 }}>
          Your trial has expired. Choose a plan below to continue using Supploxi and keep your data intact.
        </Alert>
      )}

      {/* Current Plan Banner */}
      <Card style={{ marginBottom: 28 }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                color: c.textSecondary, fontSize: 12, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Current Plan
              </span>
              {getStatusBadge()}
            </div>
            <span style={{
              color: c.text, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em',
            }}>
              {getPlanDisplayName()}
            </span>
            {isTrial && trialDays !== null && (
              <span style={{ color: c.warning, fontSize: 13, fontWeight: 500 }}>
                {trialDays} {trialDays === 1 ? 'day' : 'days'} remaining in trial
              </span>
            )}
            {isActive && currentPlanKey && (
              <span style={{ color: c.textSecondary, fontSize: 13 }}>
                {profile?.subscription_interval === 'annual' ? 'Billed annually' : 'Billed monthly'}
              </span>
            )}
          </div>
          {isActive && (
            <Btn
              variant="secondary"
              onClick={handleManageSubscription}
              loading={portalLoading}
              icon={<Icons.ExternalLink size={14} />}
            >
              Manage Subscription
            </Btn>
          )}
        </div>
      </Card>

      {/* Billing Interval Toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 12, marginBottom: 28,
      }}>
        <span
          onClick={() => setInterval('monthly')}
          style={{
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            color: interval === 'monthly' ? c.text : c.textMuted,
            transition: 'color 0.2s',
          }}
        >
          Monthly
        </span>
        <button
          onClick={() => setInterval(interval === 'annual' ? 'monthly' : 'annual')}
          aria-label="Toggle billing"
          style={{
            width: 48, height: 26, borderRadius: 13, padding: 3,
            border: interval === 'annual' ? '1px solid rgba(0,212,170,0.3)' : `1px solid ${c.border}`,
            background: interval === 'annual' ? 'rgba(0,212,170,0.2)' : c.surfaceHover,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            transition: 'background 0.3s, border-color 0.3s',
            fontFamily: 'inherit',
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: c.accent,
            transition: 'transform 0.3s',
            transform: interval === 'annual' ? 'translateX(22px)' : 'translateX(0)',
          }} />
        </button>
        <span
          onClick={() => setInterval('annual')}
          style={{
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            color: interval === 'annual' ? c.text : c.textMuted,
            transition: 'color 0.2s',
          }}
        >
          Annual
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600, color: c.accent,
          background: 'rgba(0,212,170,0.1)', padding: '4px 10px',
          borderRadius: 100, border: '1px solid rgba(0,212,170,0.2)',
        }}>
          Save 33%
        </span>
      </div>

      {/* Pricing Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: isMobile ? 16 : 20,
        marginBottom: 40,
      }}>
        {PLAN_KEYS.map((planKey) => {
          const plan = PLANS[planKey]
          const isCurrent = currentPlanKey === planKey && isActive
          const annualSavings = getAnnualSavings(planKey)

          return (
            <Card
              key={planKey}
              style={{
                display: 'flex', flexDirection: 'column',
                borderColor: isCurrent ? c.accent : c.border,
                borderWidth: isCurrent ? 2 : 1,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Current plan indicator bar */}
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: c.accent,
                }} />
              )}

              {/* Plan header */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{
                    color: c.text, fontSize: 18, fontWeight: 700, margin: 0,
                    letterSpacing: '-0.01em',
                  }}>
                    {plan.name}
                  </h3>
                  {isCurrent && <Badge variant="default">Current</Badge>}
                </div>
                <p style={{
                  color: c.textSecondary, fontSize: 13, margin: 0, lineHeight: 1.4,
                }}>
                  {plan.description}
                </p>
                <div style={{
                  marginTop: 8, padding: '4px 10px', borderRadius: 6,
                  background: c.accentMuted, display: 'inline-block',
                  fontSize: 11, fontWeight: 600, color: c.accent,
                }}>
                  {planKey === 'starter'
                    ? '14-day free trial \u00B7 No credit card'
                    : '14-day free trial \u00B7 Card required, not charged'}
                </div>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{
                    color: c.text, fontSize: 36, fontWeight: 700,
                    letterSpacing: '-0.03em', lineHeight: 1,
                  }}>
                    {formatPlanPrice(planKey, interval)}
                  </span>
                  <span style={{ color: c.textSecondary, fontSize: 14 }}>
                    /{interval === 'annual' ? 'yr' : 'mo'}
                  </span>
                </div>
                {interval === 'annual' && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{ color: c.textSecondary, fontSize: 12 }}>
                      {formatPlanMonthly(planKey, 'annual')} billed annually
                    </span>
                    <span style={{
                      color: c.success, fontSize: 12, fontWeight: 600, marginLeft: 8,
                    }}>
                      Save ${annualSavings}
                    </span>
                  </div>
                )}
                {interval === 'monthly' && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{ color: c.textMuted, fontSize: 12 }}>
                      per month, billed monthly
                    </span>
                  </div>
                )}
              </div>

              {/* Features */}
              <div style={{ flex: 1, marginBottom: 20 }}>
                {plan.features.map((feature, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    marginBottom: 10,
                  }}>
                    <Icons.Check
                      size={16}
                      style={{
                        color: c.accent, flexShrink: 0, marginTop: 1,
                      }}
                    />
                    <span style={{
                      color: c.text, fontSize: 13, lineHeight: 1.4,
                    }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action button */}
              <Btn
                variant={getButtonVariant(planKey)}
                onClick={() => handleChoosePlan(planKey)}
                disabled={isButtonDisabled(planKey)}
                loading={loadingPlan === planKey}
                style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
              >
                {getButtonLabel(planKey)}
              </Btn>
            </Card>
          )
        })}
      </div>

      {/* FAQ Section */}
      <SectionTitle>Frequently Asked Questions</SectionTitle>
      <Card padding="0">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = expandedFaq === idx
          const isLast = idx === FAQ_ITEMS.length - 1
          return (
            <div key={idx}>
              <button
                onClick={() => setExpandedFaq(isOpen ? null : idx)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', padding: '16px 20px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left',
                  borderBottom: isLast && !isOpen ? 'none' : `1px solid ${c.border}`,
                }}
              >
                <span style={{
                  color: c.text, fontSize: 14, fontWeight: 600, lineHeight: 1.4,
                  paddingRight: 16,
                }}>
                  {item.question}
                </span>
                <span style={{ color: c.textSecondary, flexShrink: 0 }}>
                  {isOpen ? <Icons.ChevronUp size={16} /> : <Icons.ChevronDown size={16} />}
                </span>
              </button>
              {isOpen && (
                <div style={{
                  padding: '0 20px 16px', borderBottom: isLast ? 'none' : `1px solid ${c.border}`,
                }}>
                  <p style={{
                    color: c.textSecondary, fontSize: 13, lineHeight: 1.7,
                    margin: 0,
                  }}>
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {/* Bottom spacer */}
      <div style={{ height: 32 }} />
    </div>
  )
}
