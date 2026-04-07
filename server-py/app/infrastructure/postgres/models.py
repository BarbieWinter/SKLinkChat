from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.postgres.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class Account(Base, TimestampMixin):
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("display_name", name="uq_accounts_display_name"),
        Index("ux_accounts_short_id", "short_id", unique=True),
        CheckConstraint(
            "((chat_access_restricted_at IS NULL "
            "AND chat_access_restriction_reason IS NULL "
            "AND chat_access_restriction_report_id IS NULL) "
            "OR (chat_access_restricted_at IS NOT NULL "
            "AND chat_access_restriction_reason IS NOT NULL "
            "AND trim(chat_access_restriction_reason) <> ''))",
            name="ck_accounts_chat_access_restriction_consistency",
        ),
        CheckConstraint("gender IN ('male', 'female', 'unknown')", name="ck_accounts_gender"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    short_id: Mapped[str] = mapped_column(String(6), nullable=False)
    gender: Mapped[str] = mapped_column(String(16), nullable=False, default="unknown", server_default="unknown")
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    chat_access_restricted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    chat_access_restriction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    chat_access_restriction_report_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    interests: Mapped[list[AccountInterest]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class AccountInterest(Base):
    __tablename__ = "account_interests"
    __table_args__ = (UniqueConstraint("account_id", "interest", name="uq_account_interest"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    interest: Mapped[str] = mapped_column(String(80), nullable=False)

    account: Mapped[Account] = relationship(back_populates="interests")


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (Index("ix_auth_sessions_account_id_expires_at", "account_id", "expires_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"
    __table_args__ = (
        Index("ix_email_verification_tokens_account_id_created_at", "account_id", "created_at"),
        CheckConstraint(
            "NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL)",
            name="ck_email_verification_tokens_not_both_consumed_and_revoked",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    __table_args__ = (
        Index("ix_password_reset_tokens_account_id_created_at", "account_id", "created_at"),
        CheckConstraint(
            "NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL)",
            name="ck_password_reset_tokens_not_both_consumed_and_revoked",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class RegistrationRiskEvent(Base):
    __tablename__ = "registration_risk_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    outcome: Mapped[str] = mapped_column(String(80), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class ChatSessionRecord(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = (
        Index("ix_chat_sessions_account_id_created_at", "account_id", "created_at"),
        Index(
            "ux_chat_sessions_one_active_per_account",
            "account_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        CheckConstraint("status IN ('active', 'closed', 'expired')", name="ck_chat_sessions_status"),
        CheckConstraint("trim(display_name_snapshot) <> ''", name="ck_chat_sessions_display_name_nonempty"),
        CheckConstraint(
            "((status = 'active' AND closed_at IS NULL) "
            "OR (status IN ('closed', 'expired') AND closed_at IS NOT NULL))",
            name="ck_chat_sessions_closed_at_consistency",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    display_name_snapshot: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    close_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)


class ChatMatch(Base):
    __tablename__ = "chat_matches"
    __table_args__ = (
        Index("ix_chat_matches_left_chat_session_id_started_at", "left_chat_session_id", "started_at"),
        Index("ix_chat_matches_right_chat_session_id_started_at", "right_chat_session_id", "started_at"),
        Index("ix_chat_matches_started_at", "started_at"),
        Index(
            "ux_chat_matches_active_left",
            "left_chat_session_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
        ),
        Index(
            "ux_chat_matches_active_right",
            "right_chat_session_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
        ),
        CheckConstraint("left_chat_session_id <> right_chat_session_id", name="ck_chat_matches_distinct_sides"),
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ck_chat_matches_ended_after_started"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    left_chat_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    right_chat_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("ix_chat_messages_chat_match_id_created_at", "chat_match_id", "created_at"),
        Index("ix_chat_messages_sender_chat_session_id_created_at", "sender_chat_session_id", "created_at"),
        Index("ix_chat_messages_expires_at", "expires_at"),
        Index(
            "ux_chat_messages_match_client_message_id",
            "chat_match_id",
            "client_message_id",
            unique=True,
            postgresql_where=text("client_message_id IS NOT NULL"),
        ),
        CheckConstraint("message_type IN ('text', 'system')", name="ck_chat_messages_message_type"),
        CheckConstraint(
            "trim(sender_display_name_snapshot) <> ''",
            name="ck_chat_messages_sender_display_name_nonempty",
        ),
        CheckConstraint("trim(body) <> ''", name="ck_chat_messages_body_nonempty"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_match_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chat_matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_chat_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_message_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    message_type: Mapped[str] = mapped_column(String(16), nullable=False, default="text")
    sender_display_name_snapshot: Mapped[str] = mapped_column(String(80), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class ChatReport(Base):
    __tablename__ = "chat_reports"
    __table_args__ = (
        Index("ix_chat_reports_reporter_account_id_created_at", "reporter_account_id", "created_at"),
        Index("ix_chat_reports_chat_match_id_created_at", "chat_match_id", "created_at"),
        Index("ix_chat_reports_reported_chat_session_id_created_at", "reported_chat_session_id", "created_at"),
        Index("ix_chat_reports_status_created_at", "status", "created_at"),
        CheckConstraint(
            "reason IN ('harassment', 'sexual_content', 'spam', 'hate_speech', 'other')",
            name="ck_chat_reports_reason",
        ),
        CheckConstraint(
            "(reason <> 'other' OR (details IS NOT NULL AND trim(details) <> ''))",
            name="ck_chat_reports_other_requires_details",
        ),
        CheckConstraint("status IN ('open', 'reviewed', 'dismissed', 'actioned')", name="ck_chat_reports_status"),
        CheckConstraint(
            "((status = 'open' AND reviewed_at IS NULL AND reviewed_by_account_id IS NULL AND review_note IS NULL) "
            "OR (status IN ('reviewed', 'dismissed', 'actioned') "
            "AND reviewed_at IS NOT NULL "
            "AND reviewed_by_account_id IS NOT NULL "
            "AND review_note IS NOT NULL "
            "AND trim(review_note) <> ''))",
            name="ck_chat_reports_reviewed_at_consistency",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reporter_account_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    chat_match_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chat_matches.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reported_chat_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by_account_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_events_expires_at", "expires_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chat_session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
