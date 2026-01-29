# SQLAlchemy Query Patterns

Best practices for safe, performant database queries with SQLAlchemy 2.0 and async support.

---

## Philosophy

- **Parameterized always**: Never interpolate user input into SQL
- **Explicit loading**: Choose eager/lazy loading per query, not per model
- **Select what you need**: Avoid `SELECT *` when a subset suffices
- **Transactions are explicit**: Wrap related operations, commit intentionally

---

## SQL Injection Prevention

### Parameterized Queries (Always)

```python
# GOOD: SQLAlchemy handles parameterization
stmt = select(User).where(User.email == email)

# GOOD: Parameterized raw SQL
stmt = text("SELECT * FROM users WHERE email = :email")
result = await db.execute(stmt, {"email": email})

# GOOD: Filter with bound parameters
stmt = select(User).where(User.name.ilike(f"%{search_term}%"))
# SQLAlchemy binds search_term as a parameter internally
```

```python
# BAD: String interpolation -- SQL INJECTION RISK
stmt = text(f"SELECT * FROM users WHERE email = '{email}'")

# BAD: f-string in raw SQL
query = f"DELETE FROM users WHERE id = {user_id}"
```

**Rule**: If you see an f-string or `.format()` inside a SQL query, it is a bug.

---

## N+1 Query Prevention

### The Problem

```python
# BAD: N+1 -- one query for posts, then one query PER post for author
posts = (await db.execute(select(Post))).scalars().all()
for post in posts:
    print(post.author.name)  # Each access triggers a lazy load query
```

### selectinload (Collections)

```python
from sqlalchemy.orm import selectinload

# GOOD: Two queries total (posts + authors via SELECT IN)
stmt = select(Post).options(selectinload(Post.comments))
posts = (await db.execute(stmt)).scalars().all()

# Nested loading
stmt = (
    select(User)
    .options(
        selectinload(User.posts)
        .selectinload(Post.comments)
    )
)
```

### joinedload (Single Relations)

```python
from sqlalchemy.orm import joinedload

# GOOD: Single JOIN query for to-one relationships
stmt = select(Post).options(joinedload(Post.author))
posts = (await db.execute(stmt)).unique().scalars().all()
# Note: .unique() is required when using joinedload with collections
```

### When to Use Each

| Strategy | Use Case | Queries |
|---|---|---|
| `selectinload` | Collections (one-to-many, many-to-many) | 2 (base + IN) |
| `joinedload` | Single relations (many-to-one) | 1 (JOIN) |
| `subqueryload` | Large collections with complex base query | 2 (base + subquery) |
| `raiseload` | Prevent accidental lazy loading | Raises error |

### Prevent Accidental Lazy Loading

```python
from sqlalchemy.orm import raiseload

# Raise error if any unloaded relationship is accessed
stmt = select(Post).options(
    joinedload(Post.author),
    raiseload("*"),  # All other relationships will raise
)
```

---

## Select Only Needed Columns

### Partial Selects

```python
# Full model (all columns)
stmt = select(User)

# Only specific columns (returns Row objects, not models)
stmt = select(User.id, User.email, User.name)
rows = (await db.execute(stmt)).all()
for row in rows:
    print(row.id, row.email)

# Hybrid: load model but defer heavy columns
from sqlalchemy.orm import defer

stmt = select(User).options(defer(User.bio), defer(User.hashed_password))
```

### When to Use Partial Selects

| Scenario | Approach |
|---|---|
| List/index pages | Select only displayed columns |
| Detail pages | Full model load |
| Autocomplete/search | `select(Model.id, Model.name)` |
| Counting | `select(func.count()).select_from(Model)` |
| Existence check | `select(Model.id).where(...).limit(1)` |

---

## Proper Indexing

### Index Strategy

```python
from sqlalchemy import Index

class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        # Composite index for common query patterns
        Index("ix_posts_user_status", "user_id", "status"),
        # Partial index (PostgreSQL)
        Index(
            "ix_posts_published",
            "published_at",
            postgresql_where=text("status = 'published'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), index=True)
    published_at: Mapped[datetime | None] = mapped_column(index=True)
```

### Index Rules

- Index every foreign key column
- Index columns used in `WHERE`, `ORDER BY`, and `JOIN`
- Composite indexes: put high-cardinality columns first
- Partial indexes for filtered queries (e.g., only active records)
- Do not over-index: each index slows writes

---

## Transactions and Isolation

### Explicit Transactions

```python
# Default: auto-begin, explicit commit
async with db.begin():
    user = User(email="a@b.com", name="Test", hashed_password="hash")
    db.add(user)
    # Commits automatically at end of block
    # Rolls back on exception

# Manual commit pattern
db.add(user)
await db.flush()  # Generate ID without committing
# ... use user.id for related records ...
await db.commit()
```

### Isolation Levels

```python
from sqlalchemy.ext.asyncio import create_async_engine

# Set default isolation level
engine = create_async_engine(
    settings.database_url,
    isolation_level="READ COMMITTED",  # PostgreSQL default
)

# Per-transaction isolation (for critical operations)
async with db.begin():
    await db.connection(execution_options={"isolation_level": "SERIALIZABLE"})
    # Critical operation here
```

