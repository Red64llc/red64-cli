# Code Quality

Standards and tooling for maintaining high-quality Laravel code.

---

## Philosophy

- **Laravel conventions first**: Follow the framework's way before custom patterns
- **Pint for style**: Zero-config formatting, Laravel preset
- **Larastan for types**: PHPStan that understands Laravel magic
- **Pest architecture tests**: Enforce structural rules in CI

---

## Code Formatting (Laravel Pint)

### Usage

```bash
# Format all files
./vendor/bin/pint

# Check without fixing (CI mode)
./vendor/bin/pint --test

# Format specific directory
./vendor/bin/pint app/Models/
```

### Configuration (`pint.json`)

```json
{
    "preset": "laravel",
    "rules": {
        "declare_strict_types": true
    }
}
```

---

## Static Analysis (Larastan)

### Configuration

```neon
# phpstan.neon
includes:
    - vendor/larastan/larastan/extension.neon

parameters:
    level: 8
    paths:
        - app
    checkMissingIterableValueType: false
```

### Common Fixes

```php
// Larastan understands Eloquent relationships and query builders
// But you should still type-hint for clarity:

/** @return Collection<int, Post> */
public function getPublishedPosts(): Collection
{
    return Post::published()->get();
}

// Type-hint request properties
public function store(StorePostRequest $request): JsonResponse
{
    /** @var string $title */
    $title = $request->validated('title');
}
```

---

## Architecture Tests (Pest)

```php
// Enforce conventions at the CI level
arch('strict types in all files')
    ->expect('App')
    ->toUseStrictTypes();

arch('models extend eloquent model')
    ->expect('App\Models')
    ->toExtend('Illuminate\Database\Eloquent\Model');

arch('controllers use form requests')
    ->expect('App\Http\Controllers')
    ->not->toUse('Illuminate\Http\Request')
    ->ignoring('App\Http\Controllers\Api');

arch('no env() outside config')
    ->expect('env')
    ->not->toBeUsedIn('App');

arch('services are final')
    ->expect('App\Services')
    ->toBeFinal();

arch('no debugging functions')
    ->expect(['dd', 'dump', 'ray', 'var_dump'])
    ->not->toBeUsed();
```

---

## CI Pipeline

```yaml
# .github/workflows/quality.yml
quality:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: shivammathur/setup-php@v2
      with:
        php-version: '8.3'
        coverage: xdebug
    - run: composer install --no-progress
    - run: ./vendor/bin/pint --test
    - run: ./vendor/bin/phpstan analyse
    - run: php artisan test --coverage --min=80
    - run: composer audit
```

---

## Quality Metrics

| Metric | Target | Tool |
|--------|--------|------|
| Larastan level | 8+ | `phpstan analyse` |
| Code coverage | >80% | `php artisan test --coverage` |
| Style violations | 0 | `pint --test` |
| Architecture rules | All pass | Pest `arch()` tests |
| Known vulnerabilities | 0 | `composer audit` |

---

_Automate quality. If it's not in CI, it doesn't exist._
