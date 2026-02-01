# Loco Coding Style

Coding style conventions for idiomatic Loco applications. Combines Rust best practices with Loco's Rails-inspired conventions.

---

## Philosophy

- **Convention over configuration**: Follow Loco's prescribed patterns
- **Fat models, slim controllers**: Business logic belongs on models
- **Use generators**: Scaffolding maintains consistency
- **Leverage the type system**: Encode invariants in types, not runtime checks
- **Clippy is law**: If Clippy warns, fix it

---

## Naming Conventions

### Loco-Specific Naming

| Element | Convention | Example |
|---|---|---|
| Controller functions | snake_case verbs | `create`, `list`, `show`, `update`, `destroy` |
| Route prefixes | plural resource name | `"posts"`, `"users"`, `"auth"` |
| Model methods | domain verbs | `register`, `verify_email`, `reset_password` |
| Worker structs | PascalCase + Worker | `ReportWorker`, `EmailWorker` |
| Worker args | PascalCase + Args | `ReportArgs`, `EmailArgs` |
| Task structs | PascalCase | `SeedData`, `SyncUsers` |
| View structs | PascalCase + Response | `PostResponse`, `UserResponse` |
| Migration files | timestamp + description | `m20231001_000001_create_users` |

### Standard Rust Naming

| Element | Convention | Example |
|---|---|---|
| Variables, functions | `snake_case` | `user_count`, `get_user` |
| Types, traits, enums | `PascalCase` | `UserService`, `Serialize` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_PORT` |
| Modules | `snake_case` | `user_service`, `auth_utils` |
| Lifetimes | Short lowercase with `'` | `'a`, `'ctx` |

### Boolean Naming

Prefix with `is_`, `has_`, `can_`, `should_`:

```rust
struct User {
    is_active: bool,
    has_verified_email: bool,
    can_publish: bool,
}
```

---

## Controller Style

### Thin Controllers

```rust
// GOOD: Delegates to model
async fn create(
    State(ctx): State<AppContext>,
    Json(params): Json<CreatePostParams>,
) -> Result<Json<PostResponse>> {
    let post = posts::ActiveModel::create(&ctx.db, &params).await?;
    Ok(Json(PostResponse::from(post)))
}

// BAD: Logic in controller
async fn create(
    State(ctx): State<AppContext>,
    Json(params): Json<CreatePostParams>,
) -> Result<Json<PostResponse>> {
    // Validation logic here...
    // Business rules here...
    // Direct SQL here...
    // Email sending here...
}
```

### Consistent Route Structure

```rust
// GOOD: RESTful, predictable
pub fn routes() -> Routes {
    Routes::new()
        .prefix("posts")
        .add("/", get(list))
        .add("/", post(create))
        .add("/:id", get(show))
        .add("/:id", put(update))
        .add("/:id", delete(destroy))
}
```

---

## Model Style

### Domain Methods

```rust
// GOOD: Rich domain model
impl super::_entities::users::ActiveModel {
    pub async fn register(db: &DatabaseConnection, params: &RegisterParams) -> ModelResult<Self> {
        // Complete workflow in one place
    }

    pub async fn find_by_email(db: &DatabaseConnection, email: &str) -> ModelResult<Self> {
        // Reusable query
    }
}

// BAD: Anemic model, logic scattered elsewhere
// (query in controller, validation in middleware, email in separate service)
```

### Validation

Use the `validator` crate with `Validatable` trait:

```rust
impl Validatable for super::_entities::users::ActiveModel {
    fn validator(&self) -> Box<dyn Validate> {
        Box::new(UserValidator {
            email: self.email.clone().into_value().unwrap_or_default(),
        })
    }
}

// Always validate before persistence
user.validate()?;
user.insert(db).await?;
```

---

## Error Handling Style

### Use `?` Operator Consistently

```rust
// GOOD: Flat with ? operator
async fn publish(ctx: &AppContext, id: i32, user_id: i32) -> Result<Post> {
    let post = posts::Entity::find_by_id(id)
        .one(&ctx.db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    if post.user_id != user_id {
        return Err(Error::Unauthorized("Not your post".into()));
    }

    update_status(&ctx.db, id, Status::Published).await
}

// BAD: Deeply nested match/if chains
```

---

## View Style

### Explicit Response Structs

```rust
// GOOD: Dedicated view struct with From impl
#[derive(Serialize)]
pub struct PostResponse {
    pub id: i32,
    pub title: String,
    pub author_name: String,  // Derived, not raw FK
}

impl PostResponse {
    pub fn from_model_with_user(post: posts::Model, user: users::Model) -> Self {
        Self {
            id: post.id,
            title: post.title,
            author_name: user.name,
        }
    }
}

// BAD: Returning raw entity models as JSON
```

---

## Worker Style

### Self-Contained with Serializable Args

```rust
// GOOD: Serializable args, no shared state
#[derive(Serialize, Deserialize)]
pub struct EmailArgs {
    pub user_id: i32,
    pub template: String,
}

#[async_trait]
impl BackgroundWorker<EmailArgs> for EmailWorker {
    fn build(ctx: &AppContext) -> Self { Self { ctx: ctx.clone() } }

    async fn perform(&self, args: EmailArgs) -> Result<()> {
        let user = users::Entity::find_by_id(args.user_id)
            .one(&self.ctx.db).await?
            .ok_or(Error::NotFound)?;
        // Send email using args.template
        Ok(())
    }
}

// BAD: Passing non-serializable types, referencing controller state
```

---

## File and Type Size

| Element | Guideline |
|---|---|
| Controller function | Under 15 lines (validate, delegate, respond) |
| Model method | Under 30 lines of logic |
| View struct | Under 50 lines |
| Worker perform | Under 40 lines |
| Module file | Under 300 lines, max 500 |
| Parameters | Max 5 per function; use struct for more |

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Fat controllers | Untestable, unreusable logic | Move to model methods |
| `.unwrap()` in handlers | Panics crash the request | Use `?` and proper error types |
| Raw entity as response | Exposes internal schema | Use view structs with `From` |
| Business logic in workers | Duplicates model logic | Call model methods from workers |
| Ignoring generators | Inconsistent file placement | Always use `cargo loco generate` |
| `clone()` on large structs | Hidden performance cost | Borrow with `&` or use `Arc` |

---

_Follow Loco conventions: generators for scaffolding, models for logic, controllers for routing, views for shaping. Let the framework guide structure._
