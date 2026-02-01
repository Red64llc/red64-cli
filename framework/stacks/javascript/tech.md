# Technology Stack

## Architecture

Modern Node.js application with ESM-first design. Fastify or Express as web framework, PostgreSQL for persistence, Redis for caching and queues, Docker for deployment.

---

## Core Technologies

- **Runtime**: Node.js 22+ (LTS)
- **Package Manager**: pnpm (fast, disk-efficient) or npm
- **Module System**: ESM (`"type": "module"` in package.json)
- **Web Framework**: Fastify (performance-first) or Express (ecosystem) or Hono (edge/serverless)
- **Database**: PostgreSQL with pg or postgres.js
- **ORM/Query Builder**: Drizzle ORM (SQL-first) or Prisma (DX-first)
- **Validation**: Zod (TypeScript-aligned) or Joi (mature, standalone)

---

## Key Libraries

### Web & API
- **Fastify**: High-performance web framework with schema-based validation
- **Express**: Minimalist framework with massive middleware ecosystem
- **Hono**: Ultrafast framework for edge/serverless (Cloudflare Workers, Deno, Bun)
- **cors**: Cross-origin resource sharing middleware
- **helmet**: Security headers middleware

### Database & Storage
- **Drizzle ORM**: SQL-first, zero-dependency ORM with TypeScript schema-as-code
- **Prisma**: Full-featured ORM with declarative schema and migrations
- **postgres.js**: Fastest PostgreSQL client for Node.js
- **ioredis**: Redis client with cluster support

### Validation & Serialization
- **Zod**: TypeScript-first schema validation with inference
- **Joi**: Battle-tested validation library
- **ajv**: JSON Schema validator (used internally by Fastify)

### Background Tasks
- **BullMQ**: Redis-based queue for job processing
- **node-cron**: Lightweight cron scheduler

### Deployment
- **Docker**: Containerized deployment
- **Docker Compose**: Multi-service local development
- **PM2**: Process manager for production Node.js

---

## Runtime Alternatives

| Runtime | Use Case | Notes |
|---------|----------|-------|
| **Node.js 22+** | Default, production-proven | LTS until April 2027, native TS support (flag) |
| **Bun** | Performance-critical, fast scripts | Built-in bundler, test runner, package manager |
| **Deno** | Security-first, standards-aligned | Built-in TypeScript, permissions model, npm compat |

**Default**: Node.js 22 LTS. Use Bun or Deno when their specific advantages are needed.

---

## Development Environment

### Required Tools
- Node.js 22+ (see `.node-version` or `.nvmrc`)
- pnpm or npm
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose

### Common Commands
```bash
# Environment setup
pnpm install                           # Install dependencies
pnpm run db:migrate                    # Run migrations

# Dev server
pnpm run dev                           # Start with watch mode
node --watch src/index.js              # Built-in watch mode

# Tests
pnpm run test                          # All tests (Vitest)
npx vitest run tests/unit/             # Unit tests only
npx vitest run --coverage              # With coverage

# Code quality
npx eslint .                           # Lint
npx prettier --check .                 # Format check
npx prettier --write .                 # Format fix

# Docker
docker compose up -d                   # Start services
docker compose logs -f app             # Follow app logs
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **ESM over CJS** | Modern standard, tree-shaking, top-level await, aligns with browser JS |
| **pnpm over npm** | 3x faster installs, strict dependency resolution, disk-efficient |
| **Fastify over Express** | 2-3x faster, built-in schema validation, better async support |
| **Drizzle over Prisma** | Zero binary deps, SQL-first, tiny bundle, edge-compatible |
| **Zod over Joi** | TypeScript inference, composable schemas, smaller bundle |
| **Vitest over Jest** | Native ESM, faster execution, Vite-powered HMR in watch mode |
| **Biome as alternative** | Single tool for lint + format, Rust speed, zero config |

---

_Document standards and patterns, not every dependency. See `coding-style.md` for detailed JavaScript conventions._
