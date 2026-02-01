# Feedback Configuration

Project-specific commands for automated feedback during Java implementation with Gradle.

---

## Test Commands

Commands to run tests during implementation. The agent will use these to verify code changes.

```yaml
# Primary test command (REQUIRED)
test: ./gradlew test

# Test with verbose output
test_verbose: ./gradlew test --info

# Run specific test class (use {class} as placeholder)
test_class: ./gradlew test --tests "{class}"

# Run tests matching pattern
test_pattern: ./gradlew test --tests "*{pattern}*"

# Run only unit tests (by directory convention)
test_unit: ./gradlew test --tests "com.example.unit.*"

# Run only integration tests
test_integration: ./gradlew test --tests "com.example.integration.*"
```

---

## Build Commands

Commands for compiling and packaging.

```yaml
# Full build (compile + test + check)
build: ./gradlew build

# Compile only (no tests)
compile: ./gradlew compileJava

# Clean build
clean_build: ./gradlew clean build

# Build without tests (use sparingly)
build_skip_tests: ./gradlew build -x test
```

---

## Linting and Quality Commands

Commands for code quality checks.

```yaml
# Run all verification tasks (checkstyle + spotbugs + tests)
check: ./gradlew check

# Checkstyle (style enforcement)
checkstyle: ./gradlew checkstyleMain checkstyleTest

# SpotBugs (bug detection)
spotbugs: ./gradlew spotbugsMain

# Spotless format check
format_check: ./gradlew spotlessCheck

# Spotless auto-format
format_fix: ./gradlew spotlessApply

# SonarQube analysis
sonar: ./gradlew sonar
```

---

## Coverage Commands

Commands for test coverage reporting.

```yaml
# Generate coverage report
coverage: ./gradlew test jacocoTestReport

# Enforce coverage thresholds
coverage_verify: ./gradlew jacocoTestCoverageVerification

# Report location
coverage_report: build/reports/jacoco/test/html/index.html
```

---

## Database Commands

Commands for database migrations.

```yaml
# Apply pending migrations
migrate: ./gradlew flywayMigrate

# Show migration status
migrate_info: ./gradlew flywayInfo

# Clean database (DANGER: drops all objects)
migrate_clean: ./gradlew flywayClean
```

---

## Development Server

Commands for starting the development server.

```yaml
# Start dev server (Spring Boot)
dev_server: ./gradlew bootRun

# Dev server with specific profile
dev_server_profile: SPRING_PROFILES_ACTIVE=dev ./gradlew bootRun

# Dev server port
dev_port: 8080

# Dev server base URL
dev_url: http://localhost:8080

# API documentation URL
api_docs_url: http://localhost:8080/swagger-ui.html
```

---

## UI Verification

Settings for agent-browser UI verification.

```yaml
# Enable UI verification (typically false for API-only projects)
ui_verification_enabled: false

# Default wait time after navigation (milliseconds)
navigation_wait: 2000

# Screenshot directory
screenshot_dir: /tmp/ui-captures

# API documentation URL (for API projects)
api_docs_url: http://localhost:8080/swagger-ui.html
```

---

## Quick Reference

```bash
# Full CI pipeline (what CI runs)
./gradlew clean build check jacocoTestReport

# Quick local development cycle
./gradlew spotlessApply && ./gradlew check

# Fast feedback (compile + single test)
./gradlew compileJava && ./gradlew test --tests "UserServiceTest"

# Format, lint, test -- one command
./gradlew spotlessApply check
```

---

## Notes

- Uses Gradle wrapper (`./gradlew`) for reproducible builds -- never use system Gradle
- Spotless replaces manual formatting discussions -- run `spotlessApply` before committing
- `./gradlew check` runs checkstyle, spotbugs, tests, and JaCoCo verification in one command
- For Spring Boot apps, `bootRun` uses virtual threads when `spring.threads.virtual.enabled=true`
- Testcontainers requires Docker to be running for integration tests
