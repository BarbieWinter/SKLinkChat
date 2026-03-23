/**
 * 后端启动入口：读取端口并启动 Bun 服务。
 */
import { env } from 'bun'
import app from './lib/app'

try {
  // 启动应用实例，默认端口为 9000。
  app.listen(env.PORT ?? 9000)
} catch (error) {
  console.error('Something went wrong', error)
  app.stop()
}
