import { cn } from '@/shared/lib/utils'
import type { Gender } from '@/shared/types'

type PixelGenderIconProps = {
  gender: Gender
  size?: number
  className?: string
}

/**
 * 8-bit pixel-art character sprites.
 * ViewBox: 8 × 12 units (one unit = one pixel).
 *
 * Layout (row by row):
 *  y=0  hair top
 *  y=1  head (hair sides for female)
 *  y=2  face + eyes
 *  y=3  face + blush (female) / plain skin (male/unknown)
 *  y=4  neck
 *  y=5  upper body
 *  y=6  body + arms extended
 *  y=7  lower body
 *  y=8  waist / skirt hem (female)
 *  y=9  legs
 *  y=10 legs lower
 *  y=11 shoes
 */

type Px = [number, number, string]

// ── Colour palettes ──────────────────────────────────────────────────────────
const SKIN = '#ffc8a0'
const BLUSH = '#ffb3cc'
const EYE = '#1a1a1a'
const SHOE = '#111111'

const HAIR_M = '#2c1810' // male hair (dark brown)
const HAIR_F = '#3b1a0e' // female hair (slightly different dark)
const SHIRT_M = '#3b82f6' // blue shirt
const PANTS_M = '#1e3a5f' // dark navy pants
const DRESS_F = '#f472b6' // pink dress
const DRESS_F_HEM = '#ec4899' // slightly deeper hem

const HAIR_U = '#9ca3af' // unknown: gray hair
const SKIN_U = '#e5e7eb' // unknown: pale skin
const EYE_U = '#4b5563'
const SHIRT_U = '#6b7280' // gray shirt
const PANTS_U = '#4b5563' // dark gray pants
const SHOE_U = '#374151'

// ── Male pixel map ───────────────────────────────────────────────────────────
const MALE: Px[] = [
  // y=0 — hair (4 px wide, centred)
  [2, 0, HAIR_M],
  [3, 0, HAIR_M],
  [4, 0, HAIR_M],
  [5, 0, HAIR_M],
  // y=1 — head
  [1, 1, SKIN],
  [2, 1, SKIN],
  [3, 1, SKIN],
  [4, 1, SKIN],
  [5, 1, SKIN],
  [6, 1, SKIN],
  // y=2 — face + eyes at x=2, x=5
  [1, 2, SKIN],
  [2, 2, EYE],
  [3, 2, SKIN],
  [4, 2, SKIN],
  [5, 2, EYE],
  [6, 2, SKIN],
  // y=3 — lower face
  [1, 3, SKIN],
  [2, 3, SKIN],
  [3, 3, SKIN],
  [4, 3, SKIN],
  [5, 3, SKIN],
  [6, 3, SKIN],
  // y=4 — neck (2 px)
  [3, 4, SKIN],
  [4, 4, SKIN],
  // y=5 — shirt (6 px)
  [1, 5, SHIRT_M],
  [2, 5, SHIRT_M],
  [3, 5, SHIRT_M],
  [4, 5, SHIRT_M],
  [5, 5, SHIRT_M],
  [6, 5, SHIRT_M],
  // y=6 — arms fully extended (8 px)
  [0, 6, SHIRT_M],
  [1, 6, SHIRT_M],
  [2, 6, SHIRT_M],
  [3, 6, SHIRT_M],
  [4, 6, SHIRT_M],
  [5, 6, SHIRT_M],
  [6, 6, SHIRT_M],
  [7, 6, SHIRT_M],
  // y=7 — lower shirt (4 px)
  [2, 7, SHIRT_M],
  [3, 7, SHIRT_M],
  [4, 7, SHIRT_M],
  [5, 7, SHIRT_M],
  // y=8 — belt/pants top (4 px)
  [2, 8, PANTS_M],
  [3, 8, PANTS_M],
  [4, 8, PANTS_M],
  [5, 8, PANTS_M],
  // y=9 — pants (split legs: left x=2-3, right x=4-5)
  [2, 9, PANTS_M],
  [3, 9, PANTS_M],
  [4, 9, PANTS_M],
  [5, 9, PANTS_M],
  // y=10 — pants lower
  [2, 10, PANTS_M],
  [3, 10, PANTS_M],
  [4, 10, PANTS_M],
  [5, 10, PANTS_M],
  // y=11 — shoes (wider: left x=1-3, right x=4-6)
  [1, 11, SHOE],
  [2, 11, SHOE],
  [3, 11, SHOE],
  [4, 11, SHOE],
  [5, 11, SHOE],
  [6, 11, SHOE]
]

