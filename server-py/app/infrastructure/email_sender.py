from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from html import escape

import httpx

from app.shared.config import Settings

logger = logging.getLogger("app.email")


class FakeEmailSender:
    def __init__(self) -> None:
        self.sent_messages: list[dict[str, str]] = []

    async def send_verification_email(self, *, recipient: str, display_name: str, verification_link: str) -> None:
        self.sent_messages.append(
            {
                "type": "verification",
                "recipient": recipient,
                "display_name": display_name,
                "verification_link": verification_link,
            }
        )

    async def send_password_reset_email(self, *, recipient: str, display_name: str, reset_link: str) -> None:
        self.sent_messages.append(
            {
                "type": "password_reset",
                "recipient": recipient,
                "display_name": display_name,
                "reset_link": reset_link,
            }
        )


class MailpitSmtpEmailSender:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def send_verification_email(self, *, recipient: str, display_name: str, verification_link: str) -> None:
        await asyncio.to_thread(self._send_sync, "Verify your SKLinkChat account", recipient, display_name,
                                f"Open the link below to verify your account:\n{verification_link}")

    async def send_password_reset_email(self, *, recipient: str, display_name: str, reset_link: str) -> None:
        await asyncio.to_thread(self._send_sync, "Reset your SKLinkChat password", recipient, display_name,
                                f"Open the link below to reset your password:\n{reset_link}")

    def _send_sync(self, subject: str, recipient: str, display_name: str, body_text: str) -> None:
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self._settings.email_from
        message["To"] = recipient
        message.set_content(f"Hello {display_name},\n\n{body_text}\n")
        with smtplib.SMTP(self._settings.smtp_host, self._settings.smtp_port) as client:
            if self._settings.smtp_username and self._settings.smtp_password:
                client.login(self._settings.smtp_username, self._settings.smtp_password)
            client.send_message(message)


class ResendEmailSender:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def send_verification_email(self, *, recipient: str, display_name: str, verification_link: str) -> None:
        await self._send(
            "Verify your SKLinkChat account",
            recipient,
            display_name,
            html_body=f"<p><a href=\"{verification_link}\">Verify your account</a></p>",
            text_body=f"Open the link below to verify your account:\n{verification_link}",
        )

    async def send_password_reset_email(self, *, recipient: str, display_name: str, reset_link: str) -> None:
        await self._send(
            "Reset your SKLinkChat password",
            recipient,
            display_name,
            html_body=f"<p><a href=\"{reset_link}\">Reset your password</a></p>",
            text_body=f"Open the link below to reset your password:\n{reset_link}",
        )

    async def _send(
        self,
        subject: str,
        recipient: str,
        display_name: str,
        *,
        html_body: str,
        text_body: str,
    ) -> None:
        if not self._settings.resend_api_key:
            raise RuntimeError("SERVER_PY_RESEND_API_KEY is required for resend email provider")

        try:
            async with httpx.AsyncClient(base_url=self._settings.resend_base_url, timeout=10.0) as client:
                response = await client.post(
                    "/emails",
                    headers={"Authorization": f"Bearer {self._settings.resend_api_key}"},
                    json={
                        "from": self._settings.email_from,
                        "to": [recipient],
                        "subject": subject,
                        "html": f"<p>Hello {escape(display_name)},</p>{html_body}",
                        "text": f"Hello {display_name},\n\n{text_body}\n",
                    },
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as error:
            logger.error(
                "resend email request failed",
                extra={
                    "provider": "resend",
                    "status_code": error.response.status_code,
                    "recipient": recipient,
                    "subject": subject,
                },
            )
            raise RuntimeError("Resend email request failed") from error
        except httpx.HTTPError as error:
            logger.exception(
                "resend email transport failed",
                extra={"provider": "resend", "recipient": recipient, "subject": subject},
            )
            raise RuntimeError("Resend email transport failed") from error


def build_email_sender(settings: Settings):
    if settings.email_provider == "mailpit":
        logger.warning("using deprecated mailpit email sender", extra={"provider": "mailpit"})
        return MailpitSmtpEmailSender(settings)
    if settings.email_provider == "resend":
        logger.info("using resend email sender", extra={"provider": "resend"})
        return ResendEmailSender(settings)
    logger.info("using fake email sender", extra={"provider": "fake"})
    return FakeEmailSender()
