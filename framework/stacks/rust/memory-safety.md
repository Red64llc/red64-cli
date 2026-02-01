# Memory Safety Patterns

Ownership, borrowing, lifetimes, and safe concurrency patterns for Rust applications. Guidelines for when and how to use `unsafe`.

---

## Philosophy

- **Ownership is the foundation**: Understand move semantics before reaching for `Clone`
- **Borrow, do not copy**: Pass references by default; clone only when necessary
- **Minimize unsafe**: Every `unsafe` block is a contract you must uphold manually
- **Concurrency through types**: `Arc`, `Mutex`, and channels prevent data races at compile time

---

## Ownership and Borrowing

### The Three Rules

1. Each value has exactly one owner
2. When the owner goes out of scope, the value is dropped
3. You can have either one mutable reference OR any number of immutable references

```rust
// GOOD: Borrowing -- no allocation, no move
fn process_name(name: &str) -> String {
    name.trim().to_uppercase()
}

let name = String::from("  Alice  ");
let processed = process_name(&name);  // Borrows name
println!("{name}");  // name is still valid

// GOOD: Moving when ownership transfer is intentional
fn consume_request(req: Request) -> Response {
    // req is owned here, dropped at end of function
    Response::from(req)
}

// BAD: Unnecessary clone to satisfy borrow checker
fn process_name_bad(name: String) -> String {
    name.trim().to_uppercase()
}

let name = String::from("  Alice  ");
let processed = process_name_bad(name.clone());  // Wasteful clone
```

### Clone vs Borrow Decision

| Situation | Use | Reason |
|---|---|---|
| Reading data | `&T` | Zero cost, no allocation |
| Modifying data | `&mut T` | Exclusive access, no allocation |
| Transferring ownership | `T` (move) | Clear ownership transfer |
| Shared ownership needed | `Arc<T>` | Multiple owners, reference counted |
| Small Copy types (`i32`, `bool`) | Copy | Trivially cheap |
| Data needed beyond borrow scope | `Clone` | Only when lifetime cannot work |

```rust
// GOOD: Borrow for read access
fn total_price(items: &[OrderItem]) -> Decimal {
    items.iter().map(|i| i.price).sum()
}

// GOOD: Clone when data must outlive the borrow
fn spawn_background_task(config: &Config) {
    let config = config.clone();  // Clone needed: task outlives the borrow
    tokio::spawn(async move {
        process_with_config(&config).await;
    });
}

// BAD: Clone when a reference would work
fn total_price_bad(items: Vec<OrderItem>) -> Decimal {
    items.iter().map(|i| i.price).sum()
    // items is moved in and dropped -- caller loses access
}
```

---

## Lifetime Annotations

### When You Need Them

Lifetimes are needed when the compiler cannot infer the relationship between input and output references:

```rust
// GOOD: Lifetime ties output reference to input
fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() >= b.len() { a } else { b }
}

// GOOD: Struct with borrowed data
struct Request<'a> {
    path: &'a str,
    headers: &'a [(String, String)],
}

// GOOD: Lifetime elision -- compiler infers this
fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}
// Equivalent to: fn first_word<'a>(s: &'a str) -> &'a str

// BAD: Storing references when you should own
struct UserCache {
    users: Vec<&str>,  // Dangling reference risk
}

// GOOD: Own the data in long-lived structs
struct UserCache {
    users: Vec<String>,
}
```

### Lifetime Elision Rules

The compiler automatically infers lifetimes when:

1. Each reference parameter gets its own lifetime
2. If there is exactly one input lifetime, it is assigned to all output lifetimes
3. If there is a `&self` or `&mut self`, its lifetime is assigned to all output lifetimes

```rust
// All of these are equivalent (elision applies):
fn trim(s: &str) -> &str { ... }
fn trim<'a>(s: &'a str) -> &'a str { ... }

// Elision does NOT apply here (multiple inputs, no self):
// Must annotate explicitly
fn pick<'a>(a: &'a str, b: &str) -> &'a str { ... }
```

---