### Savepoints (Nested Transactions)

```python
async with db.begin():
    db.add(order)
    await db.flush()

    try:
        async with db.begin_nested():  # Savepoint
            await charge_payment(order)
    except PaymentError:
        # Savepoint rolled back, outer transaction continues
        order.status = "payment_failed"

    await db.commit()
```

---

## Query Timeouts

### Statement Timeout

```python
# Per-engine default (PostgreSQL)
engine = create_async_engine(
    settings.database_url,
    connect_args={"options": "-c statement_timeout=30000"},  # 30 seconds
)

# Per-query timeout
from sqlalchemy import text

await db.execute(text("SET LOCAL statement_timeout = '5s'"))
result = await db.execute(expensive_query)
```

### Application-Level Timeout

```python
import asyncio

async def get_report_data(db: AsyncSession) -> list[Row]:
    try:
        result = await asyncio.wait_for(
            db.execute(complex_report_query),
            timeout=10.0,
        )
        return result.all()
    except asyncio.TimeoutError:
        raise QueryTimeoutError("Report query exceeded 10s timeout")
```

---

## Bulk Operations

### Bulk Insert

```python
# GOOD: Bulk insert with executemany
users = [
    User(email=f"user{i}@example.com", name=f"User {i}", hashed_password="hash")
    for i in range(1000)
]
db.add_all(users)
await db.commit()

# BETTER: Core-level insert for large volumes (bypasses ORM overhead)
from sqlalchemy import insert

await db.execute(
    insert(User),
    [
        {"email": f"user{i}@example.com", "name": f"User {i}", "hashed_password": "hash"}
        for i in range(10000)
    ],
)
await db.commit()
```

### Bulk Update

```python
from sqlalchemy import update

# Update matching rows in a single statement
stmt = (
    update(User)
    .where(User.is_active == False)
    .where(User.last_login < cutoff_date)
    .values(status="inactive")
)
result = await db.execute(stmt)
print(f"Updated {result.rowcount} rows")
await db.commit()
```

### Bulk Delete

```python
from sqlalchemy import delete

stmt = delete(Session).where(Session.expires_at < datetime.now(timezone.utc))
result = await db.execute(stmt)
await db.commit()
```

---

## Raw SQL (When Appropriate)

### When to Use Raw SQL

- Complex reporting queries with CTEs, window functions
- Database-specific features (PostgreSQL `LATERAL`, `DISTINCT ON`)
- Performance-critical paths where ORM overhead matters
- One-off data migrations

```python
from sqlalchemy import text

# Named parameters (always)
stmt = text("""
    WITH active_users AS (
        SELECT id, name, created_at,
               ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
        FROM users
        WHERE is_active = :is_active
    )
    SELECT * FROM active_users WHERE rn <= :limit
""")

result = await db.execute(stmt, {"is_active": True, "limit": 10})
rows = result.all()
```

---

## Async Queries with asyncpg

### Engine Setup

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/db",
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=3600,
    echo=settings.debug,  # Log SQL in development
)

async_session = async_sessionmaker(engine, expire_on_commit=False)
```

### Session Dependency (FastAPI)

```python
from collections.abc import AsyncIterator

async def get_db() -> AsyncIterator[AsyncSession]:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

### Connection Pool Monitoring

```python
from sqlalchemy import event

@event.listens_for(engine.sync_engine, "checkout")
def log_checkout(dbapi_conn, connection_record, connection_proxy):
    logger.debug("Connection checked out from pool", pool_size=engine.pool.size())

@event.listens_for(engine.sync_engine, "checkin")
def log_checkin(dbapi_conn, connection_record):
    logger.debug("Connection returned to pool")
```

---

## Pagination

### Cursor-Based (Preferred)

```python
async def get_posts_cursor(
    db: AsyncSession,
    after_id: int | None = None,
    limit: int = 20,
) -> list[Post]:
    stmt = select(Post).order_by(Post.id.desc()).limit(limit + 1)
    if after_id:
        stmt = stmt.where(Post.id < after_id)

    results = (await db.execute(stmt)).scalars().all()
    has_next = len(results) > limit
    return results[:limit], has_next
```

### Offset-Based (Simple Cases)

```python
async def get_posts_page(
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Post], int]:
    count_stmt = select(func.count()).select_from(Post)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(Post).offset((page - 1) * per_page).limit(per_page)
    items = (await db.execute(stmt)).scalars().all()
    return items, total
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| f-strings in SQL | SQL injection | Use parameterized queries |
| No eager loading | N+1 queries | Use `selectinload`/`joinedload` |
| `SELECT *` for lists | Wasted bandwidth | Select needed columns |
| No indexes on FK columns | Slow joins | Always index foreign keys |
| Implicit transactions | Unexpected behavior | Explicit `begin()`/`commit()` |
| No query timeout | Runaway queries | Set statement timeout |
| ORM for bulk operations | Slow inserts/updates | Use core `insert()`/`update()` |

---

_Queries are the most performance-sensitive part of the application. Profile before optimizing, but prevent N+1 and injection from the start._
