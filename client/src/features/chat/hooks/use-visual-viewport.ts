/**
 * Tracks the visual viewport size for mobile keyboard adaptation.
 *
 * On iOS Safari, when the keyboard opens, `window.innerHeight` stays the same
 * but `window.visualViewport.height` shrinks. This hook gives you the real
 * visible height, plus a `keyboardOpen` flag.
 *
 * On desktop or browsers without visualViewport API, it falls back to
 * window.innerHeight and `keyboardOpen` stays false.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export type VisualViewportState = {
  /** The actual visible height in CSS pixels (excludes keyboard & browser chrome) */
  height: number
  /** True when the software keyboard is likely open */
  keyboardOpen: boolean
  /** The keyboard height in CSS pixels (0 when keyboard is closed) */
  keyboardHeight: number
}

/** Threshold: if viewport shrinks by more than this, keyboard is likely open */
const KEYBOARD_THRESHOLD = 150

export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => ({
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    keyboardOpen: false,
    keyboardHeight: 0
  }))

  // Store the "full" height (no keyboard) so we can detect shrinkage.
  // On iOS, window.innerHeight is stable; on Android, it changes with keyboard.
  const fullHeightRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 0)

  const update = useCallback(() => {
    const vv = window.visualViewport
    const currentHeight = vv ? Math.round(vv.height) : window.innerHeight

    // Update fullHeight if viewport grows (keyboard closing, orientation change)
    if (currentHeight > fullHeightRef.current) {
      fullHeightRef.current = currentHeight
    }

    const diff = fullHeightRef.current - currentHeight
    const keyboardOpen = diff > KEYBOARD_THRESHOLD
    const keyboardHeight = keyboardOpen ? diff : 0

    setState((prev) => {
      if (
        prev.height === currentHeight &&
        prev.keyboardOpen === keyboardOpen &&
        prev.keyboardHeight === keyboardHeight
      ) {
        return prev // no change, skip re-render
      }
      return { height: currentHeight, keyboardOpen, keyboardHeight }
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const vv = window.visualViewport

    // Initial measurement
    fullHeightRef.current = window.innerHeight
    update()

    if (vv) {
      vv.addEventListener('resize', update)
      vv.addEventListener('scroll', update)
    }
    window.addEventListener('resize', update)

    // Also listen for orientation changes
    window.addEventListener('orientationchange', () => {
      // Reset fullHeight on orientation change
      setTimeout(() => {
        fullHeightRef.current = window.visualViewport?.height ?? window.innerHeight
        update()
      }, 300)
    })

    return () => {
      if (vv) {
        vv.removeEventListener('resize', update)
        vv.removeEventListener('scroll', update)
      }
      window.removeEventListener('resize', update)
    }
  }, [update])

  return state
}
