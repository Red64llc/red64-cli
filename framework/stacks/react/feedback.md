# Feedback Configuration

Project-specific commands for automated feedback during React implementation.

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: pnpm test:run

# Test with coverage report
test_coverage: pnpm test:coverage

# Run specific test file (use {file} as placeholder)
test_file: pnpm test:run {file}

# Watch mode (for development)
test_watch: pnpm test
```

---

## Linting Commands

Commands for code quality checks.

```yaml
# Primary lint command
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
# Start dev server (Vite)
dev_server: pnpm dev

# Dev server port
dev_port: 5173

# Dev server base URL
dev_url: http://localhost:5173
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

# Storybook URL (if using Storybook)
storybook_url: http://localhost:6006
```

---

## E2E Testing

End-to-end testing with Playwright.

```yaml
# Run E2E tests
e2e: pnpm test:e2e

# Run E2E with UI
e2e_ui: pnpm test:e2e --ui

# Run E2E for specific browser
e2e_chromium: pnpm test:e2e --project=chromium
```

---

## Notes

- Uses Vitest for unit/integration tests (faster than Jest)
- Uses Playwright for E2E testing
- pnpm is the default package manager (faster, disk-efficient)
- Vite dev server on port 5173 by default
- UI verification is enabled by default for React projects
