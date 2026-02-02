# Code Quality

Standards and tooling for maintaining high-quality PHP code.

---

## Philosophy

- **Automate everything**: Style, types, and security checks run on every commit
- **Static analysis first**: Catch bugs before runtime with PHPStan Level 9
- **Consistent style**: PSR-12 via PHP CS Fixer, no debates
- **Continuous improvement**: Rector for automated upgrades

---

## Static Analysis

### PHPStan (Level 9)

```neon
# phpstan.neon
parameters:
    level: 9
    paths:
        - src
    tmpDir: var/cache/phpstan
    checkMissingIterableValueType: true
    checkGenericClassInNonGenericObjectType: true
```

### Common PHPStan Rules

```php
// Rule: No mixed types — everything must be typed
public function process(mixed $data): void  // ❌ PHPStan error at level 9
public function process(UserDTO $data): void  // ✅

// Rule: Strict comparison
if ($status == 'active')  // ❌ Use strict
if ($status === 'active') // ✅

// Rule: Dead code detection
if ($user !== null) {
    return $user;
}
return $user; // ❌ PHPStan: always null here
```

---

## Code Style (PSR-12)

### PHP CS Fixer Configuration

```php
// .php-cs-fixer.php
<?php

$finder = PhpCsFixer\Finder::create()
    ->in(['src', 'tests'])
    ->exclude('var');

return (new PhpCsFixer\Config())
    ->setRules([
        '@PSR12' => true,
        '@PHP83Migration' => true,
        'strict_param' => true,
        'declare_strict_types' => true,
        'no_unused_imports' => true,
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'single_quote' => true,
        'trailing_comma_in_multiline' => true,
        'void_return' => true,
        'native_function_invocation' => ['include' => ['@all']],
    ])
    ->setFinder($finder)
    ->setRiskyAllowed(true);
```

---

## Automated Refactoring (Rector)

```php
// rector.php
<?php

use Rector\Config\RectorConfig;

return RectorConfig::configure()
    ->withPaths(['src', 'tests'])
    ->withPhpSets(php83: true)
    ->withPreparedSets(
        deadCode: true,
        codeQuality: true,
        typeDeclarations: true,
    );
```

```bash
# Preview changes
php vendor/bin/rector process --dry-run

# Apply changes
php vendor/bin/rector process
```

---

## Pre-Commit Hooks

### Using CaptainHook or GrumPHP

```json
// grumphp.yml
grumphp:
    tasks:
        phpcs:
            standard: PSR12
        phpstan:
            level: 9
        phpunit:
            testsuite: unit
        composer_audit: ~
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
    - run: composer cs-fix -- --dry-run --diff
    - run: composer analyse
    - run: composer test -- --coverage-clover=coverage.xml
    - run: composer audit
```

---

## Quality Metrics

| Metric | Target | Tool |
|--------|--------|------|
| PHPStan level | 9 (max) | `phpstan analyse` |
| Code coverage | >80% | `phpunit --coverage-text` |
| Mutation score | >80% MSI | `infection` |
| Style violations | 0 | `php-cs-fixer --dry-run` |
| Known vulnerabilities | 0 | `composer audit` |

---

_Automate quality. If it's not in CI, it doesn't exist._
