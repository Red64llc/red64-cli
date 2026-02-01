# Testing Patterns

Comprehensive testing patterns for modern C++ projects with Google Test, Google Mock, and Google Benchmark.

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
    test_user_service.cpp
    test_payment_processor.cpp
    test_json_parser.cpp
  integration/
    test_database.cpp
    test_http_client.cpp
  fuzz/
    fuzz_json_parser.cpp
  benchmark/
    bench_serialization.cpp
  fixtures/
    test_data.json
```

**Pattern**: Mirror `src/` structure. Prefix all test files with `test_`. Register all tests in CTest.

---

## Google Test Basics

### TEST -- Simple Tests

```cpp
#include <gtest/gtest.h>
#include "math_utils.hpp"

TEST(MathUtils, AddPositiveNumbers) {
    EXPECT_EQ(add(2, 3), 5);
}

TEST(MathUtils, AddNegativeNumbers) {
    EXPECT_EQ(add(-1, -2), -3);
}

TEST(MathUtils, AddOverflowReturnsError) {
    auto result = safe_add(INT_MAX, 1);
    ASSERT_FALSE(result.has_value());
    EXPECT_EQ(result.error().code, ErrorCode::kOverflow);
}
```

### TEST_F -- Test Fixtures

```cpp
class UserServiceTest : public ::testing::Test {
protected:
    void SetUp() override {
        repo_ = std::make_shared<MockUserRepo>();
        service_ = std::make_unique<UserService>(repo_);
    }

    std::shared_ptr<MockUserRepo> repo_;
    std::unique_ptr<UserService> service_;
};

TEST_F(UserServiceTest, CreateUserSuccess) {
    // Arrange
    EXPECT_CALL(*repo_, find_by_email("alice@example.com"))
        .WillOnce(::testing::Return(std::nullopt));
    EXPECT_CALL(*repo_, save(::testing::_))
        .WillOnce(::testing::Return(User{.id = 1, .name = "Alice"}));

    // Act
    auto result = service_->create_user({"Alice", "alice@example.com"});

    // Assert
    ASSERT_TRUE(result.has_value());
    EXPECT_EQ(result->name, "Alice");
}

TEST_F(UserServiceTest, CreateUserDuplicateEmailReturnsError) {
    EXPECT_CALL(*repo_, find_by_email("taken@example.com"))
        .WillOnce(::testing::Return(User{.id = 1, .email = "taken@example.com"}));

    auto result = service_->create_user({"Bob", "taken@example.com"});

    ASSERT_FALSE(result.has_value());
    EXPECT_EQ(result.error().code, ErrorCode::kAlreadyExists);
}
```

### TEST_P -- Parameterized Tests

```cpp
struct ValidationCase {
    std::string input;
    bool expected_valid;
    std::string description;
};

class EmailValidationTest : public ::testing::TestWithParam<ValidationCase> {};

TEST_P(EmailValidationTest, ValidatesCorrectly) {
    const auto& [input, expected_valid, description] = GetParam();
    EXPECT_EQ(is_valid_email(input), expected_valid) << description;
}

INSTANTIATE_TEST_SUITE_P(
    EmailCases,
    EmailValidationTest,
    ::testing::Values(
        ValidationCase{"user@example.com", true, "standard email"},
        ValidationCase{"user@sub.example.com", true, "subdomain"},
        ValidationCase{"invalid", false, "no at sign"},
        ValidationCase{"", false, "empty string"},
        ValidationCase{"@example.com", false, "no local part"}
    )
);
```

---

## Google Mock

### Defining Mocks

```cpp
#include <gmock/gmock.h>

class UserRepo {
public:
    virtual ~UserRepo() = default;
    virtual std::optional<User> find_by_email(std::string_view email) = 0;
    virtual Result<User> save(const User& user) = 0;
    virtual std::vector<User> find_active() = 0;
};

class MockUserRepo : public UserRepo {
public:
    MOCK_METHOD(std::optional<User>, find_by_email, (std::string_view), (override));
    MOCK_METHOD(Result<User>, save, (const User&), (override));
    MOCK_METHOD(std::vector<User>, find_active, (), (override));
};
```

### Matchers and Actions

```cpp
using ::testing::_;
using ::testing::Return;
using ::testing::HasSubstr;
using ::testing::ElementsAre;
using ::testing::Field;

