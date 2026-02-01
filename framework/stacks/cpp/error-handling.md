# Error Handling Patterns

Structured error handling for modern C++ with std::expected (C++23), exceptions, and RAII.

---

## Philosophy

- **Fail fast**: Validate inputs early, return errors immediately on invalid state
- **Make errors visible**: Use types that force callers to handle failure
- **RAII for cleanup**: Never write manual cleanup code; destructors handle it
- **Pick one strategy per layer**: Do not mix exceptions and error codes in the same API surface
- **Ref**: C++ Core Guidelines E.1-E.31

---

## Exception Safety Guarantees

Every function provides one of these guarantees. Document which one.

| Guarantee | Description | Example |
|---|---|---|
| **Nothrow** | Never throws. Marked `noexcept`. | Destructors, swap, move operations |
| **Strong** | If an exception is thrown, state rolls back to before the call. | Copy-and-swap idiom |
| **Basic** | If an exception is thrown, no resources leak and invariants hold. Objects may be in a valid but unspecified state. | Most standard library operations |

```cpp
// Nothrow guarantee: destructors, move operations (CG: C.66, C.85)
class Connection {
public:
    ~Connection() noexcept;
    Connection(Connection&& other) noexcept;
    Connection& operator=(Connection&& other) noexcept;
};

// Strong guarantee via copy-and-swap (CG: C.83)
class UserList {
public:
    UserList& operator=(UserList other) noexcept {  // Pass by value = copy
        swap(*this, other);                          // noexcept swap
        return *this;
    }

    friend void swap(UserList& a, UserList& b) noexcept {
        using std::swap;
        swap(a.users_, b.users_);
    }

private:
    std::vector<User> users_;
};
```

---

## std::expected (C++23) -- Preferred for Recoverable Errors

`std::expected<T, E>` returns either a value of type `T` or an error of type `E`. No stack unwinding, no hidden control flow.

### Error Type Definition

```cpp
// error.hpp
#include <string>
#include <expected>

enum class ErrorCode {
    kNotFound,
    kAlreadyExists,
    kUnauthorized,
    kValidation,
    kInternal,
    kTimeout,
};

struct Error {
    ErrorCode code;
    std::string message;
    std::string context;  // Optional: file, function, etc.
};

template <typename T>
using Result = std::expected<T, Error>;
```

### Basic Usage

```cpp
Result<User> find_user(int user_id) {
    auto row = db_.query_one("SELECT * FROM users WHERE id = ?", user_id);
    if (!row) {
        return std::unexpected(Error{
            .code = ErrorCode::kNotFound,
            .message = fmt::format("User {} not found", user_id),
        });
    }
    return User::from_row(*row);
}

// Caller
auto result = find_user(42);
if (result) {
    spdlog::info("Found user: {}", result->name());
} else {
    spdlog::warn("Error: {}", result.error().message);
}
```

### Monadic Chaining (C++23)

```cpp
// Chain operations that may fail: and_then, transform, or_else
auto user = find_user(user_id)
    .and_then([](User u) -> Result<User> {
        if (!u.is_active()) {
            return std::unexpected(Error{ErrorCode::kUnauthorized, "User inactive"});
        }
        return u;
    })
    .transform([](User u) {
        return UserResponse{u.name(), u.email()};
    });
```

### Pre-C++23 Alternative: tl::expected

```cpp
// Use tl::expected if your compiler does not yet support std::expected
#include <tl/expected.hpp>

template <typename T>
using Result = tl::expected<T, Error>;
```

---

## When to Use Each Error Strategy

| Strategy | Use Case | Example |
|---|---|---|
| **std::expected** | Recoverable, expected failures | File not found, validation, business logic |
| **Exceptions** | Unrecoverable or truly exceptional errors | Out of memory, corrupted state, programmer error |
| **Error codes (enum)** | C interop, embedded, real-time, no-exception builds | OS APIs, hardware drivers |
| **std::optional** | "No value" without error details | Cache miss, optional config lookup |
| **assert / contracts** | Precondition violations in debug builds | `assert(ptr != nullptr)` |

