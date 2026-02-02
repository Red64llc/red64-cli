# API Patterns

RESTful API design patterns for modern PHP applications.

---

## Philosophy

- **RESTful conventions**: Standard HTTP methods and status codes
- **PSR-7 request/response**: Framework-agnostic HTTP handling
- **Validation at the boundary**: Validate input before it reaches services
- **Consistent response format**: Uniform JSON structure for all endpoints

---

## Response Format

### Success Responses

```json
// Single resource
{
    "data": {
        "id": 1,
        "email": "user@example.com",
        "name": "Test User"
    }
}

// Collection
{
    "data": [
        {"id": 1, "name": "User 1"},
        {"id": 2, "name": "User 2"}
    ],
    "meta": {
        "total": 50,
        "page": 1,
        "per_page": 20
    }
}
```

### Error Responses

```json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Validation failed",
        "details": {
            "email": ["Email is required", "Must be a valid email"],
            "name": ["Must be between 1 and 100 characters"]
        }
    }
}
```

---

## Controller Pattern

### Slim Framework Example

```php
<?php

declare(strict_types=1);

namespace App\Controller;

use App\DTO\CreateUserDTO;
use App\Service\UserService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class UserController
{
    public function __construct(
        private readonly UserService $userService,
    ) {}

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $page = (int) ($request->getQueryParams()['page'] ?? 1);
        $perPage = (int) ($request->getQueryParams()['per_page'] ?? 20);

        $result = $this->userService->listUsers($page, $perPage);

        return $this->json($response, [
            'data' => $result->items,
            'meta' => [
                'total' => $result->total,
                'page' => $page,
                'per_page' => $perPage,
            ],
        ]);
    }

    public function store(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = $request->getParsedBody();
        $dto = CreateUserDTO::fromRequest($body);
        $user = $this->userService->createUser($dto);

        return $this->json($response, ['data' => $user->toArray()], 201);
    }

    public function show(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $user = $this->userService->getUser((int) $args['id']);
        return $this->json($response, ['data' => $user->toArray()]);
    }

    private function json(ResponseInterface $response, array $data, int $status = 200): ResponseInterface
    {
        $response->getBody()->write(json_encode($data, JSON_THROW_ON_ERROR));
        return $response
            ->withStatus($status)
            ->withHeader('Content-Type', 'application/json');
    }
}
```

---

## Input Validation

### Validation Service Pattern

```php
<?php

declare(strict_types=1);

namespace App\Validation;

use App\Exception\ValidationException;

final class Validator
{
    /** @param array<string, callable[]> $rules */
    public function validate(array $data, array $rules): void
    {
        $errors = [];

        foreach ($rules as $field => $fieldRules) {
            foreach ($fieldRules as $rule) {
                $error = $rule($data[$field] ?? null, $field);
                if ($error !== null) {
                    $errors[$field][] = $error;
                }
            }
        }

        if ($errors !== []) {
            throw new ValidationException($errors);
        }
    }
}

// Reusable rule functions
function required(): \Closure
{
    return fn(mixed $value, string $field): ?string =>
        ($value === null || $value === '') ? "{$field} is required" : null;
}

function email(): \Closure
{
    return fn(mixed $value, string $field): ?string =>
        ($value !== null && !filter_var($value, FILTER_VALIDATE_EMAIL))
            ? "{$field} must be a valid email"
            : null;
}

function maxLength(int $max): \Closure
{
    return fn(mixed $value, string $field): ?string =>
        (is_string($value) && mb_strlen($value) > $max)
            ? "{$field} must not exceed {$max} characters"
            : null;
}
```

---

## Routing

```php
// config/routes.php
<?php

use Slim\App;

return function (App $app): void {
    $app->group('/api/v1', function ($group) {
        // Users
        $group->get('/users', [UserController::class, 'index']);
        $group->post('/users', [UserController::class, 'store']);
        $group->get('/users/{id:[0-9]+}', [UserController::class, 'show']);
        $group->put('/users/{id:[0-9]+}', [UserController::class, 'update']);
        $group->delete('/users/{id:[0-9]+}', [UserController::class, 'destroy']);

        // Auth
        $group->post('/auth/login', [AuthController::class, 'login']);
        $group->post('/auth/refresh', [AuthController::class, 'refresh']);
    });
};
```

---

## HTTP Status Codes

| Status | Usage |
|--------|-------|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE (no content) |
| 400 | Malformed request |
| 401 | Authentication required |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 422 | Validation failed |
| 429 | Rate limited |
| 500 | Server error |

---

## CORS Middleware

```php
final class CorsMiddleware implements MiddlewareInterface
{
    public function process(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler,
    ): ResponseInterface {
        if ($request->getMethod() === 'OPTIONS') {
            $response = new Response(204);
        } else {
            $response = $handler->handle($request);
        }

        return $response
            ->withHeader('Access-Control-Allow-Origin', $_ENV['CORS_ORIGIN'] ?? '*')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->withHeader('Access-Control-Max-Age', '86400');
    }
}
```

---

_Controllers are thin. Validation at the boundary. Services hold the logic._
