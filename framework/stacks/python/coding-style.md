# Python Coding Style

Coding style conventions beyond what ruff enforces automatically. Opinionated patterns for readable, maintainable Python.

---

## Philosophy

- **Readability counts**: Code is read far more than written
- **Explicit over implicit**: No magic, no hidden behavior
- **Consistency over preference**: Follow the project convention, not personal style
- **Automate what you can**: Let ruff handle formatting; this doc covers judgment calls

---

## Naming Conventions

### Standard Python Naming

| Element | Convention | Example |
|---|---|---|
| Variables, functions | `snake_case` | `user_count`, `get_user` |
| Classes | `PascalCase` | `UserService`, `CreateUserRequest` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_PAGE_SIZE` |
| Modules, packages | `snake_case` | `user_service.py`, `auth_utils` |
| Private members | `_leading_underscore` | `_validate_email`, `_cache` |
| Type variables | `PascalCase` or `T` | `T`, `ModelT`, `ResponseT` |
| Enums | `PascalCase` class, `UPPER_SNAKE_CASE` values | `Role.ADMIN` |

### Naming Rules

```python
# GOOD: Descriptive, reveals intent
user_count = len(active_users)
is_authenticated = token is not None
max_retry_attempts = 3

async def get_active_users(db: AsyncSession) -> list[User]:
    ...

class PaymentProcessingError(AppError):
    ...

# BAD: Abbreviated, unclear
uc = len(au)
auth = token is not None
n = 3

async def get_au(db):
    ...
```

### Boolean Naming

Prefix with `is_`, `has_`, `can_`, `should_`:

```python
is_active: bool
has_permission: bool
can_publish: bool
should_notify: bool
```

---

## Function Design

### Size Limits

- **Target**: Under 20 lines of logic
- **Maximum**: 40 lines (extract if longer)
- **Parameters**: Maximum 5; use a Pydantic model for more

```python
# GOOD: Small, focused
async def create_user(self, data: CreateUserRequest) -> User:
    await self._check_email_available(data.email)
    user = User(
        email=data.email,
        name=data.name,
        hashed_password=hash_password(data.password),
    )
    return await self.repo.save(user)

async def _check_email_available(self, email: str) -> None:
    existing = await self.repo.get_by_email(email)
    if existing:
        raise ConflictError("Email already registered")
```

```python
# BAD: Too many responsibilities
async def create_user(self, email, name, password, role, bio, avatar_url, ...):
    # 60+ lines doing validation, hashing, saving, emailing, logging...
```

### Return Types

Always annotate return types for public functions:

```python
# GOOD
async def get_user(self, user_id: int) -> User:
    ...

async def find_user(self, email: str) -> User | None:
    ...

async def list_users(self) -> list[User]:
    ...

# BAD: Missing return type
async def get_user(self, user_id):
    ...
```

### Early Returns

Prefer guard clauses over nested conditionals:

```python
# GOOD: Guard clauses
async def publish(self, post: Post, user: User) -> Post:
    if post.user_id != user.id:
        raise AuthorizationError()
    if post.status == "published":
        raise ConflictError("Already published")
    if not post.body:
        raise ValidationError("Body required")

    post.status = "published"
    return await self.repo.save(post)

# BAD: Deeply nested
async def publish(self, post: Post, user: User) -> Post:
    if post.user_id == user.id:
        if post.status != "published":
            if post.body:
                post.status = "published"
                return await self.repo.save(post)
            else:
                raise ValidationError("Body required")
        else:
            raise ConflictError("Already published")
    else:
        raise AuthorizationError()
```

---

## Module Organization

### Standard Module Layout

```python
"""Module docstring describing purpose."""

# 1. Future imports
from __future__ import annotations

# 2. Standard library
import asyncio
from datetime import datetime, timezone
from typing import TYPE_CHECKING

# 3. Third-party
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# 4. Local imports
from app.exceptions import NotFoundError
from app.models.user import User

# 5. Type-checking only imports
if TYPE_CHECKING:
    from app.services.email import EmailService

# 6. Module-level constants
MAX_RETRIES = 3
DEFAULT_PAGE_SIZE = 20

# 7. Classes and functions
class UserService:
    ...
```

### Import Rules

- One import per line for `from` imports with multiple names (ruff handles this)
- Use `TYPE_CHECKING` block for imports used only in annotations
- Never use wildcard imports (`from module import *`)
- Group: stdlib, third-party, local (ruff `isort` enforces this)

---

## Type Annotations

### Modern Syntax (Python 3.12+)

```python
# GOOD: Modern syntax
def get_users() -> list[User]:
    ...

def find_user(email: str) -> User | None:
    ...

def process_items(items: dict[str, list[int]]) -> None:
    ...

# Also acceptable: use `from __future__ import annotations` for older Python
```

### Common Patterns

```python
from collections.abc import AsyncIterator, Callable, Sequence
from typing import Any, TypeVar

