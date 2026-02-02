# Migration Patterns

Database migration best practices with Doctrine Migrations for PHP projects.

---

## Philosophy

- **Schema is code**: Migrations are versioned, reviewable, and reversible
- **Database enforces constraints**: Not just application code
- **Forward-only in production**: Rollbacks for development only
- **Data migrations separate**: Schema changes and data changes don't mix

---

## Migration Structure

```
migrations/
  Version20250101000000.php   # Create users table
  Version20250102000000.php   # Create posts table
  Version20250103000000.php   # Add role column to users
```

---

## Creating Migrations

### Auto-Generated (from Entity Changes)

```bash
# Generate migration from entity diff
php bin/doctrine migrations:diff

# Generate empty migration for manual SQL
php bin/doctrine migrations:generate
```

### Migration Example

```php
<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20250101000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create users table';
    }

    public function up(Schema $schema): void
    {
        $table = $schema->createTable('users');
        $table->addColumn('id', 'integer', ['autoincrement' => true]);
        $table->addColumn('email', 'string', ['length' => 255]);
        $table->addColumn('name', 'string', ['length' => 255]);
        $table->addColumn('hashed_password', 'string', ['length' => 255]);
        $table->addColumn('role', 'string', ['length' => 20, 'default' => 'member']);
        $table->addColumn('is_active', 'boolean', ['default' => true]);
        $table->addColumn('created_at', 'datetime_immutable');
        $table->addColumn('updated_at', 'datetime_immutable');
        $table->setPrimaryKey(['id']);
        $table->addUniqueIndex(['email'], 'uq_users_email');
    }

    public function down(Schema $schema): void
    {
        $schema->dropTable('users');
    }
}
```

---

## Common Commands

```bash
# Apply all pending migrations
php bin/doctrine migrations:migrate

# Rollback last migration
php bin/doctrine migrations:migrate prev

# Check status
php bin/doctrine migrations:status

# Dry run (see SQL without executing)
php bin/doctrine migrations:migrate --dry-run
```

---

## Best Practices

| Practice | Reason |
|----------|--------|
| Always write `down()` | Enables rollback during development |
| Use Schema API, not raw SQL | Database-agnostic, auto-generates safe SQL |
| Add indexes on foreign keys | Query performance |
| `NOT NULL` by default | Explicit about required data |
| Name constraints explicitly | Predictable names across environments |
| Separate data migrations | Schema and data changes have different failure modes |

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Raw SQL in migrations | Database-specific, error-prone | Use Schema API |
| Referencing entities in migrations | Entity changes break old migrations | Use Schema API only |
| Mixing schema + data changes | Harder to rollback, debug | Separate migrations |
| No `down()` method | Cannot rollback | Always implement `down()` |
| Editing deployed migrations | State mismatch across environments | Create new migration |

---

_Migrations are immutable once deployed. Fix forward, never edit._
