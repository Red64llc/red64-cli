# Code Quality Standards

Project memory for code quality conventions, static analysis, architecture testing, and null safety in Java 21+ with Gradle Kotlin DSL.

---

## Philosophy

- **Automate everything**: If a rule can be checked by a tool, it should be
- **Shift left**: Catch bugs at compile time, not in production
- **Architecture as code**: Enforce package dependencies and layering with ArchUnit
- **Zero warnings policy**: Treat warnings as errors in CI

---

## Checkstyle (Google Java Style)

### Gradle Configuration

```kotlin
// build.gradle.kts
plugins {
    id("checkstyle")
}

checkstyle {
    toolVersion = "10.20.1"
    configFile = file("config/checkstyle/google_checks.xml")
    isIgnoreFailures = false
    maxWarnings = 0
}

tasks.withType<Checkstyle> {
    reports {
        xml.required.set(true)
        html.required.set(true)
    }
}
```

### Key Rules Enforced

| Rule | Description |
|---|---|
| `Indentation` | 2 spaces (Google style) or 4 spaces (project choice) |
| `LineLength` | Max 120 characters |
| `MethodLength` | Max 40 lines |
| `ParameterNumber` | Max 5 parameters |
| `AvoidStarImport` | No wildcard imports |
| `NeedBraces` | Braces required for all control structures |
| `MissingJavadocMethod` | Javadoc on public methods |

```bash
./gradlew checkstyleMain checkstyleTest
```

---

## SpotBugs

### Gradle Configuration

```kotlin
// build.gradle.kts
plugins {
    id("com.github.spotbugs") version "6.0.26"
}

spotbugs {
    effort.set(com.github.spotbugs.snom.Effort.MAX)
    reportLevel.set(com.github.spotbugs.snom.Confidence.MEDIUM)
    excludeFilter.set(file("config/spotbugs/exclude.xml"))
}

tasks.withType<com.github.spotbugs.snom.SpotBugsTask> {
    reports.create("html") { required.set(true) }
    reports.create("xml") { required.set(true) }
}
```

### Exclusion Filter

```xml
<!-- config/spotbugs/exclude.xml -->
<FindBugsFilter>
    <Match>
        <Class name="~.*\.dto\..*" />
        <Bug pattern="EI_EXPOSE_REP,EI_EXPOSE_REP2" />
    </Match>
    <Match>
        <Source name="~.*Test\.java" />
    </Match>
</FindBugsFilter>
```

```bash
./gradlew spotbugsMain
```

---

## Error Prone

Compile-time bug detection from Google:

```kotlin
// build.gradle.kts
plugins {
    id("net.ltgt.errorprone") version "4.1.0"
}

dependencies {
    errorprone("com.google.errorprone:error_prone_core:2.36.0")
}

tasks.withType<JavaCompile> {
    options.errorprone {
        disableWarningsInGeneratedCode.set(true)
        error(
            "MissingOverride",
            "EqualsHashCode",
            "ReturnValueIgnored",
            "UnnecessaryParentheses",
            "FallThrough",
            "MissingCasesInEnumSwitch",
            "UnusedVariable"
        )
    }
}
```

### Common Error Prone Catches

```java
// Error Prone catches: MissingOverride
public class UserService implements Service {
    public void process() { ... }  // ERROR: missing @Override
}

// Error Prone catches: ReturnValueIgnored
String trimmed = name.trim();  // GOOD
name.trim();                   // ERROR: return value ignored (String is immutable)

// Error Prone catches: EqualsHashCode
public class User {
    @Override
    public boolean equals(Object o) { ... }
    // ERROR: equals() without hashCode()
}
```

---

## ArchUnit (Architecture Tests)

### Dependency

```kotlin
// build.gradle.kts
dependencies {
    testImplementation("com.tngtech.archunit:archunit-junit5:1.3.0")
}
```

### Architecture Rules

