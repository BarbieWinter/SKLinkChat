import { BrowserRouter, Route, Routes } from 'react-router-dom'

import Layout from '@/app/layout'
import HomePage from '@/pages/home-page'
import NotFoundPage from '@/pages/not-found-page'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
