# Code Quality Standards

Project memory for code quality conventions: formatting, static analysis, sanitizers, and compiler warnings in modern C.

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
BasedOnStyle: LLVM
Language: Cpp
Standard: c17
ColumnLimit: 100
IndentWidth: 4
UseTab: Never
BreakBeforeBraces: Attach
AllowShortFunctionsOnASingleLine: Empty
AllowShortIfStatementsOnASingleLine: Never
AllowShortLoopsOnASingleLine: false
PointerAlignment: Right
SpaceBeforeParens: ControlStatements
SortIncludes: CaseSensitive
IncludeBlocks: Regroup
IncludeCategories:
  - Regex:    '^".*"'               # Project headers (corresponding header first)
    Priority: 1
  - Regex:    '^<(assert|ctype|errno|float|limits|locale|math|setjmp|signal|stdarg|stddef|stdio|stdlib|string|time|stdbool|stdint|inttypes|stdalign|stdatomic|stdnoreturn|threads|uchar)\.h>'
    Priority: 2                     # C standard library
  - Regex:    '^<(sys|unistd|fcntl|pthread|netinet|arpa|dlfcn).*>'
    Priority: 3                     # POSIX / system
  - Regex:    '^<.+>'              # Third-party
    Priority: 4
```

```bash
# Format all source files
clang-format -i $(find src include -name '*.c' -o -name '*.h')

# Check formatting (CI)
clang-format --dry-run --Werror $(find src include -name '*.c' -o -name '*.h')
```

---

## clang-tidy Configuration

### `.clang-tidy`

```yaml
Checks: >
  -*,
  bugprone-*,
  cert-*,
  misc-*,
  readability-*,
  performance-*,
  clang-analyzer-*,
  -readability-identifier-length,
  -readability-magic-numbers,
  -bugprone-easily-swappable-parameters,
  -cert-err33-c

WarningsAsErrors: >
  bugprone-*,
  cert-str34-c,
  cert-mem57-c,
  clang-analyzer-security.*,
  clang-analyzer-deadcode.*

CheckOptions:
  - key: readability-identifier-naming.FunctionCase
    value: lower_case
  - key: readability-identifier-naming.VariableCase
    value: lower_case
  - key: readability-identifier-naming.MacroDefinitionCase
    value: UPPER_CASE
  - key: readability-identifier-naming.TypedefCase
    value: lower_case
  - key: readability-identifier-naming.TypedefSuffix
    value: _t
```

### Key Check Categories

| Category | Purpose | Example Checks |
|---|---|---|
| `bugprone-*` | Common bug patterns | `sizeof-expression`, `narrowing-conversions`, `string-literal-with-embedded-nul` |
| `cert-*` | CERT C secure coding | `err34-c` (check return of `atoi`), `str34-c` (sign of `char`), `mem57-c` |
| `clang-analyzer-*` | Static analysis (deep) | `security.insecureAPI.strcpy`, `deadcode.DeadStores` |
| `performance-*` | Performance improvements | `type-promotion-in-math-fn` |
| `readability-*` | Code clarity | `identifier-naming`, `implicit-bool-conversion` |
| `misc-*` | Miscellaneous | `unused-parameters`, `redundant-expression` |

```bash
# Run clang-tidy (requires compile_commands.json)
run-clang-tidy -p build

# Single file
clang-tidy -p build src/main.c

# With auto-fix
run-clang-tidy -p build -fix
```

---

## cppcheck (Supplementary)

```bash
# Run with compile database
cppcheck --project=build/compile_commands.json \
    --std=c17 \
    --enable=all \
    --suppress=missingIncludeSystem \
    --error-exitcode=1 \
    --inline-suppr

# Without compile database
cppcheck --enable=all --std=c17 \
    --suppress=missingInclude \
    -I include/ \
    src/
