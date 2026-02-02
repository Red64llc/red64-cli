# Technology Stack

## Architecture

Modern PHP application with strict typing and object-oriented design. PHP 8.3+ with Composer for dependency management, PostgreSQL or MySQL for persistence, Redis for caching, Docker for deployment.

---

## Core Technologies

- **Language**: PHP 8.3+
- **Package Manager**: Composer 2
- **Web Server**: Nginx + PHP-FPM (or Caddy)
- **Database**: PostgreSQL 16+ or MySQL 8+
- **Cache/Session**: Redis 7+
- **Containerization**: Docker + Docker Compose

---

## Key Libraries

### Web & API
- **Slim** or **Mezzio**: Micro-framework for API-first projects
- **PSR-7**: HTTP message interfaces (Nyholm or Guzzle)
- **PSR-15**: HTTP middleware
- **league/route**: PSR-compatible routing

### Database & Storage
- **Doctrine ORM** or **Doctrine DBAL**: Database abstraction
- **Cycle ORM**: Alternative async-friendly ORM
- **Doctrine Migrations**: Schema versioning
- **Flysystem**: Filesystem abstraction (local, S3, etc.)

### Dependency Injection
- **PHP-DI**: Autowiring container (PSR-11 compliant)
- **league/container**: Lightweight alternative

### Background Tasks
- **Symfony Messenger**: Message bus and async queue
- **Beanstalkd + Pheanstalk**: Lightweight job queue

### HTTP Client
- **Guzzle**: Full-featured HTTP client (PSR-18)
- **Symfony HttpClient**: Async-capable alternative

---

## Development Standards

### Code Quality
- **PHP CS Fixer** or **PHP_CodeSniffer**: Code style enforcement (PSR-12)
- **PHPStan** (Level 9): Static analysis
- **Psalm**: Alternative static analysis with taint checking
- **Rector**: Automated refactoring and upgrades

### Security
- **roave/security-advisories**: Block vulnerable dependencies
- **Snyk / Composer audit**: Dependency scanning (`composer audit`)
- **OWASP headers**: CSP, X-Frame-Options, X-Content-Type-Options

### Testing
- **PHPUnit 11**: Test framework
- **Mockery**: Mock object framework
- **Infection**: Mutation testing
- **DAMA DoctrineTestBundle**: Database transaction rollback in tests

---

## Development Environment

### Required Tools
- PHP 8.3+ (see `.php-version`)
- Composer 2
- PostgreSQL 16+ or MySQL 8+
- Redis 7+
- Docker & Docker Compose

### Common Commands
```bash
# Environment setup
composer install                   # Install dependencies
php bin/migrate                    # Run migrations

# Dev server
php -S localhost:8000 -t public/   # Built-in server (dev only)
docker compose up -d               # Full stack with Nginx

# Tests
composer test                      # All tests (alias)
php vendor/bin/phpunit             # PHPUnit directly
php vendor/bin/phpunit --filter=UserTest  # Single test class
php vendor/bin/phpunit --coverage-text    # With coverage

# Code quality
php vendor/bin/php-cs-fixer fix    # Format code
php vendor/bin/phpstan analyse     # Static analysis (level 9)
php vendor/bin/psalm               # Psalm analysis
composer audit                     # Check dependency vulnerabilities

# Database
php bin/doctrine migrations:diff           # Generate migration
php bin/doctrine migrations:migrate        # Apply migrations
php bin/doctrine migrations:migrate prev   # Rollback one

# Docker
docker compose up -d               # Start services
docker compose logs -f app         # Follow app logs
docker compose exec app bash       # Shell into container
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **PHP 8.3+ strict** | Readonly classes, typed class constants, `#[Override]`, json_validate |
| **PHPStan Level 9** | Catch bugs at analysis time, enforce type safety |
| **PSR standards** | Interoperability: PSR-4 autoloading, PSR-7 HTTP, PSR-11 container, PSR-12 style |
| **Composer 2** | Fast installs, lockfile, platform checks, audit |
| **Doctrine over active record** | Data mapper pattern, entity independence from DB, testability |
| **Redis for cache + session** | Fast sessions, caching, pub/sub, rate limiting |
| **PHP-FPM + Nginx** | Production-grade process management, static file serving |

---

_Document standards and patterns, not every dependency. See `php.md` for detailed PHP conventions._
