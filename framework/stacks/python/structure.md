# Project Structure

## Organization Philosophy

Modern Python packaging with `src` layout. Clear separation between application code, tests, and configuration. Domain-driven modules as complexity grows.

---

## Directory Patterns

### Root Layout

```
project-root/
  pyproject.toml          # Project metadata, dependencies, tool config
  uv.lock                 # Locked dependencies
  .python-version         # Python version pin
  alembic.ini             # Migration config
  docker-compose.yml      # Local services
  Dockerfile              # Production image
  .env.example            # Environment template (never commit .env)
  src/
    app/                  # Application package
  tests/                  # Test suite
  migrations/             # Alembic migrations
  scripts/                # Utility scripts
```

### Application Core (`src/app/`)

**Purpose**: All application code in a single installable package
**Pattern**: Domain modules with clear boundaries

```
src/app/
  __init__.py
  main.py                 # Application entry point, ASGI app factory
  config.py               # Settings via pydantic-settings
  dependencies.py         # Dependency injection setup
  models/                 # SQLAlchemy/Django models
    __init__.py
    user.py
    content.py
    base.py               # Base model with common fields
  schemas/                # Pydantic request/response models
    __init__.py
    user.py
    content.py
  services/               # Business logic layer
    __init__.py
    user_service.py
    content_service.py
  api/                    # Route handlers (FastAPI routers)
    __init__.py
    v1/
      __init__.py
      users.py
      content.py
  repositories/           # Data access layer
    __init__.py
    user_repo.py
    content_repo.py
  middleware/              # ASGI middleware
    __init__.py
    auth.py
    logging.py
  tasks/                  # Background tasks (Celery/arq)
    __init__.py
    content_tasks.py
  utils/                  # Shared utilities
    __init__.py
    hashing.py
    pagination.py
```

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Packages | snake_case | `user_service/`, `api/` |
| Modules | snake_case | `user_service.py`, `auth_middleware.py` |
| Models | PascalCase, singular | `User`, `ContentVersion` |
| Schemas | PascalCase + purpose | `CreateUserRequest`, `UserResponse` |
| Services | PascalCase + Service | `UserService`, `ContentService` |
| Repositories | PascalCase + Repo/Repository | `UserRepo` |
| Tables | plural, snake_case | `users`, `content_versions` |

---

## Package Configuration (`pyproject.toml`)

### Minimal Structure

```toml
[project]
name = "my-app"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "sqlalchemy[asyncio]>=2.0",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "asyncpg>=0.29",
    "redis>=5.0",
    "alembic>=1.13",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "pytest-cov>=5.0",
    "factory-boy>=3.3",
    "faker>=30.0",
    "httpx>=0.27",
    "ruff>=0.8",
    "mypy>=1.13",
    "pre-commit>=4.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/app"]

[tool.ruff]
target-version = "py312"
src = ["src"]

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "A", "SIM", "TCH", "RUF"]

[tool.mypy]
python_version = "3.12"
strict = true
plugins = ["pydantic.mypy"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

---

## Import Organization

### Pattern: Absolute Imports

```python
# Standard library
from collections.abc import AsyncIterator
from datetime import datetime

# Third-party
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# Application (absolute from package root)
from app.models.user import User
from app.schemas.user import CreateUserRequest, UserResponse
from app.services.user_service import UserService
from app.dependencies import get_db, get_current_user
```

Ruff enforces import sorting (`I` rules). No manual ordering needed.

---

## Configuration Pattern

### Pydantic Settings

```python
# src/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # Database
    database_url: str = "postgresql+asyncpg://localhost:5432/myapp"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str
    access_token_expire_minutes: int = 30

    # External services
    openai_api_key: str = ""

settings = Settings()
```

---

## Dependency Injection Pattern (FastAPI)

```python
# src/app/dependencies.py
from collections.abc import AsyncIterator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        yield session

async def get_user_service(
    db: AsyncSession = Depends(get_db),
) -> UserService:
    return UserService(repo=UserRepo(db))
```

---

## Migration Organization (`migrations/`)

```
migrations/
  env.py                  # Alembic environment config
  versions/
    001_create_users.py
    002_create_content.py
    003_add_user_roles.py
```

**Naming**: Prefix with sequential number for readability alongside Alembic's revision IDs.

---

## Test Organization (`tests/`)

```
tests/
  conftest.py             # Shared fixtures (db, client, factories)
  unit/
    services/
      test_user_service.py
    utils/
      test_hashing.py
  integration/
    api/
      test_users.py
      test_content.py
    repositories/
      test_user_repo.py
  factories/
    user_factory.py
    content_factory.py
```

**Pattern**: Mirror `src/app/` structure in `tests/`. Separate unit and integration tests.

---

_Document patterns, not file trees. New files following patterns should not require updates._
