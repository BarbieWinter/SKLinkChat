from enum import StrEnum
from typing import Any, TypedDict


class UserState(StrEnum):
    IDLE = "idle"
    SEARCHING = "searching"
    CONNECTED = "connected"


class PayloadType(StrEnum):
    MESSAGE = "message"
    USER_INFO = "user-info"
    ERROR = "error"
    QUEUE = "queue"
    MATCH = "match"
    DISCONNECT = "disconnect"
    TYPING = "typing"


class ProtocolEnvelope(TypedDict):
    type: PayloadType
    payload: Any


class ChatUser(TypedDict, total=False):
    id: str
    name: str
    state: UserState
    is_typing: bool
