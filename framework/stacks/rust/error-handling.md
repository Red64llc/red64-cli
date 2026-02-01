# Error Handling Patterns

Structured error handling for Rust applications with `thiserror` for libraries, `anyhow` for applications, and the `?` operator everywhere.

---

## Philosophy

- **`Result<T, E>` everywhere**: No panics in production code, no silent failures
- **Typed errors for libraries**: Use `thiserror` so callers can match on variants
- **Ergonomic errors for applications**: Use `anyhow` at the application boundary
- **Context propagation**: Always add context when crossing abstraction boundaries
- **Fail fast**: Validate inputs early, return errors immediately with `?`

---

## Error Strategy: `thiserror` vs `anyhow`

| Layer | Crate | Purpose |
|---|---|---|
| Library / shared crates | `thiserror` | Custom error enums callers can match on |
| Application / binary | `anyhow` | Ergonomic error propagation with context |
| HTTP boundary (Axum) | `thiserror` + `IntoResponse` | Map domain errors to HTTP status codes |

```rust
// GOOD: thiserror for domain/library errors
#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("User not found: {0}")]
    NotFound(i64),

    #[error("Email already registered: {0}")]
    DuplicateEmail(String),

    #[error("Invalid email format: {0}")]
    InvalidEmail(String),

    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

// GOOD: anyhow for application-level code
use anyhow::{Context, Result};

async fn run_migration(pool: &PgPool) -> Result<()> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .context("Failed to run database migrations")?;
    Ok(())
}

// BAD: Using anyhow in a library crate
pub fn parse_config(path: &str) -> anyhow::Result<Config> {
    // Callers cannot match on specific error types
}

// BAD: Using thiserror for top-level CLI error handling
fn main() -> Result<(), AppError> {
    // Unnecessarily verbose for a binary
}
```

---

## Custom Error Enums with `thiserror`

### Domain Errors

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Resource not found: {resource} ({id})")]
    NotFound {
        resource: &'static str,
        id: String,
    },

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Validation failed: {0}")]
    Validation(String),

    #[error("Authentication required")]
    Unauthenticated,

    #[error("Insufficient permissions")]
    Forbidden,

    #[error("External service error ({service}): {message}")]
    ExternalService {
        service: String,
        message: String,
    },

    #[error(transparent)]
    Database(#[from] sqlx::Error),

    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}
```

### Axum `IntoResponse` Integration

```rust
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::NotFound { resource, id } => (
                StatusCode::NOT_FOUND,
                "NOT_FOUND",
                format!("{resource} not found: {id}"),
            ),
            AppError::Conflict(msg) => (
                StatusCode::CONFLICT,
                "CONFLICT",
                msg.clone(),
            ),
            AppError::Validation(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR",
                msg.clone(),
            ),
            AppError::Unauthenticated => (
                StatusCode::UNAUTHORIZED,
                "UNAUTHENTICATED",
                "Authentication required".to_string(),
            ),
            AppError::Forbidden => (
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
                "Insufficient permissions".to_string(),
            ),
            AppError::ExternalService { service, message } => (
                StatusCode::BAD_GATEWAY,
                "EXTERNAL_SERVICE_ERROR",
                format!("External service error ({service}): {message}"),
            ),
            AppError::Database(e) => {
                tracing::error!(error = %e, "Database error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "An internal error occurred".to_string(),
                )
            }
            AppError::Internal(e) => {
                tracing::error!(error = %e, "Internal error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "An internal error occurred".to_string(),
                )
            }
        };

        let body = Json(json!({
            "error": {
                "code": code,
                "message": message,
            }
        }));

        (status, body).into_response()
    }
}
```

---

## The `?` Operator

### Propagation with `?`

```rust
// GOOD: Clean propagation with ?
async fn get_user_posts(pool: &PgPool, user_id: i64) -> Result<Vec<Post>, AppError> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound { resource: "User", id: user_id.to_string() })?;

    let posts = sqlx::query_as!(Post, "SELECT * FROM posts WHERE user_id = $1", user.id)
        .fetch_all(pool)
        .await?;

    Ok(posts)
}

// BAD: Manual matching instead of ?
async fn get_user_posts(pool: &PgPool, user_id: i64) -> Result<Vec<Post>, AppError> {
    let user = match sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_optional(pool)
        .await
    {
        Ok(Some(u)) => u,
        Ok(None) => return Err(AppError::NotFound { resource: "User", id: user_id.to_string() }),
        Err(e) => return Err(AppError::Database(e)),
    };
    // ... more nested matches
}
```

---

## Error Context with `anyhow`

### Adding Context

```rust
use anyhow::{Context, Result};

