# Technology Stack

## Architecture

Modern Laravel application following convention-over-configuration. Laravel 12 with Eloquent ORM, Blade or Inertia for views, Queue workers for background jobs, Docker or Laravel Forge for deployment.

---

## Core Technologies

- **Language**: PHP 8.3+
- **Framework**: Laravel 12
- **Package Manager**: Composer 2
- **Database**: PostgreSQL 16+ or MySQL 8+ (SQLite for dev)
- **Cache/Queue/Session**: Redis 7+ (or database driver)
- **Frontend**: Blade + Livewire, or Inertia + Vue/React
- **Deployment**: Laravel Forge, Vapor, or Docker

---

## Key Libraries

### Web & API
- **Laravel Sanctum**: API token and SPA authentication
- **Laravel Fortify**: Backend authentication scaffolding
- **Laravel Breeze / Jetstream**: Auth starter kits
- **Spatie Laravel Data**: Typed DTOs and data objects

### Database & Storage
- **Eloquent ORM**: ActiveRecord with relationships and scopes
- **Laravel Migrations**: Schema versioning
- **Laravel Storage**: Filesystem abstraction (local, S3)

### Background Tasks
- **Laravel Queue**: Redis/database-backed job processing
- **Laravel Horizon**: Redis queue dashboard and monitoring
- **Laravel Scheduler**: Cron-based task scheduling

### Testing
- **Pest PHP**: Elegant testing framework (Laravel default since v11)
- **Laravel Dusk**: Browser testing

### DevOps
- **Laravel Sail**: Docker dev environment
- **Laravel Pint**: Code style (PSR-12, Laravel preset)
- **Larastan**: PHPStan wrapper for Laravel

---

## Development Standards

### Code Quality
- **Laravel Pint**: Code formatting (Laravel preset by default)
- **Larastan** (Level 8+): Static analysis with Laravel support
- **Pest**: Test framework with architecture testing

### Security
- **Sanctum**: Token/session auth with CSRF protection
- **`composer audit`**: Dependency vulnerability scanning
- **Rate limiting**: Built-in via `RateLimiter` facade

### Testing
- **Pest PHP**: Expressive test syntax, architecture tests
- **Laravel factories**: Model factories for test data
- **`RefreshDatabase`**: Clean state per test
- **`Http::fake()`**: Mock HTTP calls
- **`Queue::fake()`**: Assert jobs dispatched

---

## Development Environment

### Required Tools
- PHP 8.3+ (see `.php-version`)
- Composer 2
- Node.js 20+ (for frontend assets)
- PostgreSQL 16+ or MySQL 8+ (or SQLite)
- Redis 7+ (optional, for queue/cache)

### Common Commands
```bash
# Environment setup
composer install                    # Install PHP dependencies
npm install                         # Install frontend dependencies
cp .env.example .env                # Create env file
php artisan key:generate            # Generate app key
php artisan migrate                 # Run migrations

# Dev server
php artisan serve                   # Start dev server (port 8000)
npm run dev                         # Vite dev server (HMR)

# Tests
php artisan test                    # Run tests (Pest)
php artisan test --filter=UserTest  # Run specific test
php artisan test --coverage         # With coverage
php artisan test --parallel         # Parallel execution

# Code quality
./vendor/bin/pint                   # Format code
./vendor/bin/phpstan analyse        # Static analysis

# Database
php artisan make:migration create_posts_table  # New migration
php artisan migrate                             # Apply migrations
php artisan migrate:rollback                    # Rollback last batch
php artisan migrate:fresh --seed                # Reset + seed

# Queue
php artisan queue:work               # Process queue jobs
php artisan horizon                  # Horizon dashboard

# Artisan utilities
php artisan make:model Post -mfc     # Model + migration + factory + controller
php artisan route:list               # Show all routes
php artisan tinker                   # REPL
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Laravel conventions** | Follow framework idioms, don't fight the framework |
| **Pest over PHPUnit** | Expressive syntax, architecture tests, Laravel default |
| **Pint over CS Fixer** | Laravel-specific presets, zero config |
| **Sanctum over Passport** | Simpler token auth, SPA support, no OAuth overhead |
| **Eloquent (not Doctrine)** | Laravel-native, conventions, relationships, factories |
| **Redis for queue + cache** | Fast, versatile, Horizon monitoring |
| **Spatie packages first** | Well-maintained, Laravel-native alternatives |

---

_Document standards and patterns, not every dependency. See `laravel.md` for detailed conventions._
