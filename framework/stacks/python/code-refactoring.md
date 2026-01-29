# Code Refactoring Patterns

Project memory for safe code refactoring strategies in Python.

---

## Refactoring Philosophy

1. **Safety first**: Tests pass before and after every change
2. **Small steps**: Incremental changes that can be reverted independently
3. **Preserve behavior**: Refactoring changes structure, not functionality

---

## Extraction Patterns

### Service Extraction

Extract business logic from route handlers when it spans multiple concerns:

**Pattern**: Route Handler to Service
```python
# Before: Fat route handler
@router.post("/users/{user_id}/content")
async def create_content(
    user_id: int,
    data: CreateContentRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)
    content = Content(title=data.title, body=data.body, user_id=user.id)
    db.add(content)
    await db.commit()
    await notify_subscribers(user, content)
    await update_search_index(content)
    return ContentResponse.model_validate(content)

# After: Thin handler, extracted service
@router.post("/users/{user_id}/content")
async def create_content(
    user_id: int,
    data: CreateContentRequest,
    service: ContentService = Depends(get_content_service),
):
    result = await service.create(user_id=user_id, data=data)
    if not result.is_ok:
        raise HTTPException(400, detail=result.error)
    return ContentResponse.model_validate(result.value)
```

### Protocol Extraction

Extract shared behavior into protocols when multiple implementations exist:

```python
# Before: Concrete dependency
class ContentService:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get(self, id: int) -> Content:
        return await self._db.get(Content, id)

# After: Protocol-based abstraction
from typing import Protocol

class ContentRepository(Protocol):
    async def get(self, id: int) -> Content | None: ...
    async def save(self, content: Content) -> Content: ...

class SQLContentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get(self, id: int) -> Content | None:
        return await self._db.get(Content, id)

    async def save(self, content: Content) -> Content:
        self._db.add(content)
        await self._db.flush()
        return content

class ContentService:
    def __init__(self, repo: ContentRepository) -> None:
        self._repo = repo
```

### Strategy Pattern

Use when type-based conditionals grow:

```python
# Before: Growing if/elif chain
def process_source(source: Source) -> str:
    if source.type == "youtube":
        # 30 lines
    elif source.type == "web":
        # 25 lines
    elif source.type == "rss":
        # 20 lines

# After: Strategy registry
from typing import Protocol

class Extractor(Protocol):
    async def extract(self, source: Source) -> ExtractedContent: ...

EXTRACTORS: dict[str, type[Extractor]] = {
    "youtube": YoutubeExtractor,
    "web": WebExtractor,
    "rss": RssExtractor,
}

async def process_source(source: Source) -> ExtractedContent:
    extractor_cls = EXTRACTORS.get(source.type)
    if not extractor_cls:
        raise ValueError(f"Unknown source type: {source.type}")
    return await extractor_cls().extract(source)
```

---

## Dependency Injection for Testability

### Constructor Injection

```python
class NotificationService:
    def __init__(
        self,
        email_client: EmailClient | None = None,
        event_bus: EventBus | None = None,
    ) -> None:
        self._email = email_client or SmtpEmailClient()
        self._events = event_bus or RedisEventBus()

# Production: uses defaults
service = NotificationService()

# Test: inject mocks
service = NotificationService(
    email_client=FakeEmailClient(),
    event_bus=FakeEventBus(),
)
```

### FastAPI Dependency Overrides

```python
# In tests: override dependencies
from app.dependencies import get_user_service

app.dependency_overrides[get_user_service] = lambda: mock_service
```

---

## Pydantic Model Refactoring

### Flatten Nested Logic into Models

```python
# Before: Validation scattered in service
class ContentService:
    async def create(self, title: str, body: str, tags: list[str]):
        if not title.strip():
            raise ValueError("Title required")
        if len(tags) > 10:
            raise ValueError("Too many tags")
        ...

# After: Validation in Pydantic model
class CreateContentRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(default="")
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()
```

### Extract Shared Fields with Base Models

```python
class TimestampMixin(BaseModel):
    created_at: datetime
    updated_at: datetime

class UserResponse(TimestampMixin):
    id: int
    email: str
    name: str

class ContentResponse(TimestampMixin):
    id: int
    title: str
    status: str
```

---

## Safe Refactoring Workflow

### Step 1: Ensure Test Coverage

```bash
# Check coverage for the module being refactored
uv run pytest tests/unit/services/test_content_service.py --cov=src/app/services/content_service

# Add characterization tests if missing
def test_current_create_behavior():
    """Document existing behavior before refactoring."""
    ...
```

### Step 2: Small, Reversible Changes

**Good**: One concept per commit
```
commit 1: Extract ContentRepository protocol
commit 2: Implement SQLContentRepository
commit 3: Update ContentService to use repository
commit 4: Update dependency injection wiring
```

### Step 3: Verify After Each Change

```bash
uv run pytest tests/ -x              # Stop on first failure
uv run mypy src/                     # Type safety preserved
uv run ruff check .                  # Style maintained
```

---

## Refactoring Signals

### When to Extract

| Signal | Action |
|--------|--------|
| Route handler > 15 lines | Extract to service |
| Service > 200 lines | Split by responsibility |
| if/elif > 3 branches on type | Strategy pattern |
| Same 5+ lines in multiple places | Extract to utility/mixin |
| External API call in service | Extract to client class |
| Complex query logic | Extract to repository |

### When NOT to Extract

- Single-use logic that fits naturally in one place
- Simple CRUD without business rules
- Premature abstraction (wait for 3+ uses)
- Adding layers just for the sake of layers

---

## Common Refactoring Targets

### Fat Services

Split by responsibility:
```
content_service.py (500 lines) ->
  content_service.py      # CRUD operations
  content_publisher.py    # Publishing logic
  content_enricher.py     # AI enrichment
```

### Complex Conditionals

Replace with:
- Guard clauses (early returns)
- Strategy/registry patterns
- `match` statements (Python 3.10+)

```python
# Pattern: match statement for clean branching
match source.type:
    case "youtube":
        return await extract_youtube(source)
    case "web":
        return await extract_web(source)
    case _:
        raise ValueError(f"Unknown type: {source.type}")
```

---

## Refactoring Checklist

Before starting:
- [ ] Tests pass for affected code
- [ ] Understand current behavior fully
- [ ] Plan incremental steps

During:
- [ ] One logical change per commit
- [ ] Tests pass after each step
- [ ] Types check after each step
- [ ] No behavior changes (unless intentional)

After:
- [ ] Full test suite passes
- [ ] mypy passes
- [ ] Ruff passes
- [ ] Manual smoke test of affected features

---

_Refactoring improves code structure while preserving behavior. Small, typed, tested steps over large rewrites._
