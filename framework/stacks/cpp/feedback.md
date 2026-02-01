# Feedback Configuration

Project-specific commands for automated feedback during C++ implementation.

---

## Build Commands

Commands to build the project during implementation.

```yaml
# Primary build command (REQUIRED)
build: cmake --build build

# Configure (first time or after CMakeLists changes)
configure: cmake --preset default

# Clean build
clean_build: cmake --build build --clean-first

# Release build
build_release: cmake --preset release && cmake --build build-release
```

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: ctest --test-dir build --output-on-failure

# Run specific test suite
test_suite: ctest --test-dir build -R "{suite_name}" --output-on-failure

# Run with verbose output
test_verbose: ctest --test-dir build -V

# Run only unit tests
test_unit: ctest --test-dir build -L unit --output-on-failure

# Run only integration tests
test_integration: ctest --test-dir build -L integration --output-on-failure
```

---

## Linting Commands

Commands for code quality checks.

```yaml
# Primary lint command (clang-tidy)
lint: run-clang-tidy -p build

# Lint single file
lint_file: clang-tidy -p build {file}

# Lint with auto-fix
lint_fix: run-clang-tidy -p build -fix

# Static analysis with cppcheck
static_analysis: cppcheck --project=build/compile_commands.json --enable=all --error-exitcode=1
```

---

## Format Commands

Commands for code formatting.

```yaml
# Format check (CI)
format_check: clang-format --dry-run --Werror $(find src include -name '*.cpp' -o -name '*.hpp')

# Format fix
format: clang-format -i $(find src include -name '*.cpp' -o -name '*.hpp')
```

---

## Sanitizer Builds

Commands for sanitizer-instrumented builds.

```yaml
# ASan + UBSan build and test
test_asan: cmake --preset asan && cmake --build build-asan && ctest --test-dir build-asan --output-on-failure

# TSan build and test
test_tsan: cmake -B build-tsan -DCMAKE_CXX_FLAGS="-fsanitize=thread" && cmake --build build-tsan && ctest --test-dir build-tsan
```

---

## Notes

- Uses CMake as the build system with Ninja backend
- Requires `compile_commands.json` for clang-tidy (set `CMAKE_EXPORT_COMPILE_COMMANDS=ON`)
- vcpkg manifest mode for dependency management
- ASan and TSan cannot be combined; run as separate CI jobs
- Google Test is the primary test framework, CTest is the test runner
