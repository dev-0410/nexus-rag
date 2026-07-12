import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

_NONCE_SIZE = 12


def _get_key() -> bytes:
    key = base64.urlsafe_b64decode(settings.encryption_key)
    if len(key) not in (16, 24, 32):
        raise ValueError("ENCRYPTION_KEY must decode to 16, 24, or 32 bytes")
    return key


def encrypt(plaintext: str) -> str:
    aesgcm = AESGCM(_get_key())
    nonce = os.urandom(_NONCE_SIZE)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode()


def decrypt(token: str) -> str:
    raw = base64.urlsafe_b64decode(token)
    nonce, ciphertext = raw[:_NONCE_SIZE], raw[_NONCE_SIZE:]
    aesgcm = AESGCM(_get_key())
    return aesgcm.decrypt(nonce, ciphertext, None).decode()


def mask(plaintext_key: str) -> str:
    if len(plaintext_key) <= 8:
        return "*" * len(plaintext_key)
    return f"{plaintext_key[:4]}{'*' * (len(plaintext_key) - 8)}{plaintext_key[-4:]}"
