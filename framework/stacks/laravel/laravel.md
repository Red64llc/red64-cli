# Laravel Conventions

Project memory for Laravel 12 patterns and conventions.

---

## Framework Stack

### Core Technologies
- **Laravel 12** with PHP 8.3+
- **Eloquent ORM**: ActiveRecord with relationships, scopes, casts
- **Blade** + **Livewire** or **Inertia**: Reactive UI
- **Sanctum**: API token and SPA authentication
- **Queue**: Redis or database-backed background jobs
- **Pest PHP**: Testing framework

---

## Application Architecture

### MVC Patterns

**Models** (`app/Models/`)
- Inherit from `Illuminate\Database\Eloquent\Model`
- Define relationships, scopes, casts, and accessors
- Keep models focused on data concerns
- Extract complex business logic to services or actions

```php
// Pattern: Lean model with clear responsibilities
class Post extends Model
{
    protected $fillable = ['title', 'body', 'status', 'user_id'];

    protected function casts(): array
    {
        return [
            'status' => PostStatus::class,
            'published_at' => 'datetime',
        ];
    }

    // Relationships
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    // Scopes
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', PostStatus::Published);
    }

    public function scopeByUser(Builder $query, User $user): Builder
    {
        return $query->where('user_id', $user->id);
    }
}
```

**Controllers** (`app/Http/Controllers/`)
- Keep actions thin — validate, delegate, respond
- Use Form Requests for validation
- Use API Resources for JSON transformation
- Single-action controllers for non-CRUD operations

```php
// Pattern: Thin controller with Form Request
class PostsController extends Controller
{
    public function store(StorePostRequest $request): RedirectResponse
    {
        $post = $request->user()->posts()->create($request->validated());

        return redirect()->route('posts.show', $post)
            ->with('success', 'Post created.');
    }

    public function update(UpdatePostRequest $request, Post $post): RedirectResponse
    {
        $post->update($request->validated());

        return redirect()->route('posts.show', $post)
            ->with('success', 'Post updated.');
    }
}
```

---

## Form Requests

### Validation at the Boundary

```php
class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // or use policies
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'status' => ['required', new Enum(PostStatus::class)],
            'tags' => ['array'],
            'tags.*' => ['exists:tags,id'],
        ];
    }
}
```

---

## Eloquent Patterns

### Enums as Casts

```php
enum PostStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Archived = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Published => 'Published',
            self::Archived => 'Archived',
        };
    }
}

// Usage
$post = Post::create(['status' => PostStatus::Draft, ...]);
$post->status === PostStatus::Draft; // true
Post::where('status', PostStatus::Published)->get();
```

### Eager Loading (N+1 Prevention)

```php
// Always eager load known relationships
$posts = Post::with(['user', 'tags'])->published()->paginate(20);

// Nested eager loading
$users = User::with(['posts' => fn ($q) => $q->published(), 'posts.tags'])->get();

// Prevent lazy loading in development
Model::preventLazyLoading(!app()->isProduction());
```

### Scopes and Query Patterns

```php
// Local scopes: reusable query constraints
Post::published()->byUser($user)->latest()->paginate();

// Global scope (apply to all queries)
class ActiveScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $builder->where('is_active', true);
    }
}
```

---

## Service Layer

### When to Use Services

Use services when business logic spans multiple models, involves external APIs, or has complex orchestration:

```php
// app/Services/PostService.php
final class PostService
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function publish(Post $post): void
    {
        $post->update([
            'status' => PostStatus::Published,
            'published_at' => now(),
        ]);

        $post->user->notify(new PostPublishedNotification($post));
        PostPublished::dispatch($post);
    }
}
```

### Action Classes (Single-Purpose)

```php
// app/Actions/CreateUser.php
final class CreateUser
{
    public function execute(array $data): User
    {
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        event(new UserRegistered($user));

        return $user;
    }
}
```

---

## API Resources

### JSON Transformation

```php
// app/Http/Resources/PostResource.php
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
            'status' => $this->status->value,
            'author' => new UserResource($this->whenLoaded('user')),
            'tags' => TagResource::collection($this->whenLoaded('tags')),
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}

// In controller
return PostResource::collection(
    Post::with(['user', 'tags'])->published()->paginate()
);
```

---

## Background Jobs

```php
// app/Jobs/ProcessPayment.php
class ProcessPayment implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;
    public array $backoff = [10, 60, 300];

    public function __construct(
        public readonly Order $order,
    ) {}

    public function handle(PaymentGateway $gateway): void
    {
        $gateway->charge($this->order);
    }

    public function failed(\Throwable $exception): void
    {
        $this->order->update(['status' => OrderStatus::Failed]);
    }
}

// Dispatch
ProcessPayment::dispatch($order)->onQueue('payments');
```

---

## Authorization (Policies)

```php
// app/Policies/PostPolicy.php
class PostPolicy
{
    public function update(User $user, Post $post): bool
    {
        return $user->id === $post->user_id;
    }

    public function delete(User $user, Post $post): bool
    {
        return $user->id === $post->user_id || $user->isAdmin();
    }
}

// In controller
$this->authorize('update', $post);

// In Blade
@can('update', $post)
    <a href="{{ route('posts.edit', $post) }}">Edit</a>
@endcan
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `env()` outside config files | Null after config cache | Use `config()` helper |
| Fat controllers | Untestable, violates SRP | Form Requests + Services |
| N+1 queries | Performance disaster | Eager loading with `with()` |
| No Form Requests | Validation mixed in controllers | Dedicated request classes |
| Raw queries everywhere | SQL injection risk, hard to maintain | Eloquent/Query Builder |
| Overusing repositories | Adds indirection over Eloquent | Use Eloquent directly, extract when needed |
| Fighting the framework | Custom solutions for built-in features | Use Laravel conventions first |
| `env()` as default values | Fails in production with config cache | Set defaults in config files |
| Not using queues | Slow responses for heavy operations | Dispatch jobs for async work |

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Models | Singular, PascalCase | `User`, `BlogPost` |
| Controllers | Plural + Controller | `PostsController` |
| Form Requests | Action + Request | `StorePostRequest` |
| Resources | Model + Resource | `PostResource` |
| Jobs | Verb + Noun | `ProcessPayment` |
| Events | Past tense | `OrderPlaced` |
| Listeners | Handler verb | `SendOrderConfirmation` |
| Policies | Model + Policy | `PostPolicy` |
| Enums | PascalCase | `PostStatus`, `UserRole` |

---

_Follow Laravel conventions. The framework provides patterns for most problems — use them before building your own._
