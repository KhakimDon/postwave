import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile

from ..config import get_settings
from ..deps import get_current_user
from ..models import User

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
}
MAX_BYTES = 200 * 1024 * 1024  # 200 МБ — не режем качество видео/фото


@router.post("")
async def upload_file(
    request: Request,
    file: UploadFile,
    user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED:
        raise HTTPException(
            400, f"Неподдерживаемый формат: {file.content_type}. Разрешены фото и mp4."
        )

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "Файл больше 25 МБ")

    name = f"{uuid.uuid4().hex}{ALLOWED[file.content_type]}"
    (UPLOAD_DIR / name).write_bytes(data)

    # За ngrok/прокси TLS терминируется → request.base_url может прийти как http,
    # что ломает картинки на https-странице (mixed content). Поэтому предпочитаем
    # явный PUBLIC_BASE_URL (https), если задан.
    base = (get_settings().public_base_url or str(request.base_url)).rstrip("/")
    return {
        "url": f"{base}/media/{name}",
        "filename": name,
        "content_type": file.content_type,
    }
