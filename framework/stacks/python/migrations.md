# Database Migration Patterns

Alembic migration best practices for Python projects with SQLAlchemy.

---

## Philosophy

- **Reversible by default**: Every migration must have a working downgrade path
- **Small and atomic**: One logical change per migration file
- **Zero-downtime aware**: Schema changes must not lock tables or break running code
- **Schema separate from data**: Never mix DDL and DML in the same migration

---

## Alembic Setup

### Configuration

```python
# alembic/env.py
from app.models.base import Base
from app.config import settings

target_metadata = Base.metadata

def run_migrations_online():
    connectable = create_engine(settings.database_url)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,          # Detect column type changes
            compare_server_default=True, # Detect default value changes
            render_as_batch=True,        # SQLite compatibility
        )
        with context.begin_transaction():
            context.run_migrations()
```

### Naming Conventions

Alembic auto-generates revision IDs. Use descriptive `--message` values:

```bash
# Schema changes
uv run alembic revision --autogenerate -m "add_users_table"
uv run alembic revision --autogenerate -m "add_email_index_to_users"
uv run alembic revision --autogenerate -m "add_role_column_to_users"

# Data migrations (never autogenerate)
uv run alembic revision -m "backfill_user_display_names"
```

**Pattern**: `{verb}_{noun}[_detail]` -- `add_users_table`, `drop_legacy_flags`, `rename_content_slug`.

---

## Reversible Migrations

### Always Implement Downgrade

```python
"""add_users_table

Revision ID: a1b2c3d4
"""

def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
```

### Irreversible Migrations

When a migration truly cannot be reversed (data loss), make it explicit:

```python
def downgrade() -> None:
    raise NotImplementedError(
        "This migration drops the legacy_flags column and cannot be reversed. "
        "Restore from backup if needed."
    )
```

---

## Small, Atomic Changes

### One Concern Per Migration

```python
# GOOD: Single logical change
# Migration 1: add_posts_table
def upgrade() -> None:
    op.create_table("posts", ...)

# Migration 2: add_posts_published_at_index
def upgrade() -> None:
    op.create_index("ix_posts_published_at", "posts", ["published_at"])
```

```python
# BAD: Multiple unrelated changes
def upgrade() -> None:
    op.create_table("posts", ...)
    op.add_column("users", sa.Column("bio", sa.Text()))
    op.create_index("ix_posts_published_at", "posts", ["published_at"])
```

---

## Zero-Downtime Migrations

### Safe Column Addition

Adding a nullable column with no default is always safe:

```python
def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(255), nullable=True))
```

### Unsafe Operations and Alternatives

| Operation | Problem | Safe Alternative |
|---|---|---|
| Add NOT NULL column | Locks table, fails on existing rows | Add nullable, backfill, then alter |
| Drop column | Running code may reference it | Deploy code removal first, then drop |
| Rename column | Breaks running queries | Add new column, backfill, deploy code, drop old |
| Add index on large table | Locks table for duration | Use `CREATE INDEX CONCURRENTLY` (PostgreSQL) |
| Change column type | May require table rewrite | Add new column, backfill, swap |

### Multi-Step Column Rename

```python
# Step 1: Add new column (deploy migration)
def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(255), nullable=True))

# Step 2: Backfill data (data migration)
def upgrade() -> None:
    op.execute("UPDATE users SET display_name = name WHERE display_name IS NULL")

# Step 3: Deploy code using display_name instead of name

# Step 4: Drop old column (after code is deployed)
def upgrade() -> None:
    op.drop_column("users", "name")
```

### Concurrent Index Creation (PostgreSQL)

```python
from alembic import op

def upgrade() -> None:
    # Must run outside a transaction for CONCURRENTLY
    op.execute("CREATE INDEX CONCURRENTLY ix_posts_user_id ON posts (user_id)")

def downgrade() -> None:
    op.drop_index("ix_posts_user_id", table_name="posts")
```

Add to the migration file:

```python
# Disable transaction wrapping for this migration
from alembic import context
context.configure(transaction_per_migration=False)
```

---

## Schema vs Data Migrations

### Schema Migration (DDL)

