# Feedback Configuration

Project-specific commands for automated feedback during Python implementation.

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: uv run pytest

# Test with coverage report
test_coverage: uv run pytest --cov=src --cov-report=term-missing

# Run specific test file (use {file} as placeholder)
test_file: uv run pytest {file} -v

# Run tests matching pattern
test_pattern: uv run pytest -k "{pattern}"
```

---

## Linting Commands

Commands for code quality checks.

```yaml
# Primary lint command (Ruff for speed)
lint: uv run ruff check .

# Lint with auto-fix
lint_fix: uv run ruff check . --fix

# Type checking
type_check: uv run mypy src/

# Format check
format_check: uv run ruff format --check .

# Format fix
format_fix: uv run ruff format .
```

---

## Development Server

Commands for starting the development server (required for UI verification).

```yaml
# Start dev server (FastAPI)
dev_server: uv run uvicorn src.app.main:app --reload

# Dev server port
dev_port: 8000

# Dev server base URL
dev_url: http://localhost:8000
```

---

## UI Verification

Settings for agent-browser UI verification.

```yaml
# Enable UI verification (typically false for API-only projects)
ui_verification_enabled: false

# Default wait time after navigation (milliseconds)
navigation_wait: 2000

# Screenshot directory
screenshot_dir: /tmp/ui-captures

# API documentation URL (for API projects)
api_docs_url: http://localhost:8000/docs
```

---

## Notes

- Uses `uv` as the package manager (faster than pip)
- Ruff replaces flake8, isort, and black for linting/formatting
- pytest-asyncio runs async tests automatically with `asyncio_mode = "auto"`
- For API-only projects, UI verification is disabled by default
