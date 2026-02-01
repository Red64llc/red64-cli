# Memory Safety

Patterns and practices for memory-safe modern C++. Leverage RAII, smart pointers, and non-owning views to eliminate manual memory management.

---

## Philosophy

- **Ownership is explicit**: Every resource has exactly one owner, encoded in the type system
- **RAII everywhere**: Acquisition in constructors, release in destructors, no exceptions
- **Non-owning by default**: Functions that observe data take references, spans, or string_views
- **Zero raw owning pointers**: If you write `new`, wrap it immediately; prefer `make_unique`/`make_shared`
- **Ref**: C++ Core Guidelines R.1-R.37, F.7, F.15-F.17

---

## Smart Pointers

### std::unique_ptr -- Exclusive Ownership (CG: R.20)

```cpp
// GOOD: Factory returns unique ownership
std::unique_ptr<Connection> create_connection(const Config& config) {
    auto conn = std::make_unique<Connection>(config.host(), config.port());
    conn->authenticate(config.credentials());
    return conn;  // Moved automatically (NRVO or implicit move)
}

// GOOD: Transfer ownership via value parameter (CG: R.32)
class ConnectionPool {
public:
    void add(std::unique_ptr<Connection> conn) {
        connections_.push_back(std::move(conn));
    }

private:
    std::vector<std::unique_ptr<Connection>> connections_;
};

// GOOD: Custom deleter for C resources
auto file = std::unique_ptr<FILE, decltype(&fclose)>(
    fopen("data.txt", "r"), &fclose);
```

### std::shared_ptr -- Shared Ownership (CG: R.20, R.21)

```cpp
// GOOD: Use only when multiple owners genuinely need the resource
class EventSystem {
public:
    void subscribe(std::shared_ptr<Handler> handler) {
        handlers_.push_back(handler);
    }

private:
    std::vector<std::shared_ptr<Handler>> handlers_;
};

// GOOD: Always create with make_shared (one allocation, exception-safe) (CG: R.22)
auto config = std::make_shared<Config>(load_config());

// BAD: Two separate allocations, potential leak if exception between them
std::shared_ptr<Config> config(new Config(load_config()));
```

### std::weak_ptr -- Breaking Cycles (CG: R.24)

```cpp
// GOOD: Break circular references with weak_ptr
class TreeNode {
public:
    void set_parent(std::shared_ptr<TreeNode> parent) {
        parent_ = parent;  // weak_ptr does not extend lifetime
    }

    std::shared_ptr<TreeNode> parent() const {
        return parent_.lock();  // Returns nullptr if parent is gone
    }

private:
    std::weak_ptr<TreeNode> parent_;
    std::vector<std::shared_ptr<TreeNode>> children_;
};

// GOOD: Cache pattern with weak_ptr
class TextureCache {
public:
    std::shared_ptr<Texture> get(const std::string& path) {
        if (auto it = cache_.find(path); it != cache_.end()) {
            if (auto tex = it->second.lock()) {
                return tex;  // Still alive
            }
            cache_.erase(it);  // Expired, clean up
        }
        auto tex = std::make_shared<Texture>(load_texture(path));
        cache_[path] = tex;
        return tex;
    }

private:
    std::unordered_map<std::string, std::weak_ptr<Texture>> cache_;
};
```

---

## RAII Patterns

### Resource Wrapper Template

```cpp
// Generic RAII wrapper for C-style resources
template <typename T, auto Deleter>
class UniqueResource {
public:
    explicit UniqueResource(T resource) noexcept : resource_(resource) {}
    ~UniqueResource() { if (resource_) Deleter(resource_); }

    UniqueResource(const UniqueResource&) = delete;
    UniqueResource& operator=(const UniqueResource&) = delete;

    UniqueResource(UniqueResource&& other) noexcept
        : resource_(std::exchange(other.resource_, T{})) {}

    UniqueResource& operator=(UniqueResource&& other) noexcept {
        if (this != &other) {
            if (resource_) Deleter(resource_);
            resource_ = std::exchange(other.resource_, T{});
        }
        return *this;
    }

    [[nodiscard]] T get() const noexcept { return resource_; }
    explicit operator bool() const noexcept { return resource_ != T{}; }

private:
    T resource_;
};

// Usage
using FileHandle = UniqueResource<FILE*, fclose>;
using SocketHandle = UniqueResource<int, close>;
```

### Scope Guards

```cpp
// RAII scope guard for ad-hoc cleanup
class ScopeGuard {
public:
    explicit ScopeGuard(std::function<void()> cleanup)
        : cleanup_(std::move(cleanup)) {}
    ~ScopeGuard() { if (cleanup_) cleanup_(); }

    ScopeGuard(const ScopeGuard&) = delete;
    ScopeGuard& operator=(const ScopeGuard&) = delete;

    void dismiss() noexcept { cleanup_ = nullptr; }

private:
    std::function<void()> cleanup_;
};

// Usage
void process() {
    acquire_lock();
    ScopeGuard guard([] { release_lock(); });

    do_work();  // If this throws, lock is still released
    guard.dismiss();  // Or: let it run anyway
}
```

