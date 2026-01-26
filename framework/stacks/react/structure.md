# Project Structure

## Project: {{projectName}}

## Organization Philosophy

Feature-first organization with shared components and utilities. Each feature is self-contained with its own components, hooks, and types.

## Directory Patterns

### Components
**Location**: `/src/components/`
**Purpose**: Shared, reusable UI components
**Example**: Button, Modal, Card, Input

### Features
**Location**: `/src/features/`
**Purpose**: Feature-specific code (components, hooks, types)
**Example**: auth/, dashboard/, settings/

### Hooks
**Location**: `/src/hooks/`
**Purpose**: Shared custom React hooks
**Example**: useDebounce, useLocalStorage, useMediaQuery

### Services
**Location**: `/src/services/`
**Purpose**: API calls and external integrations
**Example**: api.ts, auth.service.ts

### Types
**Location**: `/src/types/`
**Purpose**: Shared TypeScript interfaces and types
**Example**: User.ts, ApiResponse.ts

### Utils
**Location**: `/src/utils/`
**Purpose**: Pure utility functions
**Example**: formatDate, validators, helpers

## Naming Conventions

- **Component Files**: PascalCase.tsx (Button.tsx, UserProfile.tsx)
- **Hook Files**: use*.ts (useAuth.ts, useForm.ts)
- **Utility Files**: camelCase.ts (formatters.ts, validators.ts)
- **Test Files**: *.test.tsx or *.spec.tsx

## Import Organization

```typescript
// 1. React and external packages
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Internal absolute imports
import { Button } from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';

// 3. Relative imports
import { UserCard } from './UserCard';
import type { UserProps } from './types';
```

**Path Aliases**:
- `@/`: Maps to `src/`
- `@/components`: Maps to `src/components/`

## Code Organization Principles

- **Co-location**: Keep related code together (feature's components, hooks, types)
- **Single Responsibility**: Each file has one primary purpose
- **Barrel Exports**: Use index.ts for clean imports
- **Dependency Direction**: Features depend on shared, not vice versa

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
