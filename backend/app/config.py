from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./smm.db"
    secret_encryption_key: str = ""
    jwt_secret: str = "change-me"
    scheduler_interval_seconds: int = 30

    # Instagram OAuth (бесплатно). Новый флоу «Instagram API with Instagram Login».
    # Берётся из приложения: Instagram → API setup with Instagram login.
    instagram_app_id: str = ""
    instagram_app_secret: str = ""
    # Старые поля Facebook-app оставлены для совместимости (не используются в новом флоу)
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_redirect_uri: str = "http://localhost:8000/api/instagram/oauth/callback"
    frontend_url: str = "http://localhost:5173"
    # Публичный адрес, по которому Instagram/Telegram могут скачать наши медиа
    # (в деве — https-туннель cloudflared, на проде — домен). Без него IG не
    # может забрать картинку/видео с localhost.
    public_base_url: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
