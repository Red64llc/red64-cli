# Testing Patterns

Comprehensive JUnit 5 testing patterns for Java 21+ with Spring Boot, Mockito, AssertJ, and Testcontainers.

---

## Philosophy

- **Fast feedback**: Unit tests run in milliseconds with no I/O
- **Production parity**: Integration tests use real databases via Testcontainers
- **Readable tests**: Each test tells a story with arrange-act-assert and `@DisplayName`
- **Test slices**: Use Spring test slices (`@WebMvcTest`, `@DataJpaTest`) to keep tests fast and focused

---

## Test Organization

```
src/test/java/com/example/
  unit/
    service/
      UserServiceTest.java
      PaymentServiceTest.java
    util/
      SlugGeneratorTest.java
  integration/
    api/
      UserControllerIntegrationTest.java
    repository/
      UserRepositoryIntegrationTest.java
  architecture/
    ArchitectureTest.java
  support/
    TestContainersConfig.java
    TestDataFactory.java
```

**Pattern**: Mirror `src/main/java` structure. Suffix all test classes with `Test`.

---

## JUnit 5 Fundamentals

### @Test and @DisplayName

```java
class UserServiceTest {

    @Test
    @DisplayName("should create user when email is unique")
    void createUser_uniqueEmail_returnsUser() {
        // Arrange
        var request = new CreateUserRequest("alice@example.com", "Alice");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            var user = inv.getArgument(0, User.class);
            user.setId(1L);
            return user;
        });

        // Act
        var result = userService.createUser(request);

        // Assert
        assertThat(result.getEmail()).isEqualTo("alice@example.com");
        assertThat(result.getId()).isNotNull();
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("should throw ConflictException when email already exists")
    void createUser_duplicateEmail_throwsConflict() {
        var request = new CreateUserRequest("taken@example.com", "Bob");
        when(userRepository.findByEmail("taken@example.com"))
            .thenReturn(Optional.of(new User("taken@example.com", "Existing")));

        assertThatThrownBy(() -> userService.createUser(request))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("already registered");
    }
}
```

### @Nested for Grouping

```java
class PostServiceTest {

    @Nested
    @DisplayName("publish()")
    class Publish {

        @Test
        @DisplayName("should publish draft post")
        void draft_publishes() { ... }

        @Test
        @DisplayName("should throw when post is already published")
        void alreadyPublished_throwsConflict() { ... }

        @Test
        @DisplayName("should throw when user is not the author")
        void wrongAuthor_throwsForbidden() { ... }
    }

    @Nested
    @DisplayName("delete()")
    class Delete {

        @Test
        @DisplayName("should soft-delete post")
        void validPost_softDeletes() { ... }
    }
}
```

### @ParameterizedTest

```java
class EmailValidatorTest {

    @ParameterizedTest(name = "\"{0}\" should be {1}")
    @CsvSource({
        "user@example.com, true",
        "user@sub.example.com, true",
        "invalid, false",
        "'', false",
        "@example.com, false",
    })
    @DisplayName("should validate email format")
    void validateEmail(String email, boolean expectedValid) {
        assertThat(EmailValidator.isValid(email)).isEqualTo(expectedValid);
    }

    @ParameterizedTest
    @MethodSource("rolePermissions")
    @DisplayName("should check role permissions")
    void checkPermission(Role role, Permission permission, boolean expected) {
        assertThat(role.hasPermission(permission)).isEqualTo(expected);
    }

    static Stream<Arguments> rolePermissions() {
        return Stream.of(
            Arguments.of(Role.ADMIN, Permission.DELETE, true),
            Arguments.of(Role.USER, Permission.DELETE, false),
            Arguments.of(Role.USER, Permission.READ, true)
        );
    }
}
```

---

## AssertJ Fluent Assertions

```java
// GOOD: AssertJ -- fluent, readable, great error messages
assertThat(user.getEmail()).isEqualTo("alice@example.com");
assertThat(users).hasSize(3)
    .extracting(User::getEmail)
    .containsExactly("alice@example.com", "bob@example.com", "carol@example.com");

assertThat(result).isNotNull()
    .satisfies(r -> {
        assertThat(r.getStatus()).isEqualTo(Status.ACTIVE);
        assertThat(r.getCreatedAt()).isBeforeOrEqualTo(Instant.now());
    });

assertThatThrownBy(() -> service.getUser(999L))
    .isInstanceOf(NotFoundException.class)
    .hasMessageContaining("User not found");

assertThat(optionalUser).isPresent()
    .get()
    .extracting(User::getName)
    .isEqualTo("Alice");

// BAD: JUnit assertions -- less readable, worse error messages
assertEquals("alice@example.com", user.getEmail());
assertTrue(users.size() == 3);
assertNotNull(result);
```

---

## Mockito

### Setup with @Mock and @InjectMocks

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    @Test
    void getUser_existing_returnsUser() {
        // given
        var user = new User("alice@example.com", "Alice");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        // when
        var result = userService.getUser(1L);

        // then
        assertThat(result.getEmail()).isEqualTo("alice@example.com");
        verify(userRepository).findById(1L);
        verifyNoMoreInteractions(userRepository);
    }
}
```

### BDD Style (given/when/then)

```java
import static org.mockito.BDDMockito.*;

