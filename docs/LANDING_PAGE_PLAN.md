# Landing Page Redesign Plan
## vibeisland.app Effect Recreation

**Route**: `/landing` → `client/src/pages/retro-landing-page.tsx`

---

## Visual Effects Inventory

### 1. Top Spotlight / God Ray
A conical cyan beam shoots down from the top-center of the page.

**Implementation:**
- Absolute-positioned `<div>` at `top: 0`, full width
- Two stacked `radial-gradient` layers:
  - Wide diffuse halo: `radial-gradient(ellipse 70% 45% at 50% 0%, rgba(6,182,212,0.30) 0%, transparent 70%)`
  - Narrow beam core: `radial-gradient(ellipse 18% 55% at 50% 0%, rgba(6,182,212,0.55) 0%, transparent 100%)`
- CSS `@keyframes` breathing pulse: `opacity` 0.75 ↔ 1.0 over 3s ease-in-out infinite
- `pointer-events: none; z-index: 1`

---

### 2. Scatter Character Canvas (ASCII Noise)
A full-viewport canvas renders a grid of random characters from `["0","1","+","-","*",":","."]`.
Characters near the top-right corner fade in; mouse proximity triggers a cyan glow burst.

**Implementation (React hook `useScatterCanvas`):**
- `useRef<HTMLCanvasElement>` + `useEffect`
- 20px grid spacing, random char per cell
- Alpha formula: `fade = max(0, 1 - dist_topRight / maxDist) * 0.3 + mousePrx * 0.5`
- Refresh ~4% of cells every 150ms via `setInterval`
- `requestAnimationFrame` loop for mouse glow
- DPR scaling (max ×2), `IntersectionObserver` pause when off-screen

---

### 3. Dot Wave Canvas
Full-screen canvas with a sine/cosine dot grid that undulates continuously.
Dots expand and brighten near the cursor.

**Implementation (React hook `useDotWaveCanvas`):**
- 22px grid, dot radius: `0.5 + 1.0 * sin(x*0.008 + t*0.6) * cos(y*0.006 + t*0.4)`
- Alpha: `0.02 + 0.15 * |sin(...)|`
- Mouse radius 80px: dots scale up to 2.5px and alpha 0.6
- 2-frame skip throttle per RAF cycle
- Color: `rgba(6, 182, 212, alpha)`
- Scroll offset synchronisation for parallax feel

---

### 4. Text Scramble Cycle
The hero subtitle cycles through keyword phrases with a character-scramble transition.
Each phrase has a unique accent color.

**Words & Colors:**
| Phrase | Color |
|--------|-------|
| `ANON CHAT` | `#f472b6` (pink) |
| `PIXEL NET` | `#22c55e` (green) |
| `LIVE WIRE` | `#3b82f6` (blue) |
| `SAFE ZONE` | `#a855f7` (purple) |
| `OPEN WORLD` | `#f59e0b` (gold) |

**Implementation (React hook `useTextScramble`):**
- Cycle interval: 4500ms (first switch at 2500ms)
- Each switch: iterate chars left→right, 40ms stagger per char
- Each char scrambles through random symbols 3× before settling on target
- `prefers-reduced-motion`: skip scramble, instant swap
- Returns `{ display: string; color: string }`

---

### 5. Navbar Scroll Behavior
Transparent at top → frosted glass on scroll.

**Implementation:**
- `useEffect` + `window.addEventListener('scroll', ...)`
- Threshold: 20px
- Scrolled state: `background: rgba(5,8,16,0.75); backdrop-filter: blur(12px)`
- Transition: `all 0.3s ease`

---

### 6. Page Background
```css
background: #050810;
```
Dark near-black blue, consistent with vibeisland's deep space feel.

---

### 7. Hero Content Structure
```
[Top Spotlight]          ← absolute, z-index 1
[Dot Wave Canvas]        ← absolute, z-index 0
[Scatter Canvas]         ← absolute, z-index 0
[Noise Grain]            ← absolute, z-index 0

[Navbar]                 ← relative, z-index 50

[Hero Section]           ← relative, z-index 10
  SKLINK                 ← main title (large, white, pixel font)
  [Scramble Word]        ← cycling subtitle with accent color
  "Encrypted · Anonymous · Real-time"  ← tagline
  [CTA Button: START CHATTING]
  [Left pixel character SVG]   ← floats up/down
  [Right pixel character SVG]  ← floats up/down (offset)

[Bottom 3D Grid]         ← absolute, bottom-0, z-index 1
```

---

### 8. Pixel Character SVGs
Male (left) and Female (right) decorative figures, sized ~180×240px.
Reuse the colour palette from `PixelGenderIcon` but drawn at larger scale with more detail:
- Animation: `translateY(0) ↔ translateY(-18px)` over 4s ease-in-out, offset 2s between characters

---

### 9. Bottom 3D Perspective Grid
CSS perspective grid scrolling forward.

**CSS:**
```css
background-image:
  linear-gradient(to right, rgba(6,182,212,0.25) 1px, transparent 1px),
  linear-gradient(to top, rgba(6,182,212,0.45) 1px, transparent 1px);
background-size: 50px 50px;
transform: rotateX(75deg);
animation: gridScroll 2s linear infinite;
```
Scroll parallax via `transform: translateY(scrollY * 0.2px)`.

---

### 10. Noise Grain Overlay
Reuses the global `.noise-overlay` class already defined in `global.css`.

---

### 11. CTA Buttons (Navbar + Hero)
Pixel-style: sharp corners, solid border, block shadow, hover collapses shadow + shifts translate.

```css
border: 2px solid currentColor;
box-shadow: 4px 4px 0 currentColor;
transition: all 0.1s;

:hover {
  transform: translate(4px, 4px);
  box-shadow: none;
}
```

---

## File Changes

| File | Action |
|------|--------|
| `client/src/pages/retro-landing-page.tsx` | Full rewrite |
| `client/src/assets/global.css` | Append landing-page-specific utility classes (no existing styles touched) |
| `docs/LANDING_PAGE_PLAN.md` | This document |

**Zero new dependencies.** Uses only: React, framer-motion (already installed), react-router-dom.

---

## Acceptance Checklist

- [ ] Cyan spotlight beam visible at top, breathing animation
- [ ] Scatter char canvas covers viewport, mouse triggers glow
- [ ] Dot wave canvas animates, mouse interaction works
- [ ] Subtitle scrambles through 5 phrases every 4.5s, each with correct color
- [ ] Navbar turns frosted on scroll past 20px
- [ ] Log In button navigates to `/`
- [ ] Sign Up button navigates to `/`
- [ ] Enter App button shown when authenticated, navigates to `/`
- [ ] Bottom 3D grid scrolls forward, cyan color
- [ ] Mobile layout: single column, canvas effects retained, text readable
- [ ] No regressions on `/` main app route
