import time
import uuid
import json
from typing import Annotated, Union

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database import get_db
from redis_client import get_redis
from models import Paste
from schemas import (
    CreateTextPaste,
    CreateFilePaste,
    PasteCreatedResponse,
    TextPasteResponse,
    FilePasteResponse,
    EncryptedChunk,
)

router = APIRouter(prefix="/api/pastes", tags=["pastes"])

PRESENCE_CHANNEL_PREFIX = "presence:"


@router.post("", response_model=PasteCreatedResponse, status_code=201)
async def create_paste(
    body: Union[CreateTextPaste, CreateFilePaste],
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    paste_id = str(uuid.uuid4())
    expires_at = int(time.time()) + body.expiry_seconds if body.expiry_seconds else None

    if body.type == "text":
        paste = Paste(
            id=paste_id,
            type="text",
            iv=body.iv,
            ciphertext=body.ciphertext,
            burn_after_read=body.burn_after_read,
            expires_at=expires_at,
        )
    elif body.type == "file":
        paste = Paste(
            id=paste_id,
            type="file",
            file_name=body.file_name,
            mime_type=body.mime_type,
            total_size=body.total_size,
            chunks=[c.model_dump() for c in body.chunks],
            burn_after_read=body.burn_after_read,
            expires_at=expires_at,
        )
    else:
        raise HTTPException(status_code=422, detail="Invalid paste type")

    db.add(paste)
    await db.commit()

    # If TTL-based expiry, set a Redis key as well (belt-and-suspenders)
    if body.expiry_seconds:
        await redis.set(f"paste:ttl:{paste_id}", "1", ex=body.expiry_seconds)

    return PasteCreatedResponse(id=paste_id)


@router.get("/{paste_id}", response_model=Union[TextPasteResponse, FilePasteResponse])
async def get_paste(
    paste_id: str,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    # Check Redis TTL key — if it's gone but paste exists, treat as expired
    ttl_exists = await redis.exists(f"paste:ttl:{paste_id}")

    result = await db.execute(select(Paste).where(Paste.id == paste_id))
    paste = result.scalar_one_or_none()

    if paste is None:
        raise HTTPException(status_code=404, detail="Paste not found")

    now = int(time.time())

    # Expiry check
    if paste.expires_at and now > paste.expires_at:
        # Clean up
        await db.delete(paste)
        await db.commit()
        raise HTTPException(status_code=410, detail="Paste has expired")

    # If paste had a TTL set but the Redis key is gone, it expired
    if paste.expires_at and not ttl_exists:
        await db.delete(paste)
        await db.commit()
        raise HTTPException(status_code=410, detail="Paste has expired")

    # Burn after read — atomically delete and broadcast
    if paste.burn_after_read:
        await db.delete(paste)
        await db.commit()
        # Broadcast burn event so other open viewers get notified
        await redis.publish(
            f"{PRESENCE_CHANNEL_PREFIX}{paste_id}",
            json.dumps({"type": "paste_burned"}),
        )

    # Build response
    if paste.type == "text":
        return TextPasteResponse(
            id=paste.id,
            type=paste.type,
            iv=paste.iv,
            ciphertext=paste.ciphertext,
            burn_after_read=paste.burn_after_read,
            expires_at=paste.expires_at,
        )
    else:
        chunks = [EncryptedChunk(**c) for c in (paste.chunks or [])]
        return FilePasteResponse(
            id=paste.id,
            type=paste.type,
            file_name=paste.file_name,
            mime_type=paste.mime_type,
            total_size=paste.total_size,
            chunks=chunks,
            burn_after_read=paste.burn_after_read,
            expires_at=paste.expires_at,
        )
