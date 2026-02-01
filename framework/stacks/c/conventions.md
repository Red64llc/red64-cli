# Development Conventions

General development practices, workflow, and operational standards for C projects.

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
chore/upgrade-libcurl-to-8
refactor/extract-http-module
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
feat: add JWT token validation
fix: prevent buffer overflow in JSON parser
refactor: extract HTTP client into separate module
test: add fuzz tests for config parser
docs: update CMake build instructions
chore: upgrade vcpkg baseline to 2025.01
ci: add ASan/UBSan to test matrix
perf: use arena allocator for request parsing
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
  vcpkg.json                   # Dependency manifest (vcpkg)
  conanfile.txt                # Dependency manifest (Conan alternative)
  .clang-format                # Formatting config
  .clang-tidy                  # Static analysis config
  cmake/
    CompilerWarnings.cmake     # Shared warning flags
    Sanitizers.cmake           # Sanitizer build options
  include/
    myproject/                 # Public headers
      user.h
      config.h
      error.h
  src/
    user.c
    config.c
    error.c
    main.c
    internal/                  # Private headers
      parser_internal.h
  tests/
    CMakeLists.txt
    unit/
      test_user.c
      test_config.c
    integration/
      test_database.c
    fuzz/
      fuzz_parser.c
  vendor/                      # Vendored dependencies (Unity, etc.)
    unity/
      unity.c
      unity.h
      unity_internals.h
  docs/
```

### Root CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.25)
project(myproject VERSION 1.0.0 LANGUAGES C)

set(CMAKE_C_STANDARD 17)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Library target
add_library(myproject_lib
    src/user.c
    src/config.c
    src/error.c
)
target_include_directories(myproject_lib
    PUBLIC  include
    PRIVATE src/internal
)

# Executable target
add_executable(myproject src/main.c)
target_link_libraries(myproject PRIVATE myproject_lib)

# Tests
option(BUILD_TESTING "Build tests" ON)
if(BUILD_TESTING)
    enable_testing()
    add_subdirectory(tests)
endif()
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
                "CMAKE_C_STANDARD": "17",
                "CMAKE_EXPORT_COMPILE_COMMANDS": "ON"
            }
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
            "name": "relwithdebinfo",
            "inherits": "default",
            "cacheVariables": {
                "CMAKE_BUILD_TYPE": "RelWithDebInfo"
            }
        },
        {
            "name": "asan",
            "inherits": "debug",
            "cacheVariables": {
                "CMAKE_C_FLAGS": "-fsanitize=address,undefined -fno-omit-frame-pointer -fno-sanitize-recover=all"
            }
        },
        {
            "name": "tsan",
            "inherits": "debug",
            "cacheVariables": {
                "CMAKE_C_FLAGS": "-fsanitize=thread"
            }
        },
        {
            "name": "coverage",
            "inherits": "debug",
            "cacheVariables": {
                "CMAKE_C_FLAGS": "--coverage"
            }
        }
    ],
    "buildPresets": [
        {"name": "default", "configurePreset": "default"},
        {"name": "debug", "configurePreset": "debug"},
        {"name": "release", "configurePreset": "release"},
        {"name": "asan", "configurePreset": "asan"},
        {"name": "coverage", "configurePreset": "coverage"}
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

## Build Types

| Type | Purpose | Use Case |
|---|---|---|
| `Debug` | No optimization, full debug symbols (`-O0 -g`) | Day-to-day development |
| `Release` | Full optimization, no debug info (`-O3 -DNDEBUG`) | Production builds |
| `RelWithDebInfo` | Optimization with debug symbols (`-O2 -g -DNDEBUG`) | Production profiling, crash analysis |
| `MinSizeRel` | Optimize for binary size (`-Os -DNDEBUG`) | Embedded or size-constrained targets |

---

## Dependency Management

### vcpkg Manifest Mode (Preferred)

```json
{
    "name": "myproject",
    "version-string": "1.0.0",
    "dependencies": [
        "cjson",
        "libcurl",
        "libuv",
        "libsodium"
    ],
    "builtin-baseline": "a1a1cbc975e450accd1f5b7e4530e1378575f291"
}
```

```cmake
# In CMakePresets.json or command line
"toolchainFile": "$env{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
```

### Conan 2 Alternative

```ini
# conanfile.txt
[requires]
cjson/1.7.17
libcurl/8.5.0
libuv/1.48.0

[generators]
CMakeDeps
CMakeToolchain

