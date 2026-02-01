# Feedback Configuration

Project-specific commands for automated feedback during Rust implementation.

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: cargo nextest run

# Test with standard cargo test (fallback)
test_fallback: cargo test

# Test with coverage report
test_coverage: cargo llvm-cov nextest --fail-under-lines 80

# Run specific test by name
test_pattern: cargo nextest run --filter-expr 'test({pattern})'

# Run tests for specific crate in workspace
test_crate: cargo nextest run -p {crate}

# Run doctests (nextest does not run these)
test_doc: cargo test --doc

# Run only integration tests
test_integration: cargo nextest run --filter-expr 'kind(test)'
```

---

## Linting Commands

Commands for code quality checks.

```yaml
# Primary lint command (Clippy with denied warnings)
lint: cargo clippy --all-targets --all-features -- -D warnings

# Lint specific crate
lint_crate: cargo clippy -p {crate} -- -D warnings

# Auto-fix Clippy suggestions
lint_fix: cargo clippy --fix --allow-dirty

# Format check
format_check: cargo fmt -- --check

# Format fix
format_fix: cargo fmt

# Security audit
audit: cargo audit

# Dependency policy check (licenses, advisories, bans)
deny: cargo deny check
```

---

## Build Commands

Commands for building the project.

```yaml
# Debug build
build: cargo build

# Release build
build_release: cargo build --release

# Check without building (faster feedback)
check: cargo check --all-targets --all-features

# Build documentation
doc: cargo doc --no-deps

# Clean build artifacts
clean: cargo clean
```

---

## Development Server

Commands for starting the development server (Axum application).

```yaml
# Start dev server
dev_server: cargo run

# Start dev server with auto-reload (requires cargo-watch)
dev_watch: cargo watch -x run

# Dev server port
dev_port: 8080

# Dev server base URL
dev_url: http://localhost:8080
```

---

## Database Commands

Commands for database operations with SQLx.

```yaml
# Run migrations
migrate: sqlx migrate run

# Create new migration
migrate_create: sqlx migrate add {name}

# Prepare offline query data (for CI without database)
sqlx_prepare: cargo sqlx prepare

# Check offline query data is up to date
sqlx_check: cargo sqlx prepare --check
```

---

## CI Pipeline Commands

Full quality check sequence for continuous integration.

```yaml
# Complete CI check (run in order)
ci_format: cargo fmt -- --check
ci_lint: cargo clippy --all-targets --all-features -- -D warnings
ci_test: cargo nextest run --all-features
ci_doctest: cargo test --doc
ci_audit: cargo audit
ci_deny: cargo deny check
ci_doc: cargo doc --no-deps
```

---

## Notes

- Uses `cargo-nextest` as the primary test runner for faster parallel execution
- Doctests must be run separately with `cargo test --doc` (nextest does not support them)
- `cargo clippy` with `-D warnings` treats all warnings as errors in CI
- `cargo audit` checks against the RustSec advisory database
- `cargo deny` enforces license compliance, advisory checks, and duplicate detection
- SQLx offline mode (`cargo sqlx prepare`) enables CI builds without a live database
