# C++ Coding Style

Coding style conventions beyond what clang-format enforces automatically. Opinionated patterns for readable, maintainable modern C++.

---

## Philosophy

- **Safety by default**: Prefer constructs that prevent bugs at compile time
- **Value semantics first**: Copy/move values; use references for observation, pointers for optional observation
- **Const everything**: If it does not change, mark it `const`
- **Zero-cost abstractions**: Use templates and constexpr, not runtime polymorphism, when possible
- **Automate what you can**: Let clang-format handle layout; this doc covers judgment calls

---

## Naming Conventions

### Standard C++ Naming

| Element | Convention | Example |
|---|---|---|
| Classes, structs, enums | `PascalCase` | `UserService`, `HttpRequest` |
| Functions, methods | `snake_case` or `camelCase` (pick one, be consistent) | `get_user`, `getUser` |
| Variables, parameters | `snake_case` | `user_count`, `max_retries` |
| Constants (constexpr) | `kPascalCase` or `SCREAMING_SNAKE` | `kMaxRetries`, `MAX_RETRIES` |
| Macros (avoid) | `SCREAMING_SNAKE` | `MY_PROJECT_ASSERT` |
| Namespaces | `snake_case`, short | `myapp`, `myapp::net` |
| Template parameters | `PascalCase` | `T`, `Container`, `Predicate` |
| Member variables | `snake_case_` (trailing underscore) | `name_`, `connection_pool_` |
| Enum values | `PascalCase` or `kPascalCase` | `Color::Red`, `Status::kActive` |

### Naming Rules

```cpp
// GOOD: Descriptive, reveals intent
int active_user_count = get_active_users(db).size();
bool is_authenticated = token.has_value();
constexpr int kMaxRetryAttempts = 3;

std::expected<User, Error> find_user_by_email(std::string_view email);

class PaymentProcessor {
public:
    void process_payment(const PaymentRequest& request);
private:
    std::unique_ptr<Gateway> gateway_;
};

// BAD: Abbreviated, unclear
int auc = get_au(db).size();
bool auth = tok.has_value();
#define N 3
```

### Boolean Naming

Prefix with `is_`, `has_`, `can_`, `should_`:

```cpp
bool is_active = true;
bool has_permission = check_access(user, resource);
bool can_publish = post.status() == Status::kDraft;
bool should_notify = user.preferences().notifications_enabled();
```

---

## Modern C++ Idioms

### Rule of Zero (Prefer)

```cpp
// GOOD: Rule of Zero -- compiler-generated special members are correct
class UserService {
public:
    explicit UserService(std::shared_ptr<UserRepo> repo)
        : repo_(std::move(repo)) {}

    // No destructor, copy/move constructors, or assignment operators needed.
    // std::shared_ptr handles cleanup automatically.

private:
    std::shared_ptr<UserRepo> repo_;
};
```

### Rule of Five (When Needed)

```cpp
// When managing a raw resource (rare -- prefer RAII wrappers)
class FileHandle {
public:
    explicit FileHandle(const std::filesystem::path& path);
    ~FileHandle();

    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;

    FileHandle(FileHandle&& other) noexcept;
    FileHandle& operator=(FileHandle&& other) noexcept;

private:
    int fd_ = -1;
};
```

### Const Correctness (CG: Con.1-5)

```cpp
// GOOD: const by default
const auto user = find_user(user_id);
const auto& name = user.name();

void print_report(const std::vector<Record>& records);  // Does not modify

class Cache {
public:
    [[nodiscard]] std::optional<Value> get(std::string_view key) const;
    void put(std::string key, Value value);
};
```

---

## Auto Usage Guidelines

### When to Use Auto

```cpp
// GOOD: Type is obvious from the right-hand side
auto user = std::make_unique<User>("Alice");
auto it = container.find(key);
auto [name, age] = get_person();  // Structured bindings

// GOOD: Long or complex types
auto callback = [](const Event& e) { handle(e); };
auto result = std::ranges::find_if(users, [](const auto& u) { return u.is_active(); });
```

### When NOT to Use Auto

```cpp
// BAD: Type is not obvious
auto x = compute();  // What type is x?
auto val = get_value();  // int? double? string?

// GOOD: Be explicit when type is not clear from context
double temperature = compute_temperature(sensor_data);
std::string name = get_value("name");
```

---

## Range-Based For Loops and Structured Bindings

```cpp
// GOOD: Range-based for with const reference
for (const auto& user : users) {
    process(user);
}

// GOOD: Structured bindings (C++17/20)
for (const auto& [key, value] : config_map) {
    spdlog::info("{}={}", key, value);
}

// GOOD: With ranges (C++20)
auto active = users | std::views::filter(&User::is_active)
                    | std::views::transform(&User::name);

// BAD: Index-based when not needed
for (size_t i = 0; i < users.size(); ++i) {
    process(users[i]);
}
```