### Exceptions: When Appropriate (CG: E.2, E.3)

```cpp
// GOOD: Exception for constructor failure (no return value to use)
class DatabaseConnection {
public:
    explicit DatabaseConnection(std::string_view conn_str) {
        handle_ = connect(conn_str);
        if (!handle_) {
            throw std::runtime_error(
                fmt::format("Failed to connect to database: {}", conn_str));
        }
    }
private:
    ConnectionHandle handle_;
};

// GOOD: Exception for programming errors (should not happen in correct code)
void process(std::span<const int> data) {
    if (data.empty()) {
        throw std::invalid_argument("data must not be empty");
    }
}
```

---

## RAII for Cleanup (CG: R.1)

```cpp
// GOOD: RAII handles all cleanup automatically
void transfer_funds(Account& from, Account& to, int amount) {
    auto transaction = db_.begin_transaction();  // RAII: auto-rollback on exception

    from.withdraw(amount);
    to.deposit(amount);

    transaction.commit();  // Explicit commit; destructor rolls back if not called
}

// BAD: Manual cleanup -- exception-unsafe
void transfer_funds_bad(Account& from, Account& to, int amount) {
    auto* txn = db_.begin_transaction_raw();
    from.withdraw(amount);   // If this throws, txn is leaked
    to.deposit(amount);
    txn->commit();
    delete txn;              // Never reached on exception
}
```

---

## noexcept Specification (CG: E.12)

```cpp
// GOOD: Mark functions noexcept when they genuinely cannot throw
void swap(Buffer& other) noexcept;
Buffer(Buffer&& other) noexcept;
~Buffer() noexcept;  // Destructors are implicitly noexcept

// GOOD: Conditional noexcept for templates
template <typename T>
void swap(T& a, T& b) noexcept(std::is_nothrow_move_constructible_v<T>);

// BAD: Marking functions noexcept when they might throw
// If they do throw, std::terminate is called immediately -- no cleanup!
void parse_config(std::string_view json) noexcept;  // JSON parsing can fail!
```

---

## Custom Exception Hierarchy (When Using Exceptions)

```cpp
// Base application exception
class AppError : public std::runtime_error {
public:
    explicit AppError(ErrorCode code, std::string_view message)
        : std::runtime_error(std::string(message))
        , code_(code) {}

    [[nodiscard]] ErrorCode code() const noexcept { return code_; }

private:
    ErrorCode code_;
};

class NotFoundError : public AppError {
public:
    NotFoundError(std::string_view resource, std::string_view id)
        : AppError(ErrorCode::kNotFound,
                   fmt::format("{} not found: {}", resource, id)) {}
};

class ValidationError : public AppError {
public:
    explicit ValidationError(std::string_view message)
        : AppError(ErrorCode::kValidation, message) {}
};
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `catch (...)` with no rethrow | Silently swallows all errors including memory corruption | Catch specific types; rethrow unknown |
| Catching by value | Slices derived exceptions, copies unnecessarily | Catch by `const` reference: `catch (const Error& e)` |
| Bare `throw;` in wrong context | UB if no active exception | Only use `throw;` inside a catch block |
| Ignoring return codes | Missed errors propagate silently | Use `[[nodiscard]]` on error-returning functions |
| Manual cleanup without RAII | Exception-unsafe, leak-prone | Wrap resources in RAII types |
| `noexcept` on functions that throw | Calls `std::terminate` with no stack unwinding | Only mark truly non-throwing functions |
| Using error codes where expected fits | Verbose, easy to ignore | Use `std::expected<T, E>` for typed results |

---

_Errors are data. Classify them, make them visible in the type system, and let RAII handle cleanup. Never swallow errors silently._
