# Development Conventions

General development practices, workflow, and operational standards for C++ projects.

---

## Philosophy

- **Predictable process**: Consistent workflows reduce friction and errors
- **Automated enforcement**: clang-tidy and CI catch what humans miss
- **Build reproducibility**: Lock dependencies, pin toolchains, use presets
- **Documentation as code**: Keep docs next to the code they describe

---

## Git Workflow

### Branch Strategy

```
main              # Production-ready, always builds
  |-- feat/...    # Feature branches (short-lived)
  |-- fix/...     # Bug fix branches
  |-- chore/...   # Maintenance, dependency updates
```

### Branch Naming

```bash
feat/add-user-authentication
fix/buffer-overflow-in-parser
chore/upgrade-fmt-to-11
refactor/extract-http-client
```

**Pattern**: `{type}/{short-description}` with lowercase and hyphens.

### Workflow

1. Create branch from `main`
2. Make small, focused commits
3. Open PR when ready for review
4. Squash merge into `main`
5. Delete branch after merge

---

## Commit Conventions

### Conventional Commits

```
feat: add JWT authentication middleware
fix: prevent buffer overflow in JSON parser
refactor: extract HTTP client into separate library
test: add parameterized tests for email validation
docs: update CMake build instructions
chore: upgrade vcpkg baseline to 2025.01
ci: add ASan/UBSan to test matrix
perf: use string_view to avoid copies in request parsing
```

### Format

```
{type}: {short description}

{optional body explaining why, not what}

{optional footer: BREAKING CHANGE, Closes #123}
```

### Types

| Type | Description |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes nor adds |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Maintenance, dependencies, tooling |
| `ci` | CI/CD configuration changes |
| `perf` | Performance improvement |

**Rule**: One logical change per commit. If the commit message needs "and", split it.

---

## CMake Project Structure

### Standard Layout

```
myproject/
  CMakeLists.txt              # Root CMakeLists
  CMakePresets.json            # Build presets
  vcpkg.json                   # Dependency manifest
  .clang-format                # Formatting config
  .clang-tidy                  # Static analysis config
  cmake/
    CompilerWarnings.cmake     # Shared warning flags
    Sanitizers.cmake           # Sanitizer build options
  include/
    myproject/                 # Public headers
      user_service.hpp
      http_client.hpp
  src/
    user_service.cpp
    http_client.cpp
    main.cpp
  tests/
    CMakeLists.txt
    unit/
      test_user_service.cpp
    integration/
      test_database.cpp
    benchmark/
      bench_serialization.cpp
  docs/
  third_party/                 # Vendored dependencies (if any)
```

### CMakePresets.json

```json
{
    "version": 6,
    "configurePresets": [
        {
            "name": "default",
            "binaryDir": "${sourceDir}/build",
            "generator": "Ninja",
            "cacheVariables": {
                "CMAKE_CXX_STANDARD": "23",
                "CMAKE_EXPORT_COMPILE_COMMANDS": "ON"
            },
            "toolchainFile": "$env{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
        },
        {
            "name": "debug",
            "inherits": "default",
            "cacheVariables": {
                "CMAKE_BUILD_TYPE": "Debug"
            }
        },
        {
            "name": "release",
            "inherits": "default",
            "cacheVariables": {
                "CMAKE_BUILD_TYPE": "Release"
            }
        },
        {
            "name": "asan",
            "inherits": "debug",
            "cacheVariables": {
                "CMAKE_CXX_FLAGS": "-fsanitize=address,undefined -fno-omit-frame-pointer"
            }
        }
    ],
    "buildPresets": [
        {"name": "default", "configurePreset": "default"},
        {"name": "release", "configurePreset": "release"},
        {"name": "asan", "configurePreset": "asan"}
    ],
    "testPresets": [
        {
            "name": "default",
            "configurePreset": "default",
            "output": {"outputOnFailure": true}
        }
    ]
}
```

---

## Dependency Management

### vcpkg Manifest Mode (Preferred)

```json
{
    "name": "myproject",
    "version-string": "1.0.0",
    "dependencies": [
        "fmt",
        "spdlog",
        "nlohmann-json",
        "gtest",
        "benchmark"
    ],
    "builtin-baseline": "a1a1cbc975e450accd1f5b7e4530e1378575f291"
}
```

```bash
# Add a dependency
vcpkg add port abseil

# Update baseline (all dependencies)
vcpkg x-update-baseline
```

### Dependency Rules

- Use manifest mode (`vcpkg.json`), not classic mode
- Pin the baseline hash in `vcpkg.json`
- Update baseline regularly (monthly or per sprint)
- Prefer header-only libraries when performance permits
- Vendor critical dependencies only as a last resort

---

## Header vs Source Organization

### Public vs Private Headers

