import redis.asyncio as aioredis
from config import settings

_redis = None


async def get_redis():
    global _redis
    if _redis is None:
        if settings.DEV_MODE:
            # fakeredis — full in-memory Redis compatible implementation
            # Works for TTLs, pub/sub, and all commands we use
            import fakeredis.aioredis as fakeredis_async
            _redis = fakeredis_async.FakeRedis(decode_responses=True)
        else:
            _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def close_redis():
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None
