/**
 * Hook that uses pretext to compute textarea content height
 * without DOM reflow. Returns a pixel height to set via style.
 */
import { useMemo } from 'react'
import { measureTextareaHeight } from '@/shared/lib/pretext'

const MIN_HEIGHT = 44 // min-h-[44px] from chat-panel
const MAX_HEIGHT_SM = 112 // max-h-28 = 7rem = 112px
const MAX_HEIGHT_LG = 128 // sm:max-h-32 = 8rem = 128px

export function useAutoHeight(
  text: string,
  textareaWidth: number,
  isSmallScreen: boolean,
): number {
  return useMemo(() => {
    if (textareaWidth <= 0) return MIN_HEIGHT
    // Add vertical padding: py-3 = 12px per side = 24px total
    const contentHeight = measureTextareaHeight(text, textareaWidth) + 24
    const maxHeight = isSmallScreen ? MAX_HEIGHT_SM : MAX_HEIGHT_LG
    return Math.max(MIN_HEIGHT, Math.min(contentHeight, maxHeight))
  }, [text, textareaWidth, isSmallScreen])
}
