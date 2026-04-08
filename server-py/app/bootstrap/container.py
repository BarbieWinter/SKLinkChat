from __future__ import annotations

from dataclasses import dataclass

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.application.account.service import AccountService
from app.application.admin.service import AdminGovernanceService
from app.application.auth.service import AuthService
from app.application.chat.access_service import ChatAccessService
from app.application.chat.report_service import ChatReportService
from app.application.chat.runtime_service import ChatRuntimeService
from app.application.chat.use_cases import (
    BootstrapConnectionUseCase,
    DisconnectSessionUseCase,
    EnterQueueUseCase,
    ExpireStaleSessionsUseCase,
    LookupPartnerUseCase,
    MarkDisconnectedUseCase,
    RevokeChatSessionUseCase,
    SendMessageUseCase,
    SetTypingUseCase,
    SubmitChatReportUseCase,
    TryMatchUseCase,
    UpdateProfileUseCase,
)
from app.application.platform.use_cases import (
    AuthorizeChatSessionUseCase,
    CreateChatSessionUseCase,
    GetAccountProfileUseCase,
    OnlineUserCountUseCase,
    ReadinessCheckUseCase,
    ResolveAuthSessionUseCase,
    UpdateAccountProfileUseCase,
)
from app.application.retention.service import RetentionService
from app.infrastructure.email_sender import build_email_sender
from app.infrastructure.feature_flags import NoOpFeatureFlagEvaluator
from app.infrastructure.geetest_verifier import build_geetest_verifier
from app.infrastructure.jobs.inline_job_dispatcher import InlineJobDispatcher
from app.infrastructure.moderation_gateway import NoOpModerationGateway
from app.infrastructure.observability.database_audit_sink import DatabaseAuditSink
from app.infrastructure.permission_gate import VerifiedChatPermissionGate
from app.infrastructure.postgres.readiness_probe import DatabaseReadinessProbe
from app.infrastructure.postgres.repositories import (
    AccountRepository,
    AdminGovernanceRepository,
    AuditEventRepository,
    AuthSessionRepository,
    DurableChatRepositoryImpl,
    EmailVerificationTokenRepository,
    PasswordResetTokenRepository,
    RiskEventRepository,
)
from app.infrastructure.readiness_probe import CompositeReadinessProbe
from app.infrastructure.realtime.in_memory_connection_hub import InMemoryConnectionHub
from app.infrastructure.redis.presence_repository import RedisPresenceRepository
from app.infrastructure.redis.readiness_probe import RedisReadinessProbe
from app.infrastructure.redis.redis_event_bus import RedisEventBus
from app.infrastructure.redis.session_repository import RedisSessionRepository
from app.infrastructure.stack_auth_client import StackAuthClient
from app.shared.config import Settings


@dataclass(slots=True)
class ApplicationContainer:
    settings: Settings
    redis: Redis
    session_factory: async_sessionmaker[AsyncSession]
    presence_repository: RedisPresenceRepository
    session_repository: RedisSessionRepository
    account_repository: AccountRepository
    auth_service: AuthService
    account_service: AccountService
    admin_governance_service: AdminGovernanceService
    chat_access_service: ChatAccessService
    retention_service: RetentionService
    chat_runtime_service: ChatRuntimeService
    create_chat_session: CreateChatSessionUseCase
    resolve_auth_session: ResolveAuthSessionUseCase
    authorize_chat_session: AuthorizeChatSessionUseCase
    get_account_profile: GetAccountProfileUseCase
    update_account_profile: UpdateAccountProfileUseCase
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
    revoke_chat_session: RevokeChatSessionUseCase
    submit_chat_report: SubmitChatReportUseCase
    connection_hub: InMemoryConnectionHub


