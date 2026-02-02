# Testing Patterns

Comprehensive Pest PHP patterns for Laravel 12 projects.

---

## Philosophy

- **Feature tests first**: Test HTTP endpoints and user flows end-to-end
- **Unit tests for logic**: Isolated tests for services, actions, and value objects
- **Factories over fixtures**: Model factories generate realistic test data
- **Clean state**: `RefreshDatabase` ensures isolation between tests

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
      UsersControllerTest.php
    Jobs/
      ProcessPaymentTest.php
  Unit/
    Services/
      PaymentServiceTest.php
    Actions/
      CreateUserTest.php
    Enums/
      UserRoleTest.php
  Pest.php
  TestCase.php
```

---

## Pest Configuration

```php
// tests/Pest.php
uses(Tests\TestCase::class, Illuminate\Foundation\Testing\RefreshDatabase::class)
    ->in('Feature');

uses(Tests\TestCase::class)
    ->in('Unit');
```

---

## Feature Test Patterns

### HTTP Endpoint Testing

```php
// tests/Feature/Http/PostsControllerTest.php

it('lists published posts', function () {
    Post::factory()->published()->count(3)->create();
    Post::factory()->create(['status' => PostStatus::Draft]);

    $response = $this->getJson('/api/posts');

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

it('creates a post when authenticated', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/posts', [
            'title' => 'Test Post',
            'body' => 'Post content here.',
            'status' => 'draft',
        ]);

    $response->assertCreated()
        ->assertJsonPath('data.title', 'Test Post');

    $this->assertDatabaseHas('posts', [
        'title' => 'Test Post',
        'user_id' => $user->id,
    ]);
});

it('returns 401 for unauthenticated users', function () {
    $this->postJson('/api/posts', ['title' => 'Test'])
        ->assertUnauthorized();
});

it('validates required fields', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/posts', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title', 'body', 'status']);
});
```

### Authorization Testing

```php
it('allows post owner to update', function () {
    $user = User::factory()->create();
    $post = Post::factory()->byUser($user)->create();

    $this->actingAs($user)
        ->putJson("/api/posts/{$post->id}", ['title' => 'Updated'])
        ->assertOk();
});

it('forbids non-owner from updating', function () {
    $post = Post::factory()->create();
    $otherUser = User::factory()->create();

    $this->actingAs($otherUser)
        ->putJson("/api/posts/{$post->id}", ['title' => 'Updated'])
        ->assertForbidden();
});
```

---

## Mocking External Services

### HTTP Fake

```php
it('fetches external data', function () {
    Http::fake([
        'api.example.com/users/*' => Http::response(['name' => 'John'], 200),
    ]);

    Http::preventStrayRequests(); // Fail on unmatched requests

    $result = app(ExternalUserService::class)->fetch(1);

    expect($result->name)->toBe('John');
    Http::assertSentCount(1);
});
```

### Queue Fake

```php
it('dispatches payment job on order', function () {
    Queue::fake();

    $order = Order::factory()->create();
    app(OrderService::class)->process($order);

    Queue::assertPushed(ProcessPayment::class, fn ($job) =>
        $job->order->id === $order->id
    );
});
```

### Notification Fake

```php
it('notifies user on post publish', function () {
    Notification::fake();

    $post = Post::factory()->create();
    app(PostService::class)->publish($post);

    Notification::assertSentTo($post->user, PostPublishedNotification::class);
});
```

---

## Unit Test Patterns

```php
// tests/Unit/Services/PaymentServiceTest.php

it('calculates total with tax', function () {
    $service = new PriceCalculator();

    $total = $service->calculateTotal(amount: 10000, taxRate: 0.08);

    expect($total)->toBe(10800);
});

it('throws on negative amount', function () {
    $service = new PriceCalculator();

    expect(fn () => $service->calculateTotal(-100, 0.08))
        ->toThrow(InvalidArgumentException::class);
});
```

---

## Architecture Tests

```php
// tests/Pest.php or tests/ArchTest.php

arch('models extend base model')
    ->expect('App\Models')
    ->toExtend('Illuminate\Database\Eloquent\Model');

arch('controllers have no direct DB queries')
    ->expect('App\Http\Controllers')
    ->not->toUse(['Illuminate\Support\Facades\DB']);

arch('no env() calls outside config')
    ->expect('env')
    ->not->toBeUsedIn('App');

arch('actions are final')
    ->expect('App\Actions')
    ->toBeFinal();
```

---

## Dataset Pattern (Pest)

```php
dataset('invalid_emails', [
    'empty' => [''],
    'no at sign' => ['invalid'],
    'no domain' => ['@example.com'],
    'spaces' => ['user @example.com'],
]);

it('rejects invalid emails', function (string $email) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/posts', ['title' => 'T', 'body' => 'B', 'email' => $email])
        ->assertUnprocessable();
})->with('invalid_emails');
```

---

## Test Commands

```bash
# Fast feedback
php artisan test --stop-on-failure
php artisan test --filter=PostsControllerTest

# Full suite
php artisan test --coverage

# Parallel execution
php artisan test --parallel

# Only feature or unit
php artisan test tests/Feature/
php artisan test tests/Unit/
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| No `RefreshDatabase` | Tests leak state between runs | Always use the trait |
| Real HTTP calls in tests | Flaky, slow, external dependency | `Http::fake()` + `preventStrayRequests()` |
| Testing framework internals | Brittle, breaks on updates | Test your code's behavior |
| Shared test state | Order-dependent failures | Each test is self-contained |
| Only happy-path tests | Bugs hide in edge cases | Test errors, validation, auth |

---

_Tests document behavior. Each test should read as a specification of what the code does._
