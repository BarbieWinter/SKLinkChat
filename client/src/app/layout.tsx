/**
 * Layout shell for the routed app.
 */
import { Outlet } from 'react-router-dom'

import Providers from '@/app/providers'

const Layout = () => {
  return (
    <Providers>
      <div className="safe-area-top safe-area-x flex h-screen w-screen flex-col overflow-hidden">
        <main className="min-h-0 flex-1 w-full overflow-hidden">
          <Outlet />
        </main>
      </div>
    </Providers>
  )
}

export default Layout
