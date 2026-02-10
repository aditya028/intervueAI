"""Redis-based sliding window rate limiter."""

import logging
import time
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy Redis connection
_redis_client = None


async def get_redis():
    """Get or create async Redis client."""
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
            )
            # Test connection
            await _redis_client.ping()
            logger.info("Redis connected for rate limiting")
        except Exception as e:
            logger.warning(f"Redis not available for rate limiting: {e}")
            _redis_client = None
    return _redis_client


async def check_rate_limit(
    user_id: str,
    action: str,
    max_requests: int,
    window_seconds: int,
):
    """Check and enforce rate limit using Redis sliding window.

    Args:
        user_id: The user's ID
        action: Action name (e.g., "create_interview", "chat")
        max_requests: Maximum requests allowed in the window
        window_seconds: Time window in seconds

    Raises:
        HTTPException 429 if rate limit exceeded
    """
    redis = await get_redis()

    # If Redis is not available, skip rate limiting (fail open for MVP)
    if redis is None:
        return

    key = f"rate_limit:{user_id}:{action}"
    now = time.time()
    window_start = now - window_seconds

    try:
        pipe = redis.pipeline()
        # Remove expired entries
        pipe.zremrangebyscore(key, 0, window_start)
        # Count requests in current window
        pipe.zcard(key)
        # Add current request
        pipe.zadd(key, {str(now): now})
        # Set expiry on the key
        pipe.expire(key, window_seconds + 10)
        results = await pipe.execute()

        request_count = results[1]

        if request_count >= max_requests:
            # Calculate retry-after
            oldest_entries = await redis.zrange(key, 0, 0, withscores=True)
            retry_after = int(window_seconds - (now - oldest_entries[0][1])) + 1 if oldest_entries else window_seconds

            logger.warning(
                f"Rate limit exceeded: user={user_id} action={action} "
                f"count={request_count}/{max_requests} window={window_seconds}s"
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {max_requests} {action} requests per {window_seconds // 60} minute(s). Try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

    except HTTPException:
        raise
    except Exception as e:
        # If Redis errors out, fail open
        logger.error(f"Rate limit check failed: {e}")


# ---- Convenience functions for specific rate limits ----

async def check_interview_creation_limit(user_id: str):
    """5 interviews per hour per user."""
    await check_rate_limit(
        user_id=user_id,
        action="create_interview",
        max_requests=5,
        window_seconds=3600,  # 1 hour
    )


async def check_chat_limit(user_id: str):
    """60 chat messages per minute per user."""
    await check_rate_limit(
        user_id=user_id,
        action="chat",
        max_requests=60,
        window_seconds=60,  # 1 minute
    )
