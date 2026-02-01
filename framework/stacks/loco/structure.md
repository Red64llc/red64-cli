# Project Structure

## Organization Philosophy

Convention over configuration, inspired by Rails. File location implies behavior. Loco enforces a standard layout where folder structure, configuration shape, and wiring all matter. Extend with custom modules as complexity grows.

---

## Directory Patterns

### Application Core (`src/`)
**Purpose**: All application code following Loco conventions
**Pattern**: Convention-driven -- generators create files in the right place

| Directory | Purpose | Naming |
|-----------|---------|--------|
| `controllers/` | HTTP request handlers (thin, delegate to models) | snake_case (`posts.rs`, `auth.rs`) |
| `models/` | Domain logic, ActiveRecord-style methods | snake_case (`users.rs`, `posts.rs`) |
| `models/_entities/` | Auto-generated SeaORM entities (read-only) | snake_case, prefixed with `_` |
| `views/` | JSON serialization structs and response shaping | snake_case (`posts.rs`, `auth.rs`) |
| `workers/` | Background job handlers | snake_case (`report_worker.rs`) |
| `tasks/` | CLI-invokable administrative tasks | snake_case (`sync_data.rs`) |
| `mailers/` | Email templates and delivery logic | snake_case (`auth.rs`) |
| `initializers/` | App startup hooks (extra DB, custom state) | snake_case (`view_engine.rs`) |

### Generated Entities (`src/models/_entities/`)
**Purpose**: SeaORM auto-generated entity files -- never edit manually
**Pattern**: Regenerated from database schema via `cargo loco db entities`

```
src/models/_entities/
  mod.rs              # Re-exports all entities
  users.rs            # Auto-generated User entity
  posts.rs            # Auto-generated Post entity
  prelude.rs          # Common imports
```

### Configuration (`config/`)
**Purpose**: Environment-specific YAML configuration
**Pattern**: One file per environment, merged with defaults

```
config/
  development.yaml    # Dev settings (auto_migrate: true, debug logging)
  test.yaml           # Test settings (dangerously_truncate: true)
  production.yaml     # Production settings (no dangerous flags)
```

### Migrations (`migration/`)
**Purpose**: Database schema changes, versioned and reproducible
**Pattern**: Timestamped, descriptive names that drive auto-detection

```
migration/
  src/
    lib.rs            # Migration registry
    m20231001_000001_create_users.rs
    m20231002_000001_create_posts.rs
```

### Tests (`tests/`)
**Purpose**: Integration and request tests
**Pattern**: Mirror controller structure

```
tests/
  requests/
    posts.rs          # Controller integration tests
    auth.rs           # Auth endpoint tests
  models/
    users.rs          # Model unit tests
  workers/
    report_worker.rs  # Worker tests
```

### Frontend (optional) (`frontend/`)
**Purpose**: SPA frontend when using Loco with a JS framework
**Pattern**: Separate directory, served as static assets

---

## Naming Conventions

### Rust / Loco
- **Models**: Singular, PascalCase for type (`User`, `Post`), snake_case for file (`users.rs`)
- **Controllers**: snake_case, grouped by resource (`posts.rs`, `auth.rs`)
- **Views**: snake_case, mirrors controller (`posts.rs`)
- **Workers**: Descriptive + Worker (`ReportWorker` in `report_worker.rs`)
- **Tasks**: Descriptive (`SyncData` in `sync_data.rs`)
- **Migrations**: Timestamped + descriptive (`m20231001_000001_create_users`)
- **Tables**: Plural, snake_case (`users`, `draft_posts`)
- **Columns**: snake_case (`created_at`, `user_id`)

### Files
- **Rust source**: snake_case (`user_service.rs`)
- **Config**: kebab or snake_case YAML (`development.yaml`)
- **Migrations**: Timestamp-prefixed (`m20231001_000001_*.rs`)

---

## Module Organization

### `src/app.rs`
Central application hook -- register routes, workers, tasks, initializers:

```rust
impl Hooks for App {
    fn routes(ctx: &AppContext) -> AppRoutes {
        AppRoutes::with_default_routes()
            .prefix("api")
            .add_route(controllers::posts::routes())
            .add_route(controllers::auth::routes())
    }

    async fn connect_workers(ctx: &AppContext, queue: &Queue) -> Result<()> {
        queue.register(ReportWorker::build(ctx)).await?;
        Ok(())
    }
}
```

### `src/lib.rs`
Module declarations and re-exports:

```rust
pub mod app;
pub mod controllers;
pub mod models;
pub mod views;
pub mod workers;
pub mod tasks;
pub mod mailers;
```

---

## Configuration Patterns

### Environment-Specific (`config/*.yaml`)
- Development: `auto_migrate: true`, debug logging, relaxed settings
- Test: `dangerously_truncate: true` for clean test runs
- Production: no dangerous flags, explicit migration, secure JWT secret

### Key Config Sections
```yaml
server:
  port: 5150
  host: http://localhost

database:
  uri: postgres://localhost/myapp_dev
  auto_migrate: true
  min_connections: 1
  max_connections: 5

auth:
  jwt:
    secret: <secure-random>
    expiration: 604800  # 7 days

workers:
  mode: BackgroundAsync  # or BackgroundQueue for Redis

queue:
  kind: Redis
  uri: redis://localhost:6379

logger:
  level: debug
  format: compact
```

---

## Import Organization

```rust
// Standard library
use std::sync::Arc;

// External crates
use loco_rs::prelude::*;
use sea_orm::*;
use serde::{Deserialize, Serialize};

// Internal modules
use crate::models::_entities::users;
use crate::views::posts::PostResponse;
```

---

_Document patterns, not file trees. New files following patterns should not require updates._
