# Error Handling Patterns

Structured error handling for Node.js applications with custom exceptions, framework-specific middleware, and observability.

---

## Philosophy

- **Fail fast**: Validate inputs early, throw immediately on invalid state
- **Typed exceptions**: Custom error hierarchy over generic `Error`
- **Centralized handling**: Error middleware at the API boundary, not scattered try/catch
- **Structured logging**: Machine-readable logs with context, not `console.log`
- **User-safe messages**: Never expose stack traces or internal details to clients

---

## Custom Error Hierarchy

### Base Errors

```javascript
// src/errors.js
export class AppError extends Error {
  constructor(message, { code = 'INTERNAL_ERROR', statusCode = 500, details = {} } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource, identifier) {
    super(`${resource} not found: ${identifier}`, {
      code: 'NOT_FOUND',
      statusCode: 404,
      details: { resource, identifier },
    });
  }
}

export class ConflictError extends AppError {
  constructor(message, details = {}) {
    super(message, { code: 'CONFLICT', statusCode: 409, details });
  }
}

export class ValidationError extends AppError {
  constructor(message, fieldErrors = {}) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 422,
      details: { fieldErrors },
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, { code: 'UNAUTHENTICATED', statusCode: 401 });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, { code: 'FORBIDDEN', statusCode: 403 });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service, message) {
    super(`External service error (${service}): ${message}`, {
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 502,
      details: { service },
    });
  }
}
```

---

## Centralized Error Handler (Express)

```javascript
// src/middleware/error-handler.js
import { AppError } from '../errors.js';
import { logger } from '../logger.js';

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, message: err.message, path: req.path });
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: { issues: err.issues } },
    });
  }

  // Unknown errors -- never expose internals
  logger.error({ message: 'Unhandled error', error: err.message, stack: err.stack, path: req.path });
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
```

---

## Fastify Error Handling

```javascript
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    request.log.warn({ code: error.code, message: error.message });
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message, details: error.details },
    });
  }

  if (error.validation) {
    return reply.status(422).send({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: { issues: error.validation } },
    });
  }

  request.log.error({ error: error.message, stack: error.stack });
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
});
```

---

## Async Error Handling

```javascript
// GOOD: try/catch at the right level
async function processOrder(orderId) {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  try {
    await paymentClient.charge(order.totalCents, order.paymentToken);
  } catch (err) {
    throw new ExternalServiceError('payment', err.message);
  }

  order.status = 'paid';
  return orderRepo.save(order);
}

// BAD: Wrapping everything in try/catch and swallowing
async function processOrder(orderId) {
  try {
    const order = await orderRepo.findById(orderId);
    // ... 50 lines of logic ...
  } catch (err) {
    console.log(err);  // Swallowed, no rethrow
  }
}
```

---

## Process-Level Error Handlers

```javascript
// src/index.js -- register at application startup
process.on('unhandledRejection', (reason) => {
  logger.error({ message: 'Unhandled promise rejection', reason: reason instanceof Error ? reason.message : reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ message: 'Uncaught exception', error: error.message, stack: error.stack });
  process.exit(1);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.info({ message: 'Shutdown signal received', signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `catch (err) {}` | Silently swallows errors | Log and re-throw or handle specifically |
| `throw 'something'` | No stack trace, not an Error object | Always `throw new Error(...)` or custom class |
| Nested try/catch everywhere | Hard to read, hides control flow | Centralized error middleware |
| `console.log(err)` in catch | No structure, lost in production | Use structured logger (pino) |
| Stack traces in API responses | Security risk | Return error codes and user-safe messages |
| Mixing callbacks and promises | Inconsistent error propagation | Use async/await consistently |

---

_Errors are data. Classify them, log them with context, and present them consistently. Never swallow exceptions silently._
