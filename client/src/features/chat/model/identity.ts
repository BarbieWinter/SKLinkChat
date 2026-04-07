import type { Gender } from '@/shared/types'

export const getAnonymousPartnerLabel = (gender?: Gender) => {
  if (gender === 'male') {
    return '男性用户'
  }

  if (gender === 'female') {
    return '女性用户'
  }

  return '匿名用户'
}
