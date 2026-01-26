# Project Structure

## Project: {{projectName}}

## Organization Philosophy

Package-based organization with clear module boundaries. Each package is self-contained with its own models, services, and routes.

## Directory Patterns

### Application Package
**Location**: `/src/{{projectName}}/` or `/app/`
**Purpose**: Main application code
**Example**: __init__.py, main.py

### API Routes
**Location**: `/src/api/` or `/app/routers/`
**Purpose**: HTTP endpoint definitions
**Example**: users.py, auth.py

### Models
**Location**: `/src/models/`
**Purpose**: Pydantic models and SQLAlchemy models
**Example**: user.py, schemas.py

### Services
**Location**: `/src/services/`
**Purpose**: Business logic
**Example**: user_service.py, email_service.py

### Repositories
**Location**: `/src/repositories/`
**Purpose**: Data access layer
**Example**: user_repository.py

### Core
**Location**: `/src/core/`
**Purpose**: Shared utilities, config, dependencies
**Example**: config.py, dependencies.py, security.py

### Tests
**Location**: `/tests/`
**Purpose**: Test files mirroring src structure
**Example**: test_users.py, conftest.py

## Naming Conventions

- **Files**: snake_case.py (user_service.py, auth_router.py)
- **Classes**: PascalCase (UserService, UserSchema)
- **Functions**: snake_case (get_user, validate_token)
- **Constants**: UPPER_SNAKE_CASE
- **Packages**: snake_case (my_package/)

## Import Organization

```python
# 1. Standard library
from datetime import datetime
from typing import Optional

# 2. Third-party packages
from fastapi import FastAPI, Depends
from pydantic import BaseModel

# 3. Local application imports
from app.core.config import settings
from app.services.user_service import UserService
```

## Code Organization Principles

- **Explicit Imports**: No wildcard imports
- **Dependency Injection**: Use FastAPI Depends or manual DI
- **Single Responsibility**: Each module has one purpose
- **Clean Architecture**: Dependencies flow inward

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