// GOOD: Context explains what was happening when the error occurred
async fn load_config(path: &str) -> Result<Config> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read config file: {path}"))?;

    let config: Config = toml::from_str(&content)
        .with_context(|| format!("Failed to parse config file: {path}"))?;

    Ok(config)
}

// BAD: No context -- error message is just "No such file or directory"
async fn load_config(path: &str) -> Result<Config> {
    let content = std::fs::read_to_string(path)?;
    let config: Config = toml::from_str(&content)?;
    Ok(config)
}
```

### Context in Async Chains

```rust
// GOOD: Context on each fallible step
async fn sync_user(pool: &PgPool, external_id: &str) -> Result<User> {
    let external_user = fetch_external_user(external_id)
        .await
        .context("Failed to fetch user from external service")?;

    let user = upsert_user(pool, &external_user)
        .await
        .context("Failed to upsert user in database")?;

    send_sync_notification(&user)
        .await
        .context("Failed to send sync notification")?;

    Ok(user)
}
```

---

## `From` Implementations

### Automatic with `thiserror`

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    // #[from] auto-generates From<sqlx::Error> for AppError
    #[error(transparent)]
    Database(#[from] sqlx::Error),

    // #[from] auto-generates From<serde_json::Error> for AppError
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

// Now ? works automatically:
async fn get_user(pool: &PgPool, id: i64) -> Result<User, AppError> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
        .fetch_one(pool)
        .await?;  // sqlx::Error -> AppError via From
    Ok(user)
}
```

### Manual `From` When Needed

```rust
// When you need custom conversion logic
impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            AppError::ExternalService {
                service: "http_client".to_string(),
                message: "Request timed out".to_string(),
            }
        } else if err.is_connect() {
            AppError::ExternalService {
                service: "http_client".to_string(),
                message: "Connection failed".to_string(),
            }
        } else {
            AppError::Internal(err.into())
        }
    }
}
```

---

## No `unwrap()` in Production

### Alternatives to `unwrap()`

```rust
// GOOD: Propagate with ?
let user = get_user(pool, id).await?;

// GOOD: Provide default
let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());

// GOOD: Convert to Result with ok_or
let user = users.get(0).ok_or(AppError::NotFound {
    resource: "User",
    id: "first".to_string(),
})?;

// GOOD: expect() in tests and initialization (with justification)
let pool = PgPool::connect(&database_url)
    .await
    .expect("DATABASE_URL must point to a valid Postgres instance");

// BAD: unwrap in production code
let user = get_user(pool, id).await.unwrap();  // PANICS if None/Err
let config = std::fs::read_to_string("config.toml").unwrap();  // PANICS if file missing
```

### When `expect()` Is Acceptable

| Context | Acceptable? | Reason |
|---|---|---|
| Tests | Yes | Test failure is the correct behavior |
| `main()` initialization | Yes | Cannot proceed without config/db |
| After validation guard | Cautiously | Document why it cannot fail |
| Production request handling | Never | Panics crash the server |

---

## Error Logging with `tracing`

### Log at the Boundary

```rust
// GOOD: Log once at the boundary, not at every layer
async fn create_user_handler(
    State(pool): State<PgPool>,
    Json(data): Json<CreateUserRequest>,
) -> Result<Json<UserResponse>, AppError> {
    let user = create_user(&pool, &data).await.map_err(|e| {
        tracing::error!(
            error = %e,
            email = %data.email,
            "Failed to create user"
        );
        e
    })?;
    Ok(Json(UserResponse::from(user)))
}

// BAD: Logging at every layer
async fn create_user(pool: &PgPool, data: &CreateUserRequest) -> Result<User, AppError> {
    let hash = hash_password(&data.password).map_err(|e| {
        tracing::error!("hash failed: {}", e);  // Too noisy
        e
    })?;
    // ...
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `.unwrap()` in handlers | Panics crash the server | Use `?` with proper error types |
| `Box<dyn Error>` in libraries | Callers cannot match on variants | Use `thiserror` enums |
| Stringly-typed errors | No programmatic handling | Use typed error enums |
| Catching and ignoring errors | Hides bugs | Log and propagate or handle explicitly |
| `anyhow` in library crates | Callers lose type information | Reserve for application code |
| Error messages with internal details | Security risk in API responses | Return safe messages, log details |
| Re-implementing `From` that `thiserror` provides | Boilerplate | Use `#[from]` attribute |

---

_Errors are values in Rust. Classify them with `thiserror`, propagate them with `?`, enrich them with `.context()`, and handle them at the boundary._
