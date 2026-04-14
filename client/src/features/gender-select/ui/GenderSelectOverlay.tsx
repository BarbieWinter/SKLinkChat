import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import type { Gender } from '@/shared/types'

import { ParticleExplosion } from './ParticleExplosion'
import PixelCard from './PixelCard'

/* ──────────────────────────────────────────────────────────────
   常量
────────────────────────────────────────────────────────────── */

const HOLD_DURATION = 3000
const PARTICLE_APPEAR_DURATION = 850

const CONFIGS = [
  {
    gender: 'female' as const,
    variant: 'pink' as const,
    label: 'Female.',
    glowColor: '#fda4af'
  },
  {
    gender: 'male' as const,
    variant: 'blue' as const,
    label: 'Male.',
    glowColor: '#7dd3fc'
  }
]

type GenderCfg = (typeof CONFIGS)[number]

/* ──────────────────────────────────────────────────────────────
   GenderSelectOverlay
────────────────────────────────────────────────────────────── */

interface GenderSelectOverlayProps {
  onSelect: (gender: Gender) => Promise<void>
}

export function GenderSelectOverlay({ onSelect }: GenderSelectOverlayProps) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [visible, setVisible] = useState(true)

  /* 长按状态 */
  const [holding, setHolding] = useState(false)
  const [holdDone, setHoldDone] = useState(false) // 3s 已到
  const [saving, setSaving] = useState(false) // API 调用中

  /* 粒子 */
  const [showParticles, setShowParticles] = useState(false)
  const [particlePhase, setParticlePhase] = useState<'appear' | 'disappear'>('appear')
  const [particleOrigin, setParticleOrigin] = useState({ x: 0, y: 0 })
  const pressedCfgRef = useRef<GenderCfg | null>(null)

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const particlePhaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)

  const cfg = CONFIGS[index]

  /* ── 切卡 ── */
  const goTo = (next: number) => {
    if (next < 0 || next >= CONFIGS.length || holding) return
    setDirection(next > index ? 1 : -1)
    setIndex(next)
  }

  const onDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (holding) return
    if (info.offset.x < -40) goTo(index + 1)
    else if (info.offset.x > 40) goTo(index - 1)
  }

  /* ── 长按开始 ── */
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, cardCfg: GenderCfg) => {
    if (saving || holding) return

    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    isDraggingRef.current = false

    const rect = e.currentTarget.getBoundingClientRect()
    pressedCfgRef.current = cardCfg
    setParticleOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    setHolding(true)

    holdTimerRef.current = setTimeout(() => {
      setHoldDone(true)
      setSaving(true)
      setHolding(false)
      setParticlePhase('appear')
      setShowParticles(true)

      particlePhaseTimerRef.current = setTimeout(() => {
        setParticlePhase('disappear')
      }, PARTICLE_APPEAR_DURATION)
    }, HOLD_DURATION)
  }

  /* ── 移动时判断是否是拖拽，若是则立即取消长按 ── */
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!holding || isDraggingRef.current) return
    const start = pointerStartRef.current
    if (!start) return
    const dist = Math.sqrt((e.clientX - start.x) ** 2 + (e.clientY - start.y) ** 2)
    if (dist > 8) {
      isDraggingRef.current = true
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      setHolding(false)
    }
  }

  /* ── 长按取消（松开 / 离开）── */
  const cancelHold = () => {
    if (!holding) return
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    setHolding(false)
  }

  /* ── 粒子消失完成 ── */
  const handleDisappearComplete = async () => {
    setShowParticles(false)
    setParticlePhase('appear')
    particlePhaseTimerRef.current = null

    if (holdDone && pressedCfgRef.current) {
      setHoldDone(false)
      try {
        await onSelect(pressedCfgRef.current.gender)
        setVisible(false)
      } catch {
        setSaving(false)
      }
    }
  }

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      if (particlePhaseTimerRef.current) clearTimeout(particlePhaseTimerRef.current)
    }
  }, [])

  /* ── 卡片切换动画 ── */
  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 260 : -260, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -260 : 260, opacity: 0 })
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="gender-overlay"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black/90 backdrop-blur-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* ── 卡片区域 ─────────────────────────────────────── */}
            <div
              className="relative flex items-center justify-center transition-opacity duration-200"
              style={{
                width: 300,
                height: 375,
                /* 粒子开始后隐藏卡片，避免透过粒子间隙看到 */
                opacity: showParticles ? 0 : 1
              }}
            >
              <AnimatePresence custom={direction} mode="popLayout">
                <motion.div
                  key={index}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  drag={holding || saving ? false : 'x'}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.15}
                  onDragEnd={onDragEnd}
                  style={{ position: 'absolute' }}
                >
                  <PixelCard
                    variant={cfg.variant}
                    colors="#ffffff,#f0f0f0,#e8e8e8,#d0d0d0"
                    disabled={saving}
                    /* 长按事件 */
                    onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => handlePointerDown(e, cfg)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={cancelHold}
                    onPointerLeave={cancelHold}
                    onPointerCancel={cancelHold}
                  >
                    <p
                      style={{
                        position: 'absolute',
                        inset: 0,
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '42px',
                        fontWeight: 800,
                        color: 'rgb(40,30,56)',
                        letterSpacing: '-0.02em',
                        pointerEvents: 'none',
                        userSelect: 'none'
                      }}
                    >
                      {cfg.label}
                    </p>
                  </PixelCard>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── 底部指示器 ───────────────────────────────────── */}
            <motion.div
              className="mt-8 flex flex-col items-center gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              <motion.div
                animate={{ opacity: holding ? 0 : 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex items-center gap-2">
                  {CONFIGS.map((c, i) => (
                    <button
                      key={c.gender}
                      onClick={() => goTo(i)}
                      className="rounded-full transition-all duration-300 focus:outline-none"
                      style={{
                        width: index === i ? 20 : 6,
                        height: 6,
                        background: index === i ? CONFIGS[i].glowColor : 'rgba(255,255,255,0.2)'
                      }}
                    />
                  ))}
                </div>
                <SwipeHint />
                <p className="text-[10px] tracking-widest text-white/25 text-center">
                  按住3s确定性别，你之后无法再修改
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 粒子画布 ─────────────────────────────────────────── */}
      {showParticles && (
        <ParticleExplosion
          origin={particleOrigin}
          phase={particlePhase}
          appearDuration={PARTICLE_APPEAR_DURATION}
          onDisappearComplete={handleDisappearComplete}
        />
      )}
    </>
  )
}

/* ──────────────────────────────────────────────────────────────
   SwipeHint
────────────────────────────────────────────────────────────── */

function SwipeHint() {
  return (
    <div className="flex items-center gap-1 text-white/30">
      <motion.div
        animate={{ x: [0, -5, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
      >
        <ChevronLeft size={18} />
      </motion.div>
      <span className="mx-1 text-[10px] uppercase tracking-[0.35em]">右滑选取性别</span>
      <motion.div
        animate={{ x: [0, 5, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
      >
        <ChevronRight size={18} />
      </motion.div>
    </div>
  )
}
