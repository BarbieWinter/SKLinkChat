import '@testing-library/jest-dom/vitest'

Object.defineProperty(window.HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  value: vi.fn()
})

// Stub ResizeObserver for jsdom (used by pretext integration)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any
}
