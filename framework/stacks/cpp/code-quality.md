# Code Quality Standards

Project memory for code quality conventions: formatting, static analysis, sanitizers, and compiler warnings in modern C++.

---

## Philosophy

- **Shift left**: Catch bugs at compile time, not runtime
- **Automate enforcement**: clang-format and clang-tidy in CI, not code review
- **Warnings are errors**: `-Werror` in CI ensures nothing slips through
- **Sanitizers in test**: Run ASan/UBSan on every test run in CI

---

## clang-format Configuration

### `.clang-format`

```yaml
BasedOnStyle: Google
Language: Cpp
Standard: c++20
ColumnLimit: 100
IndentWidth: 4
UseTab: Never
BreakBeforeBraces: Attach
AllowShortFunctionsOnASingleLine: Inline
AllowShortIfStatementsOnASingleLine: Never
AllowShortLoopsOnASingleLine: false
AlwaysBreakTemplateDeclarations: Yes
PointerAlignment: Left
SortIncludes: CaseSensitive
IncludeBlocks: Regroup
IncludeCategories:
  - Regex:    '^<[a-z_]+>'           # C++ standard headers
    Priority: 1
  - Regex:    '^<.+>'               # Third-party headers
    Priority: 2
  - Regex:    '^".*"'               # Project headers
    Priority: 3
```

```bash
# Format all source files
clang-format -i $(find src include -name '*.cpp' -o -name '*.hpp')

# Check formatting (CI)
clang-format --dry-run --Werror $(find src include -name '*.cpp' -o -name '*.hpp')
```

---

## clang-tidy Configuration

### `.clang-tidy`

```yaml
Checks: >
  -*,
  bugprone-*,
  cert-*,
  cppcoreguidelines-*,
  misc-*,
  modernize-*,
  performance-*,
  readability-*,
  -modernize-use-trailing-return-type,
  -readability-identifier-length,
  -cppcoreguidelines-avoid-magic-numbers,
  -readability-magic-numbers

WarningsAsErrors: >
  bugprone-*,
  modernize-use-nullptr,
  modernize-use-override,
  modernize-use-auto,
  performance-unnecessary-copy-initialization,
  performance-move-const-arg

CheckOptions:
  - key: readability-identifier-naming.ClassCase
    value: CamelCase
  - key: readability-identifier-naming.FunctionCase
    value: lower_case
  - key: readability-identifier-naming.VariableCase
    value: lower_case
  - key: readability-identifier-naming.ConstantCase
    value: CamelCase
  - key: readability-identifier-naming.ConstantPrefix
    value: k
  - key: readability-identifier-naming.MemberSuffix
    value: _
```

### Key Check Categories

| Category | Purpose | Example Checks |
|---|---|---|
| `modernize-*` | Upgrade to modern C++ | `use-auto`, `use-nullptr`, `use-override`, `use-ranges` |
| `performance-*` | Performance improvements | `unnecessary-copy-initialization`, `move-const-arg` |
| `bugprone-*` | Common bug patterns | `use-after-move`, `narrowing-conversions`, `dangling-handle` |
| `readability-*` | Code clarity | `identifier-naming`, `redundant-string-cstr` |
| `cppcoreguidelines-*` | C++ Core Guidelines | `owning-memory`, `no-malloc`, `slicing` |
| `cert-*` | CERT secure coding | `err33-c` (check return values), `str34-c` |

```bash
# Run clang-tidy (requires compile_commands.json)
run-clang-tidy -p build

# Single file
clang-tidy -p build src/main.cpp

# With auto-fix
run-clang-tidy -p build -fix
```

---

## Compiler Warnings

### Recommended Flags

