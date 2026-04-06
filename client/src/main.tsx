/**
 * 前端应用入口：负责挂载 React 根节点，并加载全局样式。
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/jetbrains-mono'
import App from '@/app/App'
import './assets/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
