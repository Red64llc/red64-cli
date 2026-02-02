# Eloquent Model Patterns

Best practices for Eloquent models in Laravel 12 projects.

---

## Philosophy

- **Convention over configuration**: Follow Laravel naming conventions
- **Lean models**: Relationships, scopes, casts, accessors — not business logic
- **Eager load by default**: Prevent N+1 in development with `preventLazyLoading()`
- **Database enforces integrity**: Constraints in migrations, not just validation

---

## Model Definition

### Complete Example

```php
<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
        ];
    }

    // Relationships
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }

    // Scopes
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    // Accessors
    protected function fullName(): Attribute
    {
        return Attribute::make(
            get: fn () => "{$this->first_name} {$this->last_name}",
        );
    }

    // Domain methods (thin, delegation-focused)
    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }
}
```

### Key Conventions

| Convention | Example | Reason |
|---|---|---|
| Singular model name | `User`, not `Users` | Laravel convention |
| Plural table name | `users` (auto-inferred) | Laravel convention |
| `$fillable` over `$guarded` | Explicit allowed fields | Mass assignment protection |
| Enum casts | `'role' => UserRole::class` | Type safety, no magic strings |
| `'password' => 'hashed'` cast | Auto-hash on assignment | Laravel 11+ feature |
| Return type on relationships | `HasMany`, `BelongsTo` | IDE support, static analysis |

---

## Relationships

### Defining Relationships

```php
class Post extends Model
{
    // Belongs to (many-to-one)
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // Has many
    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    // Many-to-many
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class)->withTimestamps();
    }

    // Has one through
    public function userProfile(): HasOneThrough
    {
        return $this->hasOneThrough(Profile::class, User::class);
    }
}
```

### Eager Loading

```php
// Always specify relationships to load
$posts = Post::with(['user', 'tags'])->paginate();

// Constrained eager loading
$users = User::with(['posts' => fn ($q) => $q->published()->latest()->limit(5)])->get();

// Prevent lazy loading in dev (catch N+1 early)
// bootstrap/app.php
Model::preventLazyLoading(!app()->isProduction());
```

---

## Scopes

### Local Scopes

```php
// Reusable query constraints
public function scopePublished(Builder $query): Builder
{
    return $query->where('status', PostStatus::Published);
}

public function scopeRecent(Builder $query, int $days = 7): Builder
{
    return $query->where('created_at', '>=', now()->subDays($days));
}

// Chainable usage
Post::published()->recent(30)->with('user')->paginate();
```

---

## Factories

### Model Factory Pattern

```php
// database/factories/PostFactory.php
class PostFactory extends Factory
{
    protected $model = Post::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'title' => fake()->sentence(),
            'body' => fake()->paragraphs(3, true),
            'status' => PostStatus::Draft,
        ];
    }

    // State methods for common variations
    public function published(): static
    {
        return $this->state(fn () => [
            'status' => PostStatus::Published,
            'published_at' => now(),
        ]);
    }

    public function byUser(User $user): static
    {
        return $this->state(fn () => ['user_id' => $user->id]);
    }
}

// Usage
Post::factory()->published()->count(10)->create();
Post::factory()->byUser($user)->create(['title' => 'Custom Title']);
```

---

## Observers and Events

### Prefer Events Over Observers

```php
// app/Events/PostPublished.php
class PostPublished
{
    use Dispatchable;

    public function __construct(
        public readonly Post $post,
    ) {}
}

// Dispatch in service/action
PostPublished::dispatch($post);

// Listen
class SendPostNotification
{
    public function handle(PostPublished $event): void
    {
        $event->post->user->notify(new PostPublishedNotification($event->post));
    }
}
```

---

## Soft Deletes

```php
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use SoftDeletes;
}

// Queries automatically exclude soft-deleted
Post::all();                    // Active only
Post::withTrashed()->get();     // Include deleted
Post::onlyTrashed()->get();     // Deleted only

// Operations
$post->delete();                // Soft delete
$post->restore();               // Restore
$post->forceDelete();           // Permanent delete
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Business logic in models | God models, untestable | Services/Actions for complex logic |
| `$guarded = []` | Mass assignment vulnerability | Use explicit `$fillable` |
| No eager loading | N+1 queries, slow pages | `with()` and `preventLazyLoading()` |
| String status columns | Typos, no IDE support | Backed enums with casts |
| Observers for everything | Hidden side effects, hard to debug | Explicit events/listeners |
| Accessors doing DB queries | Hidden performance issues | Eager load or compute in query |
| `Model::all()` in production | Loads entire table into memory | Paginate or chunked queries |

---

_Models define data structure and relationships. Business logic belongs in services. Query optimization belongs in the caller._
