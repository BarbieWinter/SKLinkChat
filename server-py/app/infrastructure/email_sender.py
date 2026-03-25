from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.shared.config import Settings

logger = logging.getLogger("app.email")


class FakeEmailSender:
    def __init__(self) -> None:
        self.sent_messages: list[dict[str, str]] = []

    async def send_verification_email(self, *, recipient: str, display_name: str, verification_link: str) -> None:
        self.sent_messages.append(
            {
                "recipient": recipient,
                "display_name": display_name,
                "verification_link": verification_link,
            }
        )


class MailpitSmtpEmailSender:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def send_verification_email(self, *, recipient: str, display_name: str, verification_link: str) -> None:
        await asyncio.to_thread(self._send_sync, recipient, display_name, verification_link)

    def _send_sync(self, recipient: str, display_name: str, verification_link: str) -> None:
        message = EmailMessage()
        message["Subject"] = "Verify your SKLinkChat account"
        message["From"] = self._settings.email_from_address
        message["To"] = recipient
        message.set_content(
            f"Hello {display_name},\n\nOpen the link below to verify your account:\n{verification_link}\n"
        )
        with smtplib.SMTP(self._settings.smtp_host, self._settings.smtp_port) as client:
            if self._settings.smtp_username and self._settings.smtp_password:
                client.login(self._settings.smtp_username, self._settings.smtp_password)
            client.send_message(message)


class ResendEmailSender:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def send_verification_email(self, *, recipient: str, display_name: str, verification_link: str) -> None:
        if not self._settings.resend_api_key:
            raise RuntimeError("SERVER_PY_RESEND_API_KEY is required for resend email provider")

        async with httpx.AsyncClient(base_url=self._settings.resend_base_url, timeout=10.0) as client:
            response = await client.post(
                "/emails",
                headers={"Authorization": f"Bearer {self._settings.resend_api_key}"},
                json={
                    "from": self._settings.email_from_address,
                    "to": [recipient],
                    "subject": "Verify your SKLinkChat account",
                    "html": (
                        f"<p>Hello {display_name},</p>"
                        f"<p><a href=\"{verification_link}\">Verify your account</a></p>"
                    ),
                },
            )
            response.raise_for_status()


def build_email_sender(settings: Settings):
    if settings.email_provider == "mailpit":
        return MailpitSmtpEmailSender(settings)
    if settings.email_provider == "resend":
        return ResendEmailSender(settings)
    logger.info("using fake email sender", extra={"provider": "fake"})
    return FakeEmailSender()
