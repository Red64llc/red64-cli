# Project Conventions

Next.js 15 App Router file conventions, folder structure, environment management, and development workflow.

---

## Philosophy

- **Convention over configuration**: Follow Next.js file-based conventions; avoid custom routing
- **Colocation**: Keep related files together; tests next to source, types next to usage
- **Explicit boundaries**: Every route segment has its own loading, error, and not-found states
- **Environment safety**: Type-safe env vars, never leak secrets to the client

---

## App Router File Conventions

### Special Files

| File | Purpose | Required |
|---|---|---|
| `page.tsx` | Route UI, makes segment publicly accessible | Yes (for routes) |
| `layout.tsx` | Shared UI wrapper, persists across navigations | Root required |
| `loading.tsx` | Loading UI shown while page/segment loads | Recommended |
| `error.tsx` | Error boundary for the segment | Recommended |
| `not-found.tsx` | UI for `notFound()` calls | Recommended |
| `template.tsx` | Like layout but re-mounts on navigation | Rare |
| `default.tsx` | Parallel route fallback | When using parallel routes |
| `route.ts` | API endpoint (GET, POST, etc.) | For API routes |
| `global-error.tsx` | Root-level error boundary (wraps `<html>`) | Recommended |
| `middleware.ts` | Runs before every request (at project root) | As needed |

### File Naming

```
app/
  layout.tsx                    # Root layout (required)
  page.tsx                      # Home page (/)
  loading.tsx                   # Global loading state
  error.tsx                     # Global error boundary
  not-found.tsx                 # Global 404 page
  global-error.tsx              # Root error boundary

  dashboard/
    layout.tsx                  # Dashboard layout (sidebar, nav)
    page.tsx                    # /dashboard
    loading.tsx                 # Dashboard loading skeleton
    error.tsx                   # Dashboard error boundary

    settings/
      page.tsx                  # /dashboard/settings

    users/
      page.tsx                  # /dashboard/users
      [id]/
        page.tsx                # /dashboard/users/:id
        edit/
          page.tsx              # /dashboard/users/:id/edit

  (auth)/                       # Route group (no URL segment)
    login/
      page.tsx                  # /login
    register/
      page.tsx                  # /register

  api/
    health/
      route.ts                  # GET /api/health
    users/
      route.ts                  # GET, POST /api/users
      [id]/
        route.ts                # GET, PATCH, DELETE /api/users/:id
```

---

## Folder Structure

### Full Project Layout

```
src/
  app/                          # Next.js routes and layouts
  components/
    ui/                         # Reusable primitives (Button, Input, Card)
    forms/                      # Form-specific components
    layouts/                    # Layout building blocks (Sidebar, Header)
  lib/
    prisma.ts                   # Prisma client singleton
    auth.ts                     # NextAuth configuration
    utils.ts                    # General utilities
  hooks/                        # Custom React hooks
  actions/                      # Server actions
  types/                        # Shared TypeScript types
prisma/
  schema.prisma                 # Database schema
  migrations/                   # Migration history
  seed.ts                       # Seed data script
public/                         # Static assets (favicons, og images)
tests/
  e2e/                          # Playwright end-to-end tests
```

### Naming Patterns

| Entity | Convention | Example |
|---|---|---|
| Route directories | kebab-case | `user-settings/`, `api-keys/` |
| Component files | kebab-case | `user-card.tsx`, `data-table.tsx` |
| Utility files | kebab-case | `format-date.ts`, `cn.ts` |
| Hook files | kebab-case with use- prefix | `use-debounce.ts` |
| Action files | kebab-case | `user-actions.ts` |
| Type files | kebab-case | `api-types.ts` |
| Constants | kebab-case file, UPPER_SNAKE exports | `config.ts` with `MAX_RETRIES` |

---

## Route Groups and Parallel Routes

### Route Groups (Parentheses)

