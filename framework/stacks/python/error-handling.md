# Error Handling Patterns

Structured error handling for Python applications with FastAPI, custom exceptions, and observability.

---

## Philosophy

- **Fail fast**: Validate inputs early, raise immediately on invalid state
- **Typed exceptions**: Custom hierarchy over generic `Exception`
- **Centralized handling**: Exception handlers at API boundary, not scattered try/except
- **Structured logging**: Machine-readable logs with context, not print statements
- **User-safe messages**: Never expose stack traces or internal details to clients

---

## Custom Exception Hierarchy

### Base Exceptions

```python
# app/exceptions.py
from typing import Any


class AppError(Exception):
    """Base exception for all application errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class NotFoundError(AppError):
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            message=f"{resource} not found: {identifier}",
            code="NOT_FOUND",
            status_code=404,
            details={"resource": resource, "identifier": identifier},
        )


class ConflictError(AppError):
    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(message=message, code="CONFLICT", status_code=409, details=details)


class ValidationError(AppError):
    def __init__(self, message: str, field_errors: dict[str, str] | None = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=422,
            details={"field_errors": field_errors or {}},
        )


class AuthenticationError(AppError):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(message=message, code="UNAUTHENTICATED", status_code=401)


class AuthorizationError(AppError):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message=message, code="FORBIDDEN", status_code=403)


class ExternalServiceError(AppError):
    def __init__(self, service: str, message: str):
        super().__init__(
            message=f"External service error ({service}): {message}",
            code="EXTERNAL_SERVICE_ERROR",
            status_code=502,
            details={"service": service},
        )
```

### Usage in Services

```python
class UserService:
    async def get_user(self, user_id: int) -> User:
        user = await self.repo.get(user_id)
        if user is None:
            raise NotFoundError("User", str(user_id))
        return user

    async def create_user(self, data: CreateUserRequest) -> User:
        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise ConflictError(
                "Email already registered",
                details={"email": data.email},
            )
        return await self.repo.save(User(**data.model_dump()))
```

---

## FastAPI Exception Handlers

### Centralized Handler Registration

```python
# app/middleware/error_handler.py
import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError

from app.exceptions import AppError

logger = structlog.get_logger()


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        logger.warning(
            "app_error",
            code=exc.code,
            message=exc.message,
            status_code=exc.status_code,
            path=request.url.path,
            **exc.details,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                },
            },
        )

    @app.exception_handler(PydanticValidationError)
    async def pydantic_error_handler(
        request: Request, exc: PydanticValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": {"errors": exc.errors()},
                },
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "unhandled_error",
            path=request.url.path,
            method=request.method,
            error=str(exc),
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                },
            },
        )
```

### Registration in App

```python
# app/main.py
from app.middleware.error_handler import register_error_handlers

app = FastAPI()
register_error_handlers(app)
```

---

## Structured Error Response

### Consistent Format

All error responses follow the same structure:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found: 42",
    "details": {
      "resource": "User",
      "identifier": "42"
    }
  }
}
```

### Error Response Schema

```python
# app/schemas/error.py
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
```

Use in OpenAPI docs:

```python
@router.get(
    "/users/{user_id}",
    responses={
        404: {"model": ErrorResponse, "description": "User not found"},
    },
)
async def get_user(user_id: int) -> UserResponse:
    ...
```

---

## Fail-Fast Validation

### Early Returns

```python
async def publish_post(self, post_id: int, user: User) -> Post:
    post = await self.repo.get(post_id)
    if post is None:
        raise NotFoundError("Post", str(post_id))
    if post.user_id != user.id:
        raise AuthorizationError("Cannot publish another user's post")
    if post.status == "published":
        raise ConflictError("Post is already published")
    if not post.title or not post.body:
        raise ValidationError("Post must have title and body to publish")

    post.status = "published"
    post.published_at = datetime.now(timezone.utc)
    await self.repo.save(post)
    return post
```

### Guard Clauses in Utilities

```python
def parse_pagination(page: int, per_page: int) -> tuple[int, int]:
    if page < 1:
        raise ValidationError("Page must be >= 1", field_errors={"page": "Must be positive"})
    if per_page < 1 or per_page > 100:
        raise ValidationError(
            "per_page must be between 1 and 100",
            field_errors={"per_page": "Must be 1-100"},
        )
    return page, per_page
