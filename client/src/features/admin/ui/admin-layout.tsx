import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-provider'

const getNavClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-foreground text-background'
      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
  }`

export const AdminLayout = () => {
  const { authSession } = useAuth()

  return (
    <div data-testid="admin-layout" className="h-full overflow-auto bg-background px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-border/60 bg-card/90 p-6 shadow-xl shadow-black/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Admin Console</p>
              <div>
                <h1 className="text-3xl font-semibold text-foreground">治理台</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  当前登录账号：{authSession.display_name ?? '管理员'}
                </p>
              </div>
            </div>
            <nav className="flex flex-wrap gap-2">
              <NavLink to="/admin/reports" data-testid="admin-nav-reports" className={getNavClassName}>
                举报审核
              </NavLink>
              <NavLink to="/admin/audit" data-testid="admin-nav-audit" className={getNavClassName}>
                审计日志
              </NavLink>
            </nav>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  )
}
