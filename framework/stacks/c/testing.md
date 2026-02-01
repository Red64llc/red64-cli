# Testing Patterns

Comprehensive testing patterns for C projects with Unity (primary) and CMocka (alternative) test frameworks.

---

## Philosophy

- **Fast feedback**: Unit tests run in milliseconds, no I/O
- **Arrange-Act-Assert**: Every test follows the same three-step structure
- **Test behavior, not implementation**: Tests should survive refactoring
- **Sanitizers always on**: Run tests under ASan + UBSan in CI

---

## Test Organization

```
tests/
  CMakeLists.txt
  unit/
    test_user.c
    test_config.c
    test_parser.c
  integration/
    test_database.c
    test_http_client.c
  fuzz/
    fuzz_parser.c
  fixtures/
    sample_config.json
    test_data.bin
```

**Pattern**: Mirror `src/` structure. Prefix all test files with `test_`. Register all tests in CTest.

---

## Unity Test Framework (Primary)

### Basic Test Structure

```c
#include "unity.h"
#include "myproject/math_utils.h"

void setUp(void) {
    /* Called before each test -- allocate shared resources */
}

void tearDown(void) {
    /* Called after each test -- free shared resources */
}

void test_add_positive_numbers(void) {
    /* Arrange & Act */
    int result = add(2, 3);

    /* Assert */
    TEST_ASSERT_EQUAL_INT(5, result);
}

void test_add_negative_numbers(void) {
    TEST_ASSERT_EQUAL_INT(-3, add(-1, -2));
}

void test_add_overflow_returns_error(void) {
    int result;
    int rc = safe_add(INT_MAX, 1, &result);

    TEST_ASSERT_EQUAL_INT(ERR_OVERFLOW, rc);
}

int main(void) {
    UNITY_BEGIN();
    RUN_TEST(test_add_positive_numbers);
    RUN_TEST(test_add_negative_numbers);
    RUN_TEST(test_add_overflow_returns_error);
    return UNITY_END();
}
```

### Common TEST_ASSERT Macros

| Macro | Purpose |
|---|---|
| `TEST_ASSERT_EQUAL_INT(expected, actual)` | Compare integers |
| `TEST_ASSERT_EQUAL_STRING(expected, actual)` | Compare null-terminated strings |
| `TEST_ASSERT_EQUAL_FLOAT(expected, actual, delta)` | Compare floats within tolerance |
| `TEST_ASSERT_EQUAL_PTR(expected, actual)` | Compare pointers |
| `TEST_ASSERT_EQUAL_MEMORY(expected, actual, len)` | Compare raw memory |
| `TEST_ASSERT_NULL(ptr)` | Assert pointer is NULL |
| `TEST_ASSERT_NOT_NULL(ptr)` | Assert pointer is not NULL |
| `TEST_ASSERT_TRUE(condition)` | Assert boolean true |
| `TEST_ASSERT_FALSE(condition)` | Assert boolean false |
| `TEST_ASSERT_EQUAL_INT_ARRAY(exp, act, len)` | Compare integer arrays |

### setUp / tearDown with Resources

```c
static db_t *test_db = NULL;
static user_repo_t *test_repo = NULL;

void setUp(void) {
    test_db = db_open(":memory:");
    TEST_ASSERT_NOT_NULL(test_db);
    db_migrate(test_db);
    test_repo = user_repo_create(test_db);
    TEST_ASSERT_NOT_NULL(test_repo);
}

void tearDown(void) {
    user_repo_destroy(test_repo);
    test_repo = NULL;
    db_close(test_db);
    test_db = NULL;
}

void test_create_user_success(void) {
    /* Arrange */
    create_request_t req = {.name = "Alice", .email = "alice@example.com"};
    user_t user = {0};

    /* Act */
    int rc = user_repo_create_user(test_repo, &req, &user);

    /* Assert */
    TEST_ASSERT_EQUAL_INT(ERR_OK, rc);
    TEST_ASSERT_EQUAL_STRING("Alice", user.name);
    TEST_ASSERT_TRUE(user.id > 0);
}

void test_create_user_duplicate_email(void) {
    create_request_t req = {.name = "Alice", .email = "alice@example.com"};
    user_t user = {0};

    user_repo_create_user(test_repo, &req, &user);  /* First create */
    int rc = user_repo_create_user(test_repo, &req, &user);  /* Duplicate */

    TEST_ASSERT_EQUAL_INT(ERR_ALREADY_EXISTS, rc);
}
```

---

## CMocka Alternative

### Basic CMocka Test