[layout]
cmake_layout
```

```bash
conan install . --build=missing
cmake --preset conan-release
cmake --build build/Release
```

### CMake FetchContent (For Small Dependencies)

```cmake
include(FetchContent)

FetchContent_Declare(
    unity
    GIT_REPOSITORY https://github.com/ThrowTheSwitch/Unity.git
    GIT_TAG        v2.6.0
)
FetchContent_MakeAvailable(unity)

target_link_libraries(test_user PRIVATE unity)
```

### Dependency Rules

- Use manifest mode (`vcpkg.json` or `conanfile.txt`), not ad-hoc installs
- Pin versions and baselines
- Update dependencies regularly (monthly or per sprint)
- Vendor test frameworks (Unity is a single .c/.h) when simplicity matters
- Prefer libraries with minimal transitive dependencies

---

## Header vs Source Organization

### Public vs Private Headers

```
include/myproject/       # Public API headers (installed with library)
  user.h                 # Declarations only, minimal includes
  config.h
  error.h
src/
  user.c                 # Implementations
  config.c
  internal/              # Private headers (not installed, not in public include path)
    parser_internal.h
    buffer_pool.h
```

### Include Order

```c
/* 1. Corresponding header (for .c files) */
#include "myproject/user.h"

/* 2. C standard library */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* 3. POSIX / system headers */
#include <unistd.h>

/* 4. Third-party libraries */
#include <cJSON.h>

/* 5. Project headers */
#include "myproject/config.h"
#include "myproject/error.h"
```

---

## Library vs Executable Targets

```cmake
# GOOD: Separate library from executable for testability
add_library(myproject_lib
    src/user.c
    src/config.c
    src/error.c
)
target_include_directories(myproject_lib PUBLIC include PRIVATE src/internal)

# Main executable links against library
add_executable(myproject src/main.c)
target_link_libraries(myproject PRIVATE myproject_lib)

# Tests link against library (not executable)
add_executable(test_user tests/unit/test_user.c)
target_link_libraries(test_user PRIVATE myproject_lib unity)
add_test(NAME unit_user COMMAND test_user)
```

```c
/* BAD: All code in main.c -- untestable */
int main(int argc, char *argv[]) {
    /* 500 lines of business logic mixed with I/O */
}
```

---

## Documentation with Doxygen

### Function Documentation

```c
/**
 * @brief Create a new user in the repository.
 *
 * Validates email uniqueness and allocates a new user record.
 * Caller is responsible for freeing the user with user_free().
 *
 * @param[in]  repo    User repository handle.
 * @param[in]  req     User creation request (name and email required).
 * @param[out] out     Populated user on success.
 * @return ERR_OK on success, ERR_ALREADY_EXISTS if email is taken,
 *         ERR_NOMEM if allocation fails.
 *
 * @see user_free
 * @see user_find_by_email
 */
int user_create(user_repo_t *repo, const create_request_t *req, user_t *out);
```

### Doxyfile Essentials

```bash
# Generate Doxygen config
doxygen -g

# Key settings
PROJECT_NAME           = "MyProject"
INPUT                  = include/ src/
FILE_PATTERNS          = *.h *.c
RECURSIVE              = YES
EXTRACT_ALL            = NO
EXTRACT_STATIC         = NO
GENERATE_LATEX         = NO
WARN_NO_PARAMDOC       = YES
```

### When to Write Documentation

| Element | Documentation Required? |
|---|---|
| Public API function (in header) | Yes -- @brief, @param, @return |
| Opaque types | Yes -- describe purpose and ownership |
| Static (file-local) function | Only if non-obvious |
| Struct members | Yes if meaning not obvious from name |
| Macros | Yes -- document parameters and side effects |
| Test functions | No (test name is the doc) |

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
- [ ] All malloc/calloc calls have corresponding free paths

### Reviewer Checklist

- [ ] Code follows project naming conventions (snake_case, _t suffix)
- [ ] Error cases handled (return codes checked, goto cleanup used)
- [ ] No buffer overflows (bounds checked, snprintf over sprintf)
- [ ] No memory leaks (every allocation has a free path)
- [ ] Const correctness for pointer parameters
- [ ] Static for file-local functions
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

# Conan
CMakeUserPresets.json

# Coverage
*.gcda
*.gcno
coverage-report/
coverage.info

# Compiled objects
*.o
*.obj
*.a
*.so
*.dylib
*.exe
```

---

_Conventions reduce cognitive load. Follow them consistently so the team can focus on solving problems, not debating style._
