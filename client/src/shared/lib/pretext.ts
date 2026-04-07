/**
 * Pretext integration layer for chat bubble measurement.
 *
 * Uses @chenglou/pretext to measure text dimensions without DOM reflow,
 * enabling tight bubble widths and precomputed heights for virtualization.
 */
import { layout, prepare, prepareWithSegments, walkLineRanges, type PreparedTextWithSegments } from '@chenglou/pretext'

// ── Font & layout constants (synced with Tailwind / chat-panel CSS) ──

/** Matches the chat bubble's `text-[14px]` on mobile, `sm:text-[15px]` on desktop */
const BUBBLE_FONT_SM = '14px "Inter var", Inter, ui-sans-serif, system-ui, sans-serif'
const BUBBLE_FONT_LG = '15px "Inter var", Inter, ui-sans-serif, system-ui, sans-serif'

/** `leading-relaxed` = 1.625 line-height */
const LINE_HEIGHT_SM = Math.round(14 * 1.625) // 23
const LINE_HEIGHT_LG = Math.round(15 * 1.625) // 24

/** Bubble horizontal padding: `px-3.5` = 14px per side */
const BUBBLE_PADDING_H = 14
/** Bubble vertical padding: `py-2.5` = 10px per side */
const BUBBLE_PADDING_V = 10

/** Textarea font: same as bubble but with `leading-5` = 20px */
const TEXTAREA_FONT = '14px "Inter var", Inter, ui-sans-serif, system-ui, sans-serif'
const TEXTAREA_LINE_HEIGHT = 20
/** Textarea horizontal padding: `px-3.5` = 14px */
const TEXTAREA_PADDING_H = 14

// ── Cache ──

const bubblePreparedByText = new Map<string, PreparedTextWithSegments>()

const getBubbleFont = (isSmall: boolean) => (isSmall ? BUBBLE_FONT_SM : BUBBLE_FONT_LG)
const getBubbleLineHeight = (isSmall: boolean) => (isSmall ? LINE_HEIGHT_SM : LINE_HEIGHT_LG)
const getBubbleCacheKey = (text: string, isSmall: boolean) => `${isSmall ? 'sm' : 'lg'}:${text}`

// ── Public API ──

export type BubbleMeasurement = {
  width: number
  height: number
  lineCount: number
}

/**
 * Prepare a chat message text for layout. Results are cached by text and breakpoint.
 * Call once per message; reuse the handle for all subsequent layout calls.
 */
export function prepareBubble(text: string, isSmall = true): PreparedTextWithSegments {
  const cacheKey = getBubbleCacheKey(text, isSmall)
  const cached = bubblePreparedByText.get(cacheKey)
  if (cached) return cached
  const prepared = prepareWithSegments(text, getBubbleFont(isSmall), { whiteSpace: 'pre-wrap' })
  bubblePreparedByText.set(cacheKey, prepared)
  return prepared
}

/**
 * Measure a bubble at a given container width. Returns the CSS-layout-equivalent
 * dimensions (what CSS `max-width` would produce).
 */
export function measureBubble(
  prepared: PreparedTextWithSegments,
  containerWidth: number,
  isSmall = true
): BubbleMeasurement {
  const lineHeight = getBubbleLineHeight(isSmall)
  const contentMaxWidth = Math.max(1, containerWidth - BUBBLE_PADDING_H * 2)
  const result = layout(prepared, contentMaxWidth, lineHeight)
  let maxLineWidth = 0
  walkLineRanges(prepared, contentMaxWidth, (line) => {
    if (line.width > maxLineWidth) maxLineWidth = line.width
  })
  return {
    width: Math.ceil(maxLineWidth) + BUBBLE_PADDING_H * 2,
    height: result.height + BUBBLE_PADDING_V * 2,
    lineCount: result.lineCount
  }
}

/**
 * Compute the tightest bubble width that keeps the same line count.
 * This is the "shrink-wrap" width that eliminates wasted whitespace
 * on the right side of chat bubbles.
 */
export function getTightBubbleWidth(
  prepared: PreparedTextWithSegments,
  containerMaxWidth: number,
  isSmall = true
): number {
  const lineHeight = getBubbleLineHeight(isSmall)
  const contentMaxWidth = Math.max(1, containerMaxWidth - BUBBLE_PADDING_H * 2)
  const baseLineCount = layout(prepared, contentMaxWidth, lineHeight).lineCount

  // Binary search for the tightest width with the same line count
  let lo = 1
  let hi = Math.max(1, Math.ceil(contentMaxWidth))

  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    const midLineCount = layout(prepared, mid, lineHeight).lineCount
    if (midLineCount <= baseLineCount) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }

  // Get the actual max line width at the tight width
  let maxLineWidth = 0
  walkLineRanges(prepared, lo, (line) => {
    if (line.width > maxLineWidth) maxLineWidth = line.width
  })

  return Math.ceil(maxLineWidth) + BUBBLE_PADDING_H * 2
}

/**
 * Get the full bubble height at a given container width.
 * Used for virtual scrolling height pre-calculation.
 */
export function getBubbleHeight(prepared: PreparedTextWithSegments, containerMaxWidth: number, isSmall = true): number {
  const lineHeight = getBubbleLineHeight(isSmall)
  const contentMaxWidth = Math.max(1, containerMaxWidth - BUBBLE_PADDING_H * 2)
  return layout(prepared, contentMaxWidth, lineHeight).height + BUBBLE_PADDING_V * 2
}

/**
 * Measure textarea content height for auto-resize.
 * Uses pre-wrap mode to preserve newlines and whitespace.
 */
export function measureTextareaHeight(text: string, textareaWidth: number): number {
  if (!text) return TEXTAREA_LINE_HEIGHT
  const contentWidth = Math.max(1, textareaWidth - TEXTAREA_PADDING_H * 2)
  const prepared = prepare(text, TEXTAREA_FONT, { whiteSpace: 'pre-wrap' })
  const { height } = layout(prepared, contentWidth, TEXTAREA_LINE_HEIGHT)
  return height
}

export { type PreparedTextWithSegments }