## Shared Ownership: `Arc<Mutex<T>>`

### Sharing State Across Async Tasks

```rust
use std::sync::Arc;
use tokio::sync::Mutex;

// GOOD: Arc<Mutex<T>> for shared mutable state
#[derive(Clone)]
struct AppState {
    db: PgPool,
    cache: Arc<Mutex<HashMap<String, CachedValue>>>,
}

async fn get_cached_or_fetch(state: &AppState, key: &str) -> Result<String> {
    // Check cache first
    {
        let cache = state.cache.lock().await;
        if let Some(value) = cache.get(key) {
            return Ok(value.data.clone());
        }
    }  // Lock is dropped here

    // Fetch and cache
    let value = fetch_from_db(&state.db, key).await?;
    {
        let mut cache = state.cache.lock().await;
        cache.insert(key.to_string(), CachedValue { data: value.clone() });
    }
    Ok(value)
}
```

### Choosing the Right Synchronization Primitive

| Primitive | Use Case |
|---|---|
| `Arc<T>` | Shared immutable data across threads |
| `Arc<Mutex<T>>` | Shared mutable data, low contention |
| `Arc<RwLock<T>>` | Shared data, many readers, few writers |
| `tokio::sync::Mutex` | Holding lock across `.await` points |
| `std::sync::Mutex` | Short critical sections, no `.await` inside |
| `tokio::sync::mpsc` | Message passing between tasks |
| `tokio::sync::watch` | Single-producer, multi-consumer broadcast |
| `dashmap::DashMap` | Concurrent hashmap, high contention |

```rust
// GOOD: Use tokio::sync::Mutex when holding across .await
let data = state.cache.lock().await;  // tokio Mutex
let result = fetch_something(&data).await;  // .await while holding lock is OK

// BAD: std::sync::Mutex across .await points
let data = state.cache.lock().unwrap();  // std Mutex
let result = fetch_something(&data).await;  // BLOCKS the runtime thread!
```

---

## Interior Mutability

### `Cell` and `RefCell`

```rust
use std::cell::{Cell, RefCell};

// Cell: for Copy types, zero overhead
struct Counter {
    count: Cell<u32>,
}

impl Counter {
    fn increment(&self) {  // Note: &self, not &mut self
        self.count.set(self.count.get() + 1);
    }
}

// RefCell: for non-Copy types, runtime borrow checking
struct Logger {
    messages: RefCell<Vec<String>>,
}

impl Logger {
    fn log(&self, msg: String) {
        self.messages.borrow_mut().push(msg);
    }

    fn dump(&self) -> Vec<String> {
        self.messages.borrow().clone()
    }
}

// WARNING: RefCell panics on double mutable borrow at runtime
// BAD: This will panic
fn bad_refcell() {
    let data = RefCell::new(vec![1, 2, 3]);
    let mut a = data.borrow_mut();
    let mut b = data.borrow_mut();  // PANIC: already borrowed mutably
}
```

### When to Use Which

| Type | Thread-safe? | Overhead | Use Case |
|---|---|---|---|
| `Cell<T>` | No | Zero | Single-thread, Copy types |
| `RefCell<T>` | No | Runtime check | Single-thread, non-Copy |
| `Mutex<T>` | Yes | Lock | Multi-thread |
| `RwLock<T>` | Yes | Lock | Multi-thread, read-heavy |
| `AtomicU64` etc. | Yes | Atomic op | Counters, flags |

---

## Pin and Self-Referential Types

### When Pin Is Needed

Pin is required for self-referential types (most commonly, async futures):

```rust
use std::pin::Pin;
use std::future::Future;

// GOOD: Returning pinned futures (common in trait methods)
trait Service {
    fn call(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>>;
}

impl Service for MyService {
    fn call(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        Box::pin(async move {
            // async body
            Response::ok()
        })
    }
}

// In most application code, you do NOT need Pin directly.
// async/await handles it automatically.
async fn handle_request(req: Request) -> Response {
    // The compiler pins the future for you
    Response::ok()
}
```

