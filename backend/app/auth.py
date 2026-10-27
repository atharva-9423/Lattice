import secrets
from typing import Dict, Optional
from fastapi import Header, HTTPException
from .schemas import UserInfo

TOKENS: Dict[str, UserInfo] = {}


def create_session(user: UserInfo) -> str:
    token = secrets.token_hex(24)
    TOKENS[token] = user
    return token


def get_current_user(authorization: Optional[str] = Header(default=None)) -> UserInfo:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split(" ", 1)[1].strip()
    user = TOKENS.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user
