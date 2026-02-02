# Feedback Configuration

Project-specific commands for automated feedback during PHP implementation.

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: php vendor/bin/phpunit

# Test with coverage report
test_coverage: php vendor/bin/phpunit --coverage-text

# Run specific test file (use {file} as placeholder)
test_file: php vendor/bin/phpunit {file} --verbose

# Run tests matching pattern
test_pattern: php vendor/bin/phpunit --filter="{pattern}"
```

---

## Linting Commands

Commands for code quality checks.

```yaml
# Primary lint command (PHP CS Fixer)
lint: php vendor/bin/php-cs-fixer fix --dry-run --diff

# Lint with auto-fix
lint_fix: php vendor/bin/php-cs-fixer fix

# Static analysis (PHPStan Level 9)
type_check: php vendor/bin/phpstan analyse

# Psalm analysis
psalm: php vendor/bin/psalm

# All quality checks
quality: composer quality
```

---

## Development Server

Commands for starting the development server (required for UI verification).

```yaml
# Start dev server (built-in PHP server)
dev_server: php -S localhost:8000 -t public/

# Dev server port
dev_port: 8000

# Dev server base URL
dev_url: http://localhost:8000

# Docker-based (production-like)
dev_docker: docker compose up -d
```

---

## UI Verification

Settings for agent-browser UI verification.

```yaml
# Enable UI verification
ui_verification_enabled: false

# Default wait time after navigation (milliseconds)
navigation_wait: 2000

# Screenshot directory
screenshot_dir: /tmp/ui-captures

# API documentation URL
api_docs_url: http://localhost:8000/api/docs
```

---

## Notes

- Uses Composer 2 for package management
- PHP CS Fixer enforces PSR-12 code style
- PHPStan Level 9 is the strictest analysis level
- PHPUnit 11 is the default test framework
- `composer quality` runs cs-fix, analyse, and test in sequence
