# Code Quality Standards

Code quality conventions, linting, formatting, and type checking for React applications.

---

## Philosophy

- **Automate everything**: No manual enforcement; tools catch issues automatically
- **Fail fast**: Catch errors at write-time (IDE), commit-time (hooks), or CI
- **Single source of truth**: One tool per concern, no conflicting configurations
- **Developer experience**: Fast feedback, clear error messages, auto-fix when possible

---

## Tool Stack

| Tool | Purpose | Runs |
|------|---------|------|
| **TypeScript** | Static type checking | IDE, pre-commit, CI |
| **ESLint** | Code linting, React rules | IDE, pre-commit, CI |
| **Prettier** | Code formatting | IDE (on save), pre-commit |
| **Husky** | Git hooks | Pre-commit |
| **lint-staged** | Run checks on staged files only | Pre-commit |

---

## TypeScript Configuration

### Strict Mode (Required)

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Strict type checking (all required)
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,

    // React
    "jsx": "react-jsx",

    // Module resolution
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,

    // Path aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

### Key Compiler Options Explained

| Option | Effect |
|--------|--------|
| `strict` | Enables all strict checks (required) |
| `noUncheckedIndexedAccess` | `arr[0]` returns `T \| undefined` |
| `exactOptionalPropertyTypes` | `{ x?: string }` means `string \| undefined`, not `string \| undefined \| null` |
| `noImplicitOverride` | Must use `override` keyword for overridden methods |

---

## ESLint Configuration

### Flat Config (ESLint 9+)

```javascript
// eslint.config.js
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  // Base JS rules
  js.configs.recommended,

  // TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // React
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/prop-types': 'off', // Using TypeScript
      'react/jsx-no-target-blank': 'error',
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      'react/self-closing-comp': 'error',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Accessibility
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // Test files (relaxed rules)
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js'],
  },
];
```

---

## Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

```json
// .prettierignore
dist
node_modules
coverage
pnpm-lock.yaml
*.md
```

**Important**: Let Prettier handle formatting; disable ESLint formatting rules to avoid conflicts.

---

## Pre-commit Hooks

### Husky Setup

```bash
# Install
pnpm add -D husky lint-staged

# Initialize Husky
pnpm exec husky init
```

### Pre-commit Hook

```bash
# .husky/pre-commit
pnpm lint-staged
```

### lint-staged Configuration

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

**Behavior**: Only staged files are checked, keeping commits fast.

---

## VS Code Settings

```json
// .vscode/settings.json
{
  // Format on save
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",

  // ESLint
  "eslint.validate": ["javascript", "typescript", "javascriptreact", "typescriptreact"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },

  // TypeScript
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",

  // Tailwind CSS
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "'([^']*)'"]
  ],

  // File associations
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

### Recommended Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "usernamehw.errorlens",
    "yoavbls.pretty-ts-errors"
  ]
}
```

---

## Type Safety Patterns

### Avoid `any`

```typescript
// BAD
function parseData(data: any) {
  return data.value;
}

// GOOD - Use unknown and validate
function parseData(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value);
  }
  throw new Error('Invalid data');
}

// BETTER - Use Zod for runtime validation
import { z } from 'zod';

const DataSchema = z.object({ value: z.string() });

function parseData(data: unknown) {
  return DataSchema.parse(data).value;
}
```

### Type-safe Event Handlers

```typescript
// BAD
const handleChange = (e: any) => {
  setValue(e.target.value);
};

// GOOD
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};
```

### Discriminated Unions for State

```typescript
// BAD
interface State {
  loading: boolean;
  data?: User[];
  error?: string;
}

// GOOD - State is always valid
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User[] }
  | { status: 'error'; error: string };

// Usage with exhaustive checking
function render(state: State) {
  switch (state.status) {
    case 'idle':
      return <Idle />;
    case 'loading':
      return <Loading />;
    case 'success':
      return <UserList data={state.data} />;
    case 'error':
      return <Error message={state.error} />;
  }
}
```

### Interface vs Type

```typescript
// Use interface for object shapes (extendable, better errors)
interface User {
  id: number;
  name: string;
  email: string;
}

interface AdminUser extends User {
  permissions: string[];
}

// Use type for unions, intersections, primitives
type Status = 'idle' | 'loading' | 'success' | 'error';
type ID = string | number;
type UserWithStatus = User & { status: Status };
```

---

## Import Organization

ESLint can auto-sort imports. Add this rule:

```javascript
// eslint.config.js
{
  rules: {
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
          'index',
          'type',
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },
}
```

Result:

```typescript
// Builtin
import { useState, useEffect } from 'react';

// External
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// Internal (absolute imports)
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

// Relative
import { UserCard } from './UserCard';

// Types
import type { User } from '@/types';
```

---

## Quality Commands

```bash
# Full quality check (CI pipeline)
pnpm typecheck          # TypeScript
pnpm lint               # ESLint
pnpm format:check       # Prettier check (no write)

# Development workflow
pnpm lint:fix           # Auto-fix ESLint issues
pnpm format             # Format all files

# Single file check
pnpm exec eslint src/features/users/UserList.tsx
pnpm exec tsc --noEmit
```

### Package.json Scripts

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "quality": "pnpm typecheck && pnpm lint && pnpm format:check"
  }
}
```

---

## CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Type Check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Format Check
        run: pnpm format:check

      - name: Test
        run: pnpm test:run

      - name: Build
        run: pnpm build
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Disabling strict mode | Hides bugs | Keep strict mode, fix types |
| `// @ts-ignore` everywhere | Ignores type errors | Fix the types or use `@ts-expect-error` with comment |
| `as` type assertions | Unsafe casting | Validate with Zod, use type guards |
| No pre-commit hooks | Bad code reaches repo | Always use Husky + lint-staged |
| ESLint and Prettier conflicts | Inconsistent formatting | Let Prettier handle formatting |
| Manual import sorting | Inconsistent imports | Use ESLint import/order |

---

_Quality is automated. If a human has to remember a rule, it will be forgotten._
