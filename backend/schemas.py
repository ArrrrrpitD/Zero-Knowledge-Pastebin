from typing import Optional, List
from pydantic import BaseModel, Field


# ---- Chunk ----
class EncryptedChunk(BaseModel):
    iv: str
    ciphertext: str


# ---- Create ----
class CreateTextPaste(BaseModel):
    type: str = "text"
    iv: str
    ciphertext: str
    expiry_seconds: Optional[int] = Field(None, ge=1)
    burn_after_read: bool = False


class CreateFilePaste(BaseModel):
    type: str = "file"
    file_name: str = Field(..., max_length=255)
    mime_type: str = Field(..., max_length=127)
    total_size: int = Field(..., ge=1)
    chunks: List[EncryptedChunk]
    expiry_seconds: Optional[int] = Field(None, ge=1)
    burn_after_read: bool = False


# ---- Response ----
class PasteCreatedResponse(BaseModel):
    id: str


class TextPasteResponse(BaseModel):
    id: str
    type: str
    iv: str
    ciphertext: str
    burn_after_read: bool
    expires_at: Optional[int]


class FilePasteResponse(BaseModel):
    id: str
    type: str
    file_name: str
    mime_type: str
    total_size: int
    chunks: List[EncryptedChunk]
    burn_after_read: bool
    expires_at: Optional[int]
