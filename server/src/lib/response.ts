/**
 * WebSocket 响应包装器：统一把类型和载荷序列化为 JSON 字符串。
 */
import { PayloadType } from '../types'

export class WebSocketResponse {
  constructor(
    private type: PayloadType,
    private payload: unknown
  ) {}

  json() {
    return JSON.stringify({
      type: this.type,
      payload: this.payload
    })
  }
}
