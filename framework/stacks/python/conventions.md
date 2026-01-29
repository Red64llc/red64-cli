# Development Conventions

General development practices, workflow, and operational standards for Python projects.

---

## Philosophy

- **Predictable process**: Consistent workflows reduce friction and errors
- **Automated enforcement**: Linters and CI catch what humans miss
- **Observable systems**: If you cannot see it, you cannot fix it
- **Documentation as code**: Keep docs next to the code they describe

---

## Git Workflow

### Branch Strategy

```
main              # Production-ready, always deployable
  └── feat/...    # Feature branches (short-lived)
  └── fix/...     # Bug fix branches
  └── chore/...   # Maintenance, dependency updates
```

### Branch Naming

```bash
feat/add-user-registration
fix/duplicate-email-validation
chore/upgrade-sqlalchemy
refactor/extract-payment-service
```

**Pattern**: `{type}/{short-description}` with lowercase and hyphens.

### Workflow

1. Create branch from `main`
2. Make small, focused commits
3. Open PR when ready for review
4. Squash merge into `main`
5. Delete branch after merge

---

## Commit Conventions

### Conventional Commits

```
feat: add user registration endpoint
fix: prevent duplicate email registration
refactor: extract password hashing to utility module
test: add integration tests for payment flow
docs: update API authentication guide
chore: upgrade pydantic to v2.10
ci: add migration check to CI pipeline
```

### Format

```
{type}: {short description}

{optional body explaining why, not what}

{optional footer: BREAKING CHANGE, Closes #123}
```

### Types

| Type | Description |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes nor adds |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Maintenance, dependencies, tooling |
| `ci` | CI/CD configuration changes |
| `perf` | Performance improvement |

**Rule**: One logical change per commit. If the commit message needs "and", split it.

---

## Environment Configuration

### pydantic-settings

```python
# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "my-app"
    debug: bool = False
    environment: str = "development"  # development | staging | production

    # Database
    database_url: str
    database_pool_size: int = 20
    database_max_overflow: int = 10

    # Auth
    secret_key: str
    access_token_expire_minutes: int = 15

    # External services
    redis_url: str = "redis://localhost:6379/0"
    sentry_dsn: str | None = None


settings = Settings()
```

### .env Files

```bash
# .env (local development -- NEVER commit)
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/myapp
SECRET_KEY=dev-secret-key-not-for-production
DEBUG=true

# .env.example (committed, documents required vars)
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/myapp
SECRET_KEY=change-me
DEBUG=false
REDIS_URL=redis://localhost:6379/0
```

### .gitignore Rules

```gitignore
# Environment
.env
.env.local
.env.production

# Keep example
!.env.example
```

**Rules**:
- Never commit `.env` files with real values
- Always commit `.env.example` with placeholder values
- Use `pydantic-settings` for type-safe config with validation
- Fail fast on missing required variables (no defaults for secrets)

---

## Documentation Standards

### Code Documentation

```python
# Module-level docstring (every module)
"""User service for account management.

Handles user registration, authentication, and profile updates.
"""

# Google-style docstrings for public functions
async def create_user(self, data: CreateUserRequest) -> User:
    """Create a new user account.

    Args:
        data: Validated user creation request.

    Returns:
        The created User instance with generated ID.

    Raises:
        ConflictError: If email is already registered.
    """
```

### When to Write Docstrings

| Element | Docstring Required? |
|---|---|
| Public module | Yes |
| Public class | Yes |
| Public function/method | Yes |
| Private function (`_func`) | Only if non-obvious |
| Test functions | No (test name is the doc) |
| Pydantic models | Yes (appears in OpenAPI) |

### Inline Comments

```python
# GOOD: Explain WHY, not what
# Rate limit to 5/min to prevent brute force attacks
@limiter.limit("5/minute")

# BAD: Restates the code
# Set x to 5
x = 5
```

---

## PR Review Checklist

### Author Checklist (Before Requesting Review)

- [ ] Tests pass locally (`uv run pytest`)
- [ ] Linting passes (`uv run ruff check .`)
- [ ] Types check (`uv run mypy src/`)
- [ ] New features have tests
- [ ] No secrets or credentials committed
- [ ] Migration is reversible (if applicable)
- [ ] PR description explains WHY, not just what

### Reviewer Checklist

