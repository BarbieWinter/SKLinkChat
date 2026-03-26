import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AdminRouteGuard } from '@/features/admin/ui/admin-route-guard'

const authState: any = {
  authSession: {
    authenticated: false,
    email_verified: false,
    display_name: null,
    interests: [],
    is_admin: false,
    chat_access_restricted: false
  },
  status: 'ready',
  refreshSession: vi.fn().mockResolvedValue(undefined)
}

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => authState
}))

describe('AdminRouteGuard', () => {
  beforeEach(() => {
    authState.authSession = {
      authenticated: false,
      email_verified: false,
      display_name: null,
      interests: [],
      is_admin: false,
      chat_access_restricted: false
    }
    authState.status = 'ready'
    authState.refreshSession.mockReset()
    authState.refreshSession.mockResolvedValue(undefined)
  })

  it('redirects unauthenticated users back to home', () => {
    render(
      <MemoryRouter initialEntries={['/admin/reports']} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path="/" element={<div data-testid="home-page">home</div>} />
          <Route path="/admin" element={<AdminRouteGuard />}>
            <Route path="reports" element={<div data-testid="admin-page">admin</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })

  it('shows a forbidden state for non-admin accounts', async () => {
    authState.authSession = {
      authenticated: true,
      email_verified: true,
      display_name: 'Alice',
      interests: [],
      is_admin: false,
      chat_access_restricted: false
    }

    render(
      <MemoryRouter initialEntries={['/admin/reports']} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path="/admin" element={<AdminRouteGuard />}>
            <Route path="reports" element={<div data-testid="admin-page">admin</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('admin-forbidden')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument()
  })

  it('renders the protected outlet for admin accounts', async () => {
    authState.authSession = {
      authenticated: true,
      email_verified: true,
      display_name: 'Admin',
      interests: [],
      is_admin: true,
      chat_access_restricted: false
    }

    render(
      <MemoryRouter initialEntries={['/admin/reports']} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path="/admin" element={<AdminRouteGuard />}>
            <Route path="reports" element={<div data-testid="admin-page">admin</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument()
    })
  })

  it('revalidates admin session when entering the admin route', async () => {
    authState.authSession = {
      authenticated: true,
      email_verified: true,
      display_name: 'Admin',
      interests: [],
      is_admin: true,
      chat_access_restricted: false
    }

    render(
      <MemoryRouter initialEntries={['/admin/reports']} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path="/admin" element={<AdminRouteGuard />}>
            <Route path="reports" element={<div data-testid="admin-page">admin</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(authState.refreshSession).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('admin-page')).toBeInTheDocument()
    })
  })
})
