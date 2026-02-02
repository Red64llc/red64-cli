# PHP Conventions

Project memory for modern PHP 8.3+ patterns and conventions.

---

## Language Stack

### Core Technologies
- **PHP 8.3+** with `declare(strict_types=1)` everywhere
- **Composer 2**: Package management and PSR-4 autoloading
- **PHPStan Level 9**: Strict static analysis
- **PHP CS Fixer**: PSR-12 code style enforcement

---

## Type System

### Strict Types (PHP 8.3+)

Always declare strict types at the top of every file:

```php
<?php

declare(strict_types=1);
```

### Modern Type Features

```php
// Union types (PHP 8.0+)
function findUser(string|int $key): ?User
{
    // ...
}

// Intersection types (PHP 8.1+)
function process(Countable&Iterator $collection): void
{
    // ...
}

// DNF types (PHP 8.2+)
function handle((Countable&Iterator)|null $collection): void
{
    // ...
}

// Readonly classes (PHP 8.2+)
readonly class UserDTO
{
    public function __construct(
        public string $name,
        public string $email,
        public string $role = 'member',
    ) {}
}

// Typed class constants (PHP 8.3+)
class Status
{
    public const string ACTIVE = 'active';
    public const string INACTIVE = 'inactive';
}

// #[Override] attribute (PHP 8.3+)
class AdminRepository extends UserRepository
{
    #[Override]
    public function findAll(): array
    {
        return parent::findAll()->filter(fn(User $u) => $u->isAdmin());
    }
}
```

---

## Interfaces Over Inheritance

Prefer interfaces for contracts, composition for shared behavior:

```php
interface UserRepositoryInterface
{
    public function find(int $id): ?User;
    public function save(User $user): void;
    public function findByEmail(string $email): ?User;
}

// Any class implementing the interface satisfies the contract
class DoctrineUserRepository implements UserRepositoryInterface
{
    public function __construct(
        private readonly EntityManagerInterface $em,
    ) {}

    public function find(int $id): ?User
    {
        return $this->em->find(User::class, $id);
    }

    public function save(User $user): void
    {
        $this->em->persist($user);
        $this->em->flush();
    }

    public function findByEmail(string $email): ?User
    {
        return $this->em->getRepository(User::class)
            ->findOneBy(['email' => $email]);
    }
}
```

---

## Data Modeling

### DTOs with Constructor Promotion

Use readonly DTOs for data transfer at boundaries:

```php
readonly class CreateUserDTO
{
    public function __construct(
        public string $email,
        public string $name,
        public string $password,
        public string $role = 'member',
    ) {}

    public static function fromRequest(array $data): self
    {
        return new self(
            email: $data['email'],
            name: $data['name'],
            password: $data['password'],
            role: $data['role'] ?? 'member',
        );
    }
}
```

### Value Objects

Use for domain primitives that carry validation:

```php
readonly class Email
{
    public readonly string $value;

    public function __construct(string $value)
    {
        if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException("Invalid email: {$value}");
        }
        $this->value = strtolower($value);
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
```

---

## Enums

### Backed Enums (PHP 8.1+)

```php
enum UserRole: string
{
    case Admin = 'admin';
    case Member = 'member';
    case Viewer = 'viewer';

    public function canManageUsers(): bool
    {
        return $this === self::Admin;
    }

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Administrator',
            self::Member => 'Member',
            self::Viewer => 'Viewer',
        };
    }
}

// Usage
$role = UserRole::from('admin');
$role = UserRole::tryFrom($input); // returns null on invalid
```

---

## Error Handling

### Exception Hierarchy

```php
// Base domain exception
abstract class DomainException extends \RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'INTERNAL_ERROR',
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}

class NotFoundException extends DomainException
{
    public function __construct(string $resource, string|int $id)
    {
        parent::__construct(
            message: "{$resource} {$id} not found",
            errorCode: 'NOT_FOUND',
        );
    }
}

class ValidationException extends DomainException
{
    /** @param array<string, string[]> $errors */
    public function __construct(
        public readonly array $errors,
    ) {
        parent::__construct(
            message: 'Validation failed',
            errorCode: 'VALIDATION_ERROR',
        );
    }
}
```

---

## Service Pattern

### Constructor Injection

```php
final class UserService
{
    public function __construct(
        private readonly UserRepositoryInterface $userRepo,
        private readonly PasswordHasherInterface $hasher,
        private readonly EventDispatcherInterface $events,
    ) {}

    public function createUser(CreateUserDTO $dto): User
    {
        $existing = $this->userRepo->findByEmail($dto->email);
        if ($existing !== null) {
            throw new ValidationException([
                'email' => ['Email already in use'],
            ]);
        }

        $user = new User(
            email: $dto->email,
            name: $dto->name,
            hashedPassword: $this->hasher->hash($dto->password),
            role: UserRole::from($dto->role),
        );

        $this->userRepo->save($user);
        $this->events->dispatch(new UserCreated($user->getId()));

        return $user;
    }
}
```

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Namespaces | PascalCase | `App\Service`, `App\Entity` |
| Classes | PascalCase | `UserService`, `CreateUserDTO` |
| Interfaces | PascalCase + Interface | `UserRepositoryInterface` |
| Enums | PascalCase | `UserRole`, `ContentStatus` |
| Methods | camelCase | `findByEmail()`, `createUser()` |
| Properties | camelCase | `$firstName`, `$createdAt` |
| Constants | UPPER_SNAKE | `MAX_RETRIES`, `STATUS_ACTIVE` |
| Enum cases | PascalCase | `UserRole::Admin` |
| Private | No prefix | `private function validate()` (no `_` prefix) |

---

## Code Style Principles

1. **`declare(strict_types=1)`**: Every file, no exceptions
2. **Final by default**: Mark classes `final` unless designed for extension
3. **Readonly by default**: Use `readonly` on properties and DTOs
4. **Constructor promotion**: Reduce boilerplate for dependency injection
5. **Named arguments**: Use at call sites for clarity when >2 params
6. **Match over switch**: Prefer `match` expressions for value mapping
7. **Early returns**: Guard clauses over deep nesting
8. **No magic**: Avoid `__get`, `__set`, `__call` — be explicit

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Arrays as data structures | No type safety, no IDE support | Use DTOs or value objects |
| Service locator (injecting container) | Hidden dependencies, untestable | Constructor injection |
| God classes | Violates SRP, hard to test | Extract focused services |
| Inheritance chains | Fragile, hard to refactor | Composition + interfaces |
| Suppressing errors (`@`) | Hides bugs | Handle errors explicitly |
| Dynamic properties | Deprecated in PHP 8.2 | Declare all properties |
| `mixed` type everywhere | Defeats static analysis | Use specific types |
| Business logic in controllers | Untestable, couples to HTTP | Service layer |

---

_Document patterns, not every function. Code should be typed, final, and explicit._
