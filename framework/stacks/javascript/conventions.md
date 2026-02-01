# Development Conventions

General development practices, workflow, and operational standards for JavaScript/Node.js projects.

---

## Philosophy

- **Predictable process**: Consistent workflows reduce friction and errors
- **Automated enforcement**: Linters and CI catch what humans miss
- **Observable systems**: If you cannot see it, you cannot fix it
- **Documentation as code**: Keep docs next to the code they describe

---

## Git Workflow

### Branch Strategy

```
main              # Production-ready, always deployable
  |-- feat/...    # Feature branches (short-lived)
  |-- fix/...     # Bug fix branches
  |-- chore/...   # Maintenance, dependency updates
```

### Branch Naming

```bash
feat/add-user-registration
fix/duplicate-email-validation
chore/upgrade-fastify
refactor/extract-payment-service
```

**Pattern**: `{type}/{short-description}` with lowercase and hyphens.

---

## Commit Conventions

### Conventional Commits

```
feat: add user registration endpoint
fix: prevent duplicate email registration
refactor: extract password hashing to utility module
test: add integration tests for payment flow
docs: update API authentication guide
chore: upgrade zod to v4
ci: add lint check to CI pipeline
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes nor adds |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Maintenance, dependencies, tooling |
| `ci` | CI/CD configuration changes |
| `perf` | Performance improvement |

**Rule**: One logical change per commit. If the commit message needs "and", split it.

---

## Project Structure

```
project-root/
  src/
    index.js                 # Application entry point
    app.js                   # Framework setup (Express/Fastify)
    config.js                # Environment configuration
    routes/
      users.js
      orders.js
    services/
      user-service.js
      order-service.js
    repositories/
      user-repo.js
    middleware/
      auth.js
      error-handler.js
      validate.js
    errors.js                # Custom error classes
    logger.js                # Logger configuration
  tests/
    unit/
    integration/
    fixtures/
    setup.js
  eslint.config.js
  vitest.config.js
  package.json
  .env.example
  .gitignore
  .prettierrc
```

---

## ESM Module System

```json
// package.json
{
  "type": "module"
}
```

```javascript
// GOOD: ESM
import { readFile } from 'node:fs/promises';
import express from 'express';
export function createApp() { /* ... */ }

// BAD: CJS (avoid in new projects)
const { readFile } = require('fs/promises');
module.exports = { createApp };
```

### ESM Gotchas

```javascript
// No __dirname in ESM -- use import.meta
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Relative imports MUST include file extensions
import { userService } from './services/user-service.js';  // .js required
```

---

## Environment Configuration

### Using dotenv + Zod

```javascript
// src/config.js
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = Object.freeze(parsed.data);
```

### Rules
- Never commit `.env` files with real values
- Always commit `.env.example` with placeholder values
- Fail fast on missing required variables (no defaults for secrets)

---

## Logging with pino

```javascript
// src/logger.js
import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: config.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

```javascript
// GOOD: Structured key-value pairs
logger.info({ userId: 42, email: 'a@b.com' }, 'user_created');
logger.error({ orderId: 123, provider: 'stripe', err }, 'payment_failed');

// BAD: String interpolation
logger.info(`User ${userId} created with email ${email}`);
```

---

## API Design Patterns

```javascript
// RESTful conventions
GET    /api/v1/users           // List users
POST   /api/v1/users           // Create user
GET    /api/v1/users/:id       // Get user
PATCH  /api/v1/users/:id       // Update user
DELETE /api/v1/users/:id       // Delete user
```

### Response Formats

```javascript
// Success (single resource)
{ "data": { "id": 1, "name": "Alice" } }

// Success (collection)
{ "data": [...], "meta": { "total": 100, "page": 1, "limit": 20 } }

// Error
{ "error": { "code": "NOT_FOUND", "message": "User not found", "details": {} } }
```

---

## Dependency Management

```bash
pnpm add fastify zod              # Add dependency
pnpm add -D vitest eslint         # Add dev dependency
pnpm audit                        # Check vulnerabilities
pnpm outdated                     # Check for updates
```

### engines Field

```json
{
  "engines": {
    "node": ">=22.0.0"
  }
}
```

---

## Health Checks

```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'not_ready', database: 'disconnected' });
  }
});
```

---

_Conventions reduce cognitive load. Follow them consistently so the team can focus on solving problems, not debating style._