---

## Move Semantics and Perfect Forwarding

### Move Semantics (CG: C.64, F.18)

```cpp
// GOOD: Move-enable types that own resources
class Buffer {
public:
    explicit Buffer(size_t size) : data_(new uint8_t[size]), size_(size) {}

    // Move constructor: steal resources
    Buffer(Buffer&& other) noexcept
        : data_(std::exchange(other.data_, nullptr))
        , size_(std::exchange(other.size_, 0)) {}

    // Move assignment: release old, steal new
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data_;
            data_ = std::exchange(other.data_, nullptr);
            size_ = std::exchange(other.size_, 0);
        }
        return *this;
    }

    ~Buffer() { delete[] data_; }

    // Deleted copy (expensive, make explicit if needed)
    Buffer(const Buffer&) = delete;
    Buffer& operator=(const Buffer&) = delete;

private:
    uint8_t* data_;
    size_t size_;
};

// GOOD: Sink parameter -- take by value, then move (CG: F.18)
class MessageQueue {
public:
    void push(std::string message) {
        queue_.push_back(std::move(message));  // One move from parameter
    }

private:
    std::deque<std::string> queue_;
};
```

### Perfect Forwarding

```cpp
// GOOD: Forward arguments to preserve value category
template <typename... Args>
auto make_user(Args&&... args) {
    return std::make_unique<User>(std::forward<Args>(args)...);
}

// GOOD: Emplace (constructs in-place, no temporary)
std::vector<User> users;
users.emplace_back("Alice", 30);  // Constructs User directly in vector
```

---

## Avoiding Dangling References

```cpp
// BAD: Dangling reference to local (CG: F.43)
std::string_view get_name() {
    std::string name = "Alice";
    return name;  // DANGLING: name destroyed at end of scope
}

// GOOD: Return by value
std::string get_name() {
    std::string name = "Alice";
    return name;  // Moved or copy-elided (NRVO)
}

// BAD: Reference to container element across mutation
auto& ref = vec[0];
vec.push_back(42);  // May reallocate, invalidating ref
use(ref);           // UNDEFINED BEHAVIOR

// GOOD: Use index or re-fetch after modification
vec.push_back(42);
use(vec[0]);
```

---

## Non-Owning Views: span and string_view (CG: F.24, F.25)

```cpp
// GOOD: string_view for read-only string parameters
void log_message(std::string_view message) {
    spdlog::info("{}", message);
}

// Accepts: string literals, std::string, char arrays -- zero copy
log_message("hello");
log_message(some_string);
log_message(some_string_view);

// GOOD: span for contiguous container parameters
double compute_average(std::span<const double> values) {
    if (values.empty()) return 0.0;
    return std::accumulate(values.begin(), values.end(), 0.0) / values.size();
}

// Accepts: vector, array, C-style array -- zero copy
std::vector<double> vec = {1.0, 2.0, 3.0};
compute_average(vec);
compute_average(std::array{1.0, 2.0, 3.0});
double arr[] = {1.0, 2.0};
compute_average(arr);

// BAD: Storing string_view or span beyond the call
class Config {
    std::string_view name_;  // DANGER: may dangle if source string is destroyed
};

// GOOD: Store owning types as members
class Config {
    std::string name_;       // Owns its data
};
```

---

## Container Ownership Patterns

```cpp
// GOOD: Vector of unique_ptr for exclusive ownership of polymorphic objects
class ShapeCollection {
public:
    void add(std::unique_ptr<Shape> shape) {
        shapes_.push_back(std::move(shape));
    }

    void draw_all() const {
        for (const auto& shape : shapes_) {
            shape->draw();
        }
    }

private:
    std::vector<std::unique_ptr<Shape>> shapes_;
};

// GOOD: std::optional for "maybe a value" without heap allocation
class UserProfile {
    std::string name_;
    std::optional<std::string> bio_;        // No heap allocation for empty
    std::optional<Address> address_;        // Value semantics, not a pointer
};
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `new` without smart pointer | Memory leak on exception | `std::make_unique` / `std::make_shared` |
| Raw owning pointer in class | Unclear ownership, leak-prone | `std::unique_ptr` member |
| `shared_ptr` everywhere | Performance overhead, unclear ownership | `unique_ptr` by default; `shared_ptr` only when shared |
| Storing `string_view` as member | Dangling reference if source destroyed | Store `std::string` as member |
| Reference to container element across mutation | Iterator/reference invalidation | Use index or re-fetch |
| Circular `shared_ptr` references | Memory leak (ref count never hits 0) | Break cycle with `weak_ptr` |
| `std::move` on const objects | Silently copies instead of moving | Remove const before move |
| Returning reference to local | Dangling reference, UB | Return by value |

---

_Memory safety in C++ is achieved through discipline and types. Let the compiler and RAII do the work; reserve raw pointers for non-owning observation only._
