# Project Structure

## Organization Philosophy

Modern PHP with PSR-4 autoloading and clear separation of concerns. Domain-oriented modules as complexity grows. All application code under `src/`, framework config at root.

---

## Directory Patterns

### Root Layout

```
project-root/
  composer.json             # Dependencies and autoloading
  composer.lock             # Locked dependency versions
  .php-version              # PHP version pin
  phpstan.neon              # Static analysis config
  phpunit.xml               # Test configuration
  docker-compose.yml        # Local services
  Dockerfile                # Production image
  .env.example              # Environment template (never commit .env)
  public/
    index.php               # Single entry point (front controller)
  src/                      # Application source code
  tests/                    # Test suite
  config/                   # Configuration files
  migrations/               # Database migrations
  var/                      # Cache, logs, temp files (gitignored)
```

### Application Core (`src/`)

**Purpose**: All application code under PSR-4 namespace
**Pattern**: Layered architecture with domain modules

```
src/
  Controller/               # HTTP request handlers
    UserController.php
    ContentController.php
  Service/                  # Business logic layer
    UserService.php
    ContentService.php
  Repository/               # Data access layer (Doctrine)
    UserRepository.php
    ContentRepository.php
  Entity/                   # Domain entities (Doctrine)
    User.php
    Content.php
  DTO/                      # Data transfer objects
    CreateUserDTO.php
    ContentResponseDTO.php
  Middleware/                # HTTP middleware (PSR-15)
    AuthMiddleware.php
    CorsMiddleware.php
  Exception/                # Domain exceptions
    NotFoundException.php
    ValidationException.php
  ValueObject/              # Immutable value types
    Email.php
    Money.php
  Event/                    # Domain events
    UserCreated.php
    ContentPublished.php
  EventHandler/             # Event listeners
    SendWelcomeEmail.php
  Infrastructure/           # External service adapters
    Cache/
    Mail/
    Storage/
```

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Namespaces | PascalCase | `App\Service`, `App\Entity` |
| Classes | PascalCase, singular | `UserService`, `ContentRepository` |
| Interfaces | PascalCase + Interface | `UserRepositoryInterface` |
| Methods | camelCase | `findByEmail()`, `createUser()` |
| Properties | camelCase | `$firstName`, `$createdAt` |
| Constants | UPPER_SNAKE | `MAX_RETRIES`, `STATUS_ACTIVE` |
| Tables | plural, snake_case | `users`, `content_versions` |
| Files | Match class name | `UserService.php`, `Email.php` |

---

## Composer Configuration (`composer.json`)

### Minimal Structure

```json
{
    "name": "vendor/my-app",
    "type": "project",
    "require": {
        "php": ">=8.3",
        "doctrine/orm": "^3.0",
        "doctrine/migrations": "^3.8",
        "php-di/php-di": "^7.0",
        "nyholm/psr7": "^1.8",
        "slim/slim": "^4.14",
        "predis/predis": "^2.0",
        "monolog/monolog": "^3.0",
        "vlucas/phpdotenv": "^5.6"
    },
    "require-dev": {
        "phpunit/phpunit": "^11.0",
        "phpstan/phpstan": "^2.0",
        "friendsofphp/php-cs-fixer": "^3.0",
        "mockery/mockery": "^1.6",
        "infection/infection": "^0.29",
        "roave/security-advisories": "dev-latest"
    },
    "autoload": {
        "psr-4": {
            "App\\": "src/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "Tests\\": "tests/"
        }
    },
    "scripts": {
        "test": "phpunit",
        "analyse": "phpstan analyse",
        "cs-fix": "php-cs-fixer fix",
        "quality": [
            "@cs-fix",
            "@analyse",
            "@test"
        ]
    }
}
```

---

## Configuration Pattern

### Environment-Based Config

```php
// config/settings.php
<?php

declare(strict_types=1);

return [
    'database' => [
        'url' => $_ENV['DATABASE_URL'] ?? 'pgsql://localhost:5432/myapp',
    ],
    'redis' => [
        'url' => $_ENV['REDIS_URL'] ?? 'redis://localhost:6379',
    ],
    'auth' => [
        'secret_key' => $_ENV['SECRET_KEY'],
        'token_ttl' => (int) ($_ENV['TOKEN_TTL'] ?? 900),
    ],
];
```

### Entry Point (`public/index.php`)

```php
<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$container = require __DIR__ . '/../config/container.php';
$app = $container->get(\Slim\App::class);

(require __DIR__ . '/../config/routes.php')($app);
(require __DIR__ . '/../config/middleware.php')($app);

$app->run();
```

---

## Dependency Injection Pattern

```php
// config/container.php
<?php

declare(strict_types=1);

use DI\ContainerBuilder;

$builder = new ContainerBuilder();
$builder->addDefinitions([
    PDO::class => function () {
        return new PDO($_ENV['DATABASE_URL']);
    },
    UserRepositoryInterface::class => DI\autowire(UserRepository::class),
    UserService::class => DI\autowire(),
]);

return $builder->build();
```

---

## Test Organization (`tests/`)

```
tests/
  Unit/
    Service/
      UserServiceTest.php
      ContentServiceTest.php
    ValueObject/
      EmailTest.php
  Integration/
    Repository/
      UserRepositoryTest.php
    Controller/
      UserControllerTest.php
  Factory/
    UserFactory.php
    ContentFactory.php
  bootstrap.php
```

**Pattern**: Mirror `src/` structure. Suffix all test classes with `Test`.

---

_Document patterns, not file trees. New files following patterns should not require updates._
