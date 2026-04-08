import { Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { StackHandler } from '@stackframe/react'

import Providers from '@/app/providers'
import { AdminLayout } from '@/features/admin/ui/admin-layout'
import { AdminRouteGuard } from '@/features/admin/ui/admin-route-guard'

const Layout = lazy(() => import('@/app/layout'))
const HomePage = lazy(() => import('@/pages/home-page'))
const NotFoundPage = lazy(() => import('@/pages/not-found-page'))
const RetroLandingPage = lazy(() => import('@/pages/retro-landing-page'))
const StackAuthPage = lazy(() => import('@/pages/stack-auth-page'))
const AdminReportsPage = lazy(() =>
  import('@/features/admin/ui/admin-reports-page').then((module) => ({ default: module.AdminReportsPage }))
)
const AdminAuditPage = lazy(() =>
  import('@/features/admin/ui/admin-audit-page').then((module) => ({ default: module.AdminAuditPage }))
)

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center px-6">
    <p className="text-sm text-muted-foreground">页面加载中...</p>
  </div>
)

const withSuspense = (node: ReactNode) => <Suspense fallback={<RouteFallback />}>{node}</Suspense>

// /landing needs its own Providers wrapper (auth context) since it lives
// outside the main Layout which already wraps Providers internally.
const LandingWithProviders = () => (
  <Providers>
    {withSuspense(<RetroLandingPage />)}
  </Providers>
)

const StackAuthWithProviders = () => (
  <Providers>
    {withSuspense(<StackAuthPage />)}
  </Providers>
)

const StackHandlerWithProviders = () => (
  <Providers>
    <StackHandler fullPage />
  </Providers>
)

const App = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true }}>
      <Routes>
        <Route path="/landing" element={<LandingWithProviders />} />
        <Route path="/auth/stack" element={<StackAuthWithProviders />} />
        <Route path="/handler/*" element={<StackHandlerWithProviders />} />
        <Route path="/" element={withSuspense(<Layout />)}>
          <Route index element={withSuspense(<RetroLandingPage />)} />
          <Route path="chat" element={withSuspense(<HomePage />)} />
          <Route path="admin" element={<AdminRouteGuard />}>
            <Route element={<AdminLayout />}>
              <Route path="reports" element={withSuspense(<AdminReportsPage />)} />
              <Route path="audit" element={withSuspense(<AdminAuditPage />)} />
            </Route>
          </Route>
          <Route path="*" element={withSuspense(<NotFoundPage />)} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
