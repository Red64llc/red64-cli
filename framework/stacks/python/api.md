# API Design Standards

RESTful API conventions for FastAPI applications with consistent patterns for routing, responses, and documentation.

---

## Philosophy

- **Resource-oriented**: URLs represent resources, HTTP methods represent actions
- **Consistent responses**: Every endpoint follows the same response envelope
- **Self-documenting**: OpenAPI spec generated from code, not maintained separately
- **Dependency injection**: Auth, DB, and shared logic injected via FastAPI dependencies

---

## RESTful Conventions

### URL Structure

```
/api/v1/{resource}              # Collection
/api/v1/{resource}/{id}         # Single resource
/api/v1/{resource}/{id}/{sub}   # Nested resource (max 2 levels)
```

### HTTP Methods

| Method | URL | Action | Status Code |
|---|---|---|---|
| `GET` | `/users` | List users | 200 |
| `GET` | `/users/42` | Get single user | 200 |
| `POST` | `/users` | Create user | 201 |
| `PUT` | `/users/42` | Full replace | 200 |
| `PATCH` | `/users/42` | Partial update | 200 |
| `DELETE` | `/users/42` | Delete user | 204 |

### Naming Rules

- Plural nouns for resources: `/users`, `/posts`, `/comments`
- Lowercase with hyphens for multi-word: `/user-profiles`, `/api-keys`
- No verbs in URLs (use HTTP methods instead)
- No trailing slashes

```python
# GOOD
GET  /api/v1/users
POST /api/v1/users
GET  /api/v1/users/42/posts

# BAD
GET  /api/v1/getUsers
POST /api/v1/createUser
GET  /api/v1/user/42/getAllPosts
```

---

## Router Organization

### Feature-Based Routers

```python
# app/api/__init__.py
from fastapi import APIRouter
from app.api import users, posts, auth, health

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(posts.router, prefix="/posts", tags=["Posts"])
api_router.include_router(health.router, prefix="/health", tags=["Health"])
```

### Single Resource Router

```python
# app/api/users.py
from fastapi import APIRouter, Depends, status
from app.dependencies import get_db, get_current_user

router = APIRouter()


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ...


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int = Path(ge=1),
    db: AsyncSession = Depends(get_db),
):
    ...


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
):
    ...


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int = Path(ge=1),
    data: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ...


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int = Path(ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ...
```

---

## API Versioning

### URL Path Versioning (Recommended)

```python
# app/main.py
from app.api import api_router  # /api/v1/...

app = FastAPI(title="My API", version="1.0.0")
app.include_router(api_router)

# When v2 is needed:
# from app.api_v2 import api_router_v2  # /api/v2/...
# app.include_router(api_router_v2)
```

### Versioning Strategy

| Approach | Pros | Cons |
|---|---|---|
| URL path (`/api/v1/`) | Explicit, easy to route | URL changes on version bump |
| Header (`Accept-Version: 1`) | Clean URLs | Harder to test, less discoverable |
| Query param (`?version=1`) | Simple | Clutters query string |

**Decision**: Use URL path versioning. It is explicit and works with every HTTP client and caching layer.

---

## Pagination

### Cursor-Based (Default for Lists)

```python
from pydantic import BaseModel


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    has_next: bool
    next_cursor: str | None = None


@router.get("/posts", response_model=PaginatedResponse[PostResponse])
async def list_posts(
    cursor: str | None = Query(default=None, description="Pagination cursor"),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    posts, has_next, next_cursor = await post_service.list_posts(
        cursor=cursor, limit=limit,
    )
    return PaginatedResponse(
        items=[PostResponse.model_validate(p) for p in posts],
        has_next=has_next,
        next_cursor=next_cursor,
    )
```

### Offset-Based (Simple Admin UIs)

```python
class PagedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    per_page: int
    total_pages: int


@router.get("/admin/users", response_model=PagedResponse[UserResponse])
async def list_users_admin(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    users, total = await user_service.list_users_paged(page=page, per_page=per_page)
    return PagedResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page,
    )
```