---

## Smart Pointer Usage

```cpp
// GOOD: unique_ptr by default for ownership (CG: R.20)
auto user = std::make_unique<User>("Alice", 30);

// GOOD: shared_ptr only when shared ownership is required (CG: R.20)
auto config = std::make_shared<Config>(load_config());

// GOOD: Raw pointer or reference for non-owning observation (CG: R.3)
void process(const User& user);     // Guaranteed non-null
void process(const User* user);     // May be null

// GOOD: Pass unique_ptr by value to transfer ownership (CG: R.32)
void register_user(std::unique_ptr<User> user);

// BAD: Raw owning pointer
User* user = new User("Alice", 30);  // Who deletes this?
delete user;                          // Manual, error-prone
```

---

## Function Design

### Size and Parameter Limits

| Element | Guideline |
|---|---|
| Function body | Under 30 lines of logic, max 50 |
| Class | Under 300 lines, max 500 |
| Header file | Under 200 lines, max 400 |
| Source file | Under 500 lines, max 800 |
| Parameters | Max 5; use a struct/options for more |

### Prefer [[nodiscard]] (CG: F.48)

```cpp
// GOOD: Compiler warns if return value is ignored
[[nodiscard]] std::expected<User, Error> create_user(const CreateRequest& req);
[[nodiscard]] bool try_connect(std::string_view host, int port);

// GOOD: On classes returned from factories
class [[nodiscard]] ScopedLock { /* ... */ };
```

### Early Returns with Guard Clauses

```cpp
// GOOD: Guard clauses
std::expected<Post, Error> publish(Post& post, const User& user) {
    if (post.author_id() != user.id()) {
        return std::unexpected(Error::kUnauthorized);
    }
    if (post.status() == Status::kPublished) {
        return std::unexpected(Error::kAlreadyPublished);
    }
    if (post.body().empty()) {
        return std::unexpected(Error::kValidation);
    }

    post.set_status(Status::kPublished);
    return post;
}
```

---

## Concepts (C++20)

```cpp
// GOOD: Constrain templates with concepts (CG: T.10)
template <std::integral T>
T safe_divide(T a, T b) {
    if (b == 0) throw std::invalid_argument("division by zero");
    return a / b;
}

// GOOD: Custom concepts for domain constraints
template <typename T>
concept Serializable = requires(T t, std::ostream& os) {
    { t.serialize(os) } -> std::same_as<void>;
    { T::deserialize(os) } -> std::same_as<T>;
};

template <Serializable T>
void save(const T& obj, const std::filesystem::path& path);
```

---

## Spaceship Operator (C++20)

```cpp
// GOOD: Auto-generates all comparison operators (CG: C.161)
struct Version {
    int major;
    int minor;
    int patch;

    auto operator<=>(const Version&) const = default;
};

// Usage: ==, !=, <, >, <=, >= all work automatically
assert(Version{1, 2, 0} < Version{1, 3, 0});
```

---

## Anti-Patterns

### Raw new/delete

```cpp
// BAD: Manual memory management
Widget* w = new Widget();
// ... exception thrown here = memory leak
delete w;

// GOOD: RAII via smart pointers
auto w = std::make_unique<Widget>();
// Automatically cleaned up, even on exception
```

### C-Style Casts

```cpp
// BAD: C-style cast -- hides intent, can do dangerous reinterpretations
void* data = get_data();
int* p = (int*)data;

// GOOD: Named casts express intent (CG: ES.49)
auto p = static_cast<int*>(data);         // Known-safe conversion
auto p = dynamic_cast<Derived*>(base);    // Runtime-checked downcast
auto p = reinterpret_cast<char*>(data);   // Low-level, explicit danger
const_cast<int&>(ref) = 42;              // Remove const (last resort)
```

### Macros for Constants

```cpp
// BAD: Macros have no scope, no type, cause hard-to-debug issues
#define MAX_SIZE 1024
#define PI 3.14159

// GOOD: constexpr has scope, type safety, debugger visibility (CG: ES.31)
constexpr int kMaxSize = 1024;
constexpr double kPi = 3.14159;
```

### Using Namespace in Headers

```cpp
// BAD: Pollutes every includer's namespace (CG: SF.7)
// my_header.hpp
using namespace std;
using namespace boost;

// GOOD: Fully qualify in headers; using-declarations in .cpp only
// my_header.hpp
std::vector<std::string> get_names();

// my_source.cpp
using std::vector;
using std::string;
```

### Passing Smart Pointers Unnecessarily

```cpp
// BAD: Function does not need ownership semantics
void print_name(const std::shared_ptr<User>& user) {
    std::cout << user->name();
}

// GOOD: Accept reference if you just observe (CG: R.36)
void print_name(const User& user) {
    std::cout << user.name();
}
```

---

_Style is a tool for communication. Write code that your future self and teammates will thank you for._
