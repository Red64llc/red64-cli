# Loco Framework Conventions

Conventions and patterns for Loco -- the Rust on Rails framework. Convention over configuration; decisions are made for you.

---

## Framework Stack

### Core Technologies
- **Loco**: Rails-inspired Rust web framework
- **Axum**: HTTP routing and Tower middleware
- **SeaORM**: Async ActiveRecord-style ORM
- **Tokio**: Async runtime
- **sidekiq-rs / Tokio**: Background workers (Redis-backed or in-process)
- **JWT**: Stateless authentication (built-in)

### Database
- **PostgreSQL** for production (recommended)
- **SQLite** for development and lightweight deployments
- **MySQL** supported

---

## Application Architecture

### MVC Patterns

**Models** (`src/models/`)
- Fat models, slim controllers: domain logic lives on models
- Two-file pattern: `_entities/model.rs` (auto-generated, read-only) + `model.rs` (your ActiveRecord logic)
- Implement domain operations as methods on `ActiveModel`
- `User::create` creates a user; `user.buy(product)` buys a product

```rust
// Pattern: Domain logic on the model
impl super::_entities::users::ActiveModel {
    pub async fn find_by_email(db: &DatabaseConnection, email: &str) -> ModelResult<Self> {
        let user = users::Entity::find()
            .filter(users::Column::Email.eq(email))
            .one(db)
            .await?;
        user.ok_or_else(|| ModelError::EntityNotFound)
    }

    pub async fn verify_password(&self, password: &str) -> ModelResult<bool> {
        Ok(hash::verify_password(password, &self.password_hash))
    }
}
```

**Controllers** (`src/controllers/`)
- Thin controllers: validate input, call model, return view
- Use Axum extractors for request data
- Return `Result<impl IntoResponse>` consistently
- Group routes by resource with `.prefix()`

```rust
// Pattern: Thin controller delegating to model
async fn create(
    State(ctx): State<AppContext>,
    Json(params): Json<CreatePostParams>,
) -> Result<Json<PostResponse>> {
    let post = models::posts::ActiveModel::create(&ctx.db, &params).await?;
    Ok(Json(PostResponse::from(post)))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("posts")
        .add("/", post(create))
        .add("/", get(list))
        .add("/:id", get(show))
        .add("/:id", put(update))
        .add("/:id", delete(destroy))
}
```

**Views** (`src/views/`)
- JSON serialization structs for API responses
- Keep response shaping separate from models
- Use `serde::Serialize` derive

```rust
// Pattern: View struct for API response
#[derive(Serialize)]
pub struct PostResponse {
    pub id: i32,
    pub title: String,
    pub content: String,
    pub created_at: DateTime,
}

impl From<posts::Model> for PostResponse {
    fn from(post: posts::Model) -> Self {
        Self {
            id: post.id,
            title: post.title,
            content: post.content,
            created_at: post.created_at,
        }
    }
}
```

---

## Business Logic Patterns

### Fat Models
Place domain operations on models. This enables reuse across controllers, workers, and tasks:

```rust
// src/models/users.rs
impl super::_entities::users::ActiveModel {
    pub async fn register(db: &DatabaseConnection, params: &RegisterParams) -> ModelResult<Self> {
        // Validation, password hashing, email verification token
        // All in one place, testable via model tests
    }

    pub async fn reset_password(db: &DatabaseConnection, token: &str, new_password: &str) -> ModelResult<()> {
        // Token verification, password update
    }
}
```

### When to Extract Services
Extract standalone service modules only when logic:
- Spans multiple unrelated models
- Integrates external APIs
- Has no natural "home" model

Place in `src/services/` (create as needed).

---

## Background Workers

### Worker Definition
Implement `BackgroundWorker` trait with `perform` function:

```rust
#[async_trait]
impl BackgroundWorker<ReportArgs> for ReportWorker {
    fn build(ctx: &AppContext) -> Self {
        Self { ctx: ctx.clone() }
    }

    async fn perform(&self, args: ReportArgs) -> Result<()> {
        // Job logic -- self-contained, no shared controller state
        Ok(())
    }
}
```

### Enqueue Jobs
```rust
ReportWorker::perform_later(&ctx, ReportArgs { user_id: 42 }).await?;
```

### Worker Modes
- **BackgroundAsync**: In-process Tokio tasks (development, single-server)
- **BackgroundQueue**: Redis/Postgres/SQLite backed (production, horizontal scaling)
- **ForegroundBlocking**: Synchronous (testing only)

