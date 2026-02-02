# Feedback Configuration

Project-specific commands for automated feedback during Laravel implementation.

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: php artisan test

# Test with coverage report
test_coverage: php artisan test --coverage

# Run specific test file (use {file} as placeholder)
test_file: php artisan test {file} --verbose

# Run tests matching pattern
test_pattern: php artisan test --filter="{pattern}"

# Parallel test execution
test_parallel: php artisan test --parallel
```

---

## Linting Commands

Commands for code quality checks.

```yaml
# Primary lint command (Laravel Pint)
lint: ./vendor/bin/pint --test

# Lint with auto-fix
lint_fix: ./vendor/bin/pint

# Static analysis (Larastan)
type_check: ./vendor/bin/phpstan analyse

# All quality checks
quality: ./vendor/bin/pint --test && ./vendor/bin/phpstan analyse && php artisan test
```

---

## Development Server

Commands for starting the development server (required for UI verification).

```yaml
# Start dev server
dev_server: php artisan serve

# Dev server port
dev_port: 8000

# Dev server base URL
dev_url: http://localhost:8000

# Frontend assets (Vite)
dev_assets: npm run dev
```

---

## UI Verification

Settings for agent-browser UI verification.

```yaml
# Enable UI verification
ui_verification_enabled: true

# Default wait time after navigation (milliseconds)
navigation_wait: 2000

# Screenshot directory
screenshot_dir: /tmp/ui-captures

# Login URL (for authenticated UI testing)
login_url: http://localhost:8000/login
```

---

## Notes

- Uses Pest PHP as the default test framework
- Laravel Pint provides zero-config code formatting
- Larastan (PHPStan wrapper) understands Laravel magic methods
- `php artisan test` wraps Pest/PHPUnit with Laravel integration
- `RefreshDatabase` trait ensures clean state per test
