import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from redis_client import get_redis

router = APIRouter(tags=["presence"])

PRESENCE_CHANNEL_PREFIX = "presence:"
PRESENCE_COUNT_PREFIX = "presence:count:"


@router.websocket("/ws/presence/{paste_id}")
async def presence_ws(paste_id: str, websocket: WebSocket):
    await websocket.accept()

    redis = await get_redis()
    count_key = f"{PRESENCE_COUNT_PREFIX}{paste_id}"
    channel = f"{PRESENCE_CHANNEL_PREFIX}{paste_id}"

    # Increment viewer count atomically
    count = await redis.incr(count_key)
    await redis.expire(count_key, 3600)  # auto-cleanup after 1h inactivity

    # Broadcast updated count to all subscribers on this channel
    await redis.publish(channel, json.dumps({"type": "presence_update", "count": count}))

    # Also send current count directly to this new client
    try:
        await websocket.send_text(json.dumps({"type": "presence_update", "count": count}))
    except Exception:
        pass

    # Subscribe to this paste's channel to relay server-side events (burns, etc.)
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)

    async def relay_messages():
        """Listen on Redis Pub/Sub and forward messages to this WebSocket client."""
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        await websocket.send_text(message["data"])
                    except Exception:
                        break
        except asyncio.CancelledError:
            pass

    relay_task = asyncio.create_task(relay_messages())

    try:
        # Keep connection alive — expect pings or just idle until client disconnects
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                # Send a keepalive ping
                try:
                    await websocket.send_text(json.dumps({"type": "ping"}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        relay_task.cancel()
        try:
            await pubsub.unsubscribe(channel)
        except Exception:
            pass
        try:
            # aclose() exists on real redis; fakeredis may only have close()
            if hasattr(pubsub, "aclose"):
                await pubsub.aclose()
            elif hasattr(pubsub, "close"):
                await pubsub.close()
        except Exception:
            pass

        # Decrement viewer count and broadcast
        new_count = await redis.decr(count_key)
        if new_count < 0:
            await redis.set(count_key, 0)
            new_count = 0
        try:
            await redis.publish(
                channel,
                json.dumps({"type": "presence_update", "count": new_count}),
            )
        except Exception:
            pass
