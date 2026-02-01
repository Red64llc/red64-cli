# Testing Patterns

Comprehensive testing patterns for Rust projects with `cargo-nextest`, `mockall`, `rstest`, and `proptest`.

---

## Philosophy

- **Fast feedback**: Unit tests run in milliseconds, no I/O
- **Compile-time confidence**: The type system catches most bugs; tests cover the rest
- **Readable tests**: Arrange-Act-Assert structure, descriptive names
- **Test at the right level**: Unit tests for logic, integration tests for boundaries

---

## Test Organization

### Project Layout

```
src/
  lib.rs
  models/
    user.rs          # Contains #[cfg(test)] mod tests at bottom
    post.rs
  services/
    user_service.rs  # Contains #[cfg(test)] mod tests at bottom
tests/
  common/
    mod.rs           # Shared test helpers and fixtures
  api/
    users_test.rs    # Integration tests for user API
    posts_test.rs
  db/
    user_repo_test.rs
```

**Pattern**: Unit tests live in the same file as the code. Integration tests live in `tests/`.

### Unit Tests (Same File)

```rust
// src/services/user_service.rs

pub fn validate_email(email: &str) -> bool {
    email.contains('@') && email.contains('.')
}

pub fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_email_valid() {
        assert!(validate_email("user@example.com"));
        assert!(validate_email("user@sub.example.com"));
    }

    #[test]
    fn test_validate_email_invalid() {
        assert!(!validate_email("invalid"));
        assert!(!validate_email(""));
        assert!(!validate_email("@example.com"));
    }

    #[test]
    fn test_normalize_email() {
        assert_eq!(normalize_email("  User@Example.COM  "), "user@example.com");
    }
}
```

### Integration Tests (`tests/` Directory)

```rust
// tests/api/users_test.rs
use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;

#[tokio::test]
async fn test_create_user_success() {
    let server = spawn_test_server().await;

    let response = server
        .post("/api/v1/users")
        .json(&json!({
            "email": "new@example.com",
            "name": "New User",
            "password": "secure123"
        }))
        .await;

    assert_eq!(response.status_code(), StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert_eq!(body["email"], "new@example.com");
    assert!(body.get("password").is_none());
}

#[tokio::test]
async fn test_create_user_duplicate_email_returns_409() {
    let server = spawn_test_server().await;
    seed_user(&server, "taken@example.com").await;

    let response = server
        .post("/api/v1/users")
        .json(&json!({
            "email": "taken@example.com",
            "name": "Duplicate",
            "password": "secure123"
        }))
        .await;

    assert_eq!(response.status_code(), StatusCode::CONFLICT);
}
```

---

## Async Tests with `tokio::test`

```rust
// GOOD: Async test with tokio
#[tokio::test]
async fn test_fetch_user_from_database() {
    let pool = setup_test_db().await;
    let user = create_test_user(&pool).await;

    let found = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user.id)
        .fetch_optional(&pool)
        .await
        .unwrap();

    assert!(found.is_some());
    assert_eq!(found.unwrap().email, user.email);
}

// With custom runtime configuration
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_concurrent_operations() {
    // ...
}
```

---

## Assertions

### Standard Assertions

```rust
#[test]
fn test_assertions() {
    // Basic assertions
    assert!(result.is_ok());
    assert_eq!(user.name, "Alice");
    assert_ne!(user.id, 0);

    // With custom messages
    assert!(
        user.is_active,
        "Expected user {} to be active, but was inactive",
        user.id
    );

    // Pattern matching with assert_matches (nightly or use matches! macro)
    assert!(matches!(result, Ok(User { is_active: true, .. })));
    assert!(matches!(error, AppError::NotFound { .. }));
}
```

### Testing Errors

```rust
#[test]
fn test_invalid_email_returns_error() {
    let result = Email::new("invalid");
    assert!(result.is_err());

    let err = result.unwrap_err();
    assert!(err.to_string().contains("Invalid email"));
}

#[tokio::test]
async fn test_get_missing_user_returns_not_found() {
    let pool = setup_test_db().await;
    let service = UserService::new(pool);

    let result = service.get_user(99999).await;

    assert!(matches!(result, Err(AppError::NotFound { .. })));
}
```