def build_container(
    *,
    settings: Settings,
    redis: Redis,
    session_factory: async_sessionmaker[AsyncSession],
) -> ApplicationContainer:
    connection_hub = InMemoryConnectionHub()
    presence_repository = RedisPresenceRepository(redis)
    session_repository = RedisSessionRepository(redis, history_limit=20, default_name_prefix="Anonymous")

    account_repository = AccountRepository(session_factory)
    auth_session_repository = AuthSessionRepository(session_factory)
    verification_token_repository = EmailVerificationTokenRepository(session_factory)
    password_reset_token_repository = PasswordResetTokenRepository(session_factory)
    risk_event_repository = RiskEventRepository(
        session_factory,
        retention_seconds=settings.registration_risk_retention_seconds,
    )
    durable_chat_repository = DurableChatRepositoryImpl(
        session_factory,
        chat_message_ttl_seconds=settings.chat_message_ttl_seconds,
    )
    audit_event_repository = AuditEventRepository(
        session_factory,
        retention_seconds=settings.audit_event_retention_seconds,
    )
    admin_governance_repository = AdminGovernanceRepository(session_factory)

    auth_service = AuthService(
        account_repository=account_repository,
        auth_session_repository=auth_session_repository,
        verification_token_repository=verification_token_repository,
        password_reset_token_repository=password_reset_token_repository,
        risk_event_recorder=risk_event_repository,
        email_sender=build_email_sender(settings),
        geetest_verifier=build_geetest_verifier(settings),
        verification_token_ttl_seconds=settings.verification_token_ttl_seconds,
        auth_session_ttl_seconds=settings.auth_session_ttl_seconds,
        verification_resend_cooldown_seconds=settings.verification_resend_cooldown_seconds,
        verification_resend_hourly_limit=settings.verification_resend_hourly_limit,
        password_reset_token_ttl_seconds=settings.password_reset_token_ttl_seconds,
        password_reset_resend_cooldown_seconds=settings.password_reset_resend_cooldown_seconds,
        password_reset_hourly_limit=settings.password_reset_hourly_limit,
        app_base_url=settings.app_base_url,
        stack_auth_enabled=settings.stack_auth_enabled,
        stack_auth_client=(
            StackAuthClient(
                project_id=settings.stack_project_id,
                secret_server_key=settings.stack_secret_server_key,
                api_base_url=settings.stack_api_base_url,
            )
            if settings.stack_auth_enabled and settings.stack_project_id and settings.stack_secret_server_key
            else None
        ),
    )
    account_service = AccountService(account_repository)
    admin_governance_service = AdminGovernanceService(
        account_repository=account_repository,
        admin_repository=admin_governance_repository,
        audit_event_repository=audit_event_repository,
        durable_chat_repository=durable_chat_repository,
    )
    chat_access_service = ChatAccessService(
        account_repository=account_repository,
        durable_chat_repository=durable_chat_repository,
    )
    chat_report_service = ChatReportService(
        chat_access_service=chat_access_service,
        durable_chat_repository=durable_chat_repository,
    )

    permission_gate = VerifiedChatPermissionGate(durable_chat_repository)
    feature_flags = NoOpFeatureFlagEvaluator()
    moderation_gateway = NoOpModerationGateway()
    audit_sink = DatabaseAuditSink(audit_event_repository)
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
        durable_chat_repository,
        reconnect_window_seconds=settings.reconnect_window_seconds,
    )
    retention_service = RetentionService(
        auth_session_repository=auth_session_repository,
        verification_token_repository=verification_token_repository,
        password_reset_token_repository=password_reset_token_repository,
        durable_chat_repository=durable_chat_repository,
        risk_event_repository=risk_event_repository,
        audit_event_repository=audit_event_repository,
    )

    return ApplicationContainer(
        settings=settings,
        redis=redis,
        session_factory=session_factory,
        presence_repository=presence_repository,
        session_repository=session_repository,
        account_repository=account_repository,
        auth_service=auth_service,
        account_service=account_service,
        admin_governance_service=admin_governance_service,
        chat_access_service=chat_access_service,
        retention_service=retention_service,
        chat_runtime_service=chat_runtime_service,
        create_chat_session=CreateChatSessionUseCase(chat_access_service),
        resolve_auth_session=ResolveAuthSessionUseCase(auth_service),
        authorize_chat_session=AuthorizeChatSessionUseCase(chat_access_service),
        get_account_profile=GetAccountProfileUseCase(account_service),
        update_account_profile=UpdateAccountProfileUseCase(account_service),
        readiness_check=ReadinessCheckUseCase(
            CompositeReadinessProbe(RedisReadinessProbe(redis), DatabaseReadinessProbe(session_factory))
        ),
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
        revoke_chat_session=RevokeChatSessionUseCase(chat_runtime_service),
        submit_chat_report=SubmitChatReportUseCase(chat_report_service),
        connection_hub=connection_hub,
    )