```

---

## Retry Strategies with tenacity

### External Service Calls

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
import httpx


class PaymentClient:
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError)),
        reraise=True,
    )
    async def charge(self, amount_cents: int, token: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.payments.example.com/charges",
                json={"amount": amount_cents, "token": token},
            )
            response.raise_for_status()
            return response.json()
```

### Custom Retry with Logging

```python
from tenacity import before_sleep_log, after_log
import logging

logger = logging.getLogger(__name__)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    after=after_log(logger, logging.INFO),
)
async def fetch_external_data(url: str) -> dict:
    ...
```

### When NOT to Retry

| Scenario | Retry? | Reason |
|---|---|---|
| Network timeout | Yes | Transient failure |
| 5xx server error | Yes | Server may recover |
| 4xx client error | No | Request is wrong, retrying won't help |
| Authentication failure | No | Credentials are invalid |
| Validation error | No | Input is invalid |
| Database constraint violation | No | Data conflict, not transient |

---

## Structured Logging with structlog

### Configuration

```python
# app/logging_config.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),  # JSON in production
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)
```

### Logging with Context

```python
import structlog

logger = structlog.get_logger()

async def create_order(self, user_id: int, items: list[dict]) -> Order:
    log = logger.bind(user_id=user_id, item_count=len(items))
    log.info("creating_order")

    try:
        order = await self._build_order(user_id, items)
        log.info("order_created", order_id=order.id, total=order.total_cents)
        return order
    except ExternalServiceError:
        log.error("order_creation_failed", reason="payment_service_unavailable")
        raise
```

### Request Context Middleware

```python
import uuid
import structlog
from starlette.middleware.base import BaseHTTPMiddleware

class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
```

---

## Error Context Propagation

### Chaining Exceptions

```python
try:
    result = await external_client.fetch(resource_id)
except httpx.HTTPError as exc:
    raise ExternalServiceError("resource-api", str(exc)) from exc
```

The `from exc` preserves the original traceback for debugging while presenting a clean error to the caller.

### Adding Context to Errors

```python
async def process_batch(items: list[dict]) -> list[Result]:
    results = []
    for i, item in enumerate(items):
        try:
            result = await process_item(item)
            results.append(result)
        except AppError as exc:
            exc.details["batch_index"] = i
            exc.details["item_id"] = item.get("id")
            raise
    return results
```

---

## Result Pattern (Alternative to Exceptions)

### For Expected Failures

```python
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")

@dataclass(frozen=True)
class Ok(Generic[T]):
    value: T
    is_ok: bool = True

@dataclass(frozen=True)
class Err:
    error: str
    code: str = "ERROR"
    is_ok: bool = False

type Result[T] = Ok[T] | Err
```

### Usage

```python
async def create_user(self, data: CreateUserRequest) -> Result[User]:
    existing = await self.repo.get_by_email(data.email)
    if existing:
        return Err("Email already registered", code="DUPLICATE_EMAIL")

    user = User(**data.model_dump())
    await self.repo.save(user)
    return Ok(user)

# Caller
result = await service.create_user(data)
if result.is_ok:
    return UserResponse.model_validate(result.value)
else:
    raise ConflictError(result.error)
```

### When to Use Each

| Pattern | Use Case |
|---|---|
| Exceptions | Unexpected failures, infrastructure errors, auth failures |
| Result | Expected business logic outcomes (duplicate email, insufficient funds) |

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Bare `except:` | Catches `SystemExit`, `KeyboardInterrupt` | Catch specific exceptions |
| `except Exception: pass` | Silently swallows errors | Log and re-raise or handle |
| Returning error strings | No type safety, easy to ignore | Use Result type or raise |
| Stack traces in API responses | Security risk, bad UX | Return error codes and messages |
| Try/except around every function | Hard to read, hides flow | Centralized handlers |
| Generic `HTTPException(500)` | No error classification | Use typed exception hierarchy |

---

_Errors are data. Classify them, log them with context, and present them consistently. Never swallow exceptions silently._
