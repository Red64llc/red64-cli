# Feedback Configuration

Project-specific commands for automated feedback during C implementation.

---

## Build Commands

Commands to build the project during implementation.

```yaml
# Primary build command (REQUIRED)
build: cmake --build build

# Configure (first time or after CMakeLists changes)
configure: cmake --preset default

# Configure debug
configure_debug: cmake --preset debug

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
static_analysis: cppcheck --project=build/compile_commands.json --std=c17 --enable=all --error-exitcode=1
```

---

## Format Commands

Commands for code formatting.

```yaml
# Format check (CI)
format_check: clang-format --dry-run --Werror $(find src include -name '*.c' -o -name '*.h')

# Format fix
format: clang-format -i $(find src include -name '*.c' -o -name '*.h')
```

---

## Sanitizer Builds

Commands for sanitizer-instrumented builds.

```yaml
# ASan + UBSan build and test
test_asan: cmake --preset asan && cmake --build build-asan && ctest --test-dir build-asan --output-on-failure

# TSan build and test
test_tsan: cmake --preset tsan && cmake --build build-tsan && ctest --test-dir build-tsan --output-on-failure

# MSan build and test (Clang only)
test_msan: cmake -B build-msan -DCMAKE_C_FLAGS="-fsanitize=memory -fno-omit-frame-pointer" && cmake --build build-msan && ctest --test-dir build-msan --output-on-failure
```

---

## Coverage Commands

Commands for code coverage reporting.

```yaml
# Build with coverage
build_coverage: cmake --preset coverage && cmake --build build-coverage

# Run tests and generate report
coverage: cmake --build build-coverage && ctest --test-dir build-coverage --output-on-failure && lcov --capture --directory build-coverage --output-file coverage.info && lcov --remove coverage.info '/usr/*' '*/test/*' '*/vendor/*' --output-file coverage.info && genhtml coverage.info --output-directory coverage-report/

# Quick coverage summary
coverage_summary: cmake --build build-coverage && ctest --test-dir build-coverage && gcovr --root . --print-summary
```

---

## Valgrind Commands

Commands for memory checking with Valgrind.

```yaml
# Full leak check on executable
valgrind: valgrind --leak-check=full --show-leak-kinds=all --track-origins=yes --error-exitcode=1 ./build/myapp

# Valgrind on test binary
valgrind_tests: valgrind --leak-check=full --show-leak-kinds=all --error-exitcode=1 ./build/tests/test_user
```

---

## Packaging Commands

Commands for packaging with CPack.

```yaml
# Generate package
package: cd build && cpack

# Generate specific package type
package_tar: cd build && cpack -G TGZ
package_deb: cd build && cpack -G DEB
package_rpm: cd build && cpack -G RPM
```

---

## Notes

- Uses CMake as the build system with Ninja backend
- Requires `compile_commands.json` for clang-tidy (set `CMAKE_EXPORT_COMPILE_COMMANDS=ON`)
- vcpkg or Conan for dependency management
- ASan and TSan cannot be combined; run as separate CI jobs
- Unity is the primary test framework, CTest is the test runner
- Valgrind and ASan serve similar purposes; use ASan in CI for speed, Valgrind for deep investigation
