# Rust Coding Style

Coding style conventions for idiomatic, expressive Rust. Opinionated patterns that go beyond what `cargo fmt` enforces automatically.

---

## Philosophy

- **Leverage the type system**: Encode invariants in types, not runtime checks
- **Iterator chains over loops**: Functional composition is clearer and often faster
- **Clippy is law**: If Clippy warns, fix it or explicitly allow with justification
- **Explicitness over cleverness**: Prefer readable code; the compiler optimizes for you

---

## Naming Conventions

### Standard Rust Naming

| Element | Convention | Example |
|---|---|---|
| Variables, functions | `snake_case` | `user_count`, `get_user` |
| Types, traits, enums | `PascalCase` | `UserService`, `Serialize` |
| Constants, statics | `SCREAMING_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_PORT` |
| Modules, crates | `snake_case` | `user_service`, `auth_utils` |
| Type parameters | Single uppercase or `PascalCase` | `T`, `E`, `Item` |
| Lifetimes | Short lowercase with `'` | `'a`, `'ctx`, `'conn` |
| Macros | `snake_case!` | `vec!`, `println!`, `query!` |
| Feature flags | `kebab-case` | `full`, `serde-support` |

### Naming Rules

```rust
// GOOD: Descriptive, reveals intent
let active_user_count = users.iter().filter(|u| u.is_active).count();
let is_authenticated = token.is_some();
const MAX_RETRY_ATTEMPTS: u32 = 3;

fn find_user_by_email(email: &str) -> Option<User> {
    // ...
}

struct PaymentProcessingError;

// BAD: Abbreviated, unclear
let uc = users.iter().filter(|u| u.is_active).count();
let auth = token.is_some();
const N: u32 = 3;

fn find_u(e: &str) -> Option<User> {
    // ...
}
```

### Boolean Naming

Prefix with `is_`, `has_`, `can_`, `should_`:

```rust
struct User {
    is_active: bool,
    has_verified_email: bool,
    can_publish: bool,
}
```

### Conversion Method Naming

Follow the standard library conventions:

| Pattern | Ownership | Example |
|---|---|---|
| `as_*` | Borrowed -> borrowed (cheap) | `as_str()`, `as_bytes()` |
| `to_*` | Borrowed -> owned (expensive) | `to_string()`, `to_vec()` |
| `into_*` | Owned -> owned (consuming) | `into_inner()`, `into_bytes()` |
| `from_*` | Associated function constructor | `from_str()`, `from_parts()` |

---

## Function Design

### Size Limits

- **Target**: Under 25 lines of logic
- **Maximum**: 50 lines (extract if longer)
- **Parameters**: Maximum 5; use a builder or config struct for more

```rust
// GOOD: Small, focused
async fn create_user(pool: &PgPool, data: &CreateUserRequest) -> Result<User> {
    validate_email_available(pool, &data.email).await?;
    let password_hash = hash_password(&data.password)?;
    let user = sqlx::query_as!(
        User,
        "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *",
        data.email,
        data.name,
        password_hash,
    )
    .fetch_one(pool)
    .await?;
    Ok(user)
}

// BAD: Too many parameters, too many responsibilities
async fn create_user(
    pool: &PgPool,
    email: &str,
    name: &str,
    password: &str,
    role: &str,
    bio: Option<&str>,
    avatar_url: Option<&str>,
    send_email: bool,
) -> Result<User> {
    // 80+ lines doing validation, hashing, saving, emailing...
}
```

### Prefer `&str` Over `String` in Parameters

```rust
// GOOD: Accepts both &str and &String
fn validate_email(email: &str) -> bool {
    email.contains('@')
}

// BAD: Forces caller to allocate
fn validate_email(email: String) -> bool {
    email.contains('@')
}

// GOOD: Use String when ownership is needed
fn set_name(&mut self, name: String) {
    self.name = name;
}
```

### Early Returns with `?`

