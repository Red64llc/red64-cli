# Python Conventions

Project memory for modern Python 3.12+ patterns and conventions.

---

## Language Stack

### Core Technologies
- **Python 3.12+** with modern typing features
- **uv**: Fast package management and virtual environments
- **Pydantic v2**: Data validation and settings management
- **asyncio**: Native async/await for concurrent operations
- **structlog**: Structured logging

---

## Type System

### Modern Typing (Python 3.12+)

Use built-in generics and the new `type` statement:

```python
# Pattern: Modern type aliases (3.12+)
type UserId = int
type Result[T] = T | None
type Handler = Callable[[Request], Awaitable[Response]]

# Pattern: Built-in generics (3.10+), no imports needed
def get_items(ids: list[int]) -> dict[str, Item]:
    ...

# Pattern: Union with pipe operator (3.10+)
def find_user(key: str | int) -> User | None:
    ...
```

### Protocols Over ABCs

Prefer `Protocol` for structural subtyping:

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Repository(Protocol):
    async def get(self, id: str) -> dict: ...
    async def save(self, entity: dict) -> None: ...

# Any class with matching methods satisfies the protocol
class PostgresRepository:
    async def get(self, id: str) -> dict:
        ...
    async def save(self, entity: dict) -> None:
        ...
```

---

## Data Modeling

### Pydantic for External Data

Use Pydantic models for API boundaries, config, and validation:

```python
from pydantic import BaseModel, Field, field_validator

class CreateUserRequest(BaseModel):
    email: str = Field(..., pattern=r"^[\w.+-]+@[\w-]+\.[\w.]+$")
    name: str = Field(..., min_length=1, max_length=100)
    role: str = "member"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("admin", "member", "viewer"):
            raise ValueError(f"Invalid role: {v}")
        return v
```

### Dataclasses for Internal Data

Use `dataclass` for simple internal value objects:

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass(frozen=True, slots=True)
class AuditEntry:
    action: str
    user_id: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
```

---

## Async Patterns

### Async Service Pattern

```python
import asyncio

class ContentService:
    def __init__(self, repo: Repository, cache: CacheClient) -> None:
        self._repo = repo
        self._cache = cache

    async def get_content(self, content_id: str) -> Content:
        cached = await self._cache.get(f"content:{content_id}")
        if cached:
            return Content.model_validate_json(cached)
        content = await self._repo.get(content_id)
        await self._cache.set(f"content:{content_id}", content.model_dump_json())
        return content
```

### Concurrency with gather

```python
# Pattern: Parallel async operations
async def enrich_sources(sources: list[Source]) -> list[EnrichedSource]:
    tasks = [enrich_single(s) for s in sources]
    return await asyncio.gather(*tasks, return_exceptions=True)
```

### Async Context Managers

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

@asynccontextmanager
async def db_session() -> AsyncIterator[AsyncSession]:
    session = AsyncSession(engine)
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
```

---

## Error Handling

### Exception Hierarchy

```python
# Pattern: Domain-specific exception hierarchy
class AppError(Exception):
    """Base application error."""
    def __init__(self, message: str, code: str = "INTERNAL_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(message)

class NotFoundError(AppError):
    def __init__(self, resource: str, id: str) -> None:
        super().__init__(f"{resource} {id} not found", code="NOT_FOUND")

class ValidationError(AppError):
    def __init__(self, details: list[str]) -> None:
        self.details = details
        super().__init__("; ".join(details), code="VALIDATION_ERROR")

class ExternalServiceError(AppError):
    def __init__(self, service: str, message: str) -> None:
        super().__init__(f"{service}: {message}", code="EXTERNAL_ERROR")
```

---

## Result Pattern

```python
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")

@dataclass(frozen=True)
class Result(Generic[T]):
    value: T | None = None
    error: str | None = None

    @property
    def is_ok(self) -> bool:
        return self.error is None

    @classmethod
    def ok(cls, value: T) -> "Result[T]":
        return cls(value=value)

    @classmethod
    def fail(cls, error: str) -> "Result[T]":
        return cls(error=error)
```

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Modules | snake_case | `user_service.py`, `auth_middleware.py` |
| Classes | PascalCase | `UserService`, `CreateUserRequest` |
| Functions | snake_case | `get_user_by_email()` |
| Constants | UPPER_SNAKE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Type aliases | PascalCase | `type UserId = int` |
| Private | Leading underscore | `_validate_input()`, `_cache` |
| Protocols | PascalCase, noun | `Repository`, `EventPublisher` |

---

## Code Style Principles

1. **Explicit over implicit**: Type all function signatures
2. **Composition over inheritance**: Prefer protocols and dependency injection
3. **Immutable by default**: Use `frozen=True` dataclasses, avoid mutation
4. **Fail fast**: Validate at boundaries, propagate errors clearly
5. **Flat is better**: Avoid deep nesting; use early returns and guard clauses

---

_Document patterns, not every function. Code should be typed, testable, and explicit._
