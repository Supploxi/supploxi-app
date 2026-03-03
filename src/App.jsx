// Supploxi — App Router

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'

// Pages (lazy imports for code splitting)
import { lazy, Suspense } from 'react'
import { Loading } from './components/UI'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'))
const PurchaseOrderDetail = lazy(() => import('./pages/PurchaseOrderDetail'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const Products = lazy(() => import('./pages/Products'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Shipments = lazy(() => import('./pages/Shipments'))
const Financials = lazy(() => import('./pages/Financials'))
const Subscription = lazy(() => import('./pages/Subscription'))
const Settings = lazy(() => import('./pages/Settings'))
const Invite = lazy(() => import('./pages/Invite'))

function RequireAuth({ children, perm }) {
  const { user, loading, hasAccess, isSubscriptionActive } = useAuth()
  const location = useLocation()

  if (loading) return <Loading text="Authenticating..." />

  // Not logged in → redirect to login
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  // Subscription expired → allow only subscription and settings pages
  if (!isSubscriptionActive()) {
    const allowedPaths = ['/subscription', '/settings']
    const isAllowed = allowedPaths.some(p => location.pathname.startsWith(p))
    if (!isAllowed) return <Navigate to="/subscription" replace />
  }

  // Permission check
  if (perm && !hasAccess(perm)) {
    return <Navigate to="/" replace />
  }

  return children
}

function PageWrapper({ children }) {
  return (
    <Suspense fallback={<Loading />}>
      <div className="sp-page">
        {children}
      </div>
    </Suspense>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <Loading text="Loading Supploxi..." />

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : (
          <Suspense fallback={<Loading />}>
            <Login />
          </Suspense>
        )
      } />
      <Route path="/invite/:token" element={
        <Suspense fallback={<Loading />}>
          <Invite />
        </Suspense>
      } />

      {/* Protected routes with Layout */}
      <Route path="/" element={
        <RequireAuth perm="dashboard">
          <Layout>
            <PageWrapper><Dashboard /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/orders" element={
        <RequireAuth perm="orders">
          <Layout>
            <PageWrapper><Orders /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/orders/:id" element={
        <RequireAuth perm="orders">
          <Layout>
            <PageWrapper><OrderDetail /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/purchase-orders" element={
        <RequireAuth perm="purchase_orders">
          <Layout>
            <PageWrapper><PurchaseOrders /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/purchase-orders/:id" element={
        <RequireAuth perm="purchase_orders">
          <Layout>
            <PageWrapper><PurchaseOrderDetail /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/suppliers" element={
        <RequireAuth perm="suppliers">
          <Layout>
            <PageWrapper><Suppliers /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/products" element={
        <RequireAuth perm="products">
          <Layout>
            <PageWrapper><Products /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/inventory" element={
        <RequireAuth perm="inventory">
          <Layout>
            <PageWrapper><Inventory /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/shipments" element={
        <RequireAuth perm="shipments">
          <Layout>
            <PageWrapper><Shipments /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/financials" element={
        <RequireAuth perm="financials">
          <Layout>
            <PageWrapper><Financials /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/subscription" element={
        <RequireAuth perm="subscription">
          <Layout>
            <PageWrapper><Subscription /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />
      <Route path="/settings" element={
        <RequireAuth perm="settings">
          <Layout>
            <PageWrapper><Settings /></PageWrapper>
          </Layout>
        </RequireAuth>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
