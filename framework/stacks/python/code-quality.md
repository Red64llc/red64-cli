# Code Quality Standards

Project memory for code quality conventions, linting, type checking, and testing standards in Python.

---

## Linting and Formatting

### Ruff (Single Tool for Everything)

Ruff replaces black, isort, flake8, pyupgrade, and more. Configuration lives in `pyproject.toml`:

```toml
[tool.ruff]
target-version = "py312"
src = ["src"]
line-length = 99

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "F",    # pyflakes
    "I",    # isort
    "N",    # pep8-naming
    "UP",   # pyupgrade (modern syntax)
    "B",    # flake8-bugbear
    "A",    # flake8-builtins
    "SIM",  # flake8-simplify
    "TCH",  # flake8-type-checking (move imports behind TYPE_CHECKING)
    "RUF",  # ruff-specific rules
    "ASYNC",# flake8-async
]
ignore = ["E501"]  # line length handled by formatter

[tool.ruff.lint.isort]
known-first-party = ["app"]
```

```bash
# Run checks
uv run ruff check .              # Lint
uv run ruff check . --fix        # Auto-fix
uv run ruff format .             # Format
uv run ruff format . --check     # Verify formatting
```

---

## Type Checking

### mypy (Strict Mode)

```toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
plugins = ["pydantic.mypy"]

[[tool.mypy.overrides]]
module = ["tests.*"]
disallow_untyped_defs = false

[[tool.mypy.overrides]]
module = ["celery.*", "arq.*"]
ignore_missing_imports = true
```

### Type Annotation Patterns

```python
# Pattern: Annotate all public function signatures
async def get_user(user_id: int, db: AsyncSession) -> User | None:
    ...

# Pattern: Use TYPE_CHECKING for import-only types
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

# Pattern: TypeVar for generic functions
from typing import TypeVar
T = TypeVar("T")

async def get_or_404(model: type[T], id: int, db: AsyncSession) -> T:
    result = await db.get(model, id)
    if result is None:
        raise NotFoundError(model.__name__, str(id))
    return result
```

---

## Pre-commit Hooks

### Configuration (`.pre-commit-config.yaml`)

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        additional_dependencies:
          - pydantic>=2.0
          - types-redis

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: check-yaml
      - id: check-toml
      - id: check-added-large-files
      - id: no-commit-to-branch
        args: [--branch, main]
      - id: detect-private-key
```

```bash
# Setup
uv run pre-commit install
uv run pre-commit run --all-files   # Verify
```

---

## Testing Framework

### pytest Configuration

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = [
    "-v",
    "--strict-markers",
    "--tb=short",
]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks integration tests",
]
filterwarnings = [
    "error",
    "ignore::DeprecationWarning:sqlalchemy.*",
]
```

### Coverage Configuration

```toml
[tool.coverage.run]
source = ["src/app"]
omit = ["*/migrations/*", "*/tests/*"]

[tool.coverage.report]
fail_under = 80
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
    "@overload",
]
```

```bash
uv run pytest --cov=src/app --cov-report=term-missing
```

---

## Test Data Generation

### Factory Boy + Faker

```python
# tests/factories/user_factory.py
import factory
from faker import Faker
from app.models.user import User

fake = Faker()

class UserFactory(factory.Factory):
    class Meta:
        model = User

    id = factory.Sequence(lambda n: n + 1)
    email = factory.LazyFunction(fake.email)
    name = factory.LazyFunction(fake.name)
    hashed_password = "hashed_test_password"
    is_active = True

# Usage
user = UserFactory()
admin = UserFactory(name="Admin", is_active=True)
users = UserFactory.build_batch(5)
```

---

## Security Scanning

### bandit (Static Analysis)

```toml
# pyproject.toml
[tool.bandit]
exclude_dirs = ["tests"]
skips = ["B101"]  # Allow assert in non-test code if needed
```

```bash
uv run bandit -r src/ -c pyproject.toml
```

### Dependency Auditing

```bash
uv run pip-audit             # Check for known vulnerabilities
```

---

## Documentation Standards

### Docstrings (Google Style)

```python
class UserService:
    """Service for user-related business logic.

    Handles user creation, authentication, and profile management.
    Depends on UserRepo for data access.
    """

    async def create_user(self, data: CreateUserRequest) -> User:
        """Create a new user account.

        Args:
            data: Validated user creation request.

        Returns:
            The created User instance.

        Raises:
            ValidationError: If email already exists.
        """
```

---

## Quality Commands Summary

```bash
# Full quality check (CI pipeline)
uv run ruff check .                         # Lint
uv run ruff format . --check                # Format check
uv run mypy src/                            # Type check
uv run bandit -r src/                       # Security
uv run pytest --cov=src/app                 # Tests + coverage

# Development workflow
uv run ruff check . --fix && uv run ruff format .   # Quick fix
uv run pytest tests/unit/ -x                         # Fast feedback
uv run mypy src/app/services/                        # Focused type check
```

---

_Focus on patterns over exhaustive rules. Code should be typed, formatted, and tested._
