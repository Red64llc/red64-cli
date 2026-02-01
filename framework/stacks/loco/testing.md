# Testing

Testing conventions for Loco applications. Loco provides a custom test kit tailored per app layer.

---

## Philosophy

- **Test models thoroughly**: Fat models means model tests cover most logic
- **Test controllers via requests**: Integration tests over unit tests for HTTP layer
- **Test workers in isolation**: Use `ForegroundBlocking` mode in test config
- **Snapshot tests for views**: Reduce assertion boilerplate with `insta`

---

## Setup

### Enable Testing Features
```toml
# Cargo.toml
[dev-dependencies]
loco-rs = { version = "*", features = ["testing"] }
serial_test = "3"
insta = { version = "1", features = ["yaml", "redactions"] }
```

### Test Configuration (`config/test.yaml`)
```yaml
database:
  uri: postgres://localhost/myapp_test
  dangerously_truncate: true    # Clean DB per test
  auto_migrate: true

workers:
  mode: ForegroundBlocking       # Synchronous worker execution
```

---

## Model Tests

Test domain logic directly on models:

```rust
#[tokio::test]
async fn test_create_user() {
    let boot = boot_test::<App, Migrator>().await.unwrap();
    seed::<App>(&boot.app_context).await.unwrap();

    let user = users::ActiveModel::register(
        &boot.app_context.db,
        &RegisterParams {
            email: "test@example.com".into(),
            password: "secure123".into(),
            name: "Test User".into(),
        },
    )
    .await
    .unwrap();

    assert_eq!(user.email, "test@example.com");
    assert!(user.email_verification_token.is_some());
}
```

---

## Request Tests (Controllers)

Generated automatically with `cargo loco generate controller`. Test full HTTP request/response cycle:

```rust
use loco_rs::testing::prelude::*;

#[tokio::test]
#[serial]
async fn test_list_posts() {
    request::<App, Migrator, _, _>(|request, ctx| async move {
        seed::<App>(&ctx).await.unwrap();

        let response = request.get("/api/posts").await;

        assert_eq!(response.status_code(), 200);
        response.assert_json_contains(json!([{"title": "First Post"}]));
    })
    .await;
}

#[tokio::test]
#[serial]
async fn test_create_post_authenticated() {
    request::<App, Migrator, _, _>(|request, ctx| async move {
        let user = prepare_authenticated_user(&ctx).await;

        let response = request
            .post("/api/posts")
            .add_header("Authorization", format!("Bearer {}", user.token))
            .json(&json!({"title": "New Post", "content": "Hello"}))
            .await;

        assert_eq!(response.status_code(), 201);
    })
    .await;
}
```

### Database Isolation
Use `request_with_create_db` for async tests requiring isolated schemas:

```rust
#[tokio::test]
async fn test_concurrent_safe() {
    request_with_create_db::<App, Migrator, _, _>(|request, ctx| async move {
        // Each test gets its own database schema
    })
    .await;
}
```

---

## Worker Tests

Configure `ForegroundBlocking` in test config for synchronous execution:

```rust
#[tokio::test]
async fn test_report_worker() {
    let boot = boot_test::<App, Migrator>().await.unwrap();

    let result = ReportWorker::perform_later(
        &boot.app_context,
        ReportArgs { user_id: 1 },
    )
    .await;

    assert!(result.is_ok());
}
```

---

## Snapshot Testing

Use `insta` to snapshot API responses and reduce manual assertions:

```rust
#[tokio::test]
#[serial]
async fn test_user_response_shape() {
    request::<App, Migrator, _, _>(|request, ctx| async move {
        let response = request.get("/api/users/1").await;

        insta::assert_yaml_snapshot!(
            response.json::<serde_json::Value>(),
            {
                ".created_at" => "[timestamp]",
                ".updated_at" => "[timestamp]",
            }
        );
    })
    .await;
}
```

---

## Test Organization

```
tests/
  requests/           # Controller integration tests
    posts.rs
    auth.rs
  models/             # Model unit tests
    users.rs
    posts.rs
  workers/            # Worker tests
    report_worker.rs
```

**Pattern**: Mirror `src/` structure in `tests/`.

---

## Common Commands

```bash
cargo test                          # Run all tests
cargo nextest run                   # Faster parallel runner
cargo test -- --test-threads=1      # Serial execution (DB-dependent)
cargo test tests::requests::posts   # Run specific module
cargo insta review                  # Review snapshot changes
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Testing controller logic directly | Misses middleware, auth, routing | Use request tests via `loco_rs::testing` |
| Shared test database without truncation | Flaky tests from leftover data | Enable `dangerously_truncate` in test config |
| Testing auto-generated entities | Tests break on regeneration | Test your model methods, not SeaORM internals |
| `BackgroundAsync` in tests | Non-deterministic worker execution | Use `ForegroundBlocking` mode |
| Large assertion blocks | Brittle, hard to maintain | Use `insta` snapshot testing |
| Skipping auth in tests | Misses permission bugs | Use helper to create authenticated test requests |

---

_Test models for correctness, controllers for integration, workers for isolation. Let generators create test scaffolding._
