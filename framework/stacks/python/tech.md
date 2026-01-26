# Technology Stack

## Project: {{projectName}}

## Architecture

Modular architecture with clear separation between API layer, business logic, and data access. Uses dependency injection for testability.

## Core Technologies

- **Language**: Python 3.11+
- **Framework**: FastAPI / Django / Flask
- **Package Manager**: uv / pip / poetry

## Key Libraries

- **Validation**: Pydantic
- **Database**: SQLAlchemy / asyncpg / Motor
- **HTTP Client**: httpx / aiohttp
- **Testing**: pytest / pytest-asyncio

## Development Standards

### Type Safety
- Type hints on all function signatures
- Pydantic models for data validation
- mypy for static type checking
- No `Any` types except when interfacing with untyped libraries

### Code Quality
- Ruff for linting and formatting
- Black for code formatting
- isort for import sorting

### Testing
- pytest for all tests
- pytest-cov for coverage reporting
- Minimum 80% coverage for business logic
- Fixtures for common test setup

## Development Environment

### Required Tools
- Python 3.11+
- uv or pip
- Docker (for databases)

### Common Commands
```bash
# Dev: uv run uvicorn main:app --reload
# Test: uv run pytest
# Lint: uv run ruff check .
# Format: uv run ruff format .
```

## Key Technical Decisions

- **Async**: Use async/await for I/O operations
- **Dependency Injection**: Use FastAPI's Depends for DI
- **Environment**: Use pydantic-settings for configuration
- **Logging**: Structured logging with structlog

---
_Document standards and patterns, not every dependency_
