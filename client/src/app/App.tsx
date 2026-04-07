import { BrowserRouter, Route, Routes } from 'react-router-dom'

import Layout from '@/app/layout'
import Providers from '@/app/providers'
import { AdminLayout } from '@/features/admin/ui/admin-layout'
import { AdminRouteGuard } from '@/features/admin/ui/admin-route-guard'
import AdminAuditPage from '@/pages/admin-audit-page'
import AdminReportsPage from '@/pages/admin-reports-page'
import HomePage from '@/pages/home-page'
import NotFoundPage from '@/pages/not-found-page'
import RetroLandingPage from '@/pages/retro-landing-page'

// /landing needs its own Providers wrapper (auth context) since it lives
// outside the main Layout which already wraps Providers internally.
const LandingWithProviders = () => (
  <Providers>
    <RetroLandingPage />
  </Providers>
)

const App = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true }}>
      <Routes>
        <Route path="/landing" element={<LandingWithProviders />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="admin" element={<AdminRouteGuard />}>
            <Route element={<AdminLayout />}>
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="audit" element={<AdminAuditPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
