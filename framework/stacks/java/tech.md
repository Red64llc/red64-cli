# Technology Stack

## Architecture

Modern Java application with virtual-thread-first design. Spring Boot 3.x or Quarkus as web framework, PostgreSQL for persistence, Redis for caching, Docker for deployment.

---

## Core Technologies

- **Language**: Java 21+ (LTS)
- **Build Tool**: Gradle (Kotlin DSL) or Maven
- **Web Framework**: Spring Boot 3.x (enterprise) or Quarkus (cloud-native) or Micronaut
- **Database**: PostgreSQL with Spring Data JPA / Hibernate
- **Cache/Queue**: Redis with Spring Data Redis or Lettuce

---

## Key Libraries

### Web & API
- **Spring Boot 3.x**: Production-ready framework with auto-configuration
- **Spring WebMVC**: Servlet-based web framework (virtual threads recommended)
- **Spring WebFlux**: Reactive web framework (when reactive streams required)
- **Jackson**: JSON serialization/deserialization
- **SpringDoc OpenAPI**: API documentation (Swagger UI)

### Database & Storage
- **Spring Data JPA**: Repository abstraction over Hibernate
- **Hibernate 6.x**: ORM with Jakarta Persistence API
- **Flyway**: Database migrations (preferred) or Liquibase
- **jOOQ**: Type-safe SQL DSL (alternative to JPA for complex queries)
- **HikariCP**: Connection pooling (Spring Boot default)

### Background Tasks
- **Spring Scheduler**: `@Scheduled` for cron-like jobs
- **Spring Integration**: Enterprise integration patterns
- **Spring Batch**: Large-scale batch processing

### Deployment
- **Docker**: Containerized deployment (multi-stage builds)
- **Docker Compose**: Multi-service local development
- **GraalVM Native Image**: Optional ahead-of-time compilation (Quarkus/Micronaut)

---

## Development Standards

### Code Quality
- **Spotless** or **google-java-format**: Code formatting
- **Checkstyle**: Style enforcement (Google or Sun conventions)
- **SpotBugs**: Static analysis for bug patterns
- **Error Prone**: Compile-time error detection (Google)
- **SonarQube**: Continuous code quality inspection

### Security
- **Spring Security 6**: Authentication and authorization
- **OWASP Dependency-Check**: Dependency vulnerability scanning
- **Spring Vault**: Secrets management (when needed)

### Testing
- **JUnit 5**: Test framework with `@Test`, `@ParameterizedTest`, `@Nested`
- **Mockito**: Mocking framework
- **AssertJ**: Fluent assertion library
- **Testcontainers**: Docker-based integration testing
- **Spring Boot Test**: `@SpringBootTest`, `@WebMvcTest`, `@DataJpaTest`
- **ArchUnit**: Architecture rule enforcement

---

## Development Environment

### Required Tools
- Java 21+ (see `.java-version` or `.sdkmanrc`)
- Gradle 8.x or Maven 3.9+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose

### Common Commands
```bash
# Environment setup
./gradlew build                       # Build project
./gradlew dependencies                # Show dependency tree

# Dev server
./gradlew bootRun                     # Spring Boot
./mvnw spring-boot:run                # Maven alternative

# Tests
./gradlew test                        # All tests
./gradlew test --tests "*.unit.*"     # Unit tests only
./gradlew test jacocoTestReport       # With coverage

# Code quality
./gradlew checkstyleMain              # Checkstyle
./gradlew spotlessCheck               # Format check
./gradlew spotlessApply               # Auto-format
./gradlew spotbugsMain                # SpotBugs analysis

# Database
./gradlew flywayMigrate               # Apply migrations
./gradlew flywayInfo                  # Migration status

# Docker
docker compose up -d                  # Start services
docker compose logs -f app            # Follow app logs
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Java 21 over 17** | Virtual threads, record patterns, pattern matching for switch, sequenced collections |
| **Gradle Kotlin DSL over Groovy** | Type-safe build scripts, IDE autocompletion, refactoring support |
| **Spring Boot 3.x over 2.x** | Jakarta EE 10, ProblemDetail support, virtual threads, GraalVM native |
| **Flyway over Liquibase** | SQL-based migrations, simpler mental model, widely adopted |
| **AssertJ over Hamcrest** | Fluent API, better error messages, IDE discoverability |
| **Testcontainers over H2** | Production-parity testing, real database behavior, Docker-based |
| **Virtual threads over reactive** | Simpler programming model, familiar blocking code, JVM-managed scalability |

---

_Document standards and patterns, not every dependency. See individual steering files for detailed conventions._
