/**
 * Landing page — vibeisland.app-quality recreation.
 *
 * Effects:
 *  1. Top cyan god-ray spotlight (dual radial-gradient, breathing pulse)
 *  2. Scatter character canvas — ASCII grid, radial fade from top-right,
 *     mouse-proximity cyan glow. pointer-events: none; mouse tracked via window.
 *  3. Dot-wave canvas — sine/cosine dot field, mouse expand.
 *  4. Per-character staggered scramble (matches vibeisland timing exactly):
 *     each char independently cycles 4 random symbols → settles, 30ms stagger
 *     between adjacent characters.
 *  5. Navbar: transparent → frosted-glass on scroll.
 *  6. Bottom 3D perspective grid marching forward.
 *  7. Pixel character SVGs (male left / female right) with float animation.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-provider'

// ─── Scramble constants ───────────────────────────────────────────────────────

const SC = ['0', '1', '+', '-', '*', ':', '.', '/', '#', '?', '!', '~']

const WORDS: { text: string; color: string }[] = [
  { text: 'ANON CHAT',  color: '#f472b6' },
  { text: 'PIXEL NET',  color: '#22c55e' },
  { text: 'LIVE WIRE',  color: '#3b82f6' },
  { text: 'SAFE ZONE',  color: '#a855f7' },
  { text: 'OPEN WORLD', color: '#f59e0b' },
]

// ─── useScatterCanvas ─────────────────────────────────────────────────────────
// Tracks mouse via window, canvas is pointer-events: none throughout.

function useScatterCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  mouseRef: React.MutableRefObject<{ x: number; y: number }>,
) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const SPACING = 18
    const CYAN: [number, number, number] = [34, 211, 238]
    let W = 0, H = 0, cols = 0, rows = 0
    let cells: string[] = []
    let rafId = 0
    let intervalId: ReturnType<typeof setInterval>
    let fontReady = false

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(W / SPACING)
      rows = Math.ceil(H / SPACING)
      cells = Array.from({ length: cols * rows }, () => SC[Math.floor(Math.random() * SC.length)]!)
    }

    const refreshCells = () => {
      const n = Math.floor(cells.length * 0.04)
      for (let i = 0; i < n; i++) {
        cells[Math.floor(Math.random() * cells.length)] = SC[Math.floor(Math.random() * SC.length)]!
      }
    }

    const draw = () => {
      rafId = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)

      if (!fontReady) return
      ctx.font = `${SPACING * 0.62}px 'Departure Mono', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const maxDist = Math.hypot(W, H) * 0.58

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * SPACING + SPACING * 0.5
          const y = r * SPACING + SPACING * 0.5

          // Radial fade from top-right
          const fade = Math.max(0, 1 - Math.hypot(x - W, y) / maxDist)

          // Mouse glow
          const mDist = Math.hypot(x - mx, y - my)
          const glow  = Math.max(0, 1 - mDist / 100)

          const alpha = fade * 0.22 + glow * 0.6
          if (alpha < 0.012) continue

          const [cr, cg, cb] = CYAN
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`
          ctx.fillText(cells[r * cols + c]!, x, y)
        }
      }
    }

    // Wait for DepartureMono to be ready before rendering
    document.fonts.load(`${SPACING * 0.62}px 'Departure Mono'`).then(() => { fontReady = true })

    let active = true
    const observer = new IntersectionObserver(([e]) => {
      active = e!.isIntersecting
      if (active) rafId = requestAnimationFrame(draw)
      else cancelAnimationFrame(rafId)
    })
    observer.observe(canvas)

    resize()
    rafId = requestAnimationFrame(draw)
    intervalId = setInterval(refreshCells, 150)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(intervalId)
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef, mouseRef])
}

// ─── useDotWaveCanvas ─────────────────────────────────────────────────────────

function useDotWaveCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  mouseRef: React.MutableRefObject<{ x: number; y: number }>,
) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const SP = 24
    let W = 0, H = 0, t = 0, frame = 0, rafId = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = () => {
      rafId = requestAnimationFrame(draw)
      if (++frame % 2) return  // 2-frame throttle

      t += 0.014
      ctx.clearRect(0, 0, W, H)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (let r = 0; r * SP < H + SP; r++) {
        for (let c = 0; c * SP < W + SP; c++) {
          const x = c * SP + SP * 0.5
          const y = r * SP + SP * 0.5
          const wave = Math.sin(x * 0.007 + t * 0.55) * Math.cos(y * 0.005 + t * 0.38)
          let radius = 0.4 + 0.9 * Math.abs(wave)
          let alpha  = 0.03 + 0.14 * Math.abs(wave)

          const mDist = Math.hypot(x - mx, y - my)
          if (mDist < 90) {
            const prx = 1 - mDist / 90
            radius += prx * 2.0
            alpha = Math.min(0.65, alpha + prx * 0.45)
          }

          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(34,211,238,${alpha.toFixed(3)})`
          ctx.fill()
        }
      }
    }

    let active = true
    const observer = new IntersectionObserver(([e]) => {
      active = e!.isIntersecting
      if (active) rafId = requestAnimationFrame(draw)
      else cancelAnimationFrame(rafId)
    })
    observer.observe(canvas)

    resize()
    rafId = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef, mouseRef])
}

// ─── useTextScramble ──────────────────────────────────────────────────────────
// Per-character independent scramble matching vibeisland's timing:
//   - Each char starts after i * STAGGER_MS delay
//   - Each char scrambles SCRAMBLES times × TICK_MS before settling
//   - Settled chars get accent color; scrambling chars are dim

type ScrambleChar = { ch: string; settled: boolean }

const SCRAMBLES  = 5    // random frames per character before settling
const TICK_MS    = 38   // ms per scramble tick
const STAGGER_MS = 32   // ms delay between adjacent characters

function useTextScramble() {
  const [chars, setChars] = useState<ScrambleChar[]>(() =>
    WORDS[0]!.text.split('').map(ch => ({ ch, settled: true }))
  )
  const [color, setColor] = useState(WORDS[0]!.color)
  const wordIdxRef = useRef(0)
  const timersRef  = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const advance = () => {
      // cancel in-flight timers from previous transition
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []

      const next   = (wordIdxRef.current + 1) % WORDS.length
      wordIdxRef.current = next
      const target = WORDS[next]!
      setColor(target.color)

      if (reduced) {
        setChars(target.text.split('').map(ch => ({ ch, settled: true })))
        return
      }

      const targetChars = target.text.split('')
      const N = targetChars.length

      // Initialise all positions as scrambling
      setChars(Array.from({ length: N }, () => ({
        ch: SC[Math.floor(Math.random() * SC.length)]!,
        settled: false,
      })))

      // Each char independently schedules its own scramble sequence
      targetChars.forEach((targetCh, i) => {
        for (let s = 0; s <= SCRAMBLES; s++) {
          const t = setTimeout(() => {
            setChars(prev => {
              const next = [...prev]
              if (s === SCRAMBLES) {
                next[i] = { ch: targetCh, settled: true }
              } else {
                next[i] = {
                  ch: SC[Math.floor(Math.random() * SC.length)]!,
                  settled: false,
                }
              }
              return next
            })
          }, i * STAGGER_MS + s * TICK_MS)
          timersRef.current.push(t)
        }
      })
    }

    const first    = setTimeout(advance, 2500)
    const interval = setInterval(advance, 4800)
    return () => {
      clearTimeout(first)
      clearInterval(interval)
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  return { chars, color }
}

// ─── PixelMale ────────────────────────────────────────────────────────────────

function PixelMale({ size = 180 }: { size?: number }) {
  // 12 × 20 grid — more detail, cyan-shirt, dark pants
  const SK = '#ffd4b0'  // skin
  const HR = '#1a0f0a'  // hair (very dark)
  const EY = '#0d0d0d'  // eye
  const SH = '#1d4ed8'  // shirt (deep blue)
  const SA = '#2563eb'  // shirt arm / side
  const PN = '#0f172a'  // pants
  const PL = '#1e293b'  // pants lighter stripe
  const BT = '#0a0a0a'  // boot
  const N  = null
  // prettier-ignore
  const rows: (string | null)[][] = [
    [N,N,N,HR,HR,HR,HR,HR,N,N,N,N],   // 0
    [N,N,HR,SK,SK,SK,SK,SK,HR,N,N,N], // 1
    [N,HR,SK,SK,EY,SK,EY,SK,SK,HR,N,N], // 2  eyes
    [N,HR,SK,SK,SK,SK,SK,SK,SK,HR,N,N], // 3
    [N,HR,SK,SK,SK,SK,SK,SK,SK,HR,N,N], // 4  mouth row
    [N,N,SK,SK,SK,SK,SK,SK,SK,N,N,N],  // 5  neck
    [N,N,N,SK,SK,SK,SK,SK,N,N,N,N],   // 6  neck narrow
    [SH,SH,SH,SH,SH,SH,SH,SH,SH,SH,N,N], // 7  shoulders
    [SA,SH,SH,SH,SH,SH,SH,SH,SH,SA,N,N], // 8
    [SA,SH,SH,SH,SH,SH,SH,SH,SH,SA,N,N], // 9
    [SA,SH,SH,SH,SH,SH,SH,SH,SH,SA,N,N], // 10
    [N,SA,SH,SH,SH,SH,SH,SH,SA,N,N,N],  // 11
    [N,N,PN,PN,PN,PN,PN,PN,N,N,N,N],  // 12 belt
    [N,N,PN,PL,PN,N,PN,PL,PN,N,N,N],  // 13 legs top
    [N,N,PN,PL,PN,N,PN,PL,PN,N,N,N],  // 14
    [N,N,PN,PL,PN,N,PN,PL,PN,N,N,N],  // 15
    [N,N,PN,PL,PN,N,PN,PL,PN,N,N,N],  // 16
    [N,N,PN,PN,PN,N,PN,PN,PN,N,N,N],  // 17 ankle
    [N,BT,BT,BT,N,N,N,BT,BT,BT,N,N], // 18 boots
    [BT,BT,BT,BT,N,N,N,BT,BT,BT,BT,N], // 19 boot tips
  ]
  const COLS = 12, ROWS = rows.length
  return (
    <svg
      width={size}
      height={Math.round(size * ROWS / COLS)}
      viewBox={`0 0 ${COLS} ${ROWS}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rows.map((row, r) =>
        row.map((fill, c) =>
          fill ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={fill} /> : null
        )
      )}
    </svg>
  )
}

// ─── PixelFemale ──────────────────────────────────────────────────────────────

function PixelFemale({ size = 180 }: { size?: number }) {
  const SK = '#ffd4b0'
  const HR = '#2d0e00'  // dark auburn hair
  const HL = '#5a1a00'  // hair highlight
  const EY = '#0d0d0d'
  const BL = '#ffb3cc'  // blush
  const DR = '#db2777'  // dress body
  const DL = '#ec4899'  // dress lighter
  const DH = '#be185d'  // dress hem/shadow
  const BT = '#0a0a0a'
  const N  = null
  // prettier-ignore
  const rows: (string | null)[][] = [
    [N,N,HR,HR,HR,HR,HR,HR,HR,N,N,N],   // 0 hair top
    [N,HR,HL,HR,HR,HR,HR,HR,HL,HR,N,N], // 1 hair crown
    [HR,HR,SK,SK,EY,SK,EY,SK,SK,HR,HR,N], // 2 face + eyes
    [HR,SK,SK,BL,SK,SK,SK,BL,SK,SK,HR,N], // 3 blush
    [HR,SK,SK,SK,SK,SK,SK,SK,SK,SK,HR,N], // 4
    [N,HR,SK,SK,SK,SK,SK,SK,SK,HR,N,N],  // 5 neck
    [N,N,N,SK,SK,SK,SK,SK,N,N,N,N],    // 6 neck narrow
    [N,N,DR,DR,DR,DR,DR,DR,N,N,N,N],   // 7 bodice
    [DL,DL,DR,DR,DR,DR,DR,DR,DL,DL,N,N], // 8 shoulder/arms
    [DL,DL,DR,DR,DR,DR,DR,DR,DL,DL,N,N], // 9
    [N,DL,DR,DR,DR,DR,DR,DR,DL,N,N,N],  // 10
    [N,DL,DR,DR,DR,DR,DR,DR,DL,N,N,N],  // 11 waist flare start
    [N,DR,DR,DR,DR,DR,DR,DR,DR,N,N,N],  // 12
    [DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,N,N], // 13 skirt wide
    [DH,DH,DH,DH,DH,DH,DH,DH,DH,DH,N,N], // 14 hem
    [N,N,N,SK,SK,N,SK,SK,N,N,N,N],    // 15 legs
    [N,N,N,SK,SK,N,SK,SK,N,N,N,N],    // 16
    [N,N,N,SK,SK,N,SK,SK,N,N,N,N],    // 17
    [N,N,BT,BT,BT,N,BT,BT,BT,N,N,N],  // 18 shoes
    [N,BT,BT,BT,N,N,N,BT,BT,BT,N,N],  // 19
  ]
  const COLS = 12, ROWS = rows.length
  return (
    <svg
      width={size}
      height={Math.round(size * ROWS / COLS)}
      viewBox={`0 0 ${COLS} ${ROWS}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rows.map((row, r) =>
        row.map((fill, c) =>
          fill ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={fill} /> : null
        )
      )}
    </svg>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RetroLandingPage() {
  const navigate = useNavigate()
  const { authSession } = useAuth()

  const dotRef     = useRef<HTMLCanvasElement>(null)
  const scatterRef = useRef<HTMLCanvasElement>(null)
  const mouseRef   = useRef({ x: -999, y: -999 })
  const [scrolled, setScrolled] = useState(false)

  // Shared mouse tracker at window level → both canvases use pointer-events: none
  useEffect(() => {
    const onMove  = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY } }
    const onLeave = ()              => { mouseRef.current = { x: -999, y: -999 } }
    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  useScatterCanvas(scatterRef, mouseRef)
  useDotWaveCanvas(dotRef, mouseRef)
  const { chars: scrambleChars, color: scrambleColor } = useTextScramble()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div className="lp-root">

      {/* ── Canvas: dot wave (bottom layer) ── */}
      <canvas ref={dotRef}     className="lp-canvas" style={{ zIndex: 0 }} />
      {/* ── Canvas: scatter chars (above dots) ── */}
      <canvas ref={scatterRef} className="lp-canvas" style={{ zIndex: 1 }} />
      {/* ── Spotlight ── */}
      <div className="lp-spotlight" />

      {/* ── Navbar ── */}
      <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="lp-logo" onClick={() => navigate('/')}>
          <div className="lp-logo-mark">
            <svg width="12" height="12" viewBox="0 0 4 4" shapeRendering="crispEdges">
              <rect x="1" y="0" width="2" height="1" fill="#22d3ee" />
              <rect x="0" y="1" width="4" height="1" fill="#22d3ee" />
              <rect x="0" y="2" width="4" height="1" fill="#67e8f9" />
              <rect x="1" y="3" width="2" height="1" fill="#22d3ee" />
            </svg>
          </div>
          <span className="lp-logo-text">SKLink</span>
        </div>

        <div className="lp-nav-links">
          {(['Features', 'About', 'Connect'] as const).map(label => (
            <a key={label} className="lp-nav-link" href={`#${label.toLowerCase()}`}>
              {label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
          {authSession.authenticated ? (
            <button className="lp-btn lp-btn-fill" onClick={() => navigate('/')}>
              Enter App
            </button>
          ) : (
            <>
              <button className="lp-btn lp-btn-ghost" onClick={() => navigate('/')}>
                Log In
              </button>
              <button className="lp-btn lp-btn-fill" onClick={() => navigate('/')}>
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        {/* Side characters */}
        <div className="lp-char-left"><PixelMale   size={160} /></div>
        <div className="lp-char-right"><PixelFemale size={160} /></div>

        {/* Eyebrow */}
        <p className="lp-eyebrow">Anonymous · Encrypted · Real-time</p>

        {/* Title */}
        <h1 className="lp-title">SKLINK</h1>

        {/* Scramble subtitle */}
        <div className="lp-scramble-row" style={{ color: scrambleColor }}>
          <span className="lp-scramble-text" aria-live="polite">
            {scrambleChars.map((c, i) => (
              <span
                key={i}
                className={`lp-scramble-char${c.settled ? ' settled' : ' scrambling'}`}
                style={c.settled ? { color: scrambleColor } : undefined}
              >
                {c.ch}
              </span>
            ))}
          </span>
          <span className="lp-cursor" style={{ color: scrambleColor }} />
        </div>

        {/* Tagline */}
        <p className="lp-tagline">
          <span>Encrypted</span>
          <span className="lp-tagline-sep" />
          <span>Anonymous</span>
          <span className="lp-tagline-sep" />
          <span>Real-time</span>
        </p>

        {/* CTA */}
        <button
          className="lp-btn-cta"
          style={{ marginTop: '3.2rem' }}
          onClick={() => navigate('/')}
        >
          Start Chatting
        </button>
      </section>

      {/* ── Bottom 3D grid ── */}
      <div className="lp-grid-wrap">
        <div className="lp-grid-plane" />
      </div>
    </div>
  )
}
