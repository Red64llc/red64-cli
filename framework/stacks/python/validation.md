# Validation Patterns

Input validation with Pydantic v2 and FastAPI for type-safe, self-documenting APIs.

---

## Philosophy

- **Server-side is the source of truth**: Never trust client-side validation alone
- **Fail early**: Reject invalid data before it reaches business logic
- **Descriptive errors**: Field-specific messages that help users fix input
- **Schema as documentation**: Pydantic models generate OpenAPI specs automatically

---

## Pydantic Model Basics

### Request Schemas

```python
# app/schemas/user.py
from pydantic import BaseModel, EmailStr, Field


class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    bio: str | None = Field(default=None, max_length=2000)


class UpdateUserRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    bio: str | None = Field(default=None, max_length=2000)
```

### Response Schemas

```python
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    bio: str | None
    is_active: bool
    created_at: datetime
```

**Rule**: Always use separate request and response schemas. Never expose internal fields (password hashes, soft-delete timestamps) in responses.

---

## Field Validators

### field_validator (Single Field)

```python
from pydantic import field_validator
import re


class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    username: str = Field(min_length=3, max_length=30)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Must contain at least one digit")
        return v

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9_-]+$", v):
            raise ValueError("Only lowercase letters, numbers, hyphens, and underscores")
        return v
```

### model_validator (Cross-Field)

```python
from pydantic import model_validator


class DateRangeRequest(BaseModel):
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_date_range(self) -> "DateRangeRequest":
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        if (self.end_date - self.start_date).days > 365:
            raise ValueError("Date range cannot exceed one year")
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("new_password and confirm_password must match")
        if self.new_password == self.current_password:
            raise ValueError("New password must differ from current password")
        return self
```

---

## FastAPI Request Validation

### Automatic Validation

FastAPI validates request bodies, query params, and path params automatically:

```python
from fastapi import APIRouter, Query, Path

router = APIRouter()


@router.post("/users", status_code=201)
async def create_user(data: CreateUserRequest) -> UserResponse:
    # data is already validated by Pydantic
    ...


@router.get("/users")
async def list_users(
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=20, ge=1, le=100, description="Items per page"),
    search: str | None = Query(default=None, min_length=1, max_length=100),
    status: str | None = Query(default=None, pattern="^(active|inactive|all)$"),
) -> PaginatedResponse[UserResponse]:
    ...


@router.get("/users/{user_id}")
async def get_user(
    user_id: int = Path(ge=1, description="User ID"),
) -> UserResponse:
    ...
```

### Custom Error Messages for FastAPI

Override the default Pydantic validation error format:

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError,
) -> JSONResponse:
    errors = {}
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        errors[field] = error["msg"]

    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {"field_errors": errors},
            },
        },
    )
```

---

## Custom Types

### Reusable Annotated Types

```python
from typing import Annotated
from pydantic import Field, AfterValidator


def validate_slug(v: str) -> str:
    import re
    if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", v):
        raise ValueError("Invalid slug format (lowercase, hyphens only)")
    return v


# Reusable types
Slug = Annotated[str, Field(min_length=1, max_length=200), AfterValidator(validate_slug)]
NonEmptyStr = Annotated[str, Field(min_length=1, strip_whitespace=True)]
PositiveInt = Annotated[int, Field(gt=0)]
PageSize = Annotated[int, Field(ge=1, le=100)]


# Usage
class CreatePostRequest(BaseModel):
    title: NonEmptyStr = Field(max_length=500)
    slug: Slug
    body: str = Field(min_length=1)
    category_id: PositiveInt
```

---

## Coercion vs Strict Mode

### Default (Coercing)

Pydantic coerces compatible types by default:

```python
class Item(BaseModel):
    count: int
    price: float

# These all work:
Item(count="5", price="9.99")   # Strings coerced to numbers
Item(count=5.0, price=9)        # Float to int, int to float
```

### Strict Mode

```python
from pydantic import BaseModel, ConfigDict


class StrictItem(BaseModel):
    model_config = ConfigDict(strict=True)

    count: int
    price: float

# StrictItem(count="5", price="9.99")  # ValidationError: int expected
StrictItem(count=5, price=9.99)         # OK
```

### Per-Field Strict

```python
from pydantic import Field


