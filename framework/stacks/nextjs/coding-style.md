# Coding Style

TypeScript and React conventions for Next.js 15 App Router projects with strict type safety and consistent patterns.

---

## Philosophy

- **Strict TypeScript**: Enable all strict checks; `any` is a code smell, not a solution
- **Explicit over implicit**: Named exports, explicit return types on public functions, no magic
- **Consistency**: One way to do things, enforced by tooling, not willpower
- **Functional React**: Function components, hooks, composition over inheritance

---

## TypeScript Configuration

### Strict Mode (Non-Negotiable)

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Type vs Interface

| Use | When |
|---|---|
| `type` | Unions, intersections, mapped types, utility types |
| `interface` | Object shapes that may be extended, component props |

```typescript
// Interface for props (extendable)
interface ButtonProps {
  variant: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

// Type for unions and utility types
type ApiResponse<T> = { data: T; error: null } | { data: null; error: string };
type UserRole = "admin" | "member" | "viewer";
```

**Rule**: Be consistent within a file. When in doubt, use `interface` for props and `type` for everything else.

---

## Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Components | PascalCase | `UserProfile`, `DataTable` |
| Component files | PascalCase or kebab-case | `UserProfile.tsx` or `user-profile.tsx` |
| Hooks | camelCase with `use` prefix | `useAuth`, `useDebounce` |
| Utilities | camelCase | `formatDate`, `cn` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_BASE_URL` |
| Types/Interfaces | PascalCase | `UserProfile`, `ApiResponse` |
| Enums | PascalCase (members too) | `UserRole.Admin` |
| Route files | lowercase (Next.js convention) | `page.tsx`, `layout.tsx`, `route.ts` |
| Server actions | camelCase verb phrases | `createUser`, `updateProfile` |
| Zod schemas | camelCase + Schema suffix | `createUserSchema`, `loginSchema` |
| Environment variables | UPPER_SNAKE_CASE | `DATABASE_URL`, `NEXT_PUBLIC_APP_NAME` |

### Boolean Naming

```typescript
// Prefix with is, has, can, should
const isLoading = true;
const hasPermission = user.role === "admin";
const canEdit = hasPermission && !isArchived;
const shouldRefetch = Date.now() - lastFetch > STALE_TIME;
```

---

## Function Components

### Component Structure

```typescript
// 1. Imports
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 2. Types
interface CardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

// 3. Component (named export)
export function Card({ title, description, children, className }: CardProps) {
  return (
    <div className={cn("rounded-lg border p-6", className)}>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mt-1">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
```

### Rules

- Named exports only (no `export default` except for `page.tsx`, `layout.tsx`, and other Next.js conventions)
- Props interface defined above the component
- Destructure props in the function signature
- No `React.FC` -- use plain function with typed props

---

## Import Organization

### Order (Enforced by ESLint)

```typescript
// 1. React / Next.js
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// 2. External libraries
import { z } from "zod";
import { useForm } from "react-hook-form";

// 3. Internal aliases (@/)
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// 4. Relative imports
import { UserAvatar } from "./user-avatar";

// 5. Types (type-only imports)
import type { User } from "@prisma/client";
```

### Barrel Exports

```typescript
// components/ui/index.ts -- use sparingly
export { Button } from "./button";
export { Input } from "./input";
export { Card } from "./card";
```

**Warning**: Barrel exports can hurt tree-shaking and dev server performance. Use them for UI component libraries only, not for feature modules.

---

## Hooks Patterns

### Custom Hook Structure

```typescript
// hooks/use-debounce.ts
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

### Hook Rules

- One hook per file, named after the hook
- Always return a stable API (avoid returning new object references)
- Prefer returning tuples for simple state: `[value, setValue]`
- Prefer returning objects for complex state: `{ data, error, isLoading }`

---

## ESLint and Prettier

### ESLint Flat Config

```javascript
// eslint.config.mjs
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "prefer-const": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
```

### Prettier Config

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

---

## Module Organization

### Feature Modules

```
src/
  app/                     # Next.js routes
  components/
    ui/                    # Reusable UI primitives (Button, Input, Card)
    forms/                 # Form-specific components
    layouts/               # Layout components (Sidebar, Header)
  lib/
    prisma.ts              # Prisma client singleton
    auth.ts                # NextAuth configuration
    utils.ts               # General utilities (cn, formatDate)
  hooks/                   # Custom React hooks
  actions/                 # Server actions
  types/                   # Shared type definitions
```

### Avoid Deep Nesting

```typescript
// GOOD: Flat imports with aliases
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

// BAD: Deep relative paths
import { Button } from "../../../components/ui/button";
import { prisma } from "../../../lib/prisma";
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `any` type | Bypasses type checking entirely | Use `unknown` and narrow, or define proper types |
| `export default` everywhere | Inconsistent naming on import | Named exports except Next.js conventions |
| `React.FC` | Legacy, issues with generics | Plain function with typed props |
| Barrel exports for features | Breaks tree-shaking, slow HMR | Direct imports for feature modules |
| `as` type assertions | Unsafe, hides errors | Type guards and narrowing |
| Inline types in function signatures | Unreadable, not reusable | Define named types and interfaces |
| `// @ts-ignore` | Silences real errors | Fix the type, or use `// @ts-expect-error` with explanation |

---

_TypeScript exists to catch bugs before they ship. Configure it strictly, trust the compiler, and never silence it without a comment explaining why._
