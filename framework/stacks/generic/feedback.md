# Feedback Configuration

Project-specific commands for automated feedback during implementation.

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: npm test

# Test with coverage report
test_coverage: npm test -- --coverage

# Run specific test file (use {file} as placeholder)
test_file: npm test -- {file}
```

---

## Linting Commands

Commands for code quality checks.

```yaml
# Primary lint command
lint: npm run lint

# Lint with auto-fix
lint_fix: npm run lint -- --fix

# Type checking (if applicable)
type_check: npm run type-check
```

---

## Development Server

Commands for starting the development server (required for UI verification).

```yaml
# Start dev server
dev_server: npm run dev

# Dev server port
dev_port: 3000

# Dev server base URL
dev_url: http://localhost:3000
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
```

---

## Notes

- Update these commands to match your project's setup
- The agent reads this file to determine how to run tests and verify UI
- If a command doesn't apply, leave it empty or remove the line
- All commands should be runnable from the project root directory