TEST_F(UserServiceTest, SavePassesCorrectData) {
    EXPECT_CALL(*repo_, find_by_email(_)).WillOnce(Return(std::nullopt));

    // Verify the saved user has the correct name
    EXPECT_CALL(*repo_, save(Field(&User::name, "Alice")))
        .WillOnce(Return(User{.id = 1, .name = "Alice"}));

    service_->create_user({"Alice", "alice@example.com"});
}
```

---

## Integration Testing

```cpp
class DatabaseIntegrationTest : public ::testing::Test {
protected:
    void SetUp() override {
        db_ = std::make_unique<Database>(":memory:");
        db_->migrate();
    }

    void TearDown() override {
        db_.reset();
    }

    std::unique_ptr<Database> db_;
};

TEST_F(DatabaseIntegrationTest, InsertAndRetrieveUser) {
    auto repo = UserRepo(*db_);

    auto saved = repo.save(User{.name = "Alice", .email = "alice@example.com"});
    ASSERT_TRUE(saved.has_value());

    auto found = repo.find_by_email("alice@example.com");
    ASSERT_TRUE(found.has_value());
    EXPECT_EQ(found->name, "Alice");
}
```

---

## Google Benchmark

```cpp
#include <benchmark/benchmark.h>
#include "serializer.hpp"

static void BM_JsonSerialize(benchmark::State& state) {
    auto user = User{.id = 1, .name = "Alice", .email = "alice@example.com"};
    for (auto _ : state) {
        auto json = serialize_to_json(user);
        benchmark::DoNotOptimize(json);
    }
}
BENCHMARK(BM_JsonSerialize);

static void BM_JsonDeserialize(benchmark::State& state) {
    auto json = R"({"id":1,"name":"Alice","email":"alice@example.com"})";
    for (auto _ : state) {
        auto user = deserialize_from_json<User>(json);
        benchmark::DoNotOptimize(user);
    }
}
BENCHMARK(BM_JsonDeserialize);

BENCHMARK_MAIN();
```

---

## Fuzz Testing with libFuzzer

```cpp
// fuzz/fuzz_json_parser.cpp
#include "json_parser.hpp"
#include <cstdint>
#include <cstddef>

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
    std::string_view input(reinterpret_cast<const char*>(data), size);
    auto result = parse_json(input);
    // If it does not crash or trigger sanitizers, the input is handled safely
    return 0;
}
```

```cmake
# CMakeLists.txt for fuzz targets
add_executable(fuzz_json_parser fuzz/fuzz_json_parser.cpp)
target_compile_options(fuzz_json_parser PRIVATE -fsanitize=fuzzer,address,undefined)
target_link_options(fuzz_json_parser PRIVATE -fsanitize=fuzzer,address,undefined)
```

```bash
# Run fuzzer
./build/fuzz_json_parser corpus/ -max_total_time=60
```

---

## CMake Test Integration

```cmake
# tests/CMakeLists.txt
include(GoogleTest)

add_executable(unit_tests
    unit/test_user_service.cpp
    unit/test_payment_processor.cpp
)
target_link_libraries(unit_tests PRIVATE
    GTest::gtest_main
    GTest::gmock
    myapp_lib
)

gtest_discover_tests(unit_tests)
```

---

## Test Commands

```bash
# Fast feedback
ctest --test-dir build -R unit --output-on-failure    # Unit tests only
ctest --test-dir build -R "UserService" -V            # Single suite, verbose

# Full suite
ctest --test-dir build --output-on-failure

# With sanitizers
cmake --build build-asan && ctest --test-dir build-asan --output-on-failure

# Benchmarks (not in CTest by default)
./build/bench/bench_serialization --benchmark_format=json
```

---

## Test Markers (CTest Labels)

```cmake
set_tests_properties(unit_tests PROPERTIES LABELS "unit")
set_tests_properties(integration_tests PROPERTIES LABELS "integration")
```

```bash
ctest --test-dir build -L unit           # Run only unit tests
ctest --test-dir build -L integration    # Run only integration tests
```

---

_Tests document behavior. Each test should read as a specification of what the code does._