```python
"""add_status_column_to_posts

Autogenerated: yes
"""

def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("status", sa.String(20), nullable=True, server_default="draft"),
    )

def downgrade() -> None:
    op.drop_column("posts", "status")
```

### Data Migration (DML)

```python
"""backfill_post_status

Autogenerated: no
"""
from sqlalchemy import table, column, String

def upgrade() -> None:
    # Use lightweight table references, not ORM models
    posts = table("posts", column("status", String))
    op.execute(
        posts.update()
        .where(posts.c.status.is_(None))
        .values(status="draft")
    )

def downgrade() -> None:
    # Data backfills are generally not reversible
    pass
```

**Rule**: Never import ORM models in migrations. Models change over time; migrations must remain stable. Use `sa.table()` / `sa.column()` or raw SQL.

---

## Autogenerate Pitfalls

### What Autogenerate Detects

| Detected | Not Detected |
|---|---|
| Table creation/removal | Table or column renames (shows as drop+create) |
| Column addition/removal | Changes to constraints names |
| Column type changes (with `compare_type=True`) | Data migrations |
| Nullable changes | Custom CHECK constraints (sometimes) |
| Index creation/removal | PostgreSQL ENUM type changes |
| Foreign key changes | Trigger or function changes |

### Always Review Generated Migrations

```bash
# Generate
uv run alembic revision --autogenerate -m "add_feature_x"

# ALWAYS review the generated file before running
# Check for:
# 1. Unintended drops (renames detected as drop+create)
# 2. Missing downgrade operations
# 3. Correct column types and constraints
# 4. Index naming consistency

# Then run
uv run alembic upgrade head
```

### Custom Enum Handling

Alembic does not handle PostgreSQL ENUMs well. Manage them manually:

```python
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    # Create enum type first
    role_enum = sa.Enum("admin", "member", "viewer", name="user_role")
    role_enum.create(op.get_bind(), checkfirst=True)

    op.add_column("users", sa.Column("role", role_enum, nullable=True))

def downgrade() -> None:
    op.drop_column("users", "role")
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
```

---

## Migration Testing

### Test Migrations in CI

```python
# tests/test_migrations.py
import subprocess

def test_migrations_up_down():
    """Verify all migrations can run forward and backward."""
    result = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, f"Upgrade failed: {result.stderr}"

    result = subprocess.run(
        ["uv", "run", "alembic", "downgrade", "base"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, f"Downgrade failed: {result.stderr}"
```

### Test Migration Idempotency

```python
def test_no_pending_migrations():
    """Ensure models and migrations are in sync."""
    result = subprocess.run(
        ["uv", "run", "alembic", "check"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, (
        "Models and migrations are out of sync. "
        "Run: uv run alembic revision --autogenerate -m 'sync_models'"
    )
```

---

## Rollback Strategies

### Alembic Downgrade

```bash
# Roll back one migration
uv run alembic downgrade -1

# Roll back to specific revision
uv run alembic downgrade a1b2c3d4

# Roll back to base (empty database)
uv run alembic downgrade base

# Show current state
uv run alembic current
uv run alembic history --verbose
```

### Production Rollback Procedure

1. **Verify**: Check current revision with `alembic current`
2. **Test**: Run downgrade in staging first
3. **Downgrade**: Run `alembic downgrade -1` in production
4. **Deploy**: Roll back application code to match schema
5. **Verify**: Confirm application health after rollback

### When Downgrade Is Not Enough

For destructive migrations (dropped columns, deleted data):

- Restore from database backup
- Use point-in-time recovery (PostgreSQL WAL)
- Never deploy destructive migrations on Friday

---

## Commands Reference

```bash
# Generate migration from model changes
uv run alembic revision --autogenerate -m "description"

# Create empty migration (for data migrations)
uv run alembic revision -m "description"

# Apply all pending migrations
uv run alembic upgrade head

# Roll back last migration
uv run alembic downgrade -1

# Show migration history
uv run alembic history --verbose

# Show current revision
uv run alembic current

# Check if models and migrations are in sync
uv run alembic check
```

---

_Migrations are permanent artifacts. Review every generated file. Never modify a migration after it has been applied in any shared environment._
