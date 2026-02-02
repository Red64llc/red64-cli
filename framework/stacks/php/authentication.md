# Authentication Patterns

Modern PHP authentication using JWT, OAuth2, and session-based approaches.

---

## Philosophy

- **Stateless API auth**: JWT tokens for API consumers
- **Secure defaults**: Argon2id hashing, httpOnly cookies, short-lived tokens
- **PSR-15 middleware**: Auth logic in middleware, not scattered through controllers
- **Separation of concerns**: Auth middleware, not repeated checks

---

## JWT Authentication (API)

### Token Generation

```php
<?php

declare(strict_types=1);

namespace App\Auth;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

final class TokenService
{
    public function __construct(
        private readonly string $secretKey,
        private readonly int $accessTtl = 900,      // 15 minutes
        private readonly int $refreshTtl = 604800,   // 7 days
    ) {}

    public function createAccessToken(int $userId): string
    {
        return JWT::encode([
            'sub' => $userId,
            'type' => 'access',
            'iat' => time(),
            'exp' => time() + $this->accessTtl,
        ], $this->secretKey, 'HS256');
    }

    public function createTokenPair(int $userId): array
    {
        return [
            'access_token' => $this->createAccessToken($userId),
            'refresh_token' => JWT::encode([
                'sub' => $userId,
                'type' => 'refresh',
                'iat' => time(),
                'exp' => time() + $this->refreshTtl,
            ], $this->secretKey, 'HS256'),
            'token_type' => 'bearer',
            'expires_in' => $this->accessTtl,
        ];
    }

    public function decode(string $token): object
    {
        return JWT::decode($token, new Key($this->secretKey, 'HS256'));
    }
}
```

### Auth Middleware (PSR-15)

```php
<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Auth\TokenService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class AuthMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly TokenService $tokenService,
        private readonly UserRepositoryInterface $userRepo,
    ) {}

    public function process(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler,
    ): ResponseInterface {
        $header = $request->getHeaderLine('Authorization');

        if (!str_starts_with($header, 'Bearer ')) {
            return $this->unauthorized('Missing or invalid Authorization header');
        }

        try {
            $payload = $this->tokenService->decode(substr($header, 7));
            $user = $this->userRepo->find((int) $payload->sub);

            if ($user === null || !$user->isActive()) {
                return $this->unauthorized('User not found or inactive');
            }

            return $handler->handle($request->withAttribute('user', $user));
        } catch (\Exception) {
            return $this->unauthorized('Invalid or expired token');
        }
    }
}
```

---

## Password Management

### Argon2id Hashing (PHP 8.3+ native)

```php
<?php

declare(strict_types=1);

namespace App\Auth;

final class PasswordHasher implements PasswordHasherInterface
{
    public function hash(string $password): string
    {
        return password_hash($password, PASSWORD_ARGON2ID, [
            'memory_cost' => 65536,
            'time_cost' => 4,
            'threads' => 1,
        ]);
    }

    public function verify(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    public function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_ARGON2ID);
    }
}
```

### Login Endpoint

```php
public function login(ServerRequestInterface $request): ResponseInterface
{
    $body = $request->getParsedBody();
    $email = $body['email'] ?? '';
    $password = $body['password'] ?? '';

    $user = $this->userRepo->findByEmail($email);

    if ($user === null || !$this->hasher->verify($password, $user->getHashedPassword())) {
        return $this->json(['error' => 'Invalid credentials'], 401);
    }

    // Rehash if algorithm/cost changed
    if ($this->hasher->needsRehash($user->getHashedPassword())) {
        $user->updatePassword($this->hasher->hash($password));
        $this->userRepo->save($user);
    }

    return $this->json($this->tokenService->createTokenPair($user->getId()));
}
```

---

## Session-Based Authentication

### Secure Session Configuration

```php
// config/session.php
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '1');
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.use_strict_mode', '1');
ini_set('session.gc_maxlifetime', '86400');

// Redis session handler (production)
ini_set('session.save_handler', 'redis');
ini_set('session.save_path', $_ENV['REDIS_URL']);
```

### CSRF Protection

```php
final class CsrfMiddleware implements MiddlewareInterface
{
    public function process(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler,
    ): ResponseInterface {
        if (in_array($request->getMethod(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $token = $request->getParsedBody()['_csrf_token'] ?? '';
            if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
                return $this->forbidden('Invalid CSRF token');
            }
        }

        // Generate token for forms
        if (!isset($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }

        return $handler->handle(
            $request->withAttribute('csrf_token', $_SESSION['csrf_token'])
        );
    }
}
```

---

## Authorization

### Role-Based Access Control

```php
final class RequireRole implements MiddlewareInterface
{
    /** @param UserRole[] $allowedRoles */
    public function __construct(
        private readonly array $allowedRoles,
    ) {}

    public function process(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler,
    ): ResponseInterface {
        /** @var User $user */
        $user = $request->getAttribute('user');

        if (!in_array($user->getRole(), $this->allowedRoles, true)) {
            return $this->forbidden('Insufficient permissions');
        }

        return $handler->handle($request);
    }
}

// Route configuration
$app->delete('/api/users/{id}', DeleteUserController::class)
    ->add(new RequireRole([UserRole::Admin]))
    ->add($authMiddleware);
```

---

## Rate Limiting

```php
final class RateLimitMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly \Redis $redis,
        private readonly int $maxAttempts = 5,
        private readonly int $windowSeconds = 60,
    ) {}

    public function process(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler,
    ): ResponseInterface {
        $ip = $request->getServerParams()['REMOTE_ADDR'] ?? 'unknown';
        $key = "rate_limit:{$ip}:" . $request->getUri()->getPath();

        $attempts = (int) $this->redis->incr($key);
        if ($attempts === 1) {
            $this->redis->expire($key, $this->windowSeconds);
        }

        if ($attempts > $this->maxAttempts) {
            return $this->tooManyRequests($this->windowSeconds);
        }

        return $handler->handle($request);
    }
}
```

---

## Security Checklist

- [x] Passwords hashed with Argon2id (native `password_hash`)
- [x] JWT tokens with short expiry (15 min access, 7 day refresh)
- [x] httpOnly, Secure, SameSite cookies for sessions
- [x] CSRF protection on state-changing requests
- [x] Rate limiting on auth endpoints
- [ ] Account lockout after failed attempts (implement as needed)
- [ ] Email verification flow (implement as needed)
- [ ] MFA / TOTP support (implement as needed)

---

_Document patterns and extension points, not implementation details._