```java
@AnalyzeClasses(packages = "com.example")
class ArchitectureTest {

    @ArchTest
    static final ArchRule layerDependencies = layeredArchitecture()
        .consideringAllDependencies()
        .layer("Controller").definedBy("..controller..")
        .layer("Service").definedBy("..service..")
        .layer("Repository").definedBy("..repository..")
        .layer("Domain").definedBy("..domain..")
        .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
        .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller", "Service")
        .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service")
        .whereLayer("Domain").mayOnlyBeAccessedByLayers("Service", "Repository", "Controller");

    @ArchTest
    static final ArchRule servicesShouldNotDependOnControllers =
        noClasses().that().resideInAPackage("..service..")
            .should().dependOnClassesThat().resideInAPackage("..controller..");

    @ArchTest
    static final ArchRule controllersShouldBeAnnotated =
        classes().that().resideInAPackage("..controller..")
            .should().beAnnotatedWith(RestController.class);

    @ArchTest
    static final ArchRule noFieldInjection =
        noFields().should().beAnnotatedWith(Autowired.class)
            .because("Use constructor injection instead of field injection");

    @ArchTest
    static final ArchRule recordsShouldBeInDtoPackage =
        classes().that().areRecords()
            .and().haveSimpleNameEndingWith("Request")
            .should().resideInAPackage("..dto..");
}
```

---

## SonarQube Integration

### Gradle Plugin

```kotlin
// build.gradle.kts
plugins {
    id("org.sonarqube") version "5.1.0.4882"
}

sonar {
    properties {
        property("sonar.projectKey", "my-project")
        property("sonar.host.url", "http://localhost:9000")
        property("sonar.java.source", "21")
        property("sonar.coverage.jacoco.xmlReportPaths", "build/reports/jacoco/test/jacocoTestReport.xml")
        property("sonar.exclusions", "**/dto/**,**/config/**")
    }
}
```

```bash
./gradlew sonar -Dsonar.token=your-token
```

### Quality Gate Metrics

| Metric | Threshold |
|---|---|
| Coverage | >= 80% |
| Duplicated lines | <= 3% |
| Maintainability rating | A |
| Reliability rating | A |
| Security rating | A |
| Technical debt ratio | <= 5% |

---

## Null Safety

### @Nullable / @NonNull Annotations

```java
// Use Spring's or JSpecify annotations project-wide
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

// GOOD: Annotate boundaries
public class UserService {

    @NonNull
    public User getUser(@NonNull Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("User", id));
    }

    @Nullable
    public User findByEmail(@NonNull String email) {
        return userRepository.findByEmail(email).orElse(null);
    }
}

// GOOD: Package-level default with @NonNullApi
// package-info.java
@NonNullApi
package com.example.user.service;

import org.springframework.lang.NonNullApi;
```

### Optional vs @Nullable

| Return Type | When to Use |
|---|---|
| `Optional<T>` | Public API where absence is a normal outcome |
| `@Nullable T` | Internal methods, performance-sensitive code |
| `T` (non-null) | When null is never valid -- throw if missing |

```java
// GOOD: Clear null contract
public Optional<User> findByEmail(String email) { ... }     // public API
@Nullable User lookupCache(Long id) { ... }                  // internal

// BAD: Ambiguous null contract
public User findByEmail(String email) { ... }  // returns null? throws? who knows
```

---

## Spotless (Auto-Formatting)

```kotlin
// build.gradle.kts
plugins {
    id("com.diffplug.spotless") version "7.0.0"
}

spotless {
    java {
        googleJavaFormat("1.24.0")
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
    }
    kotlinGradle {
        ktlint()
    }
}
```

```bash
./gradlew spotlessCheck    # Verify formatting
./gradlew spotlessApply    # Auto-format
```

---

## CI Pipeline Quality Commands

```bash
# Full quality pipeline (run in CI)
./gradlew clean build                    # Compile + tests
./gradlew checkstyleMain                 # Style enforcement
./gradlew spotbugsMain                   # Bug detection
./gradlew spotlessCheck                  # Format verification
./gradlew jacocoTestReport               # Coverage report
./gradlew sonar                          # SonarQube analysis

# Quick local check
./gradlew check                          # Runs all verification tasks
./gradlew spotlessApply && ./gradlew check   # Format + verify
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| No static analysis in CI | Bugs slip through to production | Run checkstyle + spotbugs + errorprone in CI |
| Suppressing all warnings | Hides real issues | Suppress only with documented justification |
| No architecture tests | Layering violations accumulate | ArchUnit tests enforce boundaries |
| Field injection (`@Autowired`) | Hides dependencies, untestable | Constructor injection |
| Missing null annotations | NPE surprises at runtime | `@NonNullApi` package default + `@Nullable` opt-in |
| Manual formatting debates | Wastes time in code review | Spotless auto-format, no discussion |
| Ignoring SonarQube debt | Technical debt grows silently | Quality gate blocks merges |

---

_Quality is not an afterthought. Automate checks, enforce architecture, and treat every warning as a bug waiting to happen._