```rust
// GOOD: Flat with ? operator
async fn publish_post(pool: &PgPool, post_id: i64, user_id: i64) -> Result<Post> {
    let post = get_post(pool, post_id).await?.ok_or(AppError::NotFound("Post"))?;
    if post.user_id != user_id {
        return Err(AppError::Forbidden("Cannot publish another user's post"));
    }
    if post.status == PostStatus::Published {
        return Err(AppError::Conflict("Post is already published"));
    }
    update_post_status(pool, post_id, PostStatus::Published).await
}

// BAD: Deeply nested
async fn publish_post(pool: &PgPool, post_id: i64, user_id: i64) -> Result<Post> {
    if let Some(post) = get_post(pool, post_id).await? {
        if post.user_id == user_id {
            if post.status != PostStatus::Published {
                update_post_status(pool, post_id, PostStatus::Published).await
            } else {
                Err(AppError::Conflict("Already published"))
            }
        } else {
            Err(AppError::Forbidden("Not your post"))
        }
    } else {
        Err(AppError::NotFound("Post"))
    }
}
```

---

## Iterator Chains Over Loops

### Prefer Functional Style

```rust
// GOOD: Iterator chain
let active_emails: Vec<String> = users
    .iter()
    .filter(|u| u.is_active)
    .map(|u| u.email.clone())
    .collect();

// BAD: Imperative loop
let mut active_emails = Vec::new();
for user in &users {
    if user.is_active {
        active_emails.push(user.email.clone());
    }
}

// GOOD: Complex chain with intermediate operations
let report: Vec<CategoryReport> = orders
    .iter()
    .filter(|o| o.status == OrderStatus::Completed)
    .fold(HashMap::new(), |mut acc, o| {
        *acc.entry(&o.category).or_insert(Decimal::ZERO) += o.amount;
        acc
    })
    .into_iter()
    .map(|(category, total)| CategoryReport { category: category.clone(), total })
    .collect();
```

### When Loops Are Fine

Use loops when the body has complex control flow (early returns, multiple mutations, error handling with side effects):

```rust
// Loop is clearer here due to error handling with context
for (i, item) in items.iter().enumerate() {
    match process_item(item).await {
        Ok(result) => results.push(result),
        Err(e) => {
            tracing::warn!(index = i, error = %e, "Skipping failed item");
            failures.push((i, e));
        }
    }
}
```

---

## Type State Pattern

Encode state transitions in the type system so invalid states are unrepresentable:

```rust
// GOOD: Type state pattern
use std::marker::PhantomData;

struct Order<S: OrderState> {
    id: i64,
    items: Vec<OrderItem>,
    _state: PhantomData<S>,
}

struct Draft;
struct Confirmed;
struct Shipped;

trait OrderState {}
impl OrderState for Draft {}
impl OrderState for Confirmed {}
impl OrderState for Shipped {}

impl Order<Draft> {
    fn confirm(self, payment: Payment) -> Result<Order<Confirmed>> {
        // Only drafts can be confirmed
        Ok(Order {
            id: self.id,
            items: self.items,
            _state: PhantomData,
        })
    }
}

impl Order<Confirmed> {
    fn ship(self, tracking: &str) -> Order<Shipped> {
        // Only confirmed orders can be shipped
        Order {
            id: self.id,
            items: self.items,
            _state: PhantomData,
        }
    }
}

// Compile error: cannot ship a draft
// let shipped = draft_order.ship("TRACK123");  // ERROR: method not found

// BAD: Runtime state check
struct OrderBad {
    status: OrderStatus,
}

impl OrderBad {
    fn ship(&mut self, tracking: &str) -> Result<()> {
        if self.status != OrderStatus::Confirmed {
            return Err(anyhow!("Cannot ship order in {:?} state", self.status));
        }
        self.status = OrderStatus::Shipped;
        Ok(())
    }
}
```

---

## Builder Pattern

Use builders for constructing complex types with many optional fields:

