# Project Structure

## Organization Philosophy

Follow Laravel's default directory structure. Extend with `app/Services/`, `app/Actions/`, and `app/DTOs/` as complexity grows. Avoid premature DDD — start conventional, refactor when needed.

---

## Directory Patterns

### Root Layout

```
project-root/
  app/                      # Application code
  bootstrap/                # Framework bootstrap
  config/                   # Configuration files
  database/                 # Migrations, seeders, factories
  public/                   # Web server document root
  resources/                # Views, assets, lang files
  routes/                   # Route definitions
  storage/                  # Logs, cache, compiled views
  tests/                    # Test suite
  composer.json             # PHP dependencies
  package.json              # Frontend dependencies
  vite.config.js            # Asset bundling
  .env.example              # Environment template
```

### Application Core (`app/`)

```
app/
  Console/
    Commands/               # Artisan commands
  Exceptions/               # Custom exception classes
  Http/
    Controllers/            # Request handlers
    Middleware/              # HTTP middleware
    Requests/               # Form request validation
    Resources/              # API resources (JSON transformers)
  Models/                   # Eloquent models
  Providers/                # Service providers
  Services/                 # Business logic (create as needed)
  Actions/                  # Single-action classes (create as needed)
  DTOs/                     # Data transfer objects (create as needed)
  Enums/                    # PHP enums
  Events/                   # Domain events
  Listeners/                # Event listeners
  Jobs/                     # Queued jobs
  Mail/                     # Mailable classes
  Notifications/            # Notification classes
  Policies/                 # Authorization policies
  Rules/                    # Custom validation rules
```

### When to Extend

| Directory | Add When |
|-----------|----------|
| `app/Services/` | Business logic spans multiple models or involves external APIs |
| `app/Actions/` | Single-purpose operations (e.g., `CreateOrder`, `SendInvoice`) |
| `app/DTOs/` | Need typed data objects beyond form requests |
| `app/Repositories/` | Complex queries need abstraction (rare in Laravel) |
| `app/ViewModels/` | Complex view data preparation |

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Models | Singular, PascalCase | `User`, `BlogPost` |
| Controllers | Plural + Controller | `UsersController`, `PostsController` |
| Form Requests | Action + Model + Request | `StorePostRequest`, `UpdateUserRequest` |
| Resources | Model + Resource | `UserResource`, `PostCollection` |
| Migrations | Action + table | `create_posts_table`, `add_role_to_users` |
| Factories | Model + Factory | `UserFactory`, `PostFactory` |
| Seeders | Model + Seeder | `UserSeeder`, `DatabaseSeeder` |
| Jobs | Action verb | `ProcessPayment`, `SendWelcomeEmail` |
| Events | Past tense | `OrderPlaced`, `UserRegistered` |
| Listeners | Handler verb | `SendOrderConfirmation` |
| Policies | Model + Policy | `PostPolicy`, `UserPolicy` |
| Enums | PascalCase | `UserRole`, `OrderStatus` |
| Services | Model/Domain + Service | `PaymentService`, `UserService` |
| Actions | Verb + Noun | `CreateUser`, `PublishPost` |

---

## Route Organization

```php
// routes/web.php — Web routes (session auth, CSRF)
Route::middleware('auth')->group(function () {
    Route::resource('posts', PostsController::class);
    Route::get('/dashboard', DashboardController::class);
});

// routes/api.php — API routes (Sanctum token auth)
Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('posts', Api\PostsController::class);
    Route::get('/user', fn (Request $request) => $request->user());
});
```

---

## Configuration Pattern

### Environment-Based (`config/*.php`)

```php
// config/services.php
return [
    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
    ],
];

// Access: config('services.stripe.key')
// NEVER use env() outside config files
```

---

## Database Organization

```
database/
  factories/
    UserFactory.php
    PostFactory.php
  migrations/
    2025_01_01_000000_create_users_table.php
    2025_01_02_000000_create_posts_table.php
  seeders/
    DatabaseSeeder.php
    UserSeeder.php
```

---

## Test Organization

```
tests/
  Feature/
    Auth/
      LoginTest.php
      RegistrationTest.php
    Http/
      PostsControllerTest.php
    Models/
      UserTest.php
  Unit/
    Services/
      PaymentServiceTest.php
    Actions/
      CreateUserTest.php
  Pest.php                  # Pest configuration
  TestCase.php              # Base test case
```

**Convention**: Feature tests for HTTP/integration, Unit tests for isolated logic.

---

_Follow Laravel conventions. Extend the structure when complexity demands it, not before._
