# Testing Patterns

Comprehensive pytest patterns for modern Python projects.

---

## Philosophy

- **Fast feedback**: Unit tests run in milliseconds, no I/O
- **Realistic integration**: Test with real database when it matters
- **Readable tests**: Each test tells a story with arrange-act-assert
- **Fixtures over setup**: Composable pytest fixtures, not setUp/tearDown

---

## Test Organization

```
tests/
  conftest.py                # Shared fixtures (db, client, factories)
  unit/
    services/
      test_user_service.py
      test_content_service.py
    utils/
      test_hashing.py
  integration/
    api/
      test_users.py
      test_content.py
    repositories/
      test_user_repo.py
  factories/
    __init__.py
    user_factory.py
    content_factory.py
```

**Pattern**: Mirror `src/app/` structure. Prefix all test files with `test_`.

---

## Fixtures

### Database Session Fixture

```python
# tests/conftest.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

@pytest.fixture
async def db_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture
async def db(db_engine) -> AsyncIterator[AsyncSession]:
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()
```

### Test Client Fixture (FastAPI)

```python
import httpx
from app.main import app
from app.dependencies import get_db

@pytest.fixture
async def client(db: AsyncSession):
    async def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
```

### Factory Fixtures

```python
# tests/factories/user_factory.py
import factory
from faker import Faker
from app.models.user import User

fake = Faker()

class UserFactory(factory.Factory):
    class Meta:
        model = User

    id = factory.Sequence(lambda n: n + 1)
    email = factory.LazyFunction(fake.email)
    name = factory.LazyFunction(fake.name)
    hashed_password = "hashed_test_pw"
    is_active = True

# tests/conftest.py
@pytest.fixture
def user_factory():
    return UserFactory

@pytest.fixture
def sample_user(user_factory):
    return user_factory()
```

---

## Unit Test Patterns

### Service Testing with Mocks

```python
from unittest.mock import AsyncMock, MagicMock

class TestUserService:
    async def test_create_user_success(self):
        # Arrange
        repo = AsyncMock()
        repo.get_by_email.return_value = None
        repo.save.return_value = User(id=1, email="test@example.com", name="Test")

        service = UserService(repo=repo)
        data = CreateUserRequest(email="test@example.com", name="Test", password="secret123")

        # Act
        result = await service.create_user(data)

        # Assert
        assert result.is_ok
        assert result.value.email == "test@example.com"
        repo.save.assert_called_once()

    async def test_create_user_duplicate_email(self):
        repo = AsyncMock()
        repo.get_by_email.return_value = User(id=1, email="taken@example.com")

        service = UserService(repo=repo)
        data = CreateUserRequest(email="taken@example.com", name="Test", password="secret123")

        result = await service.create_user(data)

        assert not result.is_ok
        assert "already exists" in result.error
```

### Testing with `pytest.raises`

```python
async def test_get_user_not_found_raises():
    repo = AsyncMock()
    repo.get.return_value = None
    service = UserService(repo=repo)

    with pytest.raises(NotFoundError, match="User 999 not found"):
        await service.get_user(999)
```

---

## Parametrize

### Basic Parametrize

```python
@pytest.mark.parametrize("email,expected_valid", [
    ("user@example.com", True),
    ("user@sub.example.com", True),
    ("invalid", False),
    ("", False),
    ("@example.com", False),
])
def test_email_validation(email: str, expected_valid: bool):
    if expected_valid:
        user = CreateUserRequest(email=email, name="Test", password="pw123456")
        assert user.email == email
    else:
        with pytest.raises(ValueError):
            CreateUserRequest(email=email, name="Test", password="pw123456")
```

### Parametrize with IDs

```python
@pytest.mark.parametrize("status,can_publish", [
    pytest.param("draft", True, id="draft-can-publish"),
    pytest.param("published", False, id="already-published"),
    pytest.param("archived", False, id="archived-cannot-publish"),
])
async def test_publish_eligibility(status: str, can_publish: bool):
    content = ContentFactory(status=status)
    assert content.can_publish() == can_publish
```

