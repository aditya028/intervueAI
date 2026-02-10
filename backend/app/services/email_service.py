"""Email OTP service: generate, store, verify OTPs and send via Gmail SMTP."""

import logging
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Redis client for OTP storage
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Get or create a Redis connection."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def generate_otp() -> str:
    """Generate a random 6-digit OTP."""
    return "".join(random.choices(string.digits, k=settings.OTP_LENGTH))


async def store_otp(email: str, otp: str) -> None:
    """Store OTP in Redis with TTL."""
    r = await get_redis()
    key = f"otp:{email.lower()}"
    await r.set(key, otp, ex=settings.OTP_EXPIRY_SECONDS)
    logger.info(f"OTP stored for {email} (expires in {settings.OTP_EXPIRY_SECONDS}s)")


async def verify_otp(email: str, otp: str) -> bool:
    """Verify OTP from Redis. Deletes on success."""
    r = await get_redis()
    key = f"otp:{email.lower()}"
    stored_otp = await r.get(key)

    if stored_otp is None:
        logger.warning(f"OTP expired or not found for {email}")
        return False

    if stored_otp != otp:
        logger.warning(f"Invalid OTP attempt for {email}")
        return False

    # OTP is valid — delete it
    await r.delete(key)
    logger.info(f"OTP verified successfully for {email}")
    return True


async def check_otp_rate_limit(email: str) -> bool:
    """Check if we can send another OTP (max 1 per 60 seconds)."""
    r = await get_redis()
    cooldown_key = f"otp_cooldown:{email.lower()}"
    exists = await r.exists(cooldown_key)
    return not exists


async def set_otp_cooldown(email: str) -> None:
    """Set a 60-second cooldown for resending OTP."""
    r = await get_redis()
    cooldown_key = f"otp_cooldown:{email.lower()}"
    await r.set(cooldown_key, "1", ex=60)


def send_otp_email(to_email: str, otp: str, user_name: str) -> bool:
    """Send OTP via Gmail SMTP. Returns True on success."""
    if not settings.SMTP_EMAIL or not settings.SMTP_PASSWORD:
        # Dev fallback: log OTP to console
        logger.warning(
            f"SMTP not configured. DEV MODE OTP for {to_email}: {otp}"
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"IntervueAI <{settings.SMTP_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = f"Your IntervueAI Verification Code: {otp}"

        html = f"""
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #7c3aed; font-size: 24px; margin: 0;">IntervueAI</h1>
            </div>
            <p style="color: #374151; font-size: 16px;">Hi {user_name},</p>
            <p style="color: #374151; font-size: 16px;">Use this code to verify your email address:</p>
            <div style="text-align: center; margin: 32px 0;">
                <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #3b82f6); color: white; font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px;">
                    {otp}
                </div>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes.</p>
            <p style="color: #6b7280; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">IntervueAI — AI-powered interview practice</p>
        </div>
        """

        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"OTP email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")
        return False
