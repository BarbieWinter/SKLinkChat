/**
 * Virtual message list with pretext-powered height pre-calculation
 * and ResizeObserver-based height correction.
 *
 * Pretext provides initial estimates so the first frame is stable.
 * After render, ResizeObserver measures actual DOM heights and corrects
 * any drift caused by Canvas vs browser text measurement differences.
 */
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useChat } from '@/features/chat/chat-provider'
import { useI18n } from '@/shared/i18n/use-i18n'
import { getBubbleHeight, getTightBubbleWidth, prepareBubble } from '@/shared/lib/pretext'
import { cn } from '@/shared/lib/utils'
import { Message, UserState } from '@/shared/types'
import { Button } from '@/shared/ui/button'

/** Extra pixels to render above/below the viewport */
const OVERSCAN = 200
/** Gap between messages (space-y-3 = 12px, sm:space-y-4 = 16px) */
const GAP_SM = 12
const GAP_LG = 16
/** Height for system messages */
const SYSTEM_MSG_HEIGHT = 32
/** Height for the sender name label above stranger messages */
const SENDER_LABEL_HEIGHT = 20
const BUBBLE_PADDING_V = 20 // py-2.5 => 10px * 2
const LINE_HEIGHT_SM = 23
const LINE_HEIGHT_LG = 24

type VirtualMessageListProps = {
  messages: Message[]
  containerWidth: number
}

type ItemLayout = {
  top: number
  height: number
  tightWidth: number | undefined
}

// ── MeasuredItem: wraps each virtual item and reports actual DOM height ──

type MeasuredItemProps = {
  index: number
  children: React.ReactNode
  onHeightChange: (index: number, height: number) => void
  className?: string
  style?: React.CSSProperties
}

const MeasuredItem = memo(function MeasuredItem({
  index,
  children,
  onHeightChange,
  className,
  style,
}: MeasuredItemProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight
      onHeightChange(index, h)
    })
    ro.observe(el, { box: 'border-box' })
    // Report initial height immediately
    onHeightChange(index, el.offsetHeight)
    return () => ro.disconnect()
  }, [index, onHeightChange])

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
})

