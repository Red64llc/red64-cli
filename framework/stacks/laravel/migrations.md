# Migration Patterns

Database migration best practices for Laravel 12 projects.

---

## Philosophy

- **Schema is code**: Migrations are versioned, reviewable, and reversible
- **Database enforces constraints**: `NOT NULL`, foreign keys, unique indexes
- **Forward-only in production**: `migrate:fresh` is for development only
- **One concern per migration**: Don't mix schema and data changes

---

## Creating Migrations

```bash
# Create with model, factory, and controller
php artisan make:model Post -mfc

# Standalone migration
php artisan make:migration create_posts_table
php artisan make:migration add_role_to_users_table
```

---

## Migration Examples

### Create Table

```php
public function up(): void
{
    Schema::create('posts', function (Blueprint $table) {
        $table->id();
        $table->foreignId('user_id')->constrained()->cascadeOnDelete();
        $table->string('title');
        $table->text('body');
        $table->string('status', 20)->default('draft');
        $table->string('slug')->unique();
        $table->timestamp('published_at')->nullable();
        $table->timestamps();
        $table->softDeletes();

        $table->index(['user_id', 'status']);
    });
}

public function down(): void
{
    Schema::dropIfExists('posts');
}
```

### Modify Table

```php
public function up(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->string('role', 20)->default('member')->after('email');
        $table->index('role');
    });
}

public function down(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->dropIndex(['role']);
        $table->dropColumn('role');
    });
}
```

### Many-to-Many Pivot

```php
public function up(): void
{
    Schema::create('post_tag', function (Blueprint $table) {
        $table->foreignId('post_id')->constrained()->cascadeOnDelete();
        $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
        $table->primary(['post_id', 'tag_id']);
        $table->timestamps();
    });
}
```

---

## Common Commands

```bash
# Apply all pending
php artisan migrate

# Rollback last batch
php artisan migrate:rollback

# Reset and re-run all (dev only)
php artisan migrate:fresh --seed

# Check status
php artisan migrate:status

# Generate SQL without executing
php artisan migrate --pretend
```

---

## Best Practices

| Practice | Reason |
|----------|--------|
| Always write `down()` | Enables rollback during development |
| Use `foreignId()->constrained()` | Auto-names constraints, adds FK |
| Add `->cascadeOnDelete()` or `->nullOnDelete()` | Define FK behavior explicitly |
| Index foreign keys | Already done by `foreignId()` |
| `NOT NULL` by default | Columns are required unless explicitly `->nullable()` |
| Use `string('col', length)` for enums | Easier to evolve than DB enums |
| Separate data migrations | Use artisan commands, not migrations |

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `migrate:fresh` in production | Drops all tables | Only `migrate` in production |
| Editing deployed migrations | State mismatch across environments | Create new migration |
| Referencing models in migrations | Model changes break old migrations | Use Schema builder only |
| Missing `down()` | Cannot rollback | Always implement reverse |
| No foreign key constraints | Orphaned records | Use `constrained()` |
| Nullable everything | Weak data integrity | Only nullable when genuinely optional |

---

_Migrations are immutable once deployed. Fix forward, never edit._
