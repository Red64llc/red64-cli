# Code Quality

Code quality standards and tooling for Loco applications. Automated enforcement where possible, conventions where not.

---

## Tooling

### Required in CI

| Tool | Purpose | Command |
|------|---------|---------|
| `cargo fmt` | Code formatting | `cargo fmt -- --check` |
| `cargo clippy` | Linting | `cargo clippy -- -D warnings` |
| `cargo test` | Test suite | `cargo test` or `cargo nextest run` |
| `cargo audit` | Dependency vulnerabilities | `cargo audit` |
| `cargo loco doctor` | Environment validation | `cargo loco doctor --production` |

### Recommended

| Tool | Purpose | Command |
|------|---------|---------|
| `cargo nextest` | Faster parallel tests | `cargo nextest run` |
| `cargo deny` | License and advisory checks | `cargo deny check` |
| `cargo machete` | Unused dependency detection | `cargo machete` |

---

## Formatting

Run `cargo fmt` and move on. Configure in `rustfmt.toml` if needed:

```toml
# rustfmt.toml
edition = "2021"
max_width = 100
use_field_init_shorthand = true
```

---

## Linting

### Clippy Configuration

Deny warnings in CI, allow iterative development locally:

```bash
# CI: strict
cargo clippy -- -D warnings

# Local: advisory
cargo clippy
```

Common Clippy lints to enforce:
- `clippy::unwrap_used` -- no `.unwrap()` in production code
- `clippy::expect_used` -- prefer `?` or `.ok_or()`
- `clippy::large_enum_variant` -- box large variants
- `clippy::needless_pass_by_value` -- borrow instead of clone

---

## Code Review Checklist

### Controllers
- [ ] Thin: validate, delegate, respond (under 15 lines)
- [ ] Uses Axum extractors for request data
- [ ] Returns `Result<impl IntoResponse>`
- [ ] Auth-protected routes use `auth::JWT` extractor

### Models
- [ ] Domain logic lives here, not in controllers
- [ ] `_entities/` files are untouched
- [ ] Validation implemented via `Validatable` trait
- [ ] Queries use SeaORM, not raw SQL

### Workers
- [ ] Self-contained, no shared controller state
- [ ] Args are `Serialize + Deserialize`
- [ ] Error handling with logging context
- [ ] Registered in `app.rs` `connect_workers`

### Migrations
- [ ] Descriptive names matching auto-detection patterns
- [ ] `down()` implemented for rollback
- [ ] Required fields use NOT NULL
- [ ] Foreign keys and indexes added

### Tests
- [ ] Model tests for domain logic
- [ ] Request tests for controller endpoints
- [ ] Auth tested on protected routes
- [ ] `ForegroundBlocking` mode in test config

---

## Dependency Management

### Adding Dependencies

```toml
# Cargo.toml -- pin major versions
[dependencies]
loco-rs = "0.x"
sea-orm = { version = "1", features = ["sqlx-postgres", "runtime-tokio-rustls"] }
serde = { version = "1", features = ["derive"] }
```

### Rules
- Pin major version, allow minor/patch updates
- Enable only needed feature flags
- Audit new dependencies: `cargo audit`, `cargo deny`
- Prefer well-maintained crates with recent activity
- Remove unused dependencies: `cargo machete`

---

## Performance Guidelines

### Database
- Use `includes` / eager loading for associations (avoid N+1)
- Add indexes for frequently queried columns
- Configure connection pool sizes per environment
- Use `explain` for slow queries

### HTTP
- Enable compression middleware in production
- Use Loco's built-in caching layer for repeated queries
- Return only needed fields in view structs (not full entities)

### Workers
- Use `BackgroundQueue` (Redis/Postgres) for production horizontal scaling
- Tag workers for resource-intensive jobs
- Keep job args small -- pass IDs, not full objects

---

## Security

### Built-in Protections
- JWT authentication with configurable token location
- Secure headers middleware (enabled by default)
- CORS configuration via YAML

### Practices
- Never commit secrets -- use environment config or Loco's config system
- Rotate JWT secrets in production
- Enable `secure_headers` middleware with appropriate presets
- Validate all user input via `Validatable` or `JsonValidate`
- Use parameterized SeaORM queries (never string interpolation in queries)
- Run `cargo audit` in CI

---

_Automate quality: fmt for formatting, clippy for linting, tests for correctness, audit for security. Human review for architecture and domain logic._
