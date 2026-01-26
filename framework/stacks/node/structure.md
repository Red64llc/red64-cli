# Project Structure

## Project: {{projectName}}

## Organization Philosophy

Layered architecture with clear separation of concerns. Routes handle HTTP, controllers orchestrate, services contain business logic, and repositories handle data access.

## Directory Patterns

### Routes
**Location**: `/src/routes/`
**Purpose**: HTTP route definitions and middleware
**Example**: users.routes.ts, auth.routes.ts

### Controllers
**Location**: `/src/controllers/`
**Purpose**: Request handling and response formatting
**Example**: users.controller.ts, auth.controller.ts

### Services
**Location**: `/src/services/`
**Purpose**: Business logic and domain operations
**Example**: user.service.ts, email.service.ts

### Repositories
**Location**: `/src/repositories/`
**Purpose**: Data access and database queries
**Example**: user.repository.ts

### Middleware
**Location**: `/src/middleware/`
**Purpose**: Express/Fastify middleware
**Example**: auth.middleware.ts, validation.middleware.ts

### Types
**Location**: `/src/types/`
**Purpose**: TypeScript interfaces and types
**Example**: User.ts, Request.ts

### Utils
**Location**: `/src/utils/`
**Purpose**: Pure utility functions
**Example**: logger.ts, crypto.ts, validators.ts

## Naming Conventions

- **Files**: kebab-case.ts (user-service.ts, auth-controller.ts)
- **Classes**: PascalCase (UserService, AuthController)
- **Functions**: camelCase (getUser, validateToken)
- **Constants**: UPPER_SNAKE_CASE

## Import Organization

```typescript
// 1. Node.js built-ins
import { readFile } from 'node:fs/promises';

// 2. External packages
import express from 'express';
import { z } from 'zod';

// 3. Internal absolute imports
import { UserService } from '@/services/user.service';
import { logger } from '@/utils/logger';

// 4. Relative imports
import { validateUser } from './validators';
```

**Path Aliases**:
- `@/`: Maps to `src/`

## Code Organization Principles

- **Dependency Injection**: Services receive dependencies as constructor parameters
- **Single Responsibility**: Each file/class has one primary purpose
- **Clean Architecture**: Dependencies point inward (routes → controllers → services → repositories)
- **Error Boundaries**: Centralized error handling middleware

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
