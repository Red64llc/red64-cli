# Technology Stack

Modern C++ application with safety-first design. C++20/23 as language standard, CMake for build system, vcpkg for dependency management, and comprehensive tooling for static analysis and sanitizers.

---

## Core Technologies

- **Language**: C++20 (minimum), C++23 (preferred where supported)
- **Build System**: CMake 3.25+
- **Package Manager**: vcpkg (manifest mode) or Conan 2.x
- **Compiler**: GCC 13+, Clang 17+, or MSVC 17.8+
- **Standard Library**: libstdc++ or libc++

---

## Key Libraries

### Core Utilities
- **fmt**: Modern formatting library (std::format backport)
- **spdlog**: Fast, header-only logging (built on fmt)
- **nlohmann/json**: JSON for Modern C++
- **abseil-cpp**: Google's C++ common libraries (strings, time, hashing)

### Networking & Async
- **Boost.Asio** / **standalone Asio**: Async I/O and networking
- **gRPC**: High-performance RPC framework
- **cpp-httplib**: Single-header HTTP/HTTPS server and client
- **libcurl**: HTTP client (C library with C++ wrappers)

### Data & Storage
- **SQLite** (via sqlite_orm or sqlpp11): Embedded database
- **libpq** / **libpqxx**: PostgreSQL client
- **hiredis**: Redis client

### Concurrency
- **std::jthread** / **std::stop_token**: C++20 cooperative threading
- **std::latch** / **std::barrier**: C++20 synchronization primitives
- **Intel TBB**: Parallel algorithms and concurrent containers

### Testing
- **Google Test**: Test framework with rich assertions
- **Google Mock**: Mocking framework (bundled with Google Test)
- **Catch2 v3**: Alternative BDD-style test framework
- **Google Benchmark**: Microbenchmarking

---

## Build Systems

### CMake (Primary)

```cmake
cmake_minimum_required(VERSION 3.25)
project(myapp VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(fmt CONFIG REQUIRED)
find_package(spdlog CONFIG REQUIRED)
find_package(GTest CONFIG REQUIRED)

add_executable(myapp src/main.cpp)
target_link_libraries(myapp PRIVATE fmt::fmt spdlog::spdlog)
```

### Alternative Build Systems

| Build System | Use Case |
|---|---|
| **CMake** | Industry standard, broadest ecosystem support |
| **Meson** | Simpler syntax, fast builds, good for smaller projects |
| **Bazel** | Large monorepos, hermetic builds, Google-scale projects |

---

## Development Standards

### Code Quality
- **clang-format**: Automated code formatting
- **clang-tidy**: Static analysis and modernization checks
- **cppcheck**: Additional static analysis
- **include-what-you-use (IWYU)**: Header dependency hygiene

### Sanitizers
- **AddressSanitizer (ASan)**: Memory errors, buffer overflows, use-after-free
- **ThreadSanitizer (TSan)**: Data races and deadlocks
- **UndefinedBehaviorSanitizer (UBSan)**: Undefined behavior detection
- **MemorySanitizer (MSan)**: Uninitialized memory reads (Clang only)

### Security
- **Stack protector**: `-fstack-protector-strong`
- **Position-independent code**: `-fPIE -pie`
- **FORTIFY_SOURCE**: `-D_FORTIFY_SOURCE=2`

### Testing
- **Google Test**: Unit and integration tests
- **CTest**: CMake test runner
- **gcov / llvm-cov**: Code coverage
- **libFuzzer**: Fuzz testing

---

## Development Environment

### Required Tools
- C++20/23 compiler (GCC 13+, Clang 17+, or MSVC 17.8+)
- CMake 3.25+
- vcpkg or Conan 2.x
- clang-format, clang-tidy
- Ninja (recommended build backend)

### Common Commands

```bash
# Environment setup (vcpkg)
git clone https://github.com/microsoft/vcpkg.git
./vcpkg/bootstrap-vcpkg.sh
export VCPKG_ROOT=$(pwd)/vcpkg

# Configure and build
cmake --preset default                   # Or: cmake -B build -S .
cmake --build build                      # Build
ctest --test-dir build --output-on-failure  # Run tests

# Code quality
clang-format -i src/**/*.cpp src/**/*.hpp   # Format
run-clang-tidy -p build                     # Static analysis
cppcheck --project=build/compile_commands.json  # Additional checks

# Sanitizer builds
cmake -B build-asan -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer"
cmake --build build-asan
ctest --test-dir build-asan

# Package management (vcpkg manifest mode)
vcpkg new --application                  # Initialize manifest
vcpkg add port fmt spdlog nlohmann-json  # Add dependencies
```

---

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| **C++23 over C++17** | std::expected, std::print, improved ranges, deducing this |
| **CMake over Meson/Bazel** | Widest ecosystem support, vcpkg/Conan integration |
| **vcpkg over Conan** | Tighter CMake integration, simpler manifest mode, large registry |
| **fmt over printf/iostream** | Type-safe, fast, std::format compatible, no UB |
| **spdlog over custom logging** | Zero-cost when disabled, structured output, async support |
| **Google Test over Catch2** | Stronger mocking (gmock), wider CI integration, larger community |
| **Ninja over Make** | Parallel by default, faster incremental builds |

---

_Document standards and patterns, not every dependency. See individual steering files for detailed conventions._