---

## Unsafe Guidelines

### Rules for `unsafe` Code

1. **Minimize scope**: Keep `unsafe` blocks as small as possible
2. **Document invariants**: Explain why the unsafe operation is sound
3. **Test with Miri**: Run `cargo +nightly miri test` on all unsafe code
4. **Encapsulate**: Wrap unsafe code in a safe API

```rust
// GOOD: Minimal unsafe scope with documented invariants
/// Returns a reference to the element at `index` without bounds checking.
///
/// # Safety
///
/// The caller must ensure that `index < self.len()`.
pub unsafe fn get_unchecked(&self, index: usize) -> &T {
    // SAFETY: Caller guarantees index is in bounds.
    unsafe { self.data.get_unchecked(index) }
}

// GOOD: Safe wrapper around unsafe
pub fn get(&self, index: usize) -> Option<&T> {
    if index < self.len() {
        // SAFETY: We just checked that index < len.
        Some(unsafe { self.get_unchecked(index) })
    } else {
        None
    }
}

// BAD: Large unsafe block with no documentation
unsafe {
    let ptr = data.as_ptr();
    let len = data.len();
    let slice = std::slice::from_raw_parts(ptr, len);
    let result = process(slice);
    std::ptr::copy_nonoverlapping(result.as_ptr(), output.as_mut_ptr(), result.len());
    output.set_len(result.len());
}
```

### When Unsafe Is Justified

| Use Case | Justification |
|---|---|
| FFI (calling C code) | No safe alternative |
| Performance-critical inner loops | Measured, benchmarked, significant gain |
| Implementing data structures | Self-referential or intrusive structures |
| Hardware/OS interaction | Low-level system programming |

### When Unsafe Is NOT Justified

| Use Case | Safe Alternative |
|---|---|
| "The borrow checker is annoying" | Refactor ownership, use `Arc`/`Rc` |
| Skip bounds checking "for speed" | Profile first; usually negligible |
| Transmute between types | Use `From`/`Into` or `bytemuck` |
| Global mutable state | Use `once_cell::sync::Lazy` or `std::sync::OnceLock` |

---

## Common Ownership Patterns

### Axum State Sharing

```rust
// GOOD: Shared application state with Axum
#[derive(Clone)]
struct AppState {
    db: PgPool,                          // PgPool is already Arc internally
    config: Arc<Config>,                 // Immutable shared config
    rate_limiter: Arc<Mutex<RateLimiter>>, // Mutable shared state
}

async fn create_app() -> Router {
    let state = AppState {
        db: PgPool::connect(&db_url).await.unwrap(),
        config: Arc::new(Config::from_env()),
        rate_limiter: Arc::new(Mutex::new(RateLimiter::new())),
    };

    Router::new()
        .route("/users", post(create_user))
        .with_state(state)
}

async fn create_user(
    State(state): State<AppState>,
    Json(data): Json<CreateUserRequest>,
) -> Result<Json<UserResponse>, AppError> {
    // state.db is cheaply cloned (Arc internally)
    let user = insert_user(&state.db, &data).await?;
    Ok(Json(UserResponse::from(user)))
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `clone()` to silence borrow checker | Hidden allocations, hides design issues | Refactor to proper ownership or use `Arc` |
| `Rc` in async code | Not `Send`, cannot cross `.await` | Use `Arc` in async contexts |
| `std::sync::Mutex` across `.await` | Blocks runtime thread | Use `tokio::sync::Mutex` |
| Large `unsafe` blocks | Hard to audit, likely unsound | Minimize scope, document each operation |
| `'static` lifetime everywhere | Prevents borrowing, forces allocation | Use proper lifetime parameters |
| `RefCell` in multi-threaded code | Not thread-safe, compiles but panics | Use `Mutex` or `RwLock` |
| Leaking memory with `Box::leak` | Never reclaimed | Use `Arc` or `OnceLock` for global state |

---

_Rust's ownership model is not a constraint to work around -- it is a design tool. Lean into it, and your programs will be correct by construction._
