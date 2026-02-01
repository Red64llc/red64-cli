# Error Handling

Error handling patterns for Loco applications. Leverage Rust's type system and Loco's error infrastructure for predictable, user-friendly error responses.

---

## Philosophy

- **Use `Result<T>` everywhere**: No panics in production code
- **`?` operator for propagation**: Flat, readable error chains
- **Typed errors for domain logic**: Custom error enums for business rules
- **Consistent HTTP error responses**: Map errors to appropriate status codes
- **Log context, not secrets**: Structured logging with tracing spans

---

## Loco Error Types

### Built-in Error Hierarchy

Loco provides `loco_rs::Error` as the primary error type. Controllers return `Result<impl IntoResponse>` which auto-maps errors to HTTP responses.

```rust
use loco_rs::prelude::*;

// Loco maps these automatically:
// - ModelError::EntityNotFound -> 404
// - Error::Unauthorized -> 401
// - Error::BadRequest -> 400
// - Error::InternalServerError -> 500
```

### Model Errors

Use `ModelResult<T>` for model-layer operations:

```rust
impl super::_entities::users::ActiveModel {
    pub async fn find_by_email(db: &DatabaseConnection, email: &str) -> ModelResult<Self> {
        let user = users::Entity::find()
            .filter(users::Column::Email.eq(email))
            .one(db)
            .await?;
        user.ok_or_else(|| ModelError::EntityNotFound)
    }
}
```

---

## Controller Error Handling

### Pattern: Early Returns with `?`

```rust
// GOOD: Flat, each line can fail independently
async fn update(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
    Json(params): Json<UpdatePostParams>,
) -> Result<Json<PostResponse>> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    let post = posts::Model::find_by_id_and_user(&ctx.db, id, user.id).await?;
    let updated = post.update(&ctx.db, &params).await?;
    Ok(Json(PostResponse::from(updated)))
}

// BAD: Nested error handling
async fn update(/* ... */) -> Result<Json<PostResponse>> {
    match users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await {
        Ok(user) => match posts::Model::find_by_id(&ctx.db, id).await {
            Ok(Some(post)) => {
                if post.user_id == user.id {
                    // deeply nested...
                }
            }
            // more nesting...
        }
    }
}
```

### Custom Error Responses

For domain-specific errors, return explicit HTTP responses:

```rust
async fn publish(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
) -> Result<Json<PostResponse>> {
    let post = posts::Entity::find_by_id(id)
        .one(&ctx.db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    if post.status == "published" {
        return Err(Error::BadRequest("Post is already published".into()));
    }

    let published = post.publish(&ctx.db).await?;
    Ok(Json(PostResponse::from(published)))
}
```

---

## Validation Errors

### Using `validator` Crate

Return structured validation errors with field-level detail:

```rust
use loco_rs::controller::views::json_validate::JsonValidateWithMessage;

async fn create(
    State(ctx): State<AppContext>,
    JsonValidateWithMessage(params): JsonValidateWithMessage<CreatePostParams>,
) -> Result<Json<PostResponse>> {
    // Validation happens automatically via extractor
    // Returns 422 with field-level errors on failure
    let post = posts::ActiveModel::create(&ctx.db, &params).await?;
    Ok(Json(PostResponse::from(post)))
}
```

### Model-Level Validation

```rust
impl Validatable for super::_entities::posts::ActiveModel {
    fn validator(&self) -> Box<dyn Validate> {
        Box::new(PostValidator {
            title: self.title.clone().into_value().unwrap_or_default(),
        })
    }
}

// In model method:
pub async fn create(db: &DatabaseConnection, params: &CreatePostParams) -> ModelResult<Model> {
    let mut item = ActiveModel { ..Default::default() };
    item.title = Set(params.title.clone());
    item.validate()?;  // Returns validation errors before hitting DB
    item.insert(db).await.map_err(|e| ModelError::from(e))
}
```

---

## Worker Error Handling

Workers should handle errors gracefully and log context:

```rust
async fn perform(&self, args: ReportArgs) -> Result<()> {
    let user = users::Entity::find_by_id(args.user_id)
        .one(&self.ctx.db)
        .await?
        .ok_or_else(|| {
            tracing::error!(user_id = args.user_id, "User not found for report");
            Error::NotFound
        })?;

    match generate_report(&user).await {
        Ok(report) => {
            tracing::info!(user_id = args.user_id, "Report generated");
            Ok(())
        }
        Err(e) => {
            tracing::error!(user_id = args.user_id, error = %e, "Report generation failed");
            Err(e.into())
        }
    }
}
```

---

## Logging with Context

### Structured Tracing

```rust
use tracing;

// GOOD: Structured fields for queryability
tracing::info!(user_id = %user.id, action = "login", "User authenticated");
tracing::error!(post_id = id, error = %e, "Failed to publish post");

// BAD: Unstructured string interpolation
tracing::info!("User {} logged in", user.id);
```

### Span Context in Controllers

```rust
async fn create(
    State(ctx): State<AppContext>,
    Json(params): Json<CreatePostParams>,
) -> Result<Json<PostResponse>> {
    let _span = tracing::info_span!("create_post", title = %params.title).entered();
    // All logs within this scope include the span context
    let post = posts::ActiveModel::create(&ctx.db, &params).await?;
    Ok(Json(PostResponse::from(post)))
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `.unwrap()` in handlers | Panics crash the request | Use `?` or `.ok_or_else()` |
| Swallowing errors silently | Hides bugs, makes debugging impossible | Log and propagate with `?` |
| Generic "Internal Error" for everything | Poor DX for API consumers | Map to specific HTTP status codes |
| Logging sensitive data | Security risk | Use structured fields, redact secrets |
| Validation in controllers | Logic duplication across endpoints | Use `Validatable` trait on models |
| `Box<dyn Error>` as return type | Loses type information | Use Loco's `Error` / `ModelError` types |
| Ignoring worker failures | Silent data loss | Log errors with context, use retry policies |

---

_Rust's type system makes error handling explicit. Use `?` for propagation, typed errors for domain logic, and structured tracing for observability._