---

## Fixtures with `rstest`

### Basic Fixtures

```rust
use rstest::rstest;

#[rstest]
fn test_validate_email(
    #[values("user@example.com", "admin@test.org", "a@b.co")]
    valid_email: &str,
) {
    assert!(validate_email(valid_email));
}

#[rstest]
fn test_reject_invalid_email(
    #[values("", "invalid", "@example.com", "user@", "user @example.com")]
    invalid_email: &str,
) {
    assert!(!validate_email(invalid_email));
}
```

### Shared Fixtures

```rust
use rstest::*;

#[fixture]
fn test_user() -> User {
    User {
        id: 1,
        email: "test@example.com".to_string(),
        name: "Test User".to_string(),
        is_active: true,
    }
}

#[fixture]
async fn test_pool() -> PgPool {
    setup_test_db().await
}

#[rstest]
fn test_user_display(test_user: User) {
    assert_eq!(test_user.to_string(), "Test User <test@example.com>");
}

#[rstest]
#[tokio::test]
async fn test_save_user(#[future] test_pool: PgPool, test_user: User) {
    let pool = test_pool.await;
    let saved = save_user(&pool, &test_user).await.unwrap();
    assert!(saved.id > 0);
}
```

### Parametrized Tests

```rust
#[rstest]
#[case("draft", true)]
#[case("published", false)]
#[case("archived", false)]
fn test_can_publish(#[case] status: &str, #[case] expected: bool) {
    let post = Post { status: status.parse().unwrap(), ..Default::default() };
    assert_eq!(post.can_publish(), expected);
}
```

---

## Mocking with `mockall`

### Trait-Based Mocking

```rust
use mockall::automock;

#[automock]
#[async_trait::async_trait]
pub trait UserRepository {
    async fn get(&self, id: i64) -> Result<Option<User>, sqlx::Error>;
    async fn get_by_email(&self, email: &str) -> Result<Option<User>, sqlx::Error>;
    async fn save(&self, user: &NewUser) -> Result<User, sqlx::Error>;
}

#[tokio::test]
async fn test_create_user_success() {
    // Arrange
    let mut mock_repo = MockUserRepository::new();
    mock_repo
        .expect_get_by_email()
        .with(mockall::predicate::eq("new@example.com"))
        .returning(|_| Ok(None));
    mock_repo
        .expect_save()
        .returning(|new_user| Ok(User {
            id: 1,
            email: new_user.email.clone(),
            name: new_user.name.clone(),
            is_active: true,
        }));

    let service = UserService::new(Box::new(mock_repo));

    // Act
    let result = service.create_user(&CreateUserRequest {
        email: "new@example.com".to_string(),
        name: "New User".to_string(),
        password: "secure123".to_string(),
    }).await;

    // Assert
    assert!(result.is_ok());
    assert_eq!(result.unwrap().email, "new@example.com");
}

#[tokio::test]
async fn test_create_user_duplicate_email() {
    let mut mock_repo = MockUserRepository::new();
    mock_repo
        .expect_get_by_email()
        .returning(|_| Ok(Some(User {
            id: 1,
            email: "taken@example.com".to_string(),
            name: "Existing".to_string(),
            is_active: true,
        })));

    let service = UserService::new(Box::new(mock_repo));

    let result = service.create_user(&CreateUserRequest {
        email: "taken@example.com".to_string(),
        name: "Duplicate".to_string(),
        password: "secure123".to_string(),
    }).await;

    assert!(matches!(result, Err(AppError::Conflict(_))));
}
```

---

## Property Testing with `proptest`