// ── Female pixel map ─────────────────────────────────────────────────────────
const FEMALE: Px[] = [
  // y=0 — wide hair top (6 px)
  [1, 0, HAIR_F],
  [2, 0, HAIR_F],
  [3, 0, HAIR_F],
  [4, 0, HAIR_F],
  [5, 0, HAIR_F],
  [6, 0, HAIR_F],
  // y=1 — head + long hair on sides
  [0, 1, HAIR_F],
  [1, 1, SKIN],
  [2, 1, SKIN],
  [3, 1, SKIN],
  [4, 1, SKIN],
  [5, 1, SKIN],
  [6, 1, SKIN],
  [7, 1, HAIR_F],
  // y=2 — face + eyes + hair sides
  [0, 2, HAIR_F],
  [1, 2, SKIN],
  [2, 2, EYE],
  [3, 2, SKIN],
  [4, 2, SKIN],
  [5, 2, EYE],
  [6, 2, SKIN],
  [7, 2, HAIR_F],
  // y=3 — lower face + blush cheeks + hair sides
  [0, 3, HAIR_F],
  [1, 3, SKIN],
  [2, 3, BLUSH],
  [3, 3, SKIN],
  [4, 3, SKIN],
  [5, 3, BLUSH],
  [6, 3, SKIN],
  [7, 3, HAIR_F],
  // y=4 — neck
  [3, 4, SKIN],
  [4, 4, SKIN],
  // y=5 — dress bodice (narrow, 4 px)
  [2, 5, DRESS_F],
  [3, 5, DRESS_F],
  [4, 5, DRESS_F],
  [5, 5, DRESS_F],
  // y=6 — arms out + dress body
  [0, 6, DRESS_F],
  [1, 6, DRESS_F],
  [2, 6, DRESS_F],
  [3, 6, DRESS_F],
  [4, 6, DRESS_F],
  [5, 6, DRESS_F],
  [6, 6, DRESS_F],
  [7, 6, DRESS_F],
  // y=7 — dress widens (6 px)
  [1, 7, DRESS_F],
  [2, 7, DRESS_F],
  [3, 7, DRESS_F],
  [4, 7, DRESS_F],
  [5, 7, DRESS_F],
  [6, 7, DRESS_F],
  // y=8 — skirt flare (full 8 px)
  [0, 8, DRESS_F_HEM],
  [1, 8, DRESS_F_HEM],
  [2, 8, DRESS_F_HEM],
  [3, 8, DRESS_F_HEM],
  [4, 8, DRESS_F_HEM],
  [5, 8, DRESS_F_HEM],
  [6, 8, DRESS_F_HEM],
  [7, 8, DRESS_F_HEM],
  // y=9 — legs (skin showing under skirt)
  [2, 9, SKIN],
  [3, 9, SKIN],
  [4, 9, SKIN],
  [5, 9, SKIN],
  // y=10 — legs lower
  [2, 10, SKIN],
  [3, 10, SKIN],
  [4, 10, SKIN],
  [5, 10, SKIN],
  // y=11 — shoes (same width as male)
  [1, 11, SHOE],
  [2, 11, SHOE],
  [3, 11, SHOE],
  [4, 11, SHOE],
  [5, 11, SHOE],
  [6, 11, SHOE]
]

// ── Unknown pixel map (male shape, neutral grays) ────────────────────────────
const UNKNOWN: Px[] = [
  [2, 0, HAIR_U],
  [3, 0, HAIR_U],
  [4, 0, HAIR_U],
  [5, 0, HAIR_U],
  [1, 1, SKIN_U],
  [2, 1, SKIN_U],
  [3, 1, SKIN_U],
  [4, 1, SKIN_U],
  [5, 1, SKIN_U],
  [6, 1, SKIN_U],
  [1, 2, SKIN_U],
  [2, 2, EYE_U],
  [3, 2, SKIN_U],
  [4, 2, SKIN_U],
  [5, 2, EYE_U],
  [6, 2, SKIN_U],
  [1, 3, SKIN_U],
  [2, 3, SKIN_U],
  [3, 3, SKIN_U],
  [4, 3, SKIN_U],
  [5, 3, SKIN_U],
  [6, 3, SKIN_U],
  [3, 4, SKIN_U],
  [4, 4, SKIN_U],
  [1, 5, SHIRT_U],
  [2, 5, SHIRT_U],
  [3, 5, SHIRT_U],
  [4, 5, SHIRT_U],
  [5, 5, SHIRT_U],
  [6, 5, SHIRT_U],
  [0, 6, SHIRT_U],
  [1, 6, SHIRT_U],
  [2, 6, SHIRT_U],
  [3, 6, SHIRT_U],
  [4, 6, SHIRT_U],
  [5, 6, SHIRT_U],
  [6, 6, SHIRT_U],
  [7, 6, SHIRT_U],
  [2, 7, SHIRT_U],
  [3, 7, SHIRT_U],
  [4, 7, SHIRT_U],
  [5, 7, SHIRT_U],
  [2, 8, PANTS_U],
  [3, 8, PANTS_U],
  [4, 8, PANTS_U],
  [5, 8, PANTS_U],
  [2, 9, PANTS_U],
  [3, 9, PANTS_U],
  [4, 9, PANTS_U],
  [5, 9, PANTS_U],
  [2, 10, PANTS_U],
  [3, 10, PANTS_U],
  [4, 10, PANTS_U],
  [5, 10, PANTS_U],
  [1, 11, SHOE_U],
  [2, 11, SHOE_U],
  [3, 11, SHOE_U],
  [4, 11, SHOE_U],
  [5, 11, SHOE_U],
  [6, 11, SHOE_U]
]

const PIXELS: Record<Gender, Px[]> = { male: MALE, female: FEMALE, unknown: UNKNOWN }

export function PixelGenderIcon({ gender, size = 20, className }: PixelGenderIconProps) {
  const pixels = PIXELS[gender]
  // ViewBox is 8 wide × 12 tall; keep aspect ratio
  const height = Math.round((size * 12) / 8)

  return (
    <svg
      viewBox="0 0 8 12"
      width={size}
      height={height}
      className={cn('shrink-0', className)}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {pixels.map(([x, y, fill], i) => (
        <rect key={i} x={x} y={y} width="1" height="1" fill={fill} />
      ))}
    </svg>
  )
}