@Test
void createUser_hashesPassword() {
    // given
    given(passwordEncoder.encode("rawPassword")).willReturn("hashedPassword");
    given(userRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

    // when
    var user = userService.createUser(new CreateUserRequest("a@b.com", "Alice", "rawPassword"));

    // then
    then(passwordEncoder).should().encode("rawPassword");
    assertThat(user.getHashedPassword()).isEqualTo("hashedPassword");
}
```

### Argument Captors

```java
@Test
void createUser_savesCorrectEntity() {
    var captor = ArgumentCaptor.forClass(User.class);
    given(userRepository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

    userService.createUser(new CreateUserRequest("a@b.com", "Alice", "pw"));

    var saved = captor.getValue();
    assertThat(saved.getEmail()).isEqualTo("a@b.com");
    assertThat(saved.getName()).isEqualTo("Alice");
}
```

---

## Testcontainers (Integration Tests)

### Shared Container Configuration

```java
// src/test/java/com/example/support/TestContainersConfig.java
@TestConfiguration(proxyBeanMethods = false)
public class TestContainersConfig {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgresContainer() {
        return new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");
    }

    @Bean
    @ServiceConnection
    GenericContainer<?> redisContainer() {
        return new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);
    }
}
```

### Integration Test Base

```java
@SpringBootTest
@Import(TestContainersConfig.class)
@Transactional  // rolls back after each test
abstract class IntegrationTestBase {
}
```

### Repository Integration Test

```java
class UserRepositoryIntegrationTest extends IntegrationTestBase {

    @Autowired
    private UserRepository userRepository;

    @Test
    @DisplayName("should save and find user by email")
    void saveAndFindByEmail() {
        var user = new User("test@example.com", "Test User");
        userRepository.save(user);

        var found = userRepository.findByEmail("test@example.com");

        assertThat(found).isPresent()
            .get()
            .satisfies(u -> {
                assertThat(u.getId()).isNotNull();
                assertThat(u.getEmail()).isEqualTo("test@example.com");
            });
    }
}
```

---

## Spring Test Slices

### @WebMvcTest (Controller Layer)

```java
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @Test
    @DisplayName("GET /api/v1/users/{id} returns user")
    void getUser_existing_returns200() throws Exception {
        var user = new UserResponse(1L, "alice@example.com", "Alice", Instant.now());
        when(userService.getUser(1L)).thenReturn(user);

        mockMvc.perform(get("/api/v1/users/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("alice@example.com"))
            .andExpect(jsonPath("$.name").value("Alice"));
    }

    @Test
    @DisplayName("GET /api/v1/users/{id} returns 404 when not found")
    void getUser_notFound_returns404() throws Exception {
        when(userService.getUser(999L)).thenThrow(new NotFoundException("User", 999L));

        mockMvc.perform(get("/api/v1/users/999"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.title").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("POST /api/v1/users validates request body")
    void createUser_invalidBody_returns422() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email": "", "name": ""}
                    """))
            .andExpect(status().isUnprocessableEntity());
    }
}
```

### @DataJpaTest (Repository Layer)

```java
@DataJpaTest
@Import(TestContainersConfig.class)
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("should find active users by role")
    void findActiveByRole() {
        entityManager.persist(new User("admin@test.com", "Admin", Role.ADMIN, true));
        entityManager.persist(new User("user@test.com", "User", Role.USER, true));
        entityManager.persist(new User("inactive@test.com", "Inactive", Role.ADMIN, false));
        entityManager.flush();

        var admins = userRepository.findByRoleAndActiveTrue(Role.ADMIN);

        assertThat(admins).hasSize(1)
            .extracting(User::getEmail)
            .containsExactly("admin@test.com");
    }
}
```

---

## JaCoCo Coverage

### Gradle Configuration

```kotlin
// build.gradle.kts
plugins {
    id("jacoco")
}

jacoco {
    toolVersion = "0.8.12"
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required.set(true)   // for SonarQube
        html.required.set(true)  // for humans
    }
}

tasks.jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                minimum = "0.80".toBigDecimal()
            }
        }
        rule {
            element = "CLASS"
            excludes = listOf(
                "*.dto.*",
                "*.config.*",
                "*.Application"
            )
            limit {
                minimum = "0.80".toBigDecimal()
            }
        }
    }
}

tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)
}
```

```bash
./gradlew test jacocoTestReport           # Generate coverage report
./gradlew jacocoTestCoverageVerification  # Enforce thresholds
# Report: build/reports/jacoco/test/html/index.html
```

---

## Test Naming Convention

| Pattern | Example |
|---|---|
| `methodUnderTest_scenario_expectedBehavior` | `createUser_duplicateEmail_throwsConflict` |
| `@DisplayName` for human-readable output | `"should throw ConflictException when email exists"` |
| `@Nested` class name = method being tested | `class Publish { ... }` |

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| No `@DisplayName` | Test output is unreadable | Always add descriptive display names |
| JUnit `assertEquals` over AssertJ | Worse error messages, less fluent | Use `assertThat()` from AssertJ |
| H2 for integration tests | Behavior differs from PostgreSQL | Testcontainers with real PostgreSQL |
| `@SpringBootTest` for unit tests | Slow startup, tests entire context | `@ExtendWith(MockitoExtension.class)` |
| Testing implementation, not behavior | Fragile tests that break on refactor | Test public API and outcomes |
| No test slices | Full context loaded for every test | `@WebMvcTest`, `@DataJpaTest` |
| Shared mutable state between tests | Order-dependent, flaky tests | `@Transactional` rollback, fresh fixtures |
| `@Autowired` fields in unit tests | Requires Spring context | `@Mock` + `@InjectMocks` |

---

_Tests document behavior. Each test should read as a specification: given this state, when this action, then this outcome._
