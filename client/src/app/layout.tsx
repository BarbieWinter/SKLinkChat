/**
 * Layout shell for the routed app.
 *
 * iOS Safari keyboard handling:
 * When the keyboard opens, the browser's layout viewport stays tall but the
 * visual viewport shrinks. This creates a scrollable gap behind the keyboard.
 * We fix this by:
 *   1. Locking html/body scroll (overflow:hidden + fixed height)
 *   2. Setting the root container height to visualViewport.height
 *   3. Blocking stray touchmove events on the body
 */
import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'

import Providers from '@/app/providers'

const Layout = () => {
  const [kbHeight, setKbHeight] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const sync = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const full = window.innerHeight
        const cur = Math.round(viewport.height)
        const diff = full - cur
        setKbHeight(diff > 150 ? diff : 0)
      })
    }

    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const keyboardOpen = kbHeight > 0

  // Lock html + body when keyboard is open
  useEffect(() => {
    if (!keyboardOpen) return

    const html = document.documentElement
    const body = document.body

    // Force the page scroll to top so the fixed-height container aligns
    window.scrollTo(0, 0)

    html.style.overflow = 'hidden'
    html.style.height = '100%'
    body.style.overflow = 'hidden'
    body.style.height = '100%'
    body.style.position = 'fixed'
    body.style.width = '100%'
    body.style.top = '0'
    body.style.left = '0'

    // Block stray touchmove on body (allow inner scroll containers)
    const prevent = (e: TouchEvent) => {
      let el = e.target as HTMLElement | null
      while (el && el !== body) {
        const { overflowY } = getComputedStyle(el)
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          return
        }
        el = el.parentElement
      }
      e.preventDefault()
    }
    document.addEventListener('touchmove', prevent, { passive: false })

    return () => {
      html.style.overflow = ''
      html.style.height = ''
      body.style.overflow = ''
      body.style.height = ''
      body.style.position = ''
      body.style.width = ''
      body.style.top = ''
      body.style.left = ''
      document.removeEventListener('touchmove', prevent)
    }
  }, [keyboardOpen])

  return (
    <Providers>
      <div
        className="noise-overlay scanline-overlay safe-area-top safe-area-x flex w-screen flex-col overflow-hidden"
        style={{ height: keyboardOpen ? `${window.innerHeight - kbHeight}px` : '100dvh' }}
      >
        <main className="min-h-0 flex-1 w-full overflow-hidden">
          <Outlet />
        </main>
      </div>
    </Providers>
  )
}

export default Layout
