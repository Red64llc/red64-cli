# Error Handling Patterns

Modern PHP error handling with typed exceptions, PSR-7 responses, and structured error output.

---

## Philosophy

- **Exceptions for exceptional cases**: Use return types for expected failures
- **Domain exceptions**: Business errors have dedicated exception classes
- **Centralized handling**: One error handler middleware, not try/catch everywhere
- **Structured responses**: Consistent JSON error format for APIs

---

## Exception Hierarchy

```php
// Base domain exception
abstract class DomainException extends \RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'INTERNAL_ERROR',
        public readonly int $httpStatus = 500,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}

class NotFoundException extends DomainException
{
    public function __construct(string $resource, string|int $id)
    {
        parent::__construct("{$resource} {$id} not found", 'NOT_FOUND', 404);
    }
}

class ValidationException extends DomainException
{
    /** @param array<string, string[]> $errors */
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Validation failed', 'VALIDATION_ERROR', 422);
    }
}

class AuthenticationException extends DomainException
{
    public function __construct(string $message = 'Authentication required')
    {
        parent::__construct($message, 'UNAUTHORIZED', 401);
    }
}

class AuthorizationException extends DomainException
{
    public function __construct(string $message = 'Insufficient permissions')
    {
        parent::__construct($message, 'FORBIDDEN', 403);
    }
}

class ConflictException extends DomainException
{
    public function __construct(string $message)
    {
        parent::__construct($message, 'CONFLICT', 409);
    }
}
```

---

## Error Handler Middleware

```php
final class ErrorHandlerMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly LoggerInterface $logger,
        private readonly bool $debug = false,
    ) {}

    public function process(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler,
    ): ResponseInterface {
        try {
            return $handler->handle($request);
        } catch (DomainException $e) {
            $this->logger->warning($e->getMessage(), [
                'code' => $e->errorCode,
                'path' => $request->getUri()->getPath(),
            ]);

            return $this->jsonError($e->httpStatus, $e->errorCode, $e->getMessage(), $e);
        } catch (\Throwable $e) {
            $this->logger->error($e->getMessage(), [
                'exception' => $e,
                'path' => $request->getUri()->getPath(),
            ]);

            return $this->jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred', $e);
        }
    }

    private function jsonError(int $status, string $code, string $message, \Throwable $e): ResponseInterface
    {
        $body = [
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ];

        if ($e instanceof ValidationException) {
            $body['error']['details'] = $e->errors;
        }

        if ($this->debug) {
            $body['error']['trace'] = $e->getTraceAsString();
        }

        $response = new Response($status);
        $response->getBody()->write(json_encode($body, JSON_THROW_ON_ERROR));

        return $response->withHeader('Content-Type', 'application/json');
    }
}
```

---

## Usage in Services

```php
final class UserService
{
    public function getUser(int $id): User
    {
        $user = $this->userRepo->find($id);

        if ($user === null) {
            throw new NotFoundException('User', $id);
        }

        return $user;
    }

    public function createUser(CreateUserDTO $dto): User
    {
        if ($this->userRepo->findByEmail($dto->email) !== null) {
            throw new ConflictException("Email {$dto->email} already in use");
        }

        // ...
    }
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Catching `\Exception` broadly | Swallows unexpected errors | Catch specific domain exceptions |
| Try/catch in every controller | Repetitive, inconsistent | Centralized error middleware |
| Returning error arrays | No type safety, easy to ignore | Throw typed exceptions |
| Exposing stack traces in production | Security risk | Debug mode flag |
| Using error codes as HTTP status | Conflates concerns | Separate `errorCode` and `httpStatus` |

---

_Exceptions signal problems. Middleware handles them consistently. Services throw, controllers don't catch._
