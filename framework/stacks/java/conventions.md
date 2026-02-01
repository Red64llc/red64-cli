# Development Conventions

General development practices, workflow, and operational standards for Java 21+ projects with Spring Boot and Gradle Kotlin DSL.

---

## Philosophy

- **Predictable process**: Consistent project structure and naming reduce friction
- **Build reproducibility**: Gradle wrapper + dependency locking for deterministic builds
- **Configuration as records**: Type-safe configuration with `@ConfigurationProperties` and records
- **Feature packaging**: Organize by feature (domain), not by technical layer

---

## Gradle Kotlin DSL Project Structure

### Single Module

```
my-app/
  build.gradle.kts
  settings.gradle.kts
  gradle/
    wrapper/
      gradle-wrapper.jar
      gradle-wrapper.properties
    libs.versions.toml          # Version catalog
  config/
    checkstyle/
      google_checks.xml
    spotbugs/
      exclude.xml
  src/
    main/
      java/com/example/myapp/
      resources/
        application.yml
        application-dev.yml
        application-prod.yml
        db/migration/            # Flyway migrations
    test/
      java/com/example/myapp/
      resources/
        application-test.yml
  gradlew
  gradlew.bat
  .java-version                  # sdkman or jenv
```

### Multi-Module

```
my-platform/
  settings.gradle.kts
  build.gradle.kts               # root: shared config
  gradle/libs.versions.toml
  app/
    build.gradle.kts             # Spring Boot application
  domain/
    build.gradle.kts             # Pure Java domain models
  infrastructure/
    build.gradle.kts             # JPA, external clients
  common/
    build.gradle.kts             # Shared utilities
```

```kotlin
// settings.gradle.kts
rootProject.name = "my-platform"
include("app", "domain", "infrastructure", "common")
```

```kotlin
// app/build.gradle.kts
dependencies {
    implementation(project(":domain"))
    implementation(project(":infrastructure"))
}
```

---

## Dependency Management

### Version Catalog (gradle/libs.versions.toml)

```toml
[versions]
spring-boot = "3.4.1"
testcontainers = "1.20.4"
archunit = "1.3.0"
assertj = "3.27.0"

[libraries]
spring-boot-starter-web = { module = "org.springframework.boot:spring-boot-starter-web" }
spring-boot-starter-data-jpa = { module = "org.springframework.boot:spring-boot-starter-data-jpa" }
spring-boot-starter-validation = { module = "org.springframework.boot:spring-boot-starter-validation" }
spring-boot-starter-test = { module = "org.springframework.boot:spring-boot-starter-test" }
testcontainers-postgresql = { module = "org.testcontainers:postgresql", version.ref = "testcontainers" }
testcontainers-junit = { module = "org.testcontainers:junit-jupiter", version.ref = "testcontainers" }
archunit = { module = "com.tngtech.archunit:archunit-junit5", version.ref = "archunit" }
assertj = { module = "org.assertj:assertj-core", version.ref = "assertj" }

[plugins]
spring-boot = { id = "org.springframework.boot", version.ref = "spring-boot" }
spring-dependency-management = { id = "io.spring.dependency-management", version = "1.1.7" }
```

```kotlin
// build.gradle.kts
dependencies {
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.testcontainers.postgresql)
    testImplementation(libs.archunit)
}
```

### Platform/BOM for Consistency

```kotlin
// build.gradle.kts
dependencies {
    implementation(platform("org.springframework.boot:spring-boot-dependencies:3.4.1"))
    implementation(platform("org.testcontainers:testcontainers-bom:1.20.4"))
}
```

---

## Package Organization (By Feature)

```java
// GOOD: Organized by feature/domain
com.example.myapp/
  user/
    UserController.java
    UserService.java
    UserRepository.java
    User.java                    // entity
    dto/
      CreateUserRequest.java     // record
      UserResponse.java          // record
  order/
    OrderController.java
    OrderService.java
    OrderRepository.java
    Order.java
    dto/
      CreateOrderRequest.java
  common/
    exception/
      AppException.java
      GlobalExceptionHandler.java
    config/
      SecurityConfig.java
      JacksonConfig.java

// BAD: Organized by technical layer
com.example.myapp/
  controller/
    UserController.java
    OrderController.java
  service/
    UserService.java
    OrderService.java
  repository/
    UserRepository.java
    OrderRepository.java
  model/
    User.java
    Order.java
```

**Why feature-based**: Changes to a feature touch files in one package. Layer-based requires changes across the entire tree.

---

## Spring Profiles

### Profile Configuration

