# Tech Stack

Complete technology stack for Next.js 15 App Router projects with TypeScript, Tailwind CSS v4, Prisma, and NextAuth.js.

---

## Philosophy

- **Full-stack TypeScript**: One language from database to browser, shared types everywhere
- **Server-first**: Default to server components and server-side data fetching
- **Edge-ready**: Architecture that works on serverless and edge runtimes
- **Convention over configuration**: Leverage framework defaults before reaching for custom solutions

---

## Core Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js | 15 | Full-stack React framework with App Router |
| Language | TypeScript | 5.x | Strict mode, type-safe across the stack |
| Styling | Tailwind CSS | 4.x | Utility-first CSS with CSS-first configuration |
| ORM | Prisma | 6.x | Type-safe database access with migrations |
| Auth | NextAuth.js | 5.x | Authentication with multiple providers |
| Runtime | Node.js | 20+ | LTS runtime for server-side execution |
| Package Manager | pnpm | 9.x | Fast, disk-efficient package management |

---

## Frontend Stack

### UI Layer

| Technology | Purpose | Notes |
|---|---|---|
| React | 19 with Server Components | Default to RSC, opt into client when needed |
| Tailwind CSS v4 | Styling | CSS-first config via `@theme` in CSS |
| class-variance-authority | Component variants | Type-safe variant props |
| clsx + tailwind-merge | Class merging | `cn()` utility for conditional classes |
| Lucide React | Icons | Tree-shakeable SVG icon library |
| next/image | Image optimization | Automatic WebP/AVIF, lazy loading |
| next/font | Font optimization | Zero layout shift, self-hosted fonts |

### State and Data

| Technology | Purpose | Notes |
|---|---|---|
| React Server Components | Server-side data | No client bundle, direct DB access |
| Server Actions | Mutations | Type-safe form submissions |
| nuqs | URL state | Type-safe search params management |
| React Hook Form | Form state | Client-side form management with zod |
| SWR or TanStack Query | Client caching | Only when RSC is insufficient |

---

## Backend Stack

### Data Layer

| Technology | Purpose | Notes |
|---|---|---|
| Prisma Client | Query builder | Generated types from schema |
| Prisma Migrate | Schema migrations | Version-controlled database changes |
| PostgreSQL | Production database | Via Neon, Supabase, or self-hosted |
| SQLite | Development database | Zero-config local development |

### Authentication

| Technology | Purpose | Notes |
|---|---|---|
| NextAuth.js v5 | Auth framework | App Router native, edge-compatible |
| @auth/prisma-adapter | Session storage | Database-backed sessions |
| bcrypt | Password hashing | For credentials provider |

### API and Validation

| Technology | Purpose | Notes |
|---|---|---|
| Route Handlers | REST endpoints | `app/api/**/route.ts` |
| Server Actions | Mutations | `"use server"` functions |
| Zod | Schema validation | Shared between client and server |

---

## Testing Stack

| Technology | Purpose | Notes |
|---|---|---|
| Vitest | Unit and integration tests | Fast, ESM-native, Jest-compatible API |
| React Testing Library | Component testing | DOM-based, accessibility-focused |
| Playwright | End-to-end testing | Cross-browser, auto-waiting |
| MSW | API mocking | Service worker interception |

### Test Commands

```bash
# Unit and integration tests
pnpm vitest run

# Component tests with coverage
pnpm vitest run --coverage

# E2E tests
pnpm playwright test

# E2E with UI mode
pnpm playwright test --ui
```

---

## Development Tools

| Tool | Purpose | Configuration |
|---|---|---|
| ESLint | Linting | `eslint.config.mjs` with flat config |
| Prettier | Formatting | `.prettierrc` with Tailwind plugin |
| TypeScript | Type checking | `tsconfig.json` with strict mode |
| Prisma Studio | Database GUI | `pnpm prisma studio` |
| next dev --turbopack | Dev server | Turbopack for fast refresh |

### Editor Setup

```jsonc
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "non-relative"
}
```

---

## Deployment

| Component | Technology | Notes |
|---|---|---|
| Hosting | Vercel | Native Next.js support, edge functions |
| CI/CD | GitHub Actions | Lint, type-check, test, deploy |
| Database | Neon / Supabase | Serverless PostgreSQL with connection pooling |
| Monitoring | Sentry | Error tracking with source maps |
| Analytics | Vercel Analytics | Core Web Vitals, real user metrics |

### Environment Variables

```bash
# .env.local (never committed)
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# .env (defaults, committed)
NEXT_PUBLIC_APP_NAME="MyApp"
```

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Rendering | Server Components first | Smaller bundles, direct data access |
| Routing | App Router | Layouts, loading states, streaming |
| Styling | Tailwind v4 | CSS-first config, no JS overhead |
| ORM | Prisma | Best TypeScript DX, migration tooling |
| Auth | NextAuth v5 | App Router native, multiple providers |
| Testing | Vitest + Playwright | Fast unit tests, reliable E2E |
| State | URL + Server Components | Minimal client state, shareable URLs |
| Forms | Server Actions + react-hook-form | Progressive enhancement, type safety |

---

_Choose boring technology. Every dependency is a liability. Add tools only when the framework defaults fall short._
