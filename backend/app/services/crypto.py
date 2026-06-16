"""Шифрование креденшелов соц-аккаунтов перед записью в БД.

Мы НЕ храним пароли пользователей. Здесь шифруются только токены/сессии,
которые сам пользователь выдал нам для постинга (bot-токен, Graph-токен).
"""

import json

from cryptography.fernet import Fernet

from ..config import get_settings

_settings = get_settings()


def _fernet() -> Fernet:
    key = _settings.secret_encryption_key
    if not key:
        raise RuntimeError(
            "SECRET_ENCRYPTION_KEY не задан. Сгенерируй: "
            'python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    return Fernet(key.encode())


def encrypt_credentials(data: dict) -> str:
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt_credentials(token: str) -> dict:
    return json.loads(_fernet().decrypt(token.encode()).decode())
