/**
 * Layout shell for the routed app.
 */
import { Outlet } from 'react-router-dom'

import Providers from '@/app/providers'

import Header from './header'

const Layout = () => {
  return (
    <Providers>
      <div className="flex h-screen w-screen flex-col px-4 md:px-5">
        <Header />
        <main className="min-h-0 flex-grow w-full overflow-y-auto md:overflow-hidden">
          <Outlet />
        </main>
      </div>
    </Providers>
  )
}

export default Layout
