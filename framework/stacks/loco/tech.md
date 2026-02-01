# Technology Stack

## Architecture

Rust web application built on Loco framework (Rails-inspired). Axum-based HTTP layer, SeaORM for persistence, Tokio async runtime, background workers via Redis or in-process queues, single-binary deployment.

---

## Core Technologies

- **Language**: Rust stable (Edition 2021, 1.70+)
- **Framework**: Loco (Rails-inspired, convention over configuration)
- **Web Server**: Axum (Tower-based, Tokio-native)
- **Async Runtime**: Tokio (multi-threaded)
- **ORM**: SeaORM (async, ActiveRecord-style)
- **Database**: PostgreSQL, SQLite, or MySQL
- **Serialization**: serde + serde_json

---

## Key Libraries

### Web & API
- **Axum**: HTTP routing and middleware (managed by Loco)
- **Tower / tower-http**: Middleware stack (CORS, compression, tracing, secure headers)
- **utoipa**: OpenAPI documentation generation
- **validator**: Struct validation with derive macros

### Database & Storage
- **SeaORM**: Async ORM with migration system and entity generation
- **sea-orm-cli**: Code generation and migration tooling
- **loco-rs storage**: Multi-backend storage (disk, S3, GCP, Azure, in-memory)

### Background Processing
- **sidekiq-rs** (via Loco): Redis-backed background job queue
- **Tokio tasks**: In-process async workers for lightweight jobs

### Authentication & Security
- **jsonwebtoken**: JWT token generation and validation
- **bcrypt**: Password hashing
- **loco-rs auth**: Built-in JWT + API key authentication middleware

### Serialization & Validation
- **serde**: Derive-based serialization/deserialization
- **serde_json**: JSON support
- **validator**: Struct-level validation with derive macros

### Observability
- **tracing**: Structured, async-aware logging and diagnostics
- **tracing-subscriber**: Log formatting (compact, pretty, JSON)

### Testing
- **cargo test / cargo-nextest**: Test execution
- **loco-rs testing**: Custom test kit per app layer (models, requests, workers)
- **insta**: Snapshot testing for views and responses

---

## Development Environment

### Required Tools
- Rust stable 1.70+ (Edition 2021)
- Cargo (bundled with rustup)
- Loco CLI (`cargo install loco`)
- SeaORM CLI (`cargo install sea-orm-cli`)
- PostgreSQL 14+ or SQLite3
- Redis 7+ (for queue-backed workers)
- Docker & Docker Compose (optional)

### Common Commands
```bash
# Project setup
loco new                              # Scaffold new project
cargo build                           # Build project
cargo build --release                 # Release build

# Dev server
cargo loco start                      # Start server
cargo loco start --server-and-worker  # Server + workers in one process

# Workers
cargo loco start --worker             # Standalone worker process
cargo loco start --worker email       # Worker filtered by tag

# Generators
cargo loco generate model posts title:string! content:text
cargo loco generate controller posts
cargo loco generate scaffold posts title:string! content:text
cargo loco generate worker report_generator
cargo loco generate task sync_data

# Database
cargo loco db migrate                 # Run pending migrations
cargo loco db down                    # Rollback last migration
cargo loco db seed                    # Seed database
cargo loco db entities                # Regenerate entities from schema

# Tasks
cargo loco task <task_name>           # Run a task

# Code quality
cargo clippy -- -D warnings           # Lint (deny warnings)
cargo fmt                             # Format
cargo test                            # All tests
cargo nextest run                     # Faster parallel test runner

# Deployment
cargo loco generate deployment        # Generate Docker/Nginx/Shuttle configs
cargo loco doctor --production        # Validate production environment
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Loco over bare Axum** | Convention over configuration; generators, auth, workers, and ORM integrated out of the box |
| **SeaORM over SQLx/Diesel** | ActiveRecord-style fits Loco's Rails philosophy; async-native, migration system, entity generation |
| **Axum (via Loco)** | Tower middleware ecosystem, Tokio-native, best DX in Rust web |
| **Redis queue over in-process** | Scales horizontally; workers run as separate processes in production |
| **JWT for authentication** | Stateless, SaaS-ready; built into Loco's starter templates |
| **tracing over log** | Structured, span-based, async-aware, OpenTelemetry compatible |
| **Single binary deployment** | No runtime dependencies on server; ~20MB binary, minimal resource usage |
| **Convention over configuration** | Folder structure, config shape, and wiring follow Loco conventions to reduce decision fatigue |

---

_Document standards and patterns, not every dependency. See `loco.md` for detailed framework conventions._
