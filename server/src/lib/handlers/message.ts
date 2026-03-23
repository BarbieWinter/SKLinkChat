/**
 * 消息处理器：负责文本消息和“正在输入”状态的转发。
 */
import { WebSocketResponse } from '@/lib/response'
import { PayloadType, WebSocket, WebSocketPayload } from '@/types'
import Handler from './handler'

interface TypingPayload {
  id: string
  typing: boolean
}

interface MessagePayload {
  id: string
  message: string
}

export default class MessageHandler extends Handler {
  types = [PayloadType.Message, PayloadType.Typing]

  handle(ws: WebSocket, payload: WebSocketPayload) {
    if (this.app.debug) console.debug('Message received', payload)
    const { id } = payload.payload as MessagePayload | TypingPayload
    const client = this.app.client(id)

    if (!client) {
      return ws.send(new WebSocketResponse(PayloadType.Error, 'Client not found').json())
    }

    if (!client.ws) {
      return ws.send(new WebSocketResponse(PayloadType.Error, 'Client temporarily unavailable').json())
    }

    switch (payload.type) {
      case PayloadType.Message:
        // 把发送方消息转发给目标用户，并携带发送者信息供前端展示。
        const { message } = payload.payload as MessagePayload
        return client.ws?.send(
          new WebSocketResponse(PayloadType.Message, {
            id: ws.data.id,
            name: this.app.client(ws.data.id).name,
            message
          }).json()
        )
      case PayloadType.Typing:
        // 输入状态是轻量即时信号，只转发当前是否正在输入。
        return client.ws?.send(
          new WebSocketResponse(PayloadType.Typing, {
            id: ws.data.id,
            typing: (payload.payload as TypingPayload).typing
          }).json()
        )
    }
  }
}