```cmake
# CMakeLists.txt
target_compile_options(myapp PRIVATE
    $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:
        -Wall
        -Wextra
        -Wpedantic
        -Werror
        -Wconversion
        -Wsign-conversion
        -Wshadow
        -Wnon-virtual-dtor
        -Wold-style-cast
        -Wcast-align
        -Wunused
        -Woverloaded-virtual
        -Wmisleading-indentation
        -Wnull-dereference
        -Wdouble-promotion
        -Wformat=2
        -Wimplicit-fallthrough
    >
    $<$<CXX_COMPILER_ID:MSVC>:
        /W4 /WX /permissive-
    >
)
```

| Flag | Purpose |
|---|---|
| `-Wall -Wextra` | Enable most warnings |
| `-Wpedantic` | Enforce strict ISO C++ compliance |
| `-Werror` | Treat warnings as errors (CI only recommended) |
| `-Wshadow` | Warn on variable shadowing |
| `-Wconversion` | Warn on implicit narrowing conversions |
| `-Wnon-virtual-dtor` | Warn when base class has virtual functions but no virtual destructor |
| `-Wold-style-cast` | Flag C-style casts |

---

## Sanitizers

### AddressSanitizer (ASan)

Detects: buffer overflows, use-after-free, use-after-scope, double-free, memory leaks.

```cmake
# CMake preset or option
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=address -fno-omit-frame-pointer")
set(CMAKE_LINKER_FLAGS "${CMAKE_LINKER_FLAGS} -fsanitize=address")
```

### ThreadSanitizer (TSan)

Detects: data races, deadlocks.

```cmake
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=thread")
```

### UndefinedBehaviorSanitizer (UBSan)

Detects: signed integer overflow, null pointer dereference, misaligned access, out-of-bounds shifts.

```cmake
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=undefined -fno-sanitize-recover=all")
```

### MemorySanitizer (MSan) -- Clang Only

Detects: reads of uninitialized memory.

```cmake
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=memory -fno-omit-frame-pointer")
```

### Sanitizer CMake Preset Pattern

```json
{
    "name": "asan",
    "inherits": "debug",
    "cacheVariables": {
        "CMAKE_CXX_FLAGS": "-fsanitize=address,undefined -fno-omit-frame-pointer"
    }
}
```

**Note**: ASan and TSan cannot be combined. Run them as separate CI jobs.

---

## Code Coverage

### gcov / llvm-cov

```cmake
# Coverage build
target_compile_options(myapp_tests PRIVATE --coverage)
target_link_options(myapp_tests PRIVATE --coverage)
```

```bash
# Generate coverage report
cmake --build build-coverage
ctest --test-dir build-coverage
llvm-cov report ./build-coverage/tests/myapp_tests \
    -instr-profile=default.profdata \
    -ignore-filename-regex='(test|third_party)/'

# HTML report
llvm-cov show ./build-coverage/tests/myapp_tests \
    -instr-profile=default.profdata \
    -format=html -output-dir=coverage-report/
```

---

## cppcheck (Supplementary)

```bash
# Run with compile database
cppcheck --project=build/compile_commands.json \
    --enable=all \
    --suppress=missingIncludeSystem \
    --error-exitcode=1 \
    --inline-suppr
```

---

## include-what-you-use (IWYU)

```bash
# Detect unnecessary or missing includes
iwyu_tool.py -p build -- -Xiwyu --mapping_file=iwyu.imp
```

---

## Quality Commands Summary

```bash
# Full quality check (CI pipeline)
clang-format --dry-run --Werror $(find src include -name '*.cpp' -o -name '*.hpp')
run-clang-tidy -p build
cppcheck --project=build/compile_commands.json --error-exitcode=1
cmake --build build-asan && ctest --test-dir build-asan
cmake --build build-coverage && ctest --test-dir build-coverage

# Development workflow
clang-format -i src/**/*.cpp src/**/*.hpp        # Quick format
cmake --build build && ctest --test-dir build     # Fast feedback
clang-tidy -p build src/app/my_file.cpp          # Focused analysis
```

---

_Focus on patterns over exhaustive rules. Code should be formatted, analyzed, and tested under sanitizers._