### Anti-Pattern: Shared State
Workers must be self-contained. Do not share state between controllers and workers -- workers may run in separate processes.

---

## Tasks

CLI-invokable operations for administrative work:

```rust
#[async_trait]
impl Task for SeedData {
    fn task(&self) -> TaskInfo {
        TaskInfo {
            name: "seed_data".to_string(),
            detail: "Seed the database with initial data".to_string(),
        }
    }

    async fn run(&self, app_context: &AppContext, vars: &task::Vars) -> Result<()> {
        // Business logic -- no manual DB access needed
        Ok(())
    }
}
```

Run with: `cargo loco task seed_data`

---

## Authentication

### Built-in JWT Auth (SaaS Starter)
Loco's SaaS starter includes complete auth flow:
- `POST /api/auth/register` -- registration with email verification
- `POST /api/auth/login` -- returns JWT token
- `POST /api/auth/forgot` / `POST /api/auth/reset` -- password reset
- `GET /api/auth/verify` -- email verification

### Protecting Routes
Use `auth::JWT` extractor for authenticated endpoints:

```rust
async fn current(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Json<UserResponse>> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    Ok(Json(UserResponse::from(user)))
}
```

### Token Configuration
```yaml
auth:
  jwt:
    secret: <change-in-production>
    expiration: 604800  # seconds
    location:
      from: Bearer       # or Cookie, Query
```

Support multiple auth methods via fallback chains (Bearer -> Cookie -> Query).

---

## Database Conventions

### Migrations
Migration names auto-detect operations:
- `CreatePosts` -- new table
- `AddNameToUsers` -- column addition
- `RemoveAgeFromUsers` -- column removal
- `AddUserRefToPosts` -- foreign key
- `CreateJoinTableUsersAndGroups` -- link table

```bash
cargo loco generate model posts title:string! content:text user:references
```

Field suffixes: `!` = NOT NULL, `^` = UNIQUE, none = nullable.

### Entity Generation
After migrations, regenerate entities:
```bash
cargo loco db entities
```

Never edit files in `src/models/_entities/` -- they are overwritten.

### Seeding
Define fixtures in `src/fixtures/` as YAML. Load via `Hooks::seed()`:
```bash
cargo loco db seed --reset
```

---

## Configuration Environments

### Development (`config/development.yaml`)
```yaml
database:
  auto_migrate: true
  dangerously_truncate: false
  dangerously_recreate: false
```

### Test (`config/test.yaml`)
```yaml
database:
  dangerously_truncate: true    # Clean slate per test run
```

### Production (`config/production.yaml`)
- Disable all `dangerously_*` flags
- Set secure JWT secret
- Configure Redis URI for queue workers
- Set appropriate log level and format (JSON recommended)
- Run `cargo loco doctor --production` to validate

---

## Deployment

### Single Binary
Build and deploy -- no Rust toolchain needed on server:
```bash
cargo build --release
# Copy binary + config/ to server
./myapp start
```

### Docker
```bash
cargo loco generate deployment  # Generates Dockerfile
docker build -t myapp .
docker run -p 5150:5150 myapp
```

### Health Check
```bash
cargo loco doctor --production
```

---

## Generators

Use generators to maintain consistency:

| Generator | Command | Creates |
|-----------|---------|---------|
| Model | `cargo loco generate model <name> <fields>` | Migration + entity + model file |
| Controller | `cargo loco generate controller <name>` | Controller + test file |
| Scaffold | `cargo loco generate scaffold <name> <fields>` | Full CRUD (model + controller + view + tests) |
| Worker | `cargo loco generate worker <name>` | Worker file |
| Task | `cargo loco generate task <name>` | Task file |
| Deployment | `cargo loco generate deployment` | Docker/Nginx/Shuttle configs |

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Logic in controllers | Untestable, not reusable | Move domain logic to model methods |
| Editing `_entities/` files | Overwritten on regeneration | Add logic in `models/<name>.rs` impl blocks |
| Shared controller/worker state | Breaks horizontal scaling | Workers are self-contained with serializable args |
| `dangerously_*` flags in production | Data loss risk | Only enable in dev/test environments |
| Skipping generators | Inconsistent structure | Use `cargo loco generate` for all scaffolding |
| Raw SQL in controllers | Bypass ORM protections | Use SeaORM queries in model methods |
| Hardcoded config values | Environment-specific failures | Use `config/*.yaml` per environment |
| Nullable everything | Weak data integrity | Use `!` suffix for required fields in generators |

---

_Loco is "Rust on Rails" -- lean into conventions, use generators, keep models fat and controllers thin._
