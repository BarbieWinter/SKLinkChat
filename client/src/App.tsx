/**
 * 前端路由总入口：统一声明首页、欢迎页和兜底页面。
 */
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './components/pages/home'
import NotFound from './components/pages/not-found'
import Welcome from './components/pages/welcome'
import Layout from './components/template/layout'

const App = () => {
  return (
    <BrowserRouter>
      {/* 所有页面都包在统一布局中，保证头部、底部和全局 Provider 一致。 */}
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="welcome" element={<Welcome />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
