import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const ALL_PERMS = [
  'dashboard', 'orders', 'purchase_orders', 'suppliers', 'products',
  'inventory', 'shipments', 'financials', 'settings', 'subscription',
]

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState(null)
  const [permissions, setPermissions] = useState(ALL_PERMS)
  const [subscriptionPlan, setSubscriptionPlan] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(u) {
    const email = u?.email
    if (!email) {
      setProfile(null)
      setRole(null)
      setPermissions(ALL_PERMS)
      setSubscriptionPlan(null)
      setSubscriptionStatus(null)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', u.id)
      .single()

    if (!data) {
      // First user — auto-seed as admin with trial
      const newProfile = {
        user_id: u.id,
        email,
        full_name: email.split('@')[0],
        role: 'admin',
        permissions: ALL_PERMS,
        subscription_plan: 'trial',
        subscription_status: 'trial',
        subscription_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }
      await supabase.from('profiles').insert(newProfile)
      setProfile(newProfile)
      setRole('admin')
      setPermissions(ALL_PERMS)
      setSubscriptionPlan('trial')
      setSubscriptionStatus('trial')
      return
    }

    setProfile(data)
    setRole(data.role || 'admin')
    setSubscriptionPlan(data.subscription_plan || 'trial')
    setSubscriptionStatus(data.subscription_status || 'trial')

    if (data.role === 'admin') {
      setPermissions(ALL_PERMS)
    } else {
      setPermissions(Array.isArray(data.permissions) ? data.permissions : ALL_PERMS)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u?.email) loadProfile(u)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u?.email) loadProfile(u)
      else {
        setProfile(null)
        setRole(null)
        setPermissions(ALL_PERMS)
        setSubscriptionPlan(null)
        setSubscriptionStatus(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const isViewer = role === 'viewer'

  const hasAccess = useCallback((module) => {
    if (role === 'admin') return true
    return permissions.includes(module)
  }, [role, permissions])

  const isSubscriptionActive = useCallback(() => {
    return subscriptionStatus === 'active' || subscriptionStatus === 'trial'
  }, [subscriptionStatus])

  const trialDaysRemaining = useCallback(() => {
    if (subscriptionStatus !== 'trial' || !profile?.subscription_end_date) return null
    const end = new Date(profile.subscription_end_date)
    const now = new Date()
    const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
    return Math.max(0, days)
  }, [subscriptionStatus, profile])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user, profile, role, permissions, loading,
      subscriptionPlan, subscriptionStatus,
      signIn, signUp, signOut,
      hasAccess, isViewer, isSubscriptionActive, trialDaysRemaining,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