```

### cppcheck Key Checks

| Check | What It Finds |
|---|---|
| `nullPointer` | Null pointer dereference |
| `memleak` | Memory not freed on all paths |
| `bufferAccessOutOfBounds` | Array out-of-bounds access |
| `uninitvar` | Use of uninitialized variable |
| `resourceLeak` | File handle or socket not closed |
| `redundantAssignment` | Variable assigned then overwritten |

---

## Compiler Warnings

### Recommended Flags

```cmake
# CMakeLists.txt
target_compile_options(myapp PRIVATE
    $<$<C_COMPILER_ID:GNU,Clang,AppleClang>:
        -Wall
        -Wextra
        -Wpedantic
        -Werror
        -Wshadow
        -Wconversion
        -Wsign-conversion
        -Wdouble-promotion
        -Wformat=2
        -Wformat-overflow=2
        -Wformat-truncation=2
        -Wimplicit-fallthrough
        -Wnull-dereference
        -Wunused
        -Wstrict-prototypes
        -Wold-style-definition
        -Wmissing-prototypes
        -Wmissing-declarations
        -Wcast-align
        -Wwrite-strings
        -Wvla
    >
    $<$<C_COMPILER_ID:GNU>:
        -Wlogical-op
        -Wduplicated-cond
        -Wduplicated-branches
        -Wjump-misses-init
    >
)
```

| Flag | Purpose |
|---|---|
| `-Wall -Wextra` | Enable most warnings |
| `-Wpedantic` | Enforce strict ISO C compliance |
| `-Werror` | Treat warnings as errors (CI) |
| `-Wshadow` | Warn on variable shadowing |
| `-Wconversion` | Warn on implicit narrowing conversions |
| `-Wstrict-prototypes` | Require full prototypes (not empty parens) |
| `-Wmissing-prototypes` | Warn if global function has no prior prototype |
| `-Wvla` | Forbid variable-length arrays (stack overflow risk) |
| `-Wformat=2` | Extra format string checks |
| `-Wold-style-definition` | Forbid K&R style function definitions |

---

## Sanitizers

### AddressSanitizer (ASan)

Detects: buffer overflows, use-after-free, use-after-scope, double-free, memory leaks.

```cmake
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=address -fno-omit-frame-pointer")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -fsanitize=address")
```

### UndefinedBehaviorSanitizer (UBSan)

Detects: signed integer overflow, null pointer dereference, misaligned access, out-of-bounds shifts, type punning.

```cmake
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=undefined -fno-sanitize-recover=all")
```

### MemorySanitizer (MSan) -- Clang Only

Detects: reads of uninitialized memory.

```cmake
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=memory -fno-omit-frame-pointer")
```

### ThreadSanitizer (TSan)

Detects: data races, deadlocks.

```cmake
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=thread")
```

### Sanitizer CMake Preset Pattern

```json
{
    "name": "asan",
    "inherits": "debug",
    "cacheVariables": {
        "CMAKE_C_FLAGS": "-fsanitize=address,undefined -fno-omit-frame-pointer -fno-sanitize-recover=all"
    }
}
```

**Note**: ASan and TSan cannot be combined. Run them as separate CI jobs.

---

## CERT C Coding Standard References

Key CERT C rules to enforce via tooling and review:

| Rule | Description | Enforcement |
|---|---|---|
| **ERR33-C** | Detect and handle standard library errors | clang-tidy `cert-err33-c` |
| **STR31-C** | Guarantee null-terminated strings have sufficient space | Manual review, ASan |
| **MEM30-C** | Do not access freed memory | ASan, Valgrind |
| **MEM35-C** | Allocate sufficient memory for an object | ASan, cppcheck |
| **ARR38-C** | Guarantee array indices are within valid range | UBSan, ASan |
| **INT32-C** | Ensure signed integer operations do not overflow | UBSan |
| **FIO42-C** | Close files when they are no longer needed | cppcheck `resourceLeak` |
| **MSC24-C** | Do not use deprecated or obsolescent functions | clang-tidy, `-Wdeprecated` |

---

## Code Coverage

### gcov / lcov

```cmake
# Coverage build
target_compile_options(myapp_tests PRIVATE --coverage)
target_link_options(myapp_tests PRIVATE --coverage)
```

```bash
# Generate coverage report
cmake --build build-coverage
ctest --test-dir build-coverage
lcov --capture --directory build-coverage --output-file coverage.info
lcov --remove coverage.info '/usr/*' '*/test/*' --output-file coverage.info
genhtml coverage.info --output-directory coverage-report/

# Alternative: gcovr
gcovr --root . --html --html-details -o coverage/index.html
```

---

## Quality Commands Summary

```bash
# Full quality check (CI pipeline)
clang-format --dry-run --Werror $(find src include -name '*.c' -o -name '*.h')
run-clang-tidy -p build
cppcheck --project=build/compile_commands.json --error-exitcode=1
cmake --build build-asan && ctest --test-dir build-asan --output-on-failure
cmake --build build-coverage && ctest --test-dir build-coverage

# Development workflow
clang-format -i src/**/*.c include/**/*.h       # Quick format
cmake --build build && ctest --test-dir build    # Fast feedback
clang-tidy -p build src/my_file.c               # Focused analysis
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| No `-Werror` in CI | Warnings accumulate silently | `-Werror` in CI builds |
| Suppressing warnings globally | Hides real bugs | Suppress per-line with comments only when justified |
| No sanitizers in test | Memory bugs hide until production | ASan + UBSan on every CI test run |
| Manual code review for style | Inconsistent, wastes reviewer time | clang-format enforces automatically |
| No `compile_commands.json` | clang-tidy cannot find headers | `set(CMAKE_EXPORT_COMPILE_COMMANDS ON)` |
| Ignoring cppcheck findings | Misses bugs clang-tidy does not catch | Run both tools; they complement each other |

---

_Focus on patterns over exhaustive rules. Code should be formatted, analyzed, and tested under sanitizers before it reaches review._
