/**
 * 获取在线用户列表：当前主要用于在线人数展示。
 */
export const getUsers = async () => {
  const response = await fetch(import.meta.env.VITE_ENDPOINT + '/users')
  return await response.json()
}