T = TypeVar("T")

# Generic function
async def get_or_404(model: type[T], id: int, db: AsyncSession) -> T:
    ...

# Callable type
Handler = Callable[[Request], Awaitable[Response]]

# Optional with default
def paginate(page: int = 1, per_page: int = 20) -> tuple[int, int]:
    ...
```

### When to Use `Any`

Almost never. Use `Any` only for:
- Interfacing with untyped third-party libraries
- Generic JSON data (prefer `dict[str, Any]` over bare `Any`)
- Temporary during migration to typed code

---

## Docstring Style (Google)

### Functions

```python
async def create_user(self, data: CreateUserRequest) -> User:
    """Create a new user account.

    Validates email uniqueness and hashes the password before
    persisting to the database.

    Args:
        data: Validated user creation request containing email,
            name, and plain-text password.

    Returns:
        The created User instance with generated ID and timestamps.

    Raises:
        ConflictError: If the email is already registered.
    """
```

### Classes

```python
class UserService:
    """Service for user account management.

    Handles registration, authentication, and profile operations.
    Delegates data access to UserRepo.

    Attributes:
        repo: Repository for user data persistence.
    """

    def __init__(self, repo: UserRepo) -> None:
        self.repo = repo
```

### When NOT to Docstring

```python
# Self-documenting: no docstring needed
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# Tests: name IS the documentation
async def test_create_user_with_duplicate_email_raises_conflict():
    ...
```

---

## Common Anti-Patterns

### Mutable Default Arguments

```python
# BAD: Shared mutable default
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)  # Mutates the default!
    return items

# GOOD: Use None sentinel
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items

# GOOD: Pydantic uses Field(default_factory=...)
class Config(BaseModel):
    tags: list[str] = Field(default_factory=list)
```

### Bare Except

```python
# BAD: Catches everything including SystemExit, KeyboardInterrupt
try:
    result = await risky_operation()
except:
    pass

# BAD: Too broad
try:
    result = await risky_operation()
except Exception:
    pass  # Silently swallowed

# GOOD: Specific exceptions, proper handling
try:
    result = await risky_operation()
except (ConnectionError, TimeoutError) as exc:
    logger.warning("operation_failed", error=str(exc))
    raise ExternalServiceError("service", str(exc)) from exc
```

### Global Mutable State

```python
# BAD: Module-level mutable state
_cache = {}

def get_cached(key: str) -> str | None:
    return _cache.get(key)

def set_cached(key: str, value: str) -> None:
    _cache[key] = value

# GOOD: Encapsulate state in a class or use proper caching
class Cache:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    def get(self, key: str) -> str | None:
        return self._store.get(key)
```

### String Concatenation in Loops

```python
# BAD: O(n^2) string building
result = ""
for item in items:
    result += f"{item.name}, "

# GOOD: Join
result = ", ".join(item.name for item in items)
```

### Overusing Inheritance

```python
# BAD: Deep inheritance for code reuse
class BaseRepo:
    ...
class CachedRepo(BaseRepo):
    ...
class AuditedCachedRepo(CachedRepo):
    ...
class UserRepo(AuditedCachedRepo):
    ...

# GOOD: Composition and mixins
class UserRepo:
    def __init__(self, db: AsyncSession, cache: Cache) -> None:
        self.db = db
        self.cache = cache
```

---

## Async Patterns

### Prefer `async` Throughout

```python
# GOOD: Async all the way down
async def get_user_with_posts(user_id: int, db: AsyncSession) -> User:
    stmt = select(User).options(selectinload(User.posts)).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

# BAD: Mixing sync and async
def get_user_sync(user_id: int) -> User:
    # Blocks the event loop if called from async context
    with Session() as db:
        return db.get(User, user_id)
```

### Concurrent Operations

```python
import asyncio

# Run independent async operations concurrently
user, posts, notifications = await asyncio.gather(
    user_service.get_user(user_id),
    post_service.get_user_posts(user_id),
    notification_service.get_unread(user_id),
)
```

---

## File and Class Size

### Guidelines

| Element | Guideline |
|---|---|
| Function | Under 20 lines of logic, max 40 |
| Class | Under 200 lines, max 300 |
| Module | Under 300 lines, max 500 |
| Parameters | Max 5 per function; use model for more |

When a file exceeds limits, extract:
- Utility functions into a `utils` module
- Related classes into their own module
- Constants into a `constants` module

---

## Formatting (Handled by Ruff)

These are automated -- do not worry about them manually:

- Line length: 99 characters
- Indentation: 4 spaces
- Import sorting: stdlib, third-party, local
- Trailing commas in multi-line constructs
- Quote style: double quotes

Run `uv run ruff format .` and move on.

---

_Style is a tool for communication. Write code that your future self and teammates will thank you for._