```c
#include <stdarg.h>
#include <stddef.h>
#include <setjmp.h>
#include <cmocka.h>

#include "myproject/config.h"

static void test_config_load_valid(void **state) {
    (void)state;

    config_t cfg = {0};
    int rc = config_load("fixtures/valid.json", &cfg);

    assert_int_equal(ERR_OK, rc);
    assert_string_equal("localhost", cfg.host);
    assert_int_equal(8080, cfg.port);

    config_free(&cfg);
}

static void test_config_load_missing_file(void **state) {
    (void)state;

    config_t cfg = {0};
    int rc = config_load("nonexistent.json", &cfg);

    assert_int_equal(ERR_IO, rc);
}

int main(void) {
    const struct CMUnitTest tests[] = {
        cmocka_unit_test(test_config_load_valid),
        cmocka_unit_test(test_config_load_missing_file),
    };
    return cmocka_run_group_tests(tests, NULL, NULL);
}
```

### CMocka with Setup/Teardown

```c
static int setup_db(void **state) {
    db_t *db = db_open(":memory:");
    if (!db) return -1;
    db_migrate(db);
    *state = db;
    return 0;
}

static int teardown_db(void **state) {
    db_close((db_t *)*state);
    return 0;
}

static void test_insert_record(void **state) {
    db_t *db = (db_t *)*state;
    int rc = db_insert(db, "test_key", "test_value");
    assert_int_equal(ERR_OK, rc);
}

int main(void) {
    const struct CMUnitTest tests[] = {
        cmocka_unit_test_setup_teardown(test_insert_record, setup_db, teardown_db),
    };
    return cmocka_run_group_tests(tests, NULL, NULL);
}
```

---

## Mocking with Function Pointers

In C, dependency injection is achieved via function pointers or vtable-like structs.

```c
/* GOOD: Define an interface via function pointer struct */
typedef struct {
    int (*find_by_email)(void *ctx, const char *email, user_t *out);
    int (*save)(void *ctx, const user_t *user);
    void *ctx;
} user_repo_iface_t;

/* Production implementation */
static int pg_find_by_email(void *ctx, const char *email, user_t *out) {
    pg_conn_t *conn = (pg_conn_t *)ctx;
    /* ... real database query ... */
    return ERR_OK;
}

/* Test mock implementation */
static user_t mock_user;
static int mock_save_called = 0;

static int mock_find_by_email(void *ctx, const char *email, user_t *out) {
    (void)ctx;
    if (strcmp(email, "alice@example.com") == 0) {
        *out = mock_user;
        return ERR_OK;
    }
    return ERR_NOT_FOUND;
}

static int mock_save(void *ctx, const user_t *user) {
    (void)ctx;
    mock_save_called = 1;
    mock_user = *user;
    return ERR_OK;
}

/* In test */
void test_create_user_calls_save(void) {
    mock_save_called = 0;
    user_repo_iface_t repo = {
        .find_by_email = mock_find_by_email,
        .save = mock_save,
        .ctx = NULL,
    };

    create_request_t req = {.name = "Bob", .email = "bob@example.com"};
    user_t result = {0};
    int rc = user_service_create(&repo, &req, &result);

    TEST_ASSERT_EQUAL_INT(ERR_OK, rc);
    TEST_ASSERT_TRUE(mock_save_called);
    TEST_ASSERT_EQUAL_STRING("Bob", mock_user.name);
}
```

### CMock (Auto-Generated Mocks for Unity)

```bash
# CMock parses headers and generates mock .c/.h files
ruby vendor/cmock/lib/cmock.rb include/myproject/user_repo.h

# Generates:
#   mocks/mock_user_repo.h
#   mocks/mock_user_repo.c
```

```c
/* Using CMock-generated mocks */
#include "mock_user_repo.h"

void test_service_returns_not_found(void) {
    /* Expect find_by_email to be called and return NOT_FOUND */
    user_repo_find_by_email_ExpectAndReturn("unknown@example.com", NULL, ERR_NOT_FOUND);

    int rc = user_service_find("unknown@example.com", NULL);
    TEST_ASSERT_EQUAL_INT(ERR_NOT_FOUND, rc);
}
```

---

## Integration Testing

