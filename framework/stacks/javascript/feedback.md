# Feedback Configuration

Project-specific commands for automated feedback during JavaScript/Node.js implementation.

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: npx vitest run

# Test with coverage report
test_coverage: npx vitest run --coverage

# Run specific test file (use {file} as placeholder)
test_file: npx vitest run {file}

# Watch mode (development)
test_watch: npx vitest
```

---

## Linting Commands

Commands for code quality checks.

```yaml
# Primary lint command
lint: npx eslint .

# Lint with auto-fix
lint_fix: npx eslint . --fix

# Format check
format_check: npx prettier --check .

# Format fix
format_fix: npx prettier --write .
```

---

## Build / Syntax Check Commands

```yaml
# Syntax check (Node.js built-in)
build: node --check src/index.js

# Check all source files
build_all: find src -name '*.js' -exec node --check {} +
```

---

## Development Server

```yaml
# Start dev server (with watch mode)
dev_server: node --watch src/index.js

# Dev server port
dev_port: 3000

# Dev server base URL
dev_url: http://localhost:3000
```

---

## Notes

- Uses Vitest as the primary test runner (Jest-compatible API, native ESM)
- ESLint with flat config (`eslint.config.js`) for linting
- Prettier for formatting (separate from ESLint)
- Node.js `--watch` flag provides built-in file watching (stable in Node.js 22+)
- For Biome projects, replace lint + format commands with `npx biome check .`
