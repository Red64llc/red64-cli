# Technology Stack

## Architecture

Modern C application with safety-first design. C17 as baseline standard (C23 where compiler support allows), CMake for build system, comprehensive static analysis and sanitizer pipeline, structured testing with Unity or CMocka.

---

## Core Technologies

- **Language**: C17 (ISO/IEC 9899:2018), C23 features where supported
- **Compilers**: GCC 13+ / Clang 17+ (both required to compile cleanly)
- **Build System**: CMake 3.25+ (modern target-based)
- **Package Management**: vcpkg, Conan 2, or vendored dependencies
- **Formatting**: clang-format 17+
- **Static Analysis**: clang-tidy, cppcheck, Coverity (CI)

---

## Key Libraries

### Core Utilities
- **libuv**: Cross-platform async I/O (event loop, TCP, UDP, pipes, timers)
- **jansson** or **cJSON**: JSON parsing and generation
- **libcurl**: HTTP client with TLS support
- **zlib**: Compression

### Data Structures & Algorithms
- **uthash**: Hash table macros (header-only)
- **sds**: Simple Dynamic Strings (Redis-derived)
- **stb**: Single-header libraries (image, truetype, etc.)

### Logging & Diagnostics
- **log.c**: Simple C logging library (or custom structured logger)
- **libbacktrace**: Stack trace generation for crash reporting

### Cryptography & Security
- **OpenSSL** / **mbedTLS**: TLS and cryptographic operations
- **libsodium**: Modern, easy-to-use crypto primitives

---

## Development Standards

### Code Quality
- **clang-format**: Automated formatting (`.clang-format` in repo root)
- **clang-tidy**: Lint and modernize checks
- **cppcheck**: Additional static analysis (finds what clang-tidy misses)
- **pre-commit hooks**: Run format and lint before each commit

### Security & Safety
- **AddressSanitizer (ASan)**: Buffer overflows, use-after-free, memory leaks
- **MemorySanitizer (MSan)**: Uninitialized memory reads (Clang only)
- **UndefinedBehaviorSanitizer (UBSan)**: Integer overflow, null deref, alignment
- **ThreadSanitizer (TSan)**: Data races in multithreaded code
- **Valgrind**: Heap profiling and leak detection (when sanitizers unavailable)

### Testing
- **Unity**: Lightweight unit test framework (single .c/.h)
- **CMock**: Mock generation for Unity (parses headers)
- **CMocka 2.0**: Alternative with built-in mocking and TAP output
- **AFL++ / libFuzzer**: Fuzz testing for parsing and input handling

---

## Development Environment

### Required Tools
- GCC 13+ or Clang 17+
- CMake 3.25+
- Make or Ninja
- clang-format, clang-tidy
- Valgrind (Linux) or Leaks (macOS)
- gdb or lldb

### Common Commands
```bash
# Build
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build

# Build with sanitizers
cmake -B build-asan -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_C_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer"
cmake --build build-asan

# Tests
ctest --test-dir build --output-on-failure

# Code quality
clang-format -i src/**/*.c include/**/*.h
clang-tidy src/*.c -- -Iinclude
cppcheck --enable=all --suppress=missingInclude src/

# Valgrind
valgrind --leak-check=full --show-leak-kinds=all ./build/myapp

# Coverage
cmake -B build-cov -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_C_FLAGS="--coverage"
cmake --build build-cov
ctest --test-dir build-cov
gcovr --root . --html --html-details -o coverage/index.html
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **C17 over C11** | Bug fixes and clarifications; wide compiler support; stable baseline |
| **CMake over Make** | Target-based dependency management, cross-platform, IDE integration |
| **Unity over Check** | Minimal footprint, no library dependency, embedded-friendly |
| **clang-format + clang-tidy** | Single toolchain for formatting and linting, excellent C support |
| **Sanitizers over Valgrind-only** | Faster execution, compile-time instrumentation, CI-friendly |
| **vcpkg/Conan over manual vendoring** | Reproducible builds, version pinning, transitive dependency resolution |
| **C23 opt-in, not default** | Compiler support still maturing; adopt features like nullptr, auto, constexpr incrementally |

---

_Document standards and patterns, not every dependency. See coding-style.md for detailed C conventions._
