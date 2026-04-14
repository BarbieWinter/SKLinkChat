import { useEffect, useRef } from 'react'

/**
 * ParticleExplosion — 相位受外部控制的像素波扩散。
 *
 * phase='appear'  : 像素从 origin 向全屏扩散，速度与 appearDuration(ms) 匹配。
 * phase='disappear': 所有像素执行 disappear()，全部消失后调 onDisappearComplete。
 *
 * 像素逻辑与 PixelCard 的 Pixel 类完全一致（appear / shimmer / disappear）。
 */

const GAP = 6
const MAX_SIZE_INT = 2
const COLORS = ['#ffffff', '#f0f0f0', '#e8e8e8', '#d4d4d4']

/* ── 像素类（与 PixelCard Pixel 逻辑一致）── */

class ScreenPixel {
  x: number
  y: number
  color: string
  speed: number
  size: number
  sizeStep: number
  minSize: number
  maxSize: number
  delay: number
  counter: number
  counterStep: number
  isIdle: boolean
  isReverse: boolean
  isShimmer: boolean

  constructor(x: number, y: number, distance: number, counterStep: number) {
    this.x = x
    this.y = y
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)]
    this.speed = (Math.random() * 0.8 + 0.1) * 0.035
    this.size = 0
    this.sizeStep = Math.random() * 0.4
    this.minSize = 0.5
    this.maxSize = Math.random() * (MAX_SIZE_INT - 0.5) + 0.5
    this.delay = distance
    this.counter = 0
    this.counterStep = counterStep + Math.random() * 2
    this.isIdle = false
    this.isReverse = false
    this.isShimmer = false
  }

  draw(ctx: CanvasRenderingContext2D) {
    const off = MAX_SIZE_INT * 0.5 - this.size * 0.5
    ctx.fillStyle = this.color
    ctx.fillRect(this.x + off, this.y + off, this.size, this.size)
  }

  appear(ctx: CanvasRenderingContext2D) {
    this.isIdle = false
    if (this.counter <= this.delay) {
      this.counter += this.counterStep
      return
    }
    if (this.size >= this.maxSize) this.isShimmer = true
    if (this.isShimmer) this.shimmer()
    else this.size += this.sizeStep
    this.draw(ctx)
  }

  disappear(ctx: CanvasRenderingContext2D) {
    this.isShimmer = false
    this.counter = 0
    if (this.size <= 0) {
      this.isIdle = true
      return
    }
    this.size -= 0.1
    this.draw(ctx)
  }

  shimmer() {
    if (this.size >= this.maxSize) this.isReverse = true
    else if (this.size <= this.minSize) this.isReverse = false
    this.isReverse ? (this.size -= this.speed) : (this.size += this.speed)
  }
}

/* ── Props ── */

interface ParticleExplosionProps {
  origin: { x: number; y: number }
  /** 'appear' = 扩散中；切换到 'disappear' = 开始收缩 */
  phase: 'appear' | 'disappear'
  /** appear 阶段应持续的毫秒数，用于自动缩放波速 */
  appearDuration: number
  onDisappearComplete: () => void
}

/* ── Component ── */

export function ParticleExplosion({ origin, phase, appearDuration, onDisappearComplete }: ParticleExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phaseRef = useRef(phase)
  const onCompleteRef = useRef(onDisappearComplete)
  const pixelsRef = useRef<ScreenPixel[]>([])
  const rafRef = useRef<number>(0)

  // 同步最新的 phase 和 callback 到 ref，让动画循环读取
  phaseRef.current = phase
  onCompleteRef.current = onDisappearComplete

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    /* 计算波速：让波前在 appearDuration*0.8 ms 内到达最远像素 */
    const maxDist = Math.hypot(Math.max(origin.x, W - origin.x), Math.max(origin.y, H - origin.y))
    const appearFrames = (appearDuration / 1000) * 60 * 0.8 // 帧数
    const baseCounterStep = maxDist / appearFrames // 每帧推进距离

    /* 生成全屏像素网格 */
    const pixels: ScreenPixel[] = []
    for (let x = 0; x < W; x += GAP) {
      for (let y = 0; y < H; y += GAP) {
        const dist = Math.sqrt((x - origin.x) ** 2 + (y - origin.y) ** 2)
        pixels.push(new ScreenPixel(x, y, dist, baseCounterStep))
      }
    }
    pixelsRef.current = pixels

    const prevTime = { v: performance.now() }

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop)
      const dt = now - prevTime.v
      if (dt < 1000 / 60) return
      prevTime.v = now - (dt % (1000 / 60))

      ctx.clearRect(0, 0, W, H)

      const currentPhase = phaseRef.current

      if (currentPhase === 'appear') {
        for (const p of pixels) p.appear(ctx)
      } else {
        let allIdle = true
        for (const p of pixels) {
          p.disappear(ctx)
          if (!p.isIdle) allIdle = false
        }
        if (allIdle) {
          cancelAnimationFrame(rafRef.current)
          ctx.clearRect(0, 0, W, H)
          onCompleteRef.current()
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 只在挂载时初始化，phase 通过 ref 实时同步

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0" style={{ zIndex: 9999 }} />
}