export function VirtualMessageList({ messages, containerWidth }: VirtualMessageListProps) {
  const { t } = useI18n()
  const { stranger, me, connect, bootstrapStatus, transportStatus, availability, retryBootstrap } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const wasAtBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)

  // Measured DOM heights — populated by ResizeObserver after render
  const measuredHeightsRef = useRef(new Map<number, number>())
  const [correctionTick, setCorrectionTick] = useState(0)

  const handleHeightChange = useCallback(
    (index: number, height: number) => {
      const prev = measuredHeightsRef.current.get(index)
      // Only trigger re-layout if height actually changed (> 1px tolerance)
      if (prev !== undefined && Math.abs(prev - height) < 1) return
      measuredHeightsRef.current.set(index, height)
      setCorrectionTick((t) => t + 1)
    },
    [],
  )

  // Cap layout width on desktop so bubbles don't float in a vast empty space
  const MAX_CONTENT_WIDTH = 768 // max-w-3xl
  const layoutWidth = containerWidth > 0 ? Math.min(containerWidth, MAX_CONTENT_WIDTH) : 0
  const isSmall = containerWidth < 640
  const gap = isSmall ? GAP_SM : GAP_LG

  // Compute layout for all messages — pretext estimate first, measured height overrides
  const { items, totalHeight } = useMemo(() => {
    // correctionTick is a dependency to trigger recalc on height corrections
    void correctionTick
    if (layoutWidth <= 0) return { items: [] as ItemLayout[], totalHeight: 0 }

    const bubbleMaxWidth = layoutWidth * (isSmall ? 0.88 : 0.70)
    const measured = measuredHeightsRef.current
    const result: ItemLayout[] = []
    let y = 0

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]!
      const isSystem = msg.sender === 'system'
      const isMe = msg.sender === 'me'

      // If we have a measured DOM height, use it directly
      const domHeight = measured.get(i)
      if (domHeight !== undefined) {
        result.push({ top: y, height: domHeight, tightWidth: undefined })
        y += domHeight + gap
        continue
      }

      // Otherwise fall back to pretext estimate
      if (isSystem) {
        result.push({ top: y, height: SYSTEM_MSG_HEIGHT, tightWidth: undefined })
        y += SYSTEM_MSG_HEIGHT + gap
        continue
      }

      let height = 0
      let tightWidth: number | undefined
      const explicitLineCount = msg.message.split(/\r\n|\r|\n/).length
      const lineHeight = isSmall ? LINE_HEIGHT_SM : LINE_HEIGHT_LG

      let prepared = isSmall ? msg._prepared : undefined
      if (!prepared) {
        try {
          prepared = prepareBubble(msg.message, isSmall)
        } catch {
          prepared = undefined
        }
      }

      if (prepared) {
        if (!isMe) height += SENDER_LABEL_HEIGHT
        const measuredBubbleHeight = getBubbleHeight(prepared, bubbleMaxWidth, isSmall)
        const minBubbleHeightFromExplicitBreaks = explicitLineCount * lineHeight + BUBBLE_PADDING_V
        height += Math.max(measuredBubbleHeight, minBubbleHeightFromExplicitBreaks)
        tightWidth =
          explicitLineCount > 1 ? undefined : getTightBubbleWidth(prepared, bubbleMaxWidth, isSmall)
      } else {
        if (!isMe) height += SENDER_LABEL_HEIGHT
        const estimatedLines = Math.ceil(msg.message.length / 30)
        height += estimatedLines * lineHeight + BUBBLE_PADDING_V
      }

      result.push({ top: y, height, tightWidth })
      y += height + gap
    }

    return { items: result, totalHeight: y > 0 ? y - gap : 0 }
  }, [messages, layoutWidth, isSmall, gap, correctionTick])

  // Scroll compensation after height corrections
  const prevItemsRef = useRef<ItemLayout[]>([])
  useEffect(() => {
    const el = scrollRef.current
    const prevItems = prevItemsRef.current
    if (!el || prevItems.length === 0 || items.length === 0) {
      prevItemsRef.current = items
      return
    }
    // If user is at bottom, no compensation needed (auto-scroll handles it)
    if (wasAtBottomRef.current) {
      prevItemsRef.current = items
      return
    }
    // Find the first item whose top is >= scrollTop (first visible item)
    const st = el.scrollTop
    let anchorIdx = -1
    for (let i = 0; i < prevItems.length; i++) {
      if (prevItems[i]!.top + prevItems[i]!.height > st) {
        anchorIdx = i
        break
      }
    }
    if (anchorIdx >= 0 && anchorIdx < items.length && anchorIdx < prevItems.length) {
      const drift = items[anchorIdx]!.top - prevItems[anchorIdx]!.top
      if (Math.abs(drift) > 1) {
        el.scrollTop = st + drift
      }
    }
    prevItemsRef.current = items
  }, [items])

  // Track viewport size
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewportHeight(el.clientHeight)
    const ro = new ResizeObserver((entries) => {
      setViewportHeight(entries[0]?.contentRect.height ?? 0)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Handle scroll
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && wasAtBottomRef.current) {
      const el = scrollRef.current
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
        })
      }
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length])

  // Determine visible range
  const visibleStart = scrollTop - OVERSCAN
  const visibleEnd = scrollTop + viewportHeight + OVERSCAN

  const isSearching = me?.state === UserState.Searching
  const isBootstrapping = bootstrapStatus === 'bootstrapping'
  const isServiceUnavailable = availability === 'error'
  const isReconnecting = transportStatus === 'reconnecting'
  const isNotConnected = !stranger && me?.state !== UserState.Searching
  const useVirtualList = true

  // Clear measured heights when messages change (e.g. new chat session)
  useEffect(() => {
    measuredHeightsRef.current.clear()
  }, [messages.length === 0])

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="absolute inset-0 scroll-touch overflow-y-auto px-3 py-3 sm:px-6 sm:py-6" ref={scrollRef}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="mx-auto flex min-h-full max-w-sm flex-col items-center justify-center text-center"
        >
          <div
            className="mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary sm:mb-6 sm:h-14 sm:w-14"
          >
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>

          <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{t('chat.emptyTitle')}</h3>
          <p className="mt-2 max-w-[28ch] text-[13px] leading-relaxed text-muted-foreground sm:max-w-none sm:text-sm">
            {isServiceUnavailable
              ? t('chat.serviceUnavailable')
              : isReconnecting
                ? t('chat.reconnecting')
                : isBootstrapping
                  ? t('chat.serviceStarting')
                  : isSearching
                    ? '正在为你匹配有趣的灵魂...'
                    : t('chat.emptyDescription')}
          </p>

          {isSearching && (
            <div className="mt-8 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className={cn('h-2 w-2 rounded-full', i < 2 ? 'bg-primary' : 'bg-amber')}
                />
              ))}
            </div>
          )}

          {!isSearching && isNotConnected && !isServiceUnavailable && !isBootstrapping && (
            <div className="mt-6 w-full sm:mt-8">
              <Button
                onClick={() => connect?.()}
                className="h-10 w-full rounded-md bg-primary text-primary-foreground text-sm font-medium hover:shadow-[0_0_24px_hsl(187_72%_48%/0.25)]"
              >
                {t('home.startChat')}
              </Button>
            </div>
          )}

          {isServiceUnavailable && (
            <Button
              onClick={() => retryBootstrap?.()}
              variant="outline"
              className="mt-8 rounded-md border-border hover:border-primary"
            >
              {t('chat.retryConnection')}
            </Button>
          )}
        </motion.div>
      </div>
    )
  }

  // Use normal flow layout for stability across browser/font differences.
  if (!useVirtualList) {
    return (
      <div
        className="absolute inset-0 scroll-touch overflow-y-auto px-3 py-3 sm:px-6 sm:py-6"
        ref={scrollRef}
        onScroll={onScroll}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message, i) => {
            const isMe = message.sender === 'me'
            const isSystem = message.sender === 'system'
            const isStranger = !isMe && !isSystem

            if (isSystem) {
              return (
                <div key={`sys-${i}`} className="flex justify-start px-2">
                  <span className="text-xs text-terminal/70">
                    <span className="text-terminal/40 mr-1">{'>_'}</span>
                    {message.message}
                  </span>
                </div>
              )
            }

            return (
              <div key={`msg-${i}`} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                {!isMe && isStranger && (
                  <span className="mb-1 ml-1 text-[11px] font-medium text-amber tracking-wide">
                    {stranger?.name ?? message.sender}
                  </span>
                )}
                <div
                  className={cn(
                    'relative max-w-[88%] px-3.5 py-2.5 sm:max-w-[70%] sm:px-4 sm:py-3',
                    isMe
                      ? 'rounded-md bg-primary/8 border border-primary/20 text-foreground'
                      : 'rounded-md bg-secondary border border-border text-foreground'
                  )}
                >
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed sm:text-[14px]">
                    {message.message}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute inset-0 scroll-touch overflow-y-auto px-3 py-3 sm:px-6 sm:py-6"
      ref={scrollRef}
      onScroll={onScroll}
    >
      <div className="mx-auto max-w-3xl">
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          {items.map((item, i) => {
            // Skip items outside the visible range
            if (item.top + item.height < visibleStart || item.top > visibleEnd) return null

            const message = messages[i]!
            const isMe = message.sender === 'me'
            const isSystem = message.sender === 'system'
            const isStranger = !isMe && !isSystem

            if (isSystem) {
              return (
                <MeasuredItem
                  key={`sys-${i}`}
                  index={i}
                  onHeightChange={handleHeightChange}
                  className="absolute left-0 right-0 flex justify-start px-2"
                  style={{ top: `${item.top}px` }}
                >
                  <span className="text-xs text-terminal/70">
                    <span className="text-terminal/40 mr-1">{'>_'}</span>
                    {message.message}
                  </span>
                </MeasuredItem>
              )
            }

            return (
              <MeasuredItem
                key={`msg-${i}`}
                index={i}
                onHeightChange={handleHeightChange}
                className={cn('absolute left-0 right-0 flex flex-col', isMe ? 'items-end' : 'items-start')}
                style={{ top: `${item.top}px` }}
              >
                {!isMe && isStranger && (
                  <span className="mb-1 ml-1 text-[11px] font-medium text-amber tracking-wide">
                    {stranger?.name ?? message.sender}
                  </span>
                )}
                <div
                  className={cn(
                    'relative max-w-[88%] px-3.5 py-2.5 sm:max-w-[70%] sm:px-4 sm:py-3',
                    isMe
                      ? 'rounded-md bg-primary/8 border border-primary/20 text-foreground'
                      : 'rounded-md bg-secondary border border-border text-foreground'
                  )}
                  style={item.tightWidth ? { width: `${item.tightWidth}px` } : undefined}
                >
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed sm:text-[14px]">
                    {message.message}
                  </p>
                </div>
              </MeasuredItem>
            )
          })}
        </div>
      </div>
    </div>
  )
}
