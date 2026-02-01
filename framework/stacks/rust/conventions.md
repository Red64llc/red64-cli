# Development Conventions

General development practices, Cargo workspace structure, module organization, and operational standards for Rust projects.

---

## Philosophy

- **Predictable process**: Consistent workflows reduce friction and errors
- **Cargo is the build system**: Do not fight it; organize around workspaces and features
- **Minimal visibility**: Default to `pub(crate)`, expose only what is needed
- **Documentation as code**: `///` doc comments generate your API reference

---

## Cargo Workspace Structure

### Recommended Layout

```
my-project/
  Cargo.toml              # Workspace root
  Cargo.lock              # Committed for applications, not for libraries
  rustfmt.toml            # Shared formatting config
  deny.toml               # Dependency policy
  .config/
    nextest.toml           # Test runner config
  crates/
    app/                   # Binary crate (Axum server)
      Cargo.toml
      src/
        main.rs
        lib.rs
        routes/
        middleware/
    core/                  # Domain logic (no framework dependencies)
      Cargo.toml
      src/
        lib.rs
        models/
        services/
        errors.rs
    db/                    # Database layer
      Cargo.toml
      src/
        lib.rs
        repos/
        migrations/
  tests/                   # Workspace-level integration tests
  scripts/                 # Development and deployment scripts
```

### Workspace `Cargo.toml`

```toml
[workspace]
resolver = "2"
members = ["crates/*"]

[workspace.package]
edition = "2024"
rust-version = "1.85"
authors = ["Team <team@example.com>"]
license = "MIT"

[workspace.dependencies]
# Pin shared dependencies at workspace level
axum = "0.8"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio", "tls-rustls", "postgres"] }
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
thiserror = "2"
anyhow = "1"

[workspace.lints.clippy]
pedantic = { level = "warn", priority = -1 }
module_name_repetitions = "allow"
must_use_candidate = "allow"
```

### Crate `Cargo.toml`

```toml
[package]
name = "my-app"
version = "0.1.0"
edition.workspace = true
rust-version.workspace = true

[dependencies]
axum.workspace = true
serde.workspace = true
tokio.workspace = true
my-core = { path = "../core" }
my-db = { path = "../db" }

[dev-dependencies]
rstest = "0.23"
mockall = "0.13"
cargo-husky = { version = "1", features = ["precommit-hook"] }

[lints]
workspace = true
```

---

## Feature Flags

### Defining Features

```toml
[features]
default = ["postgres"]
postgres = ["sqlx/postgres"]
mysql = ["sqlx/mysql"]
sqlite = ["sqlx/sqlite"]
full = ["postgres", "mysql", "sqlite"]
```

### Using Features in Code

```rust
// Conditional compilation with features
#[cfg(feature = "postgres")]
pub mod postgres_repo;

#[cfg(feature = "sqlite")]
pub mod sqlite_repo;

// Feature-gated dependencies
#[cfg(feature = "tracing")]
use tracing::instrument;

#[cfg_attr(feature = "tracing", instrument(skip(pool)))]
pub async fn get_user(pool: &PgPool, id: i64) -> Result<User> {
    // ...
}
```

### Feature Flag Rules

| Rule | Reason |
|---|---|
| Features must be additive | Enabling a feature must not break other features |
| No feature removes functionality | Only adds capabilities |
| Default features for common use case | Minimal set for typical usage |
| Document all features in README | Users need to know what is available |

---

## Module Organization

### File-Based vs `mod.rs`

```rust
// PREFERRED (Rust 2024): File-based modules
// src/models.rs       (for simple modules)
// src/models/user.rs  (for modules with submodules, use src/models.rs as the parent)

// ACCEPTABLE: mod.rs style
// src/models/mod.rs   (re-exports submodules)

// BAD: Mixing both styles in the same project
```

### Re-export Pattern

```rust
// src/models.rs (or src/models/mod.rs)
mod user;
mod post;
mod comment;

// Re-export public types for ergonomic imports
pub use comment::Comment;
pub use post::{Post, PostStatus};
pub use user::{User, NewUser};

// Consumers import from the module, not the file:
// use crate::models::User;  // GOOD
// use crate::models::user::User;  // Also fine but less ergonomic
```

---

## Visibility Rules

### Default to `pub(crate)`

```rust
// GOOD: Minimal visibility
pub(crate) struct UserService {
    pool: PgPool,
}

pub(crate) async fn create_user(pool: &PgPool, data: &NewUser) -> Result<User> {
    // ...
}

// Public only for items that are part of the crate's API
pub struct User {
    pub id: i64,
    pub email: String,
    pub name: String,
    pub(crate) password_hash: String,  // Not exposed to consumers
}

// BAD: Everything pub
pub struct UserService {
    pub pool: PgPool,           // Leaks implementation detail
    pub cache: HashMap<i64, User>,  // Internal state exposed
}
```

