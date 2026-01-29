# Feedback Configuration

Project-specific commands for automated feedback during Next.js implementation.

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: pnpm test

# Test with coverage report
test_coverage: pnpm test -- --coverage

# Run specific test file (use {file} as placeholder)
test_file: pnpm test {file}

# Watch mode (for development)
test_watch: pnpm test -- --watch
```

---

## Linting Commands

Commands for code quality checks.

```yaml
# Primary lint command (Next.js built-in)
lint: pnpm lint

# Lint with auto-fix
lint_fix: pnpm lint --fix

# Type checking
type_check: pnpm tsc --noEmit

# Format check
format_check: pnpm prettier --check .

# Format fix
format_fix: pnpm prettier --write .
```

---

## Development Server

Commands for starting the development server (required for UI verification).

```yaml
# Start dev server (Next.js)
dev_server: pnpm dev

# Dev server port
dev_port: 3000

# Dev server base URL
dev_url: http://localhost:3000
```

---

## Build Commands

Commands for production builds.

```yaml
# Production build
build: pnpm build

# Start production server
start: pnpm start
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
  - /api/health
```

---

## E2E Testing

End-to-end testing with Playwright.

```yaml
# Run E2E tests
e2e: pnpm test:e2e

# Run E2E with UI
e2e_ui: pnpm test:e2e --ui
```

---

## Notes

- Uses Jest or Vitest for unit tests (check package.json)
- Uses Playwright for E2E testing
- Next.js dev server on port 3000 by default
- Built-in ESLint configuration via `next lint`
- UI verification is enabled by default for Next.js projects
- API routes available at `/api/*`