- [ ] Code is clear and follows project conventions
- [ ] Error cases are handled
- [ ] No N+1 queries introduced
- [ ] No security concerns (injection, auth bypass, data exposure)
- [ ] Tests cover happy path and edge cases
- [ ] API changes are backward compatible (or versioned)

---

## Release Process

### Versioning

Follow semantic versioning: `MAJOR.MINOR.PATCH`

| Change | Version Bump | Example |
|---|---|---|
| Breaking API change | Major | 1.0.0 -> 2.0.0 |
| New feature, backward compatible | Minor | 1.0.0 -> 1.1.0 |
| Bug fix | Patch | 1.0.0 -> 1.0.1 |

### Release Steps

1. Update version in `pyproject.toml`
2. Update changelog
3. Create PR: `chore: release v1.2.0`
4. Merge to `main`
5. Tag: `git tag v1.2.0`
6. Push tag: `git push origin v1.2.0`
7. CI deploys from tag

---

## Logging Conventions

### Log Levels

| Level | Use Case | Example |
|---|---|---|
| `DEBUG` | Development details | SQL queries, cache hits |
| `INFO` | Normal operations | Request handled, user created |
| `WARNING` | Recoverable issues | Retry succeeded, deprecated usage |
| `ERROR` | Failed operations | Payment failed, external service down |
| `CRITICAL` | System unusable | Database connection lost, out of memory |

### Structured Logging

```python
import structlog

logger = structlog.get_logger()

# GOOD: Structured key-value pairs
logger.info("user_created", user_id=42, email="a@b.com")
logger.error("payment_failed", order_id=123, provider="stripe", error="timeout")

# BAD: String interpolation
logger.info(f"User {user_id} created with email {email}")
```

### What to Log

| Event | Level | Context |
|---|---|---|
| Request received | DEBUG | method, path, user_id |
| Business operation complete | INFO | entity_id, action |
| External service call | INFO | service, duration_ms |
| Retry attempt | WARNING | service, attempt, max_attempts |
| Operation failed | ERROR | operation, error, context |
| Startup/shutdown | INFO | version, environment |

---

## Monitoring and Observability

### Health Checks

```python
# Liveness: is the process running?
GET /api/v1/health -> {"status": "ok"}

# Readiness: can it serve traffic?
GET /api/v1/health/ready -> {"status": "ready", "database": "connected"}
```

### Metrics to Track

| Metric | Type | Purpose |
|---|---|---|
| Request latency (p50, p95, p99) | Histogram | Performance monitoring |
| Request rate | Counter | Traffic patterns |
| Error rate (4xx, 5xx) | Counter | Reliability |
| Database query duration | Histogram | DB performance |
| External service latency | Histogram | Dependency health |
| Active connections (DB pool) | Gauge | Resource usage |

### Error Tracking

```python
# Sentry integration
import sentry_sdk

sentry_sdk.init(
    dsn=settings.sentry_dsn,
    environment=settings.environment,
    traces_sample_rate=0.1,  # 10% of transactions
    profiles_sample_rate=0.1,
)
```

### Request Tracing

Include `X-Request-ID` in all log entries for request correlation:

```python
# Middleware sets request_id in structlog context
# All subsequent log entries include it automatically
logger.info("user_created", user_id=42)
# Output: {"event": "user_created", "user_id": 42, "request_id": "abc-123", ...}
```

---

## Feature Flags

### Simple Implementation

```python
# app/config.py
class Settings(BaseSettings):
    # Feature flags
    feature_new_onboarding: bool = False
    feature_async_notifications: bool = False

# Usage
if settings.feature_new_onboarding:
    await send_new_onboarding_email(user)
else:
    await send_legacy_welcome_email(user)
```

**Rule**: Use feature flags for incomplete features instead of long-lived branches. Remove flags promptly after rollout.

---

## Dependency Management

### uv for Package Management

```bash
# Add dependency
uv add fastapi

# Add dev dependency
uv add --dev pytest pytest-asyncio

# Update all dependencies
uv lock --upgrade

# Sync environment
uv sync
```

### Dependency Rules

- Pin major versions in `pyproject.toml`
- Run `uv lock --upgrade` regularly (weekly or per sprint)
- Audit for vulnerabilities: `uv run pip-audit`
- Document why non-obvious dependencies exist

---

_Conventions reduce cognitive load. Follow them consistently so the team can focus on solving problems, not debating style._
