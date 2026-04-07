import type { CSSProperties } from 'react'

import { cn } from '@/shared/lib/utils'
import type { Gender } from '@/shared/types'

type RetroPixelBubbleProps = {
  text: string
  variant?: 'sent' | 'received'
  gender?: Gender
  uppercase?: boolean
  centerText?: boolean
  className?: string
  style?: CSSProperties
}

export function RetroPixelBubble({
  text,
  variant = 'sent',
  gender = 'female',
  uppercase = true,
  centerText = true,
  className,
  style
}: RetroPixelBubbleProps) {
  const genderClass =
    gender === 'male'
      ? 'retro-pixel-bubble-male'
      : gender === 'unknown'
        ? 'retro-pixel-bubble-unknown'
        : 'retro-pixel-bubble-female'

  return (
    <div
      className={cn(
        'retro-pixel-bubble',
        variant === 'received' ? 'retro-pixel-bubble-received' : 'retro-pixel-bubble-sent',
        genderClass,
        !centerText && 'retro-pixel-bubble-message',
        className
      )}
      style={style}
    >
      <div className="retro-pixel-bubble-surface">
        <p className={cn('retro-pixel-bubble-text', uppercase && 'retro-pixel-bubble-text-uppercase')}>{text}</p>
      </div>
    </div>
  )
}
