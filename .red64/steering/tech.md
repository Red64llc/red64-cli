# Technology Stack

## Project: red64-cli

## Architecture

Component-based architecture with unidirectional data flow. React components handle UI rendering while hooks manage state and side effects. Server state is separated from client state using dedicated libraries.

---

## Core Technologies

| Category | Choice | Rationale |
|----------|--------|-----------|
| **Language** | TypeScript 5.x (strict) | Type safety, better DX, catch errors at compile time |
| **Framework** | React 18+ | Concurrent rendering, automatic batching, Suspense |
| **Runtime** | Node.js 20+ (dev), Browser (prod) | Modern ESM support, native fetch |
| **Build Tool** | Vite 5+ | Fastest HMR, native ESM, optimized production builds |
| **Package Manager** | pnpm | Fast, disk-efficient, strict dependency resolution |

---

## Key Libraries

### State Management
| Library | Use Case |
|---------|----------|
| **Zustand** | Client state (UI state, user preferences) |
| **TanStack Query** | Server state (API data, caching, sync) |
| **React Context** | Dependency injection (theme, auth context) |

### Data Fetching
| Library | Use Case |
|---------|----------|
| **TanStack Query** | Server state, caching, background refetch |
| **ky** / **fetch** | HTTP client (ky for better DX, native fetch for simplicity) |
| **zod** | Runtime validation of API responses |

### Routing
| Library | Use Case |
|---------|----------|
| **React Router 6+** | Client-side routing, nested routes, loaders |
| **TanStack Router** | Type-safe routing (alternative) |

### Forms
| Library | Use Case |
|---------|----------|
| **React Hook Form** | Performant forms, minimal re-renders |
| **Zod** | Schema validation, type inference |
| **@hookform/resolvers** | Zod integration with RHF |

### Styling
| Library | Use Case |
|---------|----------|
| **Tailwind CSS 3+** | Utility-first, design system, purged production CSS |
| **tailwind-merge** | Conditional class merging without conflicts |
| **clsx** | Conditional classNames |

### UI Components
| Library | Use Case |
|---------|----------|
| **Radix UI** | Unstyled, accessible primitives |
| **shadcn/ui** | Copy-paste components built on Radix |
| **Lucide React** | Icon library |

---

## Development Standards

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Type Safety Rules
- TypeScript strict mode enabled
- No `any` types except for third-party library edge cases (use `unknown` instead)
- Explicit return types for exported functions
- Prefer `interface` over `type` for object shapes (better error messages, extendable)
- Use discriminated unions for state machines
- Validate external data with Zod at runtime

---

## Code Quality

| Tool | Purpose |
|------|---------|
| **ESLint** | Linting with React and TypeScript rules |
| **Prettier** | Code formatting (single source of truth) |
| **Husky** | Git hooks for pre-commit checks |
| **lint-staged** | Run checks only on staged files |

### ESLint Configuration

```javascript
// eslint.config.js (flat config)
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
];
```

---

## Testing

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit and integration tests (native Vite integration, fastest) |
| **React Testing Library** | Component testing (user-centric) |
| **MSW** | API mocking (Mock Service Worker) |
| **Playwright** | End-to-end testing |
| **@testing-library/user-event** | Realistic user interactions |

### Coverage Requirements
- Minimum 80% coverage for business logic (hooks, utils)
- Critical user flows must have E2E tests
- Components tested for user interactions, not implementation details

---

## Development Environment

### Required Tools
- Node.js 20+
- pnpm 8+ (or npm/yarn)
- VS Code with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin (Volar) for better TS support

### Common Commands

```bash
# Development
pnpm dev              # Start dev server with HMR
pnpm build            # Production build
pnpm preview          # Preview production build

# Testing
pnpm test             # Run Vitest in watch mode
pnpm test:run         # Run tests once
pnpm test:coverage    # Run with coverage report
pnpm test:e2e         # Run Playwright E2E tests

# Code Quality
pnpm lint             # ESLint check
pnpm lint:fix         # Auto-fix ESLint issues
pnpm format           # Prettier format
pnpm typecheck        # TypeScript type checking
```

---

## Key Technical Decisions

### Component Patterns
- **Functional Components**: Always use functional components with hooks
- **Custom Hooks**: Extract reusable logic into custom hooks (prefix with `use`)
- **Composition**: Prefer composition over inheritance
- **Render Props / HOCs**: Avoid unless library requires it

### State Patterns
- **Server vs Client State**: Separate concerns using TanStack Query (server) and Zustand (client)
- **Immutability**: Never mutate state directly; use immer if complex updates needed
- **Colocation**: Keep state as close to where it's used as possible
- **Lift State Up**: Only when multiple components need the same state

### Performance Defaults
- **Code Splitting**: Use `React.lazy()` for route-level splitting
- **Memoization**: Use `useMemo`/`useCallback` only when profiler shows need
- **Virtualization**: Use `@tanstack/react-virtual` for long lists (1000+ items)

### Error Handling
- **Error Boundaries**: Wrap feature sections, not individual components
- **API Errors**: Handle with TanStack Query's built-in error states
- **Form Errors**: Inline validation with React Hook Form + Zod

---

## Project Initialization

```bash
# Create new project with Vite
pnpm create vite@latest my-app --template react-ts
cd my-app

# Install core dependencies
pnpm add @tanstack/react-query zustand react-router-dom zod react-hook-form @hookform/resolvers

# Install UI dependencies
pnpm add tailwindcss postcss autoprefixer clsx tailwind-merge lucide-react
pnpm add -D @radix-ui/react-* # Add specific primitives as needed

# Install dev dependencies
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
pnpm add -D msw playwright @playwright/test
pnpm add -D eslint prettier eslint-plugin-react-hooks eslint-plugin-jsx-a11y
pnpm add -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D husky lint-staged
```

---

_Document standards and patterns, not every dependency. Keep this current as the stack evolves._