### Visibility Guidelines

| Scope | Use For |
|---|---|
| `pub` | Public API items (types, traits, functions consumers need) |
| `pub(crate)` | Internal shared items (services, utilities, helpers) |
| `pub(super)` | Items shared with parent module only |
| Private (default) | Implementation details within a module |

---

## Documentation

### Doc Comments

```rust
//! Crate-level documentation.
//!
//! This crate provides user management functionality including
//! registration, authentication, and profile operations.

/// A registered user in the system.
///
/// Users are created through [`UserService::create`] and can be
/// looked up by ID or email address.
///
/// # Examples
///
/// ```
/// use my_core::models::User;
///
/// let user = User {
///     id: 1,
///     email: "alice@example.com".to_string(),
///     name: "Alice".to_string(),
/// };
/// assert_eq!(user.email, "alice@example.com");
/// ```
pub struct User {
    /// Unique identifier assigned by the database.
    pub id: i64,
    /// Email address, guaranteed unique across all users.
    pub email: String,
    /// Display name.
    pub name: String,
}

/// Create a new user account.
///
/// Validates email uniqueness and hashes the password before
/// persisting to the database.
///
/// # Errors
///
/// Returns [`AppError::Conflict`] if the email is already registered.
/// Returns [`AppError::Database`] if the database operation fails.
pub async fn create_user(pool: &PgPool, data: &NewUser) -> Result<User, AppError> {
    // ...
}
```

### When to Write Doc Comments

| Element | Doc Comment Required? |
|---|---|
| Public struct/enum | Yes |
| Public function/method | Yes |
| Public trait | Yes |
| Crate root (`lib.rs`) | Yes (`//!`) |
| `pub(crate)` items | Only if non-obvious |
| Private items | Only if non-obvious |
| Test functions | No (name is the doc) |

### Building Documentation

```bash
# Build docs for your crate
cargo doc --no-deps --open

# Build docs for all dependencies too
cargo doc --open

# Check doc links are valid
cargo doc --no-deps 2>&1 | grep "warning"
```

---

## Git Workflow

### Branch Strategy

```
main              # Production-ready, always deployable
  └── feat/...    # Feature branches (short-lived)
  └── fix/...     # Bug fix branches
  └── chore/...   # Maintenance, dependency updates
```

### Conventional Commits

```
feat: add user registration endpoint
fix: prevent duplicate email registration
refactor: extract password hashing to utility module
test: add integration tests for payment flow
docs: update API authentication guide
chore: upgrade axum to 0.8
ci: add cargo deny check to pipeline
perf: optimize user query with index hint
```

### Commit Types

| Type | Description |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes nor adds |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Maintenance, dependencies, tooling |
| `ci` | CI/CD configuration changes |
| `perf` | Performance improvement |

**Rule**: One logical change per commit. If the commit message needs "and", split it.

---

## Environment Configuration

### Using `dotenvy` and Typed Config

```rust
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Config {
    #[serde(default = "default_port")]
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    #[serde(default)]
    pub debug: bool,
}

fn default_port() -> u16 {
    8080
}

impl Config {
    pub fn from_env() -> Result<Self, envy::Error> {
        dotenvy::dotenv().ok(); // Load .env if present
        envy::from_env()
    }
}
```

### `.env` Files

```bash
# .env (local development -- NEVER commit)
DATABASE_URL=postgres://user:pass@localhost:5432/myapp
REDIS_URL=redis://localhost:6379
DEBUG=true

# .env.example (committed, documents required vars)
DATABASE_URL=postgres://user:pass@localhost:5432/myapp
REDIS_URL=redis://localhost:6379
DEBUG=false
```

---

## Dependency Management

### Rules

- Use workspace dependencies for shared crates
- Pin major versions in `Cargo.toml`
- Commit `Cargo.lock` for applications (not libraries)
- Run `cargo update` regularly (weekly or per sprint)
- Audit with `cargo audit` and `cargo deny` in CI

```bash
# Update all dependencies
cargo update

# Update specific dependency
cargo update -p axum

# Check for outdated dependencies
cargo install cargo-outdated
cargo outdated
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Giant `lib.rs` with all code | Unnavigable | Split into modules by domain |
| `pub` on everything | Leaks internals | Default to `pub(crate)` |
| No workspace for multi-crate | Duplicated dependency versions | Use workspace dependencies |
| Missing `Cargo.lock` in apps | Non-reproducible builds | Commit lock file for binaries |
| Wildcard versions (`*`) | Breaking updates | Pin at least major version |
| No doc comments on public API | Undiscoverable API | Document all public items |
| Feature flags that remove functionality | Breaks consumers | Features must be additive |

---

_Conventions reduce cognitive load. Follow them consistently so the team can focus on solving problems, not debating structure._