```yaml
# application.yml (shared defaults)
spring:
  application:
    name: my-app
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate

# application-dev.yml
spring:
  jpa:
    show-sql: true
    hibernate:
      ddl-auto: update
  devtools:
    restart:
      enabled: true
logging:
  level:
    com.example: DEBUG
    org.hibernate.SQL: DEBUG

# application-prod.yml
spring:
  jpa:
    show-sql: false
server:
  tomcat:
    threads:
      max: 200
    accept-count: 100
logging:
  level:
    root: WARN
    com.example: INFO

# application-test.yml
spring:
  jpa:
    hibernate:
      ddl-auto: create-drop
```

### Activating Profiles

```bash
# Environment variable (preferred in production)
SPRING_PROFILES_ACTIVE=prod ./gradlew bootRun

# Command line
./gradlew bootRun --args='--spring.profiles.active=dev'

# In tests (automatic)
# application-test.yml is loaded when spring.profiles.active=test
```

---

## @ConfigurationProperties with Records

```java
// GOOD: Type-safe, immutable configuration with records (Spring Boot 3.x)
@ConfigurationProperties(prefix = "app")
public record AppProperties(
    String name,
    @DefaultValue("false") boolean debug,
    DatabaseProperties database,
    AuthProperties auth
) {
    public record DatabaseProperties(
        String url,
        @DefaultValue("20") int poolSize,
        @DefaultValue("10") int maxOverflow
    ) {}

    public record AuthProperties(
        String secretKey,
        @DefaultValue("15") int accessTokenExpireMinutes
    ) {}
}

// Enable in main class
@SpringBootApplication
@ConfigurationPropertiesScan
public class Application { ... }
```

```yaml
# application.yml
app:
  name: my-app
  debug: false
  database:
    url: jdbc:postgresql://localhost:5432/myapp
    pool-size: 20
  auth:
    secret-key: ${AUTH_SECRET_KEY}
    access-token-expire-minutes: 15
```

```java
// BAD: @Value scattered across classes
@Service
public class UserService {
    @Value("${app.auth.secret-key}") private String secretKey;      // no type safety
    @Value("${app.auth.expire:15}") private int expireMinutes;      // magic strings
}
```

---

## Conventional Commits

### Format

```
{type}({scope}): {short description}

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

### Examples

```
feat(user): add email verification endpoint
fix(order): prevent duplicate payment processing
refactor(common): extract retry logic to shared utility
test(user): add integration tests for registration flow
chore: upgrade Spring Boot to 3.4.1
```

**Rule**: One logical change per commit. If the commit message needs "and", split it.

---

## Documentation with Javadoc

### When to Write Javadoc

| Element | Javadoc Required? |
|---|---|
| Public class | Yes |
| Public method | Yes |
| Public record | Yes (fields documented via `@param`) |
| Package (`package-info.java`) | Yes for feature packages |
| Private/internal methods | Only if non-obvious |
| Tests | No (test name is the doc) |

### Javadoc Style

```java
/**
 * Service for user account management.
 *
 * <p>Handles registration, authentication, and profile operations.
 * Delegates data access to {@link UserRepository}.
 */
@Service
public class UserService {

    /**
     * Creates a new user account.
     *
     * <p>Validates email uniqueness and hashes the password before persisting.
     *
     * @param request validated creation request with email, name, and password
     * @return the created user with generated ID and timestamps
     * @throws ConflictException if the email is already registered
     */
    public User createUser(CreateUserRequest request) { ... }
}

/**
 * Immutable user creation request.
 *
 * @param email user's email address, must be unique
 * @param name display name
 * @param password plain-text password (will be hashed)
 */
public record CreateUserRequest(
    @NotBlank String email,
    @NotBlank String name,
    @Size(min = 8) String password
) {}
```

---

## Virtual Threads (Java 21+)

### Spring Boot Configuration

```yaml
# application.yml -- enable virtual threads for request handling
spring:
  threads:
    virtual:
      enabled: true
```

```java
// GOOD: Blocking code is fine with virtual threads -- no reactive needed
@Service
public class UserService {

    public User getUser(Long id) {
        // This blocks a virtual thread (cheap), not a platform thread
        return userRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("User", id));
    }
}

// BAD: Using reactive (WebFlux) when virtual threads suffice
public Mono<User> getUser(Long id) {
    return userRepository.findById(id)
        .switchIfEmpty(Mono.error(new NotFoundException("User", id)));
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Layer-based packaging | Feature changes touch every package | Package by feature/domain |
| `@Value` for config | No validation, scattered, magic strings | `@ConfigurationProperties` records |
| Groovy build scripts | No type safety, poor IDE support | Gradle Kotlin DSL |
| No version catalog | Versions scattered across build files | `gradle/libs.versions.toml` |
| Hardcoded profile values | Cannot change per environment | Spring profiles + env variables |
| Reactive when not needed | Complexity without benefit | Virtual threads for I/O concurrency |
| No `package-info.java` | Missing `@NonNullApi`, no package docs | Add to every feature package |

---

_Conventions reduce cognitive load. Follow them consistently so the team can focus on solving problems, not debating structure._
