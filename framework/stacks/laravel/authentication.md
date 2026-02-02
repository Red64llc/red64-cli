# Authentication Patterns

Laravel authentication using Sanctum, Fortify, and built-in auth scaffolding.

---

## Philosophy

- **Use built-in tools**: Sanctum for tokens, Fortify for flows, built-in guards
- **Don't reinvent auth**: Laravel's auth system is battle-tested
- **Middleware-based**: Auth logic in middleware and guards, not controllers
- **Token + session**: Sanctum handles both SPA sessions and API tokens

---

## Sanctum (API + SPA Auth)

### Installation & Config

```bash
php artisan install:api  # Installs Sanctum, creates personal_access_tokens migration
```

### API Token Authentication

```php
// Issue token (e.g., in login controller)
public function login(LoginRequest $request): JsonResponse
{
    $user = User::where('email', $request->email)->first();

    if (!$user || !Hash::check($request->password, $user->password)) {
        throw ValidationException::withMessages([
            'email' => ['The provided credentials are incorrect.'],
        ]);
    }

    $token = $user->createToken('api-token', ['posts:read', 'posts:write']);

    return response()->json([
        'token' => $token->plainTextToken,
        'token_type' => 'bearer',
    ]);
}

// Revoke tokens on logout
public function logout(Request $request): JsonResponse
{
    $request->user()->currentAccessToken()->delete();

    return response()->json(['message' => 'Logged out']);
}
```

### Protecting Routes

```php
// routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user());
    Route::apiResource('posts', PostsController::class);
});

// Token ability checks
Route::middleware(['auth:sanctum', 'ability:posts:write'])->group(function () {
    Route::post('/posts', [PostsController::class, 'store']);
});
```

### SPA Authentication (Cookie-Based)

```php
// For SPA apps (Vue, React via Inertia)
// 1. SPA calls /sanctum/csrf-cookie to get CSRF token
// 2. SPA sends credentials to /login
// 3. Subsequent requests use session cookie

// config/sanctum.php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,localhost:3000')),
```

---

## Authorization (Policies + Gates)

### Policy Pattern

```php
// app/Policies/PostPolicy.php
class PostPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Post $post): bool
    {
        return true; // Published posts are public
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Post $post): bool
    {
        return $user->id === $post->user_id;
    }

    public function delete(User $user, Post $post): bool
    {
        return $user->id === $post->user_id || $user->isAdmin();
    }
}
```

### Using Policies

```php
// In controllers
public function update(UpdatePostRequest $request, Post $post): JsonResponse
{
    $this->authorize('update', $post);
    // ...
}

// In Form Requests
public function authorize(): bool
{
    return $this->user()->can('update', $this->route('post'));
}

// In Blade
@can('update', $post)
    <a href="{{ route('posts.edit', $post) }}">Edit</a>
@endcan

// Gate (for non-model authorization)
Gate::define('access-admin', fn (User $user) => $user->isAdmin());

if (Gate::allows('access-admin')) { ... }
```

---

## Role-Based Access

### Using Enums

```php
enum UserRole: string
{
    case Admin = 'admin';
    case Editor = 'editor';
    case Member = 'member';
}

// Middleware for role checking
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $userRole = $request->user()->role;

        if (!in_array($userRole->value, $roles, true)) {
            abort(403, 'Insufficient permissions');
        }

        return $next($request);
    }
}

// Route usage
Route::middleware('role:admin,editor')->group(function () {
    Route::resource('posts', PostsController::class)->except(['index', 'show']);
});
```

---

## Rate Limiting

```php
// bootstrap/app.php or RouteServiceProvider
RateLimiter::for('login', function (Request $request) {
    return Limit::perMinute(5)->by($request->ip());
});

RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});

// Apply to routes
Route::post('/login', LoginController::class)->middleware('throttle:login');
```

---

## Security Checklist

- [x] Passwords hashed via `Hash::make()` / `'hashed'` cast
- [x] CSRF protection on web routes (automatic in Laravel)
- [x] Sanctum token auth for API, session auth for SPA
- [x] Rate limiting on auth endpoints
- [x] `$hidden` on sensitive model attributes
- [x] Form Request validation on all user input
- [ ] Email verification (`MustVerifyEmail` interface)
- [ ] Two-factor auth (Laravel Fortify)

---

## Testing Auth

```php
it('requires authentication', function () {
    $this->getJson('/api/user')->assertUnauthorized();
});

it('returns user when authenticated', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/user')
        ->assertOk()
        ->assertJsonPath('email', $user->email);
});

it('restricts admin routes', function () {
    $member = User::factory()->create(['role' => UserRole::Member]);

    $this->actingAs($member)
        ->getJson('/api/admin/users')
        ->assertForbidden();
});
```

---

_Use Laravel's auth system. Don't build custom auth unless you have a very specific reason._