```
app/
  (marketing)/                  # No URL impact
    layout.tsx                  # Marketing layout (different nav)
    page.tsx                    # / (home)
    about/
      page.tsx                  # /about
    pricing/
      page.tsx                  # /pricing

  (dashboard)/                  # No URL impact
    layout.tsx                  # Dashboard layout (sidebar)
    dashboard/
      page.tsx                  # /dashboard
      settings/
        page.tsx                # /dashboard/settings
```

### Dynamic Routes

```typescript
// app/users/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: PageProps) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    notFound();
  }

  return <UserProfile user={user} />;
}

// app/blog/[...slug]/page.tsx -- Catch-all route
interface BlogPageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { slug } = await params;
  // slug = ["2024", "01", "my-post"] for /blog/2024/01/my-post
}
```

---

## Environment Variables

### Naming Convention

```bash
# Server-only (never sent to browser)
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
STRIPE_SECRET_KEY="sk_..."
OPENAI_API_KEY="sk-..."

# Client-safe (bundled into browser code)
NEXT_PUBLIC_APP_NAME="MyApp"
NEXT_PUBLIC_APP_URL="https://myapp.com"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."
```

### Type-Safe Environment

```typescript
// lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

### Files Hierarchy

| File | Purpose | Committed |
|---|---|---|
| `.env` | Defaults for all environments | Yes |
| `.env.local` | Local overrides with secrets | No (gitignored) |
| `.env.development` | Dev-specific defaults | Yes |
| `.env.production` | Prod-specific defaults | Yes |
| `.env.test` | Test environment | Yes |

---

## Git Workflow

### Branch Naming

```
feature/add-user-dashboard
fix/login-redirect-loop
chore/upgrade-prisma-6
refactor/extract-auth-middleware
```

### Commit Messages

```
feat: add user profile page with avatar upload
fix: prevent duplicate form submissions on slow networks
refactor: extract validation schemas to shared module
chore: upgrade Next.js to 15.1
docs: add API authentication guide
test: add E2E tests for checkout flow
```

### Pull Request Checklist

- TypeScript compiles without errors (`pnpm tsc --noEmit`)
- ESLint passes (`pnpm lint`)
- Tests pass (`pnpm test`)
- New routes have `loading.tsx` and `error.tsx`
- Environment variables documented if added
- Database migrations included if schema changed

---

## Feature Flags

### Simple Environment-Based

```typescript
// lib/flags.ts
export const flags = {
  newDashboard: process.env.NEXT_PUBLIC_FF_NEW_DASHBOARD === "true",
  aiFeatures: process.env.FF_AI_FEATURES === "true",
} as const;
```

### Usage

```typescript
import { flags } from "@/lib/flags";

export default function DashboardPage() {
  if (flags.newDashboard) {
    return <NewDashboard />;
  }
  return <LegacyDashboard />;
}
```

---

## Metadata and SEO

### Static Metadata

```typescript
// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "MyApp",
    template: "%s | MyApp",
  },
  description: "A modern web application",
  metadataBase: new URL("https://myapp.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "MyApp",
  },
};
```

### Dynamic Metadata

```typescript
// app/users/[id]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });

  return {
    title: user?.name ?? "User Not Found",
    description: user?.bio ?? undefined,
  };
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Custom routing library | Fights the framework | Use App Router file conventions |
| `NEXT_PUBLIC_` on secrets | Exposes secrets to the browser | Only prefix client-safe values |
| Missing `loading.tsx` | Blank screen during navigation | Add loading states for every route segment |
| Deeply nested routes (5+ levels) | Hard to navigate, slow resolution | Flatten with route groups |
| Environment variables without validation | Runtime crashes on missing values | Validate with zod at startup |
| Feature code in `app/` directory | Mixes routing with business logic | Keep route files thin, logic in `lib/` or `actions/` |

---

_Follow the framework's conventions. When Next.js provides a file-based solution, use it instead of inventing your own._
