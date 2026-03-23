from __future__ import annotations

from dataclasses import dataclass

from redis.asyncio import Redis

from app.application.chat.runtime_service import ChatRuntimeService
from app.application.chat.use_cases import (
    BootstrapConnectionUseCase,
    DisconnectSessionUseCase,
    EnterQueueUseCase,
    ExpireStaleSessionsUseCase,
    LookupPartnerUseCase,
    MarkDisconnectedUseCase,
    SendMessageUseCase,
    SetTypingUseCase,
    TryMatchUseCase,
    UpdateProfileUseCase,
)
from app.application.platform.use_cases import (
    CreateAnonymousSessionUseCase,
    OnlineUserCountUseCase,
    ReadinessCheckUseCase,
)
from app.infrastructure.feature_flags import NoOpFeatureFlagEvaluator
from app.infrastructure.jobs.inline_job_dispatcher import InlineJobDispatcher
from app.infrastructure.moderation_gateway import NoOpModerationGateway
from app.infrastructure.observability.noop_audit_sink import NoOpAuditSink
from app.infrastructure.permission_gate import NoOpPermissionGate
from app.infrastructure.realtime.in_memory_connection_hub import InMemoryConnectionHub
from app.infrastructure.redis.presence_repository import RedisPresenceRepository
from app.infrastructure.redis.readiness_probe import RedisReadinessProbe
from app.infrastructure.redis.redis_event_bus import RedisEventBus
from app.infrastructure.redis.session_repository import RedisSessionRepository
from app.shared.config import Settings


@dataclass(slots=True)
class ApplicationContainer:
    settings: Settings
    redis: Redis
    presence_repository: RedisPresenceRepository
    session_repository: RedisSessionRepository
    chat_runtime_service: ChatRuntimeService
    create_anonymous_session: CreateAnonymousSessionUseCase
    readiness_check: ReadinessCheckUseCase
    online_user_count: OnlineUserCountUseCase
    bootstrap_connection: BootstrapConnectionUseCase
    update_profile: UpdateProfileUseCase
    enter_queue: EnterQueueUseCase
    try_match: TryMatchUseCase
    send_message: SendMessageUseCase
    set_typing: SetTypingUseCase
    disconnect_session: DisconnectSessionUseCase
    lookup_partner: LookupPartnerUseCase
    mark_disconnected: MarkDisconnectedUseCase
    expire_stale_sessions: ExpireStaleSessionsUseCase
    connection_hub: InMemoryConnectionHub


def build_container(*, settings: Settings, redis: Redis) -> ApplicationContainer:
    connection_hub = InMemoryConnectionHub()
    presence_repository = RedisPresenceRepository(redis)
    session_repository = RedisSessionRepository(redis, history_limit=20, default_name_prefix="Anonymous")
    permission_gate = NoOpPermissionGate()
    feature_flags = NoOpFeatureFlagEvaluator()
    moderation_gateway = NoOpModerationGateway()
    audit_sink = NoOpAuditSink()
    event_bus = RedisEventBus()
    job_dispatcher = InlineJobDispatcher()
    chat_runtime_service = ChatRuntimeService(
        session_repository,
        connection_hub,
        presence_repository,
        permission_gate,
        feature_flags,
        moderation_gateway,
        audit_sink,
        event_bus,
        job_dispatcher,
        reconnect_window_seconds=settings.reconnect_window_seconds,
    )

    return ApplicationContainer(
        settings=settings,
        redis=redis,
        presence_repository=presence_repository,
        session_repository=session_repository,
        chat_runtime_service=chat_runtime_service,
        create_anonymous_session=CreateAnonymousSessionUseCase(),
        readiness_check=ReadinessCheckUseCase(RedisReadinessProbe(redis)),
        online_user_count=OnlineUserCountUseCase(presence_repository),
        bootstrap_connection=BootstrapConnectionUseCase(chat_runtime_service),
        update_profile=UpdateProfileUseCase(chat_runtime_service),
        enter_queue=EnterQueueUseCase(chat_runtime_service),
        try_match=TryMatchUseCase(chat_runtime_service),
        send_message=SendMessageUseCase(chat_runtime_service),
        set_typing=SetTypingUseCase(chat_runtime_service),
        disconnect_session=DisconnectSessionUseCase(chat_runtime_service),
        lookup_partner=LookupPartnerUseCase(chat_runtime_service),
        mark_disconnected=MarkDisconnectedUseCase(chat_runtime_service),
        expire_stale_sessions=ExpireStaleSessionsUseCase(chat_runtime_service),
        connection_hub=connection_hub,
    )
