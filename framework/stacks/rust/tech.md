# Technology Stack

## Architecture

Modern Rust application with async-first design. Axum or Actix-web as web framework, PostgreSQL for persistence, Redis for caching, Tokio as async runtime, Docker for deployment.

---

## Core Technologies

- **Language**: Rust stable (Edition 2024, 1.85+)
- **Build System**: Cargo (with cargo-nextest for testing)
- **Web Framework**: Axum (default) or Actix-web (high-throughput)
- **Async Runtime**: Tokio (multi-threaded)
- **Database**: PostgreSQL with SQLx (async, compile-time checked)
- **Serialization**: serde + serde_json

---

## Key Libraries

### Web & API
- **Axum**: Tower-based web framework, excellent DX, Tokio ecosystem native
- **Actix-web**: Actor-based, highest raw throughput for extreme concurrency
- **Tower**: Middleware and service abstractions (used by Axum)
- **tower-http**: HTTP-specific middleware (CORS, compression, tracing)

### Database & Storage
- **SQLx**: Async, compile-time verified SQL queries (PostgreSQL, MySQL, SQLite)
- **Diesel**: Sync ORM with strong type safety and migration system
- **SeaORM**: Async ORM built on SQLx, ActiveRecord-style
- **deadpool**: Connection pooling for async database drivers

### Serialization & Validation
- **serde**: Derive-based serialization/deserialization framework
- **serde_json**: JSON support
- **validator**: Struct validation with derive macros
- **utoipa**: OpenAPI documentation generation from code

### Error Handling
- **thiserror**: Derive macro for custom error types (libraries)
- **anyhow**: Ergonomic error handling for applications
- **miette**: Diagnostic error reporting with source spans

### CLI
- **clap**: Command-line argument parser with derive macros
- **dialoguer**: Interactive prompts
- **indicatif**: Progress bars and spinners

### Observability
- **tracing**: Structured, async-aware logging and diagnostics
- **tracing-subscriber**: Log formatting and filtering
- **opentelemetry**: Distributed tracing integration

### Testing
- **cargo test / cargo-nextest**: Test execution
- **mockall**: Trait-based mocking framework
- **proptest**: Property-based testing
- **wiremock**: HTTP mock server for integration tests
- **rstest**: Fixture and parametrize support

---

## Development Environment

### Required Tools
- Rust stable 1.85+ (Edition 2024)
- Cargo (bundled with rustup)
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose

### Common Commands
```bash
# Environment setup
rustup update stable               # Update toolchain
cargo build                         # Build project
cargo build --release               # Release build

# Dev server (Axum example)
cargo run                           # Run application
cargo watch -x run                  # Auto-reload on changes

# Tests
cargo test                          # All tests
cargo nextest run                   # Faster parallel test runner
cargo test --doc                    # Doctests only

# Code quality
cargo clippy -- -D warnings         # Lint (deny warnings)
cargo fmt                           # Format
cargo fmt -- --check                # Verify formatting

# Database (SQLx)
sqlx migrate run                    # Apply migrations
sqlx migrate add <name>             # Create new migration
sqlx prepare                        # Generate offline query data

# Docker
docker compose up -d                # Start services
docker compose logs -f app          # Follow app logs
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Axum over Actix-web** | Better DX, Tokio-native, Tower middleware ecosystem, most adopted since 2023 |
| **SQLx over Diesel** | Async-native, compile-time SQL verification, no DSL learning curve |
| **Tokio runtime** | Industry standard, largest async ecosystem, multi-threaded by default |
| **thiserror + anyhow** | thiserror for library error types, anyhow for application-level propagation |
| **tracing over log** | Structured, span-based, async-aware, OpenTelemetry compatible |
| **serde for serialization** | Universal Rust standard, zero-cost abstractions, derive macros |
| **cargo-nextest** | Faster parallel execution, better output, retries support |
| **Edition 2024** | Latest stable edition with improved ergonomics and safety defaults |

---

_Document standards and patterns, not every dependency. See individual steering docs for detailed conventions._
