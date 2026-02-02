# Testing Patterns

Comprehensive PHPUnit 11 patterns for modern PHP projects.

---

## Philosophy

- **Fast feedback**: Unit tests run in milliseconds, no I/O
- **Realistic integration**: Test with real database when it matters
- **Readable tests**: Each test tells a story with arrange-act-assert
- **Type-safe mocks**: Mockery with typed expectations

---

## Test Organization

```
tests/
  Unit/
    Service/
      UserServiceTest.php
      ContentServiceTest.php
    ValueObject/
      EmailTest.php
      MoneyTest.php
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

## PHPUnit Configuration

```xml
<!-- phpunit.xml -->
<phpunit
    bootstrap="tests/bootstrap.php"
    colors="true"
    failOnRisky="true"
    failOnWarning="true"
    strict="true"
>
    <testsuites>
        <testsuite name="unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="integration">
            <directory>tests/Integration</directory>
        </testsuite>
    </testsuites>
    <source>
        <include>
            <directory>src</directory>
        </include>
    </source>
    <php>
        <env name="APP_ENV" value="testing"/>
        <env name="DATABASE_URL" value="sqlite:///:memory:"/>
    </php>
</phpunit>
```

---

## Unit Test Patterns

### Service Testing with Mockery

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Service;

use App\DTO\CreateUserDTO;
use App\Entity\User;
use App\Exception\ValidationException;
use App\Repository\UserRepositoryInterface;
use App\Service\PasswordHasherInterface;
use App\Service\UserService;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

final class UserServiceTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    private UserRepositoryInterface&Mockery\MockInterface $userRepo;
    private PasswordHasherInterface&Mockery\MockInterface $hasher;
    private UserService $service;

    protected function setUp(): void
    {
        $this->userRepo = Mockery::mock(UserRepositoryInterface::class);
        $this->hasher = Mockery::mock(PasswordHasherInterface::class);
        $this->service = new UserService($this->userRepo, $this->hasher);
    }

    public function testCreateUserSuccess(): void
    {
        // Arrange
        $dto = new CreateUserDTO('test@example.com', 'Test User', 'secret123');
        $this->userRepo->expects('findByEmail')->with('test@example.com')->andReturnNull();
        $this->hasher->expects('hash')->with('secret123')->andReturn('hashed');
        $this->userRepo->expects('save')->once();

        // Act
        $user = $this->service->createUser($dto);

        // Assert
        self::assertSame('test@example.com', $user->getEmail());
        self::assertSame('Test User', $user->getName());
    }

    public function testCreateUserDuplicateEmailThrows(): void
    {
        $dto = new CreateUserDTO('taken@example.com', 'Test', 'secret123');
        $this->userRepo->expects('findByEmail')->andReturn(
            new User('taken@example.com', 'Existing', 'hash')
        );

        $this->expectException(ValidationException::class);
        $this->service->createUser($dto);
    }
}
```

---

## Data Providers

### Basic Data Provider

```php
#[\PHPUnit\Framework\Attributes\DataProvider('validEmailProvider')]
public function testValidEmails(string $email): void
{
    $emailVO = new Email($email);
    self::assertSame(strtolower($email), $emailVO->value);
}

public static function validEmailProvider(): iterable
{
    yield 'standard' => ['user@example.com'];
    yield 'subdomain' => ['user@sub.example.com'];
    yield 'plus addressing' => ['user+tag@example.com'];
}

#[\PHPUnit\Framework\Attributes\DataProvider('invalidEmailProvider')]
public function testInvalidEmailsThrow(string $email): void
{
    $this->expectException(\InvalidArgumentException::class);
    new Email($email);
}

public static function invalidEmailProvider(): iterable
{
    yield 'empty' => [''];
    yield 'no at sign' => ['invalid'];
    yield 'no domain' => ['@example.com'];
}
```

---

## Integration Test Patterns

### Database Testing

```php
<?php

declare(strict_types=1);

namespace Tests\Integration\Repository;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;

abstract class DatabaseTestCase extends TestCase
{
    protected EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->em = self::createEntityManager(); // factory method
        $this->em->beginTransaction();
    }

    protected function tearDown(): void
    {
        $this->em->rollback();
        $this->em->close();
    }
}

final class UserRepositoryTest extends DatabaseTestCase
{
    private UserRepository $repo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repo = new UserRepository($this->em);
    }

    public function testSaveAndRetrieve(): void
    {
        $user = new User('test@example.com', 'Test', 'hash');

        $this->repo->save($user);

        $found = $this->repo->find($user->getId());
        self::assertNotNull($found);
        self::assertSame('test@example.com', $found->getEmail());
    }

    public function testFindByEmailReturnsNullWhenNotFound(): void
    {
        $result = $this->repo->findByEmail('nonexistent@example.com');
        self::assertNull($result);
    }
}
```

### HTTP Controller Testing

```php
final class UserControllerTest extends TestCase
{
    public function testCreateUserReturns201(): void
    {
        $client = self::createTestClient();

        $response = $client->post('/api/users', [
            'json' => [
                'email' => 'new@example.com',
                'name' => 'New User',
                'password' => 'secure123',
            ],
        ]);

        self::assertSame(201, $response->getStatusCode());
        $data = json_decode($response->getBody()->getContents(), true);
        self::assertSame('new@example.com', $data['email']);
        self::assertArrayNotHasKey('password', $data);
    }
}
```

---

## Test Commands

```bash
# Fast feedback
php vendor/bin/phpunit tests/Unit/ --stop-on-failure
php vendor/bin/phpunit --filter=UserServiceTest

# Full suite
php vendor/bin/phpunit --coverage-text

# Single test suite
php vendor/bin/phpunit --testsuite=unit
php vendor/bin/phpunit --testsuite=integration

# Mutation testing
php vendor/bin/infection --min-msi=80
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Testing implementation details | Brittle tests that break on refactor | Test behavior and outcomes |
| No test isolation | Tests depend on execution order | Transaction rollback per test |
| Mocking everything | Tests pass but code is broken | Mock boundaries, test integration |
| Testing getters/setters | No value, pure noise | Test meaningful behavior |
| `@depends` between tests | Hidden coupling | Independent, self-contained tests |

---

_Tests document behavior. Each test should read as a specification of what the code does._
