/**
 * 通用样式工具：把条件类名与 Tailwind 冲突类合并成最终 className。
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
