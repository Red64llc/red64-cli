# Feedback Configuration

Project-specific commands for automated feedback during Rails implementation.

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: bin/rails test

# Test with verbose output
test_verbose: bin/rails test -v

# Run specific test file (use {file} as placeholder)
test_file: bin/rails test {file}

# Run system tests (browser-based)
test_system: bin/rails test:system

# Run all tests including system
test_all: bin/rails test:all
```

---

## Linting Commands

Commands for code quality checks.

```yaml
# Primary lint command (RuboCop)
lint: bundle exec rubocop

# Lint with auto-fix
lint_fix: bundle exec rubocop -A

# Security check (Brakeman)
security: bundle exec brakeman -q

# Bundle audit for dependencies
bundle_audit: bundle exec bundle-audit check --update
```

---

## Development Server

Commands for starting the development server (required for UI verification).

```yaml
# Start dev server (Rails)
dev_server: bin/rails server

# Dev server port
dev_port: 3000

# Dev server base URL
dev_url: http://localhost:3000

# Start with binding (for Docker)
dev_server_docker: bin/rails server -b 0.0.0.0
```

---

## Database Commands

Commands for database operations.

```yaml
# Run migrations
db_migrate: bin/rails db:migrate

# Setup test database
db_test_prepare: bin/rails db:test:prepare

# Reset database
db_reset: bin/rails db:reset
```

---

## UI Verification

Settings for agent-browser UI verification.

```yaml
# Enable UI verification for this project
ui_verification_enabled: true

# Default wait time after navigation (milliseconds)
navigation_wait: 3000

# Screenshot directory
screenshot_dir: /tmp/ui-captures

# Common routes to verify
routes:
  - /
  - /health
```

---

## Asset Pipeline

Commands for asset management.

```yaml
# Precompile assets
assets_precompile: bin/rails assets:precompile

# Clean assets
assets_clean: bin/rails assets:clean
```

---

## Notes

- Uses Minitest by default (or RSpec if configured)
- RuboCop for Ruby style enforcement
- Brakeman for security scanning
- Rails dev server on port 3000 by default
- System tests use Capybara with Selenium
- For Hotwire/Turbo projects, UI verification is essential
