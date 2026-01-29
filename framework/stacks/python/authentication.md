# Authentication Patterns

Modern Python authentication using JWT, OAuth2, and session-based approaches.

---

## Philosophy

- **Stateless API auth**: JWT tokens for API consumers
- **OAuth2 flows**: Standards-based third-party auth
- **Secure defaults**: bcrypt hashing, httpOnly cookies, short-lived tokens
- **Separation of concerns**: Auth middleware, not scattered checks

---

## JWT Authentication (API)

### Token Generation

```python
# app/utils/auth.py
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.config import settings

ALGORITHM = "HS256"

def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict:
    """Decode and validate JWT token.

    Raises:
        JWTError: If token is invalid or expired.
    """
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
```

### Refresh Token Pattern

```python
def create_token_pair(user_id: int) -> dict:
    access = create_access_token(
        {"sub": str(user_id), "type": "access"},
        expires_delta=timedelta(minutes=15),
    )
    refresh = create_access_token(
        {"sub": str(user_id), "type": "refresh"},
        expires_delta=timedelta(days=7),
    )
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}
```

### FastAPI Dependency

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

# Usage in route
@router.get("/me")
async def get_profile(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
```

---

## Password Management

### Hashing with passlib + bcrypt

```python
# app/utils/hashing.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

### Login Endpoint

```python
@router.post("/auth/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user = await user_repo.get_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )
    return create_token_pair(user.id)
```

---

## OAuth2 with authlib

### Provider Setup

```python
# app/auth/oauth.py
from authlib.integrations.starlette_client import OAuth

oauth = OAuth()

oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

oauth.register(
    name="github",
    client_id=settings.github_client_id,
    client_secret=settings.github_client_secret,
    authorize_url="https://github.com/login/oauth/authorize",
    access_token_url="https://github.com/login/oauth/access_token",
    api_base_url="https://api.github.com/",
    client_kwargs={"scope": "user:email"},
)
```

### OAuth Flow Endpoints

```python
from starlette.requests import Request

@router.get("/auth/{provider}/login")
async def oauth_login(provider: str, request: Request):
    client = getattr(oauth, provider, None)
    if not client:
        raise HTTPException(404, f"Unknown provider: {provider}")
    redirect_uri = request.url_for("oauth_callback", provider=provider)
    return await client.authorize_redirect(request, redirect_uri)

@router.get("/auth/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    client = getattr(oauth, provider)
    token = await client.authorize_access_token(request)
    user_info = token.get("userinfo") or await client.userinfo(token=token)

    # Find or create user
    user = await find_or_create_oauth_user(
        db=db,
        provider=provider,
        provider_id=str(user_info["sub"]),
        email=user_info["email"],
        name=user_info.get("name", ""),
    )

    return create_token_pair(user.id)
```

---

## Session-Based Authentication

### Cookie Sessions (for web apps)

```python
from starlette.middleware.sessions import SessionMiddleware

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    max_age=86400,         # 24 hours
    https_only=True,       # Production only
    same_site="lax",
)

# Login: store user in session
@router.post("/login")
async def login(request: Request, form: LoginForm = Depends()):
    user = await authenticate_user(form.email, form.password)
    if not user:
        raise HTTPException(401)
    request.session["user_id"] = user.id
    return RedirectResponse("/dashboard", status_code=303)

# Middleware: load user from session
async def get_session_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    return await db.get(User, user_id)
```

---

## Authorization

### Role-Based Access Control

```python
from enum import StrEnum
from functools import wraps

class Role(StrEnum):
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"

def require_role(*roles: Role):
    """Dependency that checks user role."""
    async def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return checker

# Usage
@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(require_role(Role.ADMIN)),
):
    ...
```

### Resource Ownership

```python
# Pattern: Always scope queries to current user
async def get_user_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Content:
    content = await db.get(Content, content_id)
    if not content or content.user_id != current_user.id:
        raise HTTPException(status_code=404)
    return content
```

---

## Rate Limiting

```python
# Using slowapi
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, ...):
    ...

@router.post("/auth/reset-password")
@limiter.limit("3/minute")
async def reset_password(request: Request, ...):
    ...
```

---

## Security Checklist

- [x] Passwords hashed with bcrypt (passlib)
- [x] JWT tokens with short expiry (15 min access, 7 day refresh)
- [x] httpOnly cookies for session auth
- [x] Rate limiting on auth endpoints
- [x] CORS configured for allowed origins
- [ ] Account lockout after failed attempts (implement as needed)
- [ ] Email verification flow (implement as needed)
- [ ] MFA / TOTP support (implement as needed)

---

## Testing Auth

```python
# Fixture: authenticated client
@pytest.fixture
async def auth_client(client: httpx.AsyncClient, sample_user: User):
    token = create_access_token({"sub": str(sample_user.id)})
    client.headers["Authorization"] = f"Bearer {token}"
    return client

# Test protected endpoint
async def test_profile_requires_auth(client: httpx.AsyncClient):
    response = await client.get("/api/v1/me")
    assert response.status_code == 401

async def test_profile_with_auth(auth_client: httpx.AsyncClient):
    response = await auth_client.get("/api/v1/me")
    assert response.status_code == 200
    assert "email" in response.json()
```

---

_Document patterns and extension points, not implementation details._