### When to Use Each

| Type | Use Case |
|---|---|
| Cursor-based | Public APIs, infinite scroll, real-time data |
| Offset-based | Admin panels, dashboards, static lists |

---

## Filtering and Sorting

### Query Parameter Patterns

```python
@router.get("/posts", response_model=PaginatedResponse[PostResponse])
async def list_posts(
    status: str | None = Query(default=None, pattern="^(draft|published|archived)$"),
    author_id: int | None = Query(default=None, ge=1),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    sort: str = Query(default="-created_at", pattern="^-?(created_at|title|updated_at)$"),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    ...
```

### Sort Convention

- Prefix with `-` for descending: `-created_at`
- No prefix for ascending: `title`
- Validate against allowed fields to prevent SQL injection

---

## HTTP Status Codes

### Standard Responses

| Code | Meaning | When to Use |
|---|---|---|
| `200` | OK | Successful GET, PUT, PATCH |
| `201` | Created | Successful POST that creates a resource |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Malformed request syntax |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Authenticated but insufficient permissions |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Duplicate resource, state conflict |
| `422` | Unprocessable Entity | Validation errors (Pydantic default) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unhandled server error |
| `502` | Bad Gateway | External service failure |

---

## Response Envelope

### Success Response

```json
{
  "id": 42,
  "email": "user@example.com",
  "name": "Jane Doe",
  "created_at": "2024-01-15T10:30:00Z"
}
```

For single resources, return the object directly (no wrapping). FastAPI + Pydantic handles serialization.

### Collection Response

```json
{
  "items": [...],
  "has_next": true,
  "next_cursor": "eyJpZCI6IDQyfQ=="
}
```

### Error Response

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found: 42",
    "details": {"resource": "User", "identifier": "42"}
  }
}
```

---

## Rate Limiting

### Per-Endpoint Limits

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, data: LoginRequest):
    ...

@router.get("/search")
@limiter.limit("30/minute")
async def search(request: Request, q: str = Query(...)):
    ...
```

### Rate Limit Headers

Include in responses so clients can self-regulate:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1705312800
```

---

## Dependency Injection

### Common Dependencies

```python
# app/dependencies.py
from collections.abc import AsyncIterator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db() -> AsyncIterator[AsyncSession]:
    async with async_session() as session:
        yield session


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    ...


def require_role(*roles: str):
    async def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403)
        return user
    return dependency
```

### Service Injection Pattern

```python
async def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(repo=UserRepo(db))


@router.post("", status_code=201)
async def create_user(
    data: CreateUserRequest,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    user = await service.create_user(data)
    return UserResponse.model_validate(user)
```

---

## OpenAPI Documentation

### Customize FastAPI Docs

```python
app = FastAPI(
    title="My API",
    version="1.0.0",
    description="API for managing users and content",
    docs_url="/docs",         # Swagger UI
    redoc_url="/redoc",       # ReDoc
    openapi_url="/openapi.json",
)
```

### Document Endpoint Responses

```python
@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    description="Retrieve a single user by their unique identifier.",
    responses={
        404: {"model": ErrorResponse, "description": "User not found"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    },
)
async def get_user(user_id: int = Path(ge=1)) -> UserResponse:
    ...
```

---

## Health Check

```python
# app/api/health.py
from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def health():
    return {"status": "ok"}


@router.get("/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "database": "disconnected"},
        )
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Verbs in URLs | Not RESTful | Use HTTP methods |
| Inconsistent status codes | Confusing for clients | Follow the table above |
| No pagination | Unbounded responses | Always paginate collections |
| Business logic in routes | Hard to test | Inject services via dependencies |
| No API versioning | Breaking changes break clients | Version from day one |
| Returning `dict` | No validation, no docs | Use Pydantic response models |

---

_APIs are contracts. Be consistent, be explicit, and let the framework generate documentation from your code._