```rust
// GOOD: Builder pattern
#[derive(Default)]
struct QueryBuilder {
    filter: Option<String>,
    sort_by: Option<String>,
    page: u32,
    per_page: u32,
}

impl QueryBuilder {
    fn new() -> Self {
        Self {
            page: 1,
            per_page: 20,
            ..Default::default()
        }
    }

    fn filter(mut self, filter: impl Into<String>) -> Self {
        self.filter = Some(filter.into());
        self
    }

    fn sort_by(mut self, field: impl Into<String>) -> Self {
        self.sort_by = Some(field.into());
        self
    }

    fn page(mut self, page: u32) -> Self {
        self.page = page;
        self
    }

    fn build(self) -> Query {
        Query {
            filter: self.filter,
            sort_by: self.sort_by,
            page: self.page,
            per_page: self.per_page,
        }
    }
}

// Usage
let query = QueryBuilder::new()
    .filter("active")
    .sort_by("created_at")
    .page(2)
    .build();
```

---

## Newtype Pattern

Wrap primitive types to add type safety and domain meaning:

```rust
// GOOD: Newtype prevents mixing up IDs
struct UserId(i64);
struct PostId(i64);

fn get_post(user_id: UserId, post_id: PostId) -> Result<Post> {
    // Cannot accidentally swap user_id and post_id
}

// BAD: Easy to mix up bare i64 parameters
fn get_post_bad(user_id: i64, post_id: i64) -> Result<Post> {
    // Caller might swap arguments -- compiles fine, fails at runtime
}

// Newtype with validation
struct Email(String);

impl Email {
    fn new(value: impl Into<String>) -> Result<Self> {
        let value = value.into();
        if !value.contains('@') {
            return Err(anyhow!("Invalid email: {}", value));
        }
        Ok(Self(value))
    }

    fn as_str(&self) -> &str {
        &self.0
    }
}
```

---

## Turbofish Syntax

Use turbofish (`::<Type>`) when the compiler cannot infer types:

```rust
// GOOD: Turbofish for parse
let port = "8080".parse::<u16>()?;

// GOOD: Turbofish for collect
let ids = raw_ids.iter().map(|s| s.parse::<i64>()).collect::<Result<Vec<_>, _>>()?;

// GOOD: No turbofish needed -- type annotation on binding
let port: u16 = "8080".parse()?;

// BAD: Ambiguous without turbofish or annotation
// let port = "8080".parse()?;  // ERROR: cannot infer type
```

---

## Module Organization

```rust
// GOOD: Flat, explicit re-exports
// src/models/mod.rs
mod user;
mod post;
mod comment;

pub use user::User;
pub use post::Post;
pub use comment::Comment;

// GOOD: File-based modules (Rust 2024 preferred)
// src/models.rs  (instead of src/models/mod.rs for simple cases)

// BAD: Deep nesting with re-exports at every level
// src/domain/models/entities/user/mod.rs
```

---

## File and Type Size

### Guidelines

| Element | Guideline |
|---|---|
| Function | Under 25 lines of logic, max 50 |
| Struct impl block | Under 200 lines, max 300 |
| Module file | Under 300 lines, max 500 |
| Parameters | Max 5 per function; use struct for more |

When a file exceeds limits, extract:
- Helper functions into a submodule
- Trait implementations into separate impl blocks
- Related types into their own module

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `.unwrap()` in production | Panics on `None`/`Err` | Use `?`, `.ok_or()`, `.unwrap_or_default()` |
| `clone()` everywhere | Hidden performance cost | Borrow with `&` or use `Arc` for shared ownership |
| Stringly-typed APIs | No compile-time safety | Use enums or newtype pattern |
| Massive match arms | Hard to read, easy to miss cases | Extract into methods, use trait dispatch |
| `pub` on everything | Leaks implementation details | Default to `pub(crate)`, expose minimal API |
| Ignoring Clippy lints | Misses idiomatic patterns | Run `cargo clippy -- -D warnings` in CI |
| `Box<dyn Error>` in libraries | Loses type info for callers | Use `thiserror` custom error enums |

---

## Formatting (Handled by `cargo fmt`)

These are automated -- do not worry about them manually:

- Line length: 100 characters (configurable in `rustfmt.toml`)
- Indentation: 4 spaces
- Trailing commas in multi-line constructs
- Brace style: same line for functions, next line for control flow only if multi-line

Run `cargo fmt` and move on.

---

_The Rust compiler is your strictest reviewer. Lean into its type system to make illegal states unrepresentable, and let Clippy handle the rest._
