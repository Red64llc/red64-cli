# SQLAlchemy Model Patterns

Best practices for SQLAlchemy 2.0 declarative models in modern Python projects.

---

## Philosophy

- **Database enforces integrity**: Constraints live in the schema, not just application code
- **Models are thin**: Business logic belongs in services, not models
- **Explicit relationships**: Define loading strategy at query time, not model time
- **Type-safe by default**: Use `Mapped[]` annotations for all columns

---

## Base Model

### Declarative Base with Conventions

```python
# app/models/base.py
from datetime import datetime
from typing import Any

from sqlalchemy import MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Naming conventions for constraints (required for Alembic)
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=convention)
```

**Why naming conventions**: Alembic needs predictable constraint names to generate reliable downgrade migrations. Without them, auto-generated names differ across databases.

---

## Timestamp Mixin

### Always Include Timestamps

```python
# app/models/mixins.py
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column

class TimestampMixin:
    """Add created_at and updated_at to any model."""

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
```

**Usage**: Every table gets timestamps. No exceptions.

```python
class User(TimestampMixin, Base):
    __tablename__ = "users"
    ...
```

---

## Model Definition (SQLAlchemy 2.0 Style)

### Complete Example

```python
# app/models/user.py
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import TimestampMixin, SoftDeleteMixin


class User(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(Text, default=None)
    is_active: Mapped[bool] = mapped_column(default=True)
    role: Mapped[str] = mapped_column(String(20), default="member")

    # Relationships
    posts: Mapped[list[Post]] = relationship(back_populates="author", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"
```

### Key Conventions

| Convention | Example | Reason |
|---|---|---|
| Singular model name | `User`, not `Users` | Python class convention |
| Plural table name | `"users"` | SQL convention |
| `Mapped[type]` for all columns | `Mapped[str]` | Type safety, IDE support |
| `Mapped[T \| None]` for nullable | `Mapped[str \| None]` | Explicit nullability |
| String lengths on VARCHAR | `String(255)` | Prevent unbounded columns |
| Index on foreign keys | `index=True` | Query performance |

---

## Data Integrity

### Constraints

```python
from sqlalchemy import CheckConstraint, UniqueConstraint, Index

class Order(TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("user_id", "external_id", name="uq_orders_user_external"),
        CheckConstraint("total_cents >= 0", name="positive_total"),
        Index("ix_orders_user_status", "user_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    total_cents: Mapped[int] = mapped_column()
```

### When to Use Each Constraint

| Constraint | Use Case |
|---|---|
| `unique=True` | Single-column uniqueness (email, slug) |
| `UniqueConstraint` | Multi-column uniqueness |
| `CheckConstraint` | Value range, format rules |
| `ForeignKey` | Referential integrity |
| `Index` | Composite indexes, partial indexes |
| `nullable=False` (default for `Mapped[T]`) | Required fields |

---

## Relationships

### Loading Strategies

```python
class Post(TimestampMixin, Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="draft")

    # Define relationship, but do NOT set eager loading here
    author: Mapped[User] = relationship(back_populates="posts")
    tags: Mapped[list[Tag]] = relationship(secondary="post_tags", back_populates="posts")
    comments: Mapped[list[Comment]] = relationship(back_populates="post", cascade="all, delete-orphan")
```

**Rule**: Never set `lazy="joined"` or `lazy="selectin"` on the model. Choose loading strategy at query time:

```python
# At query time, choose the right strategy
from sqlalchemy.orm import selectinload, joinedload

# For collections: selectinload (separate SELECT IN query)
stmt = select(Post).options(selectinload(Post.comments))

# For single relations: joinedload (JOIN in same query)
stmt = select(Post).options(joinedload(Post.author))

# Nested loading
stmt = select(User).options(
    selectinload(User.posts).selectinload(Post.comments)
)
```

### Cascade Behaviors

```python
# Delete orphans when parent is deleted
posts: Mapped[list[Post]] = relationship(cascade="all, delete-orphan")

# Nullify foreign key when parent is deleted
posts: Mapped[list[Post]] = relationship(passive_deletes=True)
# Requires: ForeignKey("users.id", ondelete="SET NULL")

# Database-level cascade (preferred for performance)
user_id: Mapped[int] = mapped_column(
    ForeignKey("users.id", ondelete="CASCADE"),
    index=True,
)
```

---

## Soft Deletes

### Mixin Pattern

```python
# app/models/mixins.py
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column

class SoftDeleteMixin:
    """Soft delete support. Query with .where(Model.deleted_at.is_(None))."""

    deleted_at: Mapped[datetime | None] = mapped_column(default=None, index=True)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None
```

### Querying with Soft Deletes

```python
# Active records only
stmt = select(User).where(User.deleted_at.is_(None))

# Include deleted
stmt = select(User)

# Deleted only
stmt = select(User).where(User.deleted_at.is_not(None))

# Soft delete operation
user.deleted_at = datetime.now(timezone.utc)
await db.commit()
```

---

## Hybrid Properties

### Computed Values

```python
from sqlalchemy.ext.hybrid import hybrid_property

class User(TimestampMixin, Base):
    __tablename__ = "users"

    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))

    @hybrid_property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @full_name.expression
    @classmethod
    def full_name(cls):
        return cls.first_name + " " + cls.last_name
```

This allows both Python-side and SQL-side usage:

```python
# Python
user.full_name  # "John Doe"

# SQL
stmt = select(User).where(User.full_name == "John Doe")
```

---

## Pydantic Integration

### Model to Schema

```python
# app/schemas/user.py
from pydantic import BaseModel, ConfigDict

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    is_active: bool
    created_at: datetime

class UserCreate(BaseModel):
    email: str
    name: str
    password: str  # Plain text, hashed before storage

class UserUpdate(BaseModel):
    name: str | None = None
    bio: str | None = None
```

### Usage

```python
# SQLAlchemy model -> Pydantic schema
user = await db.get(User, user_id)
response = UserResponse.model_validate(user)

# Pydantic schema -> dict for creation
data = UserCreate(email="a@b.com", name="Test", password="secret")
user = User(**data.model_dump(exclude={"password"}), hashed_password=hash_password(data.password))
```

---

## Enums

### Use Python StrEnum

```python
from enum import StrEnum

class PostStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class Post(TimestampMixin, Base):
    __tablename__ = "posts"

    # Store as string, not database ENUM (easier migrations)
    status: Mapped[str] = mapped_column(String(20), default=PostStatus.DRAFT)
```

**Why string over DB ENUM**: Adding values to a PostgreSQL ENUM requires a migration. String columns with application-level validation are simpler to evolve.

---

## Association Tables

### Many-to-Many

```python
from sqlalchemy import Table, Column, ForeignKey

post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)
```

### Association Object (with extra data)

```python
class PostTag(TimestampMixin, Base):
    __tablename__ = "post_tags"

    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)
    added_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    position: Mapped[int] = mapped_column(default=0)

    post: Mapped[Post] = relationship()
    tag: Mapped[Tag] = relationship()
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Business logic in models | Models become hard to test | Put logic in service layer |
| `lazy="joined"` on model | Always loads relation, N+1 risk | Choose strategy at query time |
| No constraint naming convention | Alembic generates unstable names | Use `MetaData(naming_convention=...)` |
| Missing `__repr__` | Debugging is painful | Always define `__repr__` |
| `String()` without length | Unbounded columns, DB-specific behavior | Always specify `String(n)` |
| Importing models in migrations | Models change, migrations break | Use `sa.table()` in migrations |

---

_Models define structure and integrity. Business rules belong in services. Loading strategies belong in queries._
