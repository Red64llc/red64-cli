# Project Structure

## Project: red64-cli

## Organization Philosophy

Feature-first organization with shared components and utilities. Each feature is self-contained with its own components, hooks, types, and API calls. Shared code lives in dedicated directories at the root level.

---

## Directory Structure

```
src/
├── app/                    # Application shell
│   ├── App.tsx            # Root component, providers
│   ├── routes.tsx         # Route definitions
│   └── providers/         # Context providers (QueryClient, etc.)
├── components/            # Shared UI components
│   ├── ui/               # Primitive components (Button, Input, Modal)
│   └── layout/           # Layout components (Header, Sidebar, Footer)
├── features/             # Feature modules (self-contained)
│   ├── auth/
│   ├── dashboard/
│   └── users/
├── hooks/                # Shared custom hooks
├── lib/                  # Third-party library configurations
├── services/             # API client, external integrations
├── stores/               # Global state (Zustand stores)
├── types/                # Shared TypeScript types
└── utils/                # Pure utility functions
```

---

## Directory Patterns

### `/src/app/` - Application Shell
**Purpose**: Application entry point, routing, and global providers

```typescript
// app/App.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { router } from './routes';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

---

### `/src/components/` - Shared Components
**Purpose**: Reusable UI components used across multiple features

```
components/
├── ui/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── index.ts
│   ├── Input/
│   ├── Modal/
│   └── index.ts           # Barrel export
└── layout/
    ├── Header.tsx
    ├── Sidebar.tsx
    └── PageLayout.tsx
```

**Rules**:
- Components must be generic and reusable
- No business logic; accept data via props
- Include unit tests for interactive components
- Export via barrel files for clean imports

---

### `/src/features/` - Feature Modules
**Purpose**: Self-contained feature code with its own components, hooks, API, and types

```
features/
└── users/
    ├── components/        # Feature-specific components
    │   ├── UserList.tsx
    │   ├── UserCard.tsx
    │   └── UserForm.tsx
    ├── hooks/            # Feature-specific hooks
    │   ├── useUsers.ts
    │   └── useUserMutations.ts
    ├── api/              # Feature API calls
    │   └── users.api.ts
    ├── types/            # Feature types
    │   └── user.types.ts
    ├── utils/            # Feature utilities
    │   └── user.utils.ts
    └── index.ts          # Public API (barrel export)
```

**Feature Module Rules**:
- Features are isolated; do not import from other features
- Shared code goes in root-level directories
- Export only the public API via `index.ts`
- Feature components can import from `@/components/ui`

```typescript
// features/users/index.ts - Public API
export { UserList } from './components/UserList';
export { useUsers, useUser } from './hooks/useUsers';
export type { User, CreateUserInput } from './types/user.types';
```

---

### `/src/hooks/` - Shared Hooks
**Purpose**: Custom React hooks used across multiple features

```
hooks/
├── useDebounce.ts
├── useLocalStorage.ts
├── useMediaQuery.ts
├── useOnClickOutside.ts
└── index.ts
```

**Naming**: Always prefix with `use` (e.g., `useDebounce.ts`)

```typescript
// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

---

### `/src/services/` - API & External Services
**Purpose**: HTTP client setup, API configurations, external integrations

```
services/
├── api.ts               # Base API client configuration
├── auth.service.ts      # Auth-specific API calls (if not in feature)
└── storage.service.ts   # LocalStorage/SessionStorage wrapper
```

```typescript
// services/api.ts
import ky from 'ky';
import { useAuthStore } from '@/stores/auth.store';

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL,
  hooks: {
    beforeRequest: [
      (request) => {
        const token = useAuthStore.getState().token;
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
  },
});
```

---

### `/src/stores/` - Global State
**Purpose**: Zustand stores for client-side state

```
stores/
├── auth.store.ts
├── ui.store.ts          # UI state (sidebar open, theme, etc.)
└── index.ts
```

```typescript
// stores/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'auth-storage' }
  )
);
```

---

### `/src/types/` - Shared Types
**Purpose**: TypeScript interfaces and types used across features

```
types/
├── api.types.ts         # API response shapes
├── common.types.ts      # Utility types
└── index.ts
```

```typescript
// types/api.types.ts
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  hasNext: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}
```

---

### `/src/utils/` - Utility Functions
**Purpose**: Pure utility functions with no React dependencies

```
utils/
├── formatters.ts        # Date, number, currency formatting
├── validators.ts        # Validation helpers
├── cn.ts               # className utility (clsx + tailwind-merge)
└── index.ts
```

```typescript
// utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

---

### `/src/lib/` - Library Configurations
**Purpose**: Configuration for third-party libraries

```
lib/
├── query-client.ts      # TanStack Query client setup
├── zod-schemas.ts       # Shared Zod schemas
└── dayjs.ts            # dayjs with plugins
```

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Components** | PascalCase | `UserProfile.tsx`, `Button.tsx` |
| **Hooks** | camelCase with `use` prefix | `useAuth.ts`, `useDebounce.ts` |
| **Utilities** | camelCase | `formatters.ts`, `validators.ts` |
| **Types** | PascalCase | `User`, `ApiResponse` |
| **Stores** | camelCase with `.store` suffix | `auth.store.ts` |
| **API files** | camelCase with `.api` suffix | `users.api.ts` |
| **Test files** | Same as source with `.test` | `Button.test.tsx` |
| **Constants** | SCREAMING_SNAKE_CASE | `API_BASE_URL` |

---

## Import Organization

```typescript
// 1. React imports
import { useState, useEffect, type ReactNode } from 'react';

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

// 3. Absolute imports (internal)
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import type { User } from '@/types';

// 4. Relative imports (same feature)
import { UserCard } from './UserCard';
import type { UserListProps } from './types';

// 5. Styles (if CSS modules)
import styles from './UserList.module.css';
```

**Path Aliases** (configured in `tsconfig.json` and `vite.config.ts`):
- `@/` → `src/`

---

## Code Organization Principles

### Colocation
Keep related code together. A feature's components, hooks, types, and API calls live in the same directory.

### Single Responsibility
Each file has one primary purpose. A component file contains one component. A hook file contains one hook.

### Barrel Exports
Use `index.ts` for clean imports, but only export the public API.

```typescript
// features/users/index.ts
export { UserList } from './components/UserList';
export { UserForm } from './components/UserForm';
export { useUsers } from './hooks/useUsers';
// Don't export internal components like UserCard
```

### Dependency Direction
- Features import from shared (`@/components`, `@/hooks`, `@/utils`)
- Features do NOT import from other features
- Shared code does NOT import from features

---

## Test File Organization

```
src/
├── features/
│   └── users/
│       ├── components/
│       │   ├── UserList.tsx
│       │   └── UserList.test.tsx    # Co-located with component
│       └── hooks/
│           ├── useUsers.ts
│           └── useUsers.test.ts
└── utils/
    ├── formatters.ts
    └── formatters.test.ts

tests/                               # E2E tests at root level
├── e2e/
│   ├── auth.spec.ts
│   └── users.spec.ts
└── setup.ts
```

---

_Document patterns, not file trees. New files following patterns should not require updates to this document._