class MixedItem(BaseModel):
    id: int = Field(strict=True)    # Must be int
    quantity: int                     # Coercion allowed
    label: str                        # Coercion allowed
```

**Guidance**: Use strict mode for IDs and critical fields. Allow coercion for user-facing inputs where `"5"` meaning `5` is reasonable.

---

## Nested Model Validation

### Composable Schemas

```python
class Address(BaseModel):
    street: str = Field(min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=2, max_length=2)
    zip_code: str = Field(pattern=r"^\d{5}(-\d{4})?$")


class CreateOrderRequest(BaseModel):
    items: list[OrderItemRequest] = Field(min_length=1, max_length=50)
    shipping_address: Address
    billing_address: Address | None = None
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def set_billing_default(self) -> "CreateOrderRequest":
        if self.billing_address is None:
            self.billing_address = self.shipping_address
        return self


class OrderItemRequest(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=999)
```

---

## Discriminated Unions

### Tagged Unions for Polymorphic Data

```python
from typing import Literal, Annotated
from pydantic import BaseModel, Field


class EmailNotification(BaseModel):
    type: Literal["email"]
    to: EmailStr
    subject: str = Field(max_length=200)
    body: str


class SmsNotification(BaseModel):
    type: Literal["sms"]
    phone: str = Field(pattern=r"^\+[1-9]\d{1,14}$")
    message: str = Field(max_length=160)


class WebhookNotification(BaseModel):
    type: Literal["webhook"]
    url: str
    payload: dict


Notification = Annotated[
    EmailNotification | SmsNotification | WebhookNotification,
    Field(discriminator="type"),
]


class SendNotificationRequest(BaseModel):
    notifications: list[Notification] = Field(min_length=1, max_length=10)
```

Pydantic uses the `type` field to determine which model to validate against, giving precise error messages.

---

## Serialization Aliases

### Different Names for API vs Internal

```python
from pydantic import BaseModel, ConfigDict, Field


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    email_address: str = Field(alias="email", serialization_alias="email_address")
    full_name: str = Field(alias="name")
    is_active: bool


# From SQLAlchemy model (uses alias to read "email" attribute)
user_response = UserResponse.model_validate(user_model)

# Serialized output uses serialization_alias
# {"id": 1, "email_address": "a@b.com", "full_name": "Test", "is_active": true}
```

### Snake Case to Camel Case

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelCaseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class UserResponse(CamelCaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool

# Serializes to: {"id": 1, "email": "...", "fullName": "...", "isActive": true}
# Accepts both: {"full_name": "..."} and {"fullName": "..."}
```

---

## OpenAPI Schema Generation

### Automatic from Pydantic

FastAPI generates OpenAPI schemas from Pydantic models automatically:

```python
class CreateUserRequest(BaseModel):
    """Create a new user account."""

    email: EmailStr = Field(description="User's email address", examples=["user@example.com"])
    name: str = Field(
        min_length=1,
        max_length=255,
        description="Display name",
        examples=["Jane Doe"],
    )
    password: str = Field(
        min_length=8,
        max_length=128,
        description="Account password",
    )
```

### JSON Schema Examples

```python
class CreateUserRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "email": "jane@example.com",
                    "name": "Jane Doe",
                    "password": "SecurePass1",
                },
            ],
        },
    )

    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8)
```

---

## Validation Layers

| Layer | Tool | Purpose |
|---|---|---|
| HTTP request | FastAPI + Pydantic | Type, format, range validation |
| Business rules | Service layer | Domain logic (duplicates, permissions) |
| Database | SQLAlchemy constraints | Data integrity (unique, foreign keys, checks) |

**Rule**: Each layer validates its own concerns. Do not rely on a single layer.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Validating in route handlers | Scattered logic, hard to test | Use Pydantic schemas |
| Same schema for create/read | Exposes internal fields | Separate request/response schemas |
| No `max_length` on strings | Unbounded input, DoS risk | Always set `max_length` |
| Bare `dict` for request body | No validation, no docs | Use typed Pydantic model |
| Validating in the database only | Late failure, poor error messages | Validate at entry point too |
| Mutable default values | Shared state bugs | Use `Field(default_factory=list)` |

---

_Validation is the first line of defense. If the data is wrong, reject it immediately with a clear explanation._
