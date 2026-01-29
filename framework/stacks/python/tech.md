# Technology Stack

## Architecture

Modern Python application with async-first design. FastAPI or Django as web framework, PostgreSQL for persistence, Redis for caching and task queues, Docker for deployment.

---

## Core Technologies

- **Language**: Python 3.12+
- **Package Manager**: uv (fast, Rust-based)
- **Web Framework**: FastAPI (API-first) or Django (full-stack)
- **Database**: PostgreSQL with asyncpg
- **ORM**: SQLAlchemy 2.0 (async) or Django ORM
- **Cache/Queue**: Redis with redis-py

---

## Key Libraries

### Web & API
- **FastAPI**: High-performance async API framework
- **Uvicorn**: ASGI server (production: with gunicorn)
- **Pydantic v2**: Request/response validation, settings
- **python-multipart**: Form/file upload handling

### Database & Storage
- **SQLAlchemy 2.0**: Async ORM with type-safe queries
- **Alembic**: Database migrations
- **asyncpg**: Async PostgreSQL driver
- **boto3**: AWS S3 for file storage (when needed)

### Background Tasks
- **Celery**: Distributed task queue (with Redis broker)
- **arq**: Lightweight async task queue alternative
- **APScheduler**: Scheduled/cron jobs

### Deployment
- **Docker**: Containerized deployment
- **Docker Compose**: Multi-service local development
- **Gunicorn + Uvicorn**: Production ASGI serving

---

## Development Standards

### Code Quality
- **Ruff**: Linting and formatting (replaces black, isort, flake8)
- **mypy**: Static type checking (strict mode)
- **pre-commit**: Git hooks for automated checks

### Security
- **bandit**: Security vulnerability scanner
- **safety**: Dependency vulnerability scanning
- **python-dotenv**: Environment-based configuration (never commit `.env`)

### Testing
- **pytest**: Test framework with fixtures and parametrize
- **pytest-asyncio**: Async test support
- **pytest-cov**: Coverage reporting
- **factory-boy + faker**: Test data generation
- **httpx**: Async HTTP client for integration tests

---

## Development Environment

### Required Tools
- Python 3.12+ (see `.python-version`)
- uv (package manager)
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose

### Common Commands
```bash
# Environment setup
uv sync                          # Install dependencies
uv run alembic upgrade head      # Run migrations

# Dev server
uv run uvicorn app.main:app --reload          # FastAPI
uv run python manage.py runserver             # Django

# Tests
uv run pytest                    # All tests
uv run pytest tests/unit/        # Unit tests only
uv run pytest --cov=src          # With coverage

# Code quality
uv run ruff check .              # Lint
uv run ruff format .             # Format
uv run mypy src/                 # Type check

# Database
uv run alembic revision --autogenerate -m "description"  # New migration
uv run alembic upgrade head                              # Apply migrations
uv run alembic downgrade -1                              # Rollback one

# Docker
docker compose up -d             # Start services
docker compose logs -f app       # Follow app logs
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **uv over pip/poetry** | 10-100x faster installs, built-in venv, lockfile support |
| **Ruff over black+isort+flake8** | Single tool, Rust-based speed, drop-in replacement |
| **Pydantic v2 over attrs/marshmallow** | Native FastAPI integration, Rust core, JSON Schema |
| **SQLAlchemy 2.0 async** | Type-safe queries, async support, mature ecosystem |
| **PostgreSQL over SQLite** | Production-grade, JSONB, full-text search, concurrency |
| **Redis for cache + queue** | Versatile: caching, Celery broker, pub/sub, rate limiting |

---

_Document standards and patterns, not every dependency. See `python.md` for detailed Python conventions._
