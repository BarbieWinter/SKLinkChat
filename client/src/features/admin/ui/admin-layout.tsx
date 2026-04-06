import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-provider'

const getNavClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-all border ${
    isActive
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border bg-secondary text-muted-foreground hover:border-primary hover:text-primary'
  }`

export const AdminLayout = () => {
  const { authSession } = useAuth()

  return (
    <div data-testid="admin-layout" className="h-full overflow-auto bg-background px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Admin Console</p>
              <div>
                <h1 className="text-xl font-bold text-foreground">治理台</h1>
                <p className="mt-2 text-xs text-muted-foreground">
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