---

## Mocking Patterns

### `unittest.mock` Essentials

```python
from unittest.mock import AsyncMock, MagicMock, patch

# AsyncMock for async functions
mock_repo = AsyncMock()
mock_repo.get.return_value = User(id=1, name="Test")

# MagicMock for sync objects
mock_cache = MagicMock()
mock_cache.get.return_value = None

# patch for module-level functions
@patch("app.services.content_service.send_notification")
async def test_create_sends_notification(mock_notify: AsyncMock):
    mock_notify.return_value = None
    await service.create(data)
    mock_notify.assert_called_once_with(user_id=1, content_id=42)
```

### Mock Side Effects

```python
# Simulate sequential return values
mock_repo.get.side_effect = [None, User(id=1, name="Created")]

# Simulate exception
mock_client.fetch.side_effect = ExternalServiceError("timeout")

# Custom side effect function
async def fake_save(entity):
    entity.id = 42
    return entity

mock_repo.save.side_effect = fake_save
```

---

## Async Testing

### pytest-asyncio (auto mode)

With `asyncio_mode = "auto"` in `pyproject.toml`, all `async def test_*` functions run automatically:

```python
# No decorator needed with auto mode
async def test_async_service_call():
    service = ContentService(repo=AsyncMock())
    result = await service.get_all()
    assert isinstance(result, list)
```

### Testing Async Generators

```python
async def test_stream_content():
    chunks = []
    async for chunk in service.stream_content("prompt"):
        chunks.append(chunk)
    assert len(chunks) > 0
    assert all(isinstance(c, str) for c in chunks)
```

---

## Integration Test Patterns

### API Endpoint Testing

```python
class TestUsersAPI:
    async def test_create_user(self, client: httpx.AsyncClient, db: AsyncSession):
        response = await client.post("/api/v1/users", json={
            "email": "new@example.com",
            "name": "New User",
            "password": "secure123",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "new@example.com"
        assert "password" not in data

    async def test_create_user_duplicate_email(
        self, client: httpx.AsyncClient, sample_user: User, db: AsyncSession,
    ):
        db.add(sample_user)
        await db.commit()

        response = await client.post("/api/v1/users", json={
            "email": sample_user.email,
            "name": "Duplicate",
            "password": "secure123",
        })

        assert response.status_code == 409

    async def test_list_users_requires_auth(self, client: httpx.AsyncClient):
        response = await client.get("/api/v1/users")
        assert response.status_code == 401
```

### Repository Testing (Real DB)

```python
class TestUserRepo:
    async def test_save_and_retrieve(self, db: AsyncSession):
        repo = UserRepo(db)
        user = User(email="test@example.com", name="Test", hashed_password="hash")

        saved = await repo.save(user)
        assert saved.id is not None

        found = await repo.get(saved.id)
        assert found is not None
        assert found.email == "test@example.com"

    async def test_get_by_email_not_found(self, db: AsyncSession):
        repo = UserRepo(db)
        result = await repo.get_by_email("nonexistent@example.com")
        assert result is None
```

---

## Test Markers

```python
# Mark slow tests
@pytest.mark.slow
async def test_full_pipeline():
    ...

# Mark integration tests
@pytest.mark.integration
async def test_database_migration():
    ...

# Skip conditionally
@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason="No API key")
async def test_openai_integration():
    ...
```

```bash
# Run only unit tests (exclude slow/integration)
uv run pytest tests/unit/ -m "not slow"

# Run integration tests
uv run pytest -m integration
```

---

## Test Commands

```bash
# Fast feedback
uv run pytest tests/unit/ -x                        # Stop on first failure
uv run pytest tests/unit/services/test_user.py -v    # Single file, verbose

# Full suite
uv run pytest --cov=src/app --cov-report=term-missing

# Parallel execution
uv run pytest -n auto                                # Requires pytest-xdist
```

---

_Tests document behavior. Each test should read as a specification of what the code does._