```
include/myproject/       # Public API headers (installed with library)
  user_service.hpp       # Declarations only, minimal includes
src/
  user_service.cpp       # Implementations
  internal/              # Private headers (not installed)
    database_impl.hpp
```

### Include Guard Style

```cpp
// GOOD: #pragma once (widely supported, no name collisions)
#pragma once

#include <string>
#include <vector>

namespace myproject {
class UserService { /* ... */ };
}  // namespace myproject
```

```cpp
// ACCEPTABLE: Traditional include guards (required for some compilers)
#ifndef MYPROJECT_USER_SERVICE_HPP
#define MYPROJECT_USER_SERVICE_HPP

// ...

#endif  // MYPROJECT_USER_SERVICE_HPP
```

**Preference**: Use `#pragma once` unless the project must support exotic compilers.

### Include Order

```cpp
// 1. Corresponding header (for .cpp files)
#include "myproject/user_service.hpp"

// 2. C++ standard library
#include <algorithm>
#include <string>
#include <vector>

// 3. Third-party libraries
#include <fmt/core.h>
#include <spdlog/spdlog.h>
#include <nlohmann/json.hpp>

// 4. Project headers
#include "myproject/database.hpp"
#include "myproject/error.hpp"
```

---

## Logging with spdlog

### Setup

```cpp
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_color_sinks.h>
#include <spdlog/sinks/rotating_file_sink.h>

void init_logging() {
    auto console = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
    auto file = std::make_shared<spdlog::sinks::rotating_file_sink_mt>(
        "logs/app.log", 1024 * 1024 * 5, 3);

    auto logger = std::make_shared<spdlog::logger>(
        "app", spdlog::sinks_init_list{console, file});
    logger->set_level(spdlog::level::info);
    logger->set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] [%t] %v");
    spdlog::set_default_logger(logger);
}
```

### Usage

```cpp
// GOOD: Structured key-value logging with fmt syntax
spdlog::info("user_created id={} email={}", user.id(), user.email());
spdlog::warn("retry_attempt service={} attempt={}/{}", "payment", attempt, max);
spdlog::error("operation_failed reason={}", error.message());

// BAD: Unstructured string concatenation
spdlog::info("User " + name + " was created");
```

### Log Levels

| Level | Use Case |
|---|---|
| `trace` | Fine-grained debug detail (disabled in production) |
| `debug` | Development diagnostics |
| `info` | Normal operations (request handled, service started) |
| `warn` | Recoverable issues (retry succeeded, deprecated usage) |
| `error` | Failed operations (connection lost, invalid response) |
| `critical` | System unusable (out of memory, data corruption) |

---

## Documentation Standards

### Doxygen-Style Comments

```cpp
/// @brief Create a new user account.
///
/// Validates email uniqueness and hashes the password before
/// persisting to the database.
///
/// @param request Validated user creation request.
/// @return The created User, or an error if email is taken.
/// @see UserRepo::save
[[nodiscard]] Result<User> create_user(const CreateRequest& request);
```

### When to Write Documentation

| Element | Documentation Required? |
|---|---|
| Public class | Yes |
| Public function/method | Yes |
| Private function | Only if non-obvious |
| Test functions | No (test name is the doc) |
| Template parameters | Yes, describe constraints |

### Inline Comments

```cpp
// GOOD: Explain WHY, not what
// Rate limit to 5/min to prevent brute force attacks
constexpr int kMaxAuthAttemptsPerMinute = 5;

// BAD: Restates the code
// Set max to 5
constexpr int kMax = 5;
```

---

## PR Review Checklist

### Author Checklist (Before Requesting Review)

- [ ] Tests pass locally (`ctest --test-dir build`)
- [ ] clang-tidy passes (`run-clang-tidy -p build`)
- [ ] clang-format applied (`clang-format -i ...`)
- [ ] No compiler warnings with `-Wall -Wextra -Werror`
- [ ] New features have tests
- [ ] No secrets or credentials committed
- [ ] PR description explains WHY, not just what

### Reviewer Checklist

- [ ] Code follows project conventions
- [ ] Error cases are handled (expected/exceptions)
- [ ] No raw owning pointers, manual new/delete
- [ ] No unnecessary copies (use references, string_view, span)
- [ ] Thread safety considered for shared data
- [ ] Tests cover happy path and edge cases

---

## .gitignore

```gitignore
# Build artifacts
build/
build-*/
out/

# IDE
.vscode/settings.json
.idea/
*.swp
*~

# vcpkg
vcpkg_installed/

# Coverage
*.gcda
*.gcno
coverage-report/

# Compiled objects
*.o
*.obj
*.a
*.so
*.dylib
```

---

_Conventions reduce cognitive load. Follow them consistently so the team can focus on solving problems, not debating style._
