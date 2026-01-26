# Technology Stack

## Project: {{projectName}}

## Architecture

Service-oriented architecture with clear separation between routes, controllers, services, and data access layers.

## Core Technologies

- **Language**: TypeScript 5.x (strict mode)
- **Runtime**: Node.js 20+
- **Framework**: Express / Fastify / Hono / NestJS

## Key Libraries

- **Validation**: Zod / Joi / class-validator
- **Database**: Prisma / Drizzle / TypeORM / Mongoose
- **Authentication**: Passport / JWT
- **Testing**: Vitest / Jest

## Development Standards

### Type Safety
- TypeScript strict mode enabled
- No `any` types
- Zod schemas for runtime validation
- Explicit return types for all exports

### Code Quality
- ESLint with Node.js rules
- Prettier for formatting
- Consistent error handling patterns

### Testing
- Unit tests for services and utilities
- Integration tests for API endpoints
- Minimum 80% coverage for business logic

## Development Environment

### Required Tools
- Node.js 20+
- npm / yarn / pnpm
- Docker (for databases)

### Common Commands
```bash
# Dev: npm run dev
# Build: npm run build
# Test: npm test
# Start: npm start
```

## Key Technical Decisions

- **Async/Await**: Always use async/await over callbacks
- **Error Handling**: Custom error classes with proper HTTP status codes
- **Environment**: Use dotenv for configuration
- **Logging**: Structured JSON logging (pino/winston)

---
_Document standards and patterns, not every dependency_