### Basic Property Tests

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_normalize_email_always_lowercase(email in "[a-zA-Z0-9]+@[a-zA-Z]+\\.[a-zA-Z]+") {
        let normalized = normalize_email(&email);
        assert_eq!(normalized, normalized.to_lowercase());
    }

    #[test]
    fn test_parse_and_serialize_roundtrip(id in 1i64..=i64::MAX) {
        let user_id = UserId(id);
        let serialized = serde_json::to_string(&user_id).unwrap();
        let deserialized: UserId = serde_json::from_str(&serialized).unwrap();
        assert_eq!(user_id.0, deserialized.0);
    }

    #[test]
    fn test_pagination_invariants(page in 1u32..=1000, per_page in 1u32..=100) {
        let offset = calculate_offset(page, per_page);
        assert!(offset < page as u64 * per_page as u64);
        assert_eq!(offset, ((page - 1) as u64) * (per_page as u64));
    }
}
```

### Custom Strategies

```rust
use proptest::prelude::*;

fn valid_email_strategy() -> impl Strategy<Value = String> {
    ("[a-z]{1,10}", "[a-z]{1,10}", "[a-z]{2,4}")
        .prop_map(|(user, domain, tld)| format!("{user}@{domain}.{tld}"))
}

proptest! {
    #[test]
    fn test_email_validation_accepts_valid(email in valid_email_strategy()) {
        assert!(validate_email(&email));
    }
}
```

---

## Test Execution with `cargo-nextest`

### Running Tests

```bash
# Install
cargo install cargo-nextest

# Run all tests
cargo nextest run

# Run with output
cargo nextest run --no-capture

# Run specific test
cargo nextest run test_create_user

# Run tests in specific module
cargo nextest run --filter-expr 'test(user_service)'

# Run with retries for flaky tests
cargo nextest run --retries 2

# Run only integration tests
cargo nextest run --filter-expr 'kind(test)'

# Run with specific number of threads
cargo nextest run -j 4
```

### `.config/nextest.toml`

```toml
[profile.default]
retries = 0
slow-timeout = { period = "30s", terminate-after = 2 }
fail-fast = true

[profile.ci]
retries = 2
fail-fast = false
```

---

## Coverage with `cargo-llvm-cov`

```bash
# Install
cargo install cargo-llvm-cov

# Run with coverage
cargo llvm-cov

# Generate HTML report
cargo llvm-cov --html
open target/llvm-cov/html/index.html

# Fail if coverage is below threshold
cargo llvm-cov --fail-under-lines 80

# Generate LCOV for CI integration
cargo llvm-cov --lcov --output-path lcov.info

# Coverage for nextest
cargo llvm-cov nextest
```

---

## Test Markers and Attributes

```rust
// Ignore slow tests by default
#[test]
#[ignore]
fn test_full_pipeline() {
    // Run with: cargo test -- --ignored
}

// Conditional compilation
#[cfg(feature = "integration-tests")]
#[tokio::test]
async fn test_real_database() {
    // Run with: cargo test --features integration-tests
}

// Should panic
#[test]
#[should_panic(expected = "index out of bounds")]
fn test_index_out_of_bounds() {
    let v: Vec<i32> = vec![];
    let _ = v[0];
}
```

---

## Test Commands Summary

```bash
# Fast feedback
cargo nextest run -j auto                     # All tests, parallel
cargo nextest run --filter-expr 'test(user)'  # Pattern match
cargo test --doc                              # Doctests only

# Full suite
cargo nextest run --all-features              # All features enabled
cargo llvm-cov nextest --fail-under-lines 80  # With coverage gate

# Specific targets
cargo nextest run -p my-crate                 # Single crate in workspace
cargo nextest run --filter-expr 'kind(test)'  # Integration tests only
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `#[test] fn test1()` | Non-descriptive name | `fn test_create_user_with_duplicate_email_returns_conflict()` |
| Testing implementation details | Brittle, breaks on refactor | Test behavior and public API |
| No async test runtime | `async fn` tests silently do nothing | Use `#[tokio::test]` |
| Shared mutable state between tests | Flaky, order-dependent | Each test sets up its own state |
| `.unwrap()` without context in tests | Confusing failure messages | Use `.expect("reason")` |
| Giant test functions | Hard to identify failure | One assertion per logical concept |
| Mocking everything | Tests prove nothing | Mock boundaries, test logic directly |

---

_Tests document behavior. Each test should read as a specification of what the code does._
