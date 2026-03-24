/**
 * 页面骨架布局：统一包裹 Provider、头部、主体内容和底部。
 */
import Providers from '@/providers'
import { Outlet } from 'react-router-dom'
import Header from '../molecules/header'

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