```c
/* Integration tests use real dependencies (database, filesystem) */
static char test_dir[256];

void setUp(void) {
    snprintf(test_dir, sizeof(test_dir), "/tmp/test_%d", getpid());
    mkdir(test_dir, 0755);
}

void tearDown(void) {
    /* Clean up test directory */
    char cmd[512];
    snprintf(cmd, sizeof(cmd), "rm -rf %s", test_dir);
    system(cmd);
}

void test_config_save_and_load_roundtrip(void) {
    char path[512];
    snprintf(path, sizeof(path), "%s/config.json", test_dir);

    config_t original = {.host = "localhost", .port = 8080, .debug = true};
    int rc = config_save(&original, path);
    TEST_ASSERT_EQUAL_INT(ERR_OK, rc);

    config_t loaded = {0};
    rc = config_load(path, &loaded);
    TEST_ASSERT_EQUAL_INT(ERR_OK, rc);
    TEST_ASSERT_EQUAL_STRING("localhost", loaded.host);
    TEST_ASSERT_EQUAL_INT(8080, loaded.port);
    TEST_ASSERT_TRUE(loaded.debug);

    config_free(&loaded);
}
```

---

## Fuzz Testing with libFuzzer

```c
/* fuzz/fuzz_parser.c */
#include "myproject/parser.h"
#include <stdint.h>
#include <stddef.h>

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
    /* Null-terminate input for string-based parsers */
    char *input = malloc(size + 1);
    if (!input) return 0;
    memcpy(input, data, size);
    input[size] = '\0';

    result_t result = {0};
    parse(input, &result);
    result_free(&result);
    free(input);
    return 0;
}
```

```cmake
add_executable(fuzz_parser fuzz/fuzz_parser.c)
target_compile_options(fuzz_parser PRIVATE -fsanitize=fuzzer,address,undefined)
target_link_options(fuzz_parser PRIVATE -fsanitize=fuzzer,address,undefined)
target_link_libraries(fuzz_parser PRIVATE myapp_lib)
```

---

## Coverage with gcov / lcov

```bash
# Build with coverage
cmake -B build-cov -DCMAKE_BUILD_TYPE=Debug \
    -DCMAKE_C_FLAGS="--coverage"
cmake --build build-cov

# Run tests
ctest --test-dir build-cov --output-on-failure

# Generate HTML report
lcov --capture --directory build-cov --output-file coverage.info
lcov --remove coverage.info '/usr/*' '*/test/*' '*/vendor/*' --output-file coverage.info
genhtml coverage.info --output-directory coverage-report/

# Console summary
gcovr --root . --print-summary
```

---

## CTest Integration

```cmake
# tests/CMakeLists.txt
enable_testing()

# Unity-based tests
add_executable(test_user tests/unit/test_user.c)
target_link_libraries(test_user PRIVATE unity myapp_lib)
add_test(NAME unit_user COMMAND test_user)
set_tests_properties(unit_user PROPERTIES LABELS "unit")

add_executable(test_config tests/unit/test_config.c)
target_link_libraries(test_config PRIVATE unity myapp_lib)
add_test(NAME unit_config COMMAND test_config)
set_tests_properties(unit_config PROPERTIES LABELS "unit")

# Integration tests
add_executable(test_database tests/integration/test_database.c)
target_link_libraries(test_database PRIVATE unity myapp_lib)
add_test(NAME integration_database COMMAND test_database)
set_tests_properties(integration_database PROPERTIES LABELS "integration")
```

```bash
# Run by label
ctest --test-dir build -L unit --output-on-failure
ctest --test-dir build -L integration --output-on-failure

# Run specific test
ctest --test-dir build -R "unit_user" -V

# Run all tests
ctest --test-dir build --output-on-failure
```

---

## Test Commands Summary

```bash
# Fast feedback
ctest --test-dir build -L unit --output-on-failure    # Unit tests only
ctest --test-dir build -R "unit_user" -V              # Single suite, verbose

# Full suite
ctest --test-dir build --output-on-failure

# With sanitizers
cmake --build build-asan && ctest --test-dir build-asan --output-on-failure

# Fuzz testing
./build/fuzz_parser corpus/ -max_total_time=60

# Coverage
cmake --build build-cov && ctest --test-dir build-cov && gcovr --root . --print-summary
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Tests that depend on execution order | Flaky, fragile | Independent setUp/tearDown per test |
| Testing private/static functions directly | Couples tests to implementation | Test through public API |
| No tearDown cleanup | Memory leaks obscure real bugs | Free all resources in tearDown |
| Mocking everything | Tests pass but code is broken | Mock boundaries only (I/O, network, DB) |
| No sanitizers during test | Memory bugs hide | ASan + UBSan on every CI test run |
| Giant test functions | Hard to diagnose failures | One assertion per logical behavior |
| No integration tests | Unit tests pass, system fails | Test real dependencies in integration suite |

---

_Tests document behavior. Each test should read as a specification of what the code does. Name tests after the scenario, not the function._
