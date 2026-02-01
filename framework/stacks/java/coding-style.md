# Java Coding Style

Coding style conventions for modern Java 21+ projects. Opinionated patterns for readable, maintainable code leveraging records, sealed classes, pattern matching, and functional idioms.

---

## Philosophy

- **Modern Java first**: Use records, sealed interfaces, pattern matching, and `var` -- write Java 21, not Java 8
- **Composition over inheritance**: Favor small, focused interfaces and delegation over deep class hierarchies
- **Immutability by default**: Records for data, unmodifiable collections, final fields
- **Explicit over clever**: Clear code beats terse code; optimize for the reader, not the writer

---

## Naming Conventions

### Standard Java Naming

| Element | Convention | Example |
|---|---|---|
| Classes, interfaces, enums, records | `PascalCase` | `UserService`, `CreateUserRequest` |
| Methods, local variables, parameters | `camelCase` | `getUserById`, `pageSize` |
| Constants (`static final`) | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_PAGE_SIZE` |
| Packages | `lowercase.dotted` | `com.example.user.service` |
| Type parameters | Single uppercase letter or `PascalCase` | `T`, `E`, `ResponseT` |
| Boolean methods/variables | `is`/`has`/`can`/`should` prefix | `isActive()`, `hasPermission` |

### Naming Rules

```java
// GOOD: Descriptive, reveals intent
int activeUserCount = userRepository.countByActive(true);
boolean isAuthenticated = token != null && !token.isExpired();
var maxRetryAttempts = 3;

List<User> findActiveUsersByRole(Role role) { ... }

record CreateUserRequest(String email, String name) {}

// BAD: Abbreviated, unclear
int uc = repo.cnt(true);
boolean auth = t != null;
var n = 3;

List<User> getAU(Role r) { ... }
```

### Boolean Naming

```java
// GOOD: Clear boolean intent
boolean isActive;
boolean hasPermission;
boolean canPublish;
boolean shouldNotify;

// Methods
boolean isEligibleForPromotion(Employee employee) { ... }
boolean hasAccessTo(Resource resource, User user) { ... }

// BAD: Ambiguous
boolean active;   // is it a flag or a count?
boolean check;    // check what?
boolean flag;     // meaningless
```

---

## Modern Java Patterns

### Records for DTOs and Value Objects

Records replace boilerplate POJOs for immutable data carriers:

```java
// GOOD: Record for request/response DTOs
public record CreateUserRequest(
    @NotBlank String email,
    @NotBlank String name,
    @Size(min = 8) String password
) {}

public record UserResponse(
    Long id,
    String email,
    String name,
    Instant createdAt
) {
    // Compact constructor for validation
    public UserResponse {
        Objects.requireNonNull(email, "email must not be null");
    }

    // Factory method from entity
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getName(), user.getCreatedAt());
    }
}

// BAD: Mutable POJO for data that should be immutable
public class CreateUserRequest {
    private String email;
    private String name;
    private String password;
    // 30+ lines of getters, setters, equals, hashCode, toString...
}
```

### Sealed Interfaces

Use sealed interfaces for closed type hierarchies:

```java
// GOOD: Sealed interface with exhaustive pattern matching
public sealed interface PaymentResult
    permits PaymentResult.Success, PaymentResult.Declined, PaymentResult.Error {

    record Success(String transactionId, long amountCents) implements PaymentResult {}
    record Declined(String reason) implements PaymentResult {}
    record Error(String message, Exception cause) implements PaymentResult {}
}

// Exhaustive switch -- compiler enforces all cases
String describe(PaymentResult result) {
    return switch (result) {
        case PaymentResult.Success s -> "Paid: " + s.transactionId();
        case PaymentResult.Declined d -> "Declined: " + d.reason();
        case PaymentResult.Error e -> "Error: " + e.message();
    };
}

// BAD: Open class hierarchy with instanceof chains
if (result instanceof SuccessResult) { ... }
else if (result instanceof DeclinedResult) { ... }
else if (result instanceof ErrorResult) { ... }
else { /* easy to forget new subtypes */ }
```

### Pattern Matching

```java
// GOOD: Pattern matching for instanceof (Java 16+)
if (shape instanceof Circle c) {
    return Math.PI * c.radius() * c.radius();
}

// GOOD: Switch expressions with pattern matching (Java 21+)
double area(Shape shape) {
    return switch (shape) {
        case Circle c -> Math.PI * c.radius() * c.radius();
        case Rectangle r -> r.width() * r.height();
        case Triangle t -> 0.5 * t.base() * t.height();
    };
}

// GOOD: Guarded patterns
String classify(Integer value) {
    return switch (value) {
        case Integer i when i < 0 -> "negative";
        case Integer i when i == 0 -> "zero";
        case Integer i -> "positive";
    };
}

// BAD: Old-style instanceof with cast
if (shape instanceof Circle) {
    Circle c = (Circle) shape;
    return Math.PI * c.radius() * c.radius();
}
```

### `var` for Local Variables

```java
// GOOD: var when type is obvious from context
var users = userRepository.findAll();               // clearly List<User>
var response = new UserResponse(1L, "a@b.com", "Alice", Instant.now());
var mapper = new ObjectMapper();
var entry = Map.entry("key", "value");

// GOOD: var in for-loops and try-with-resources
for (var user : users) { ... }
try (var stream = Files.lines(path)) { ... }

// BAD: var when type is not obvious
var result = process(data);       // what type is result?
var x = calculateMetric();        // meaningless name + unclear type

// BAD: var for primitives where literal type matters
var timeout = 30;                 // int? long? -- be explicit
long timeoutMs = 30_000L;         // clear
```

---

## Optional Usage

### Rules

```java
// GOOD: Optional as return type for "may not exist"
Optional<User> findByEmail(String email) { ... }

// GOOD: Use map/flatMap/orElseThrow -- never get() directly
User user = userRepository.findByEmail(email)
    .orElseThrow(() -> new UserNotFoundException(email));

String displayName = userRepository.findById(id)
    .map(User::getName)
    .orElse("Unknown");

// BAD: Optional as field or parameter
public class UserService {
    private Optional<Cache> cache;     // use @Nullable or overload
}

void createUser(Optional<String> nickname) { ... }  // just use @Nullable

// BAD: Calling get() without isPresent()
User user = findByEmail(email).get();  // NoSuchElementException risk

// BAD: Using Optional just to avoid null check
Optional.ofNullable(name).ifPresent(n -> setName(n));  // just use if (name != null)
```

### Optional Method Chain Patterns

```java
// GOOD: Chained operations
String city = user.getAddress()           // returns Optional<Address>
    .map(Address::getCity)
    .filter(c -> !c.isBlank())
    .orElse("Unknown");

// GOOD: orElseGet for expensive defaults
User user = cache.get(id)
    .orElseGet(() -> repository.findById(id)
        .orElseThrow(() -> new NotFoundException("User", id)));
```

---

## Stream API Patterns

```java
// GOOD: Clean stream pipelines
List<String> activeEmails = users.stream()
    .filter(User::isActive)
    .map(User::getEmail)
    .sorted()
    .toList();                          // Java 16+ immutable list

Map<Role, List<User>> usersByRole = users.stream()
    .collect(Collectors.groupingBy(User::getRole));

// GOOD: Parallel streams for CPU-bound work on large collections
long total = largeDataSet.parallelStream()
    .mapToLong(Item::getValue)
    .sum();

// BAD: Side-effectful streams
users.stream()
    .forEach(u -> u.setActive(false));   // mutating in stream -- use for-loop

// BAD: Overly complex stream when a loop is clearer
var result = items.stream()
    .flatMap(i -> i.getChildren().stream())
    .filter(c -> c.getType() == Type.A)
    .collect(Collectors.groupingBy(
        Child::getCategory,
        Collectors.mapping(Child::getName, Collectors.joining(", "))
    ));
// If the pipeline exceeds 5 operations, consider extracting helper methods
```

---

## Composition Over Inheritance

```java
// GOOD: Composition with interfaces
public interface Validator<T> {
    ValidationResult validate(T input);
}

public class UserValidator implements Validator<CreateUserRequest> {
    private final List<Validator<CreateUserRequest>> rules;

    public UserValidator(List<Validator<CreateUserRequest>> rules) {
        this.rules = rules;
    }

    @Override
    public ValidationResult validate(CreateUserRequest input) {
        return rules.stream()
            .map(rule -> rule.validate(input))
            .reduce(ValidationResult.ok(), ValidationResult::merge);
    }
}

// BAD: Deep inheritance for code reuse
class BaseRepository<T> { ... }
class CachedRepository<T> extends BaseRepository<T> { ... }
class AuditedCachedRepository<T> extends CachedRepository<T> { ... }
class UserRepository extends AuditedCachedRepository<User> { ... }
```

---

## Function Design

### Size Limits

| Element | Guideline |
|---|---|
| Method body | Under 20 lines of logic, max 40 |
| Class | Under 200 lines, max 300 |
| Source file | Under 300 lines, max 500 |
| Method parameters | Max 5; use a record or builder for more |

### Early Returns (Guard Clauses)

```java
// GOOD: Guard clauses
public Post publish(Post post, User user) {
    if (!post.getAuthorId().equals(user.getId())) {
        throw new ForbiddenException("Cannot publish another user's post");
    }
    if (post.getStatus() == PostStatus.PUBLISHED) {
        throw new ConflictException("Post is already published");
    }
    if (post.getBody() == null || post.getBody().isBlank()) {
        throw new ValidationException("Post body is required");
    }

    post.setStatus(PostStatus.PUBLISHED);
    post.setPublishedAt(Instant.now());
    return postRepository.save(post);
}

// BAD: Deeply nested
public Post publish(Post post, User user) {
    if (post.getAuthorId().equals(user.getId())) {
        if (post.getStatus() != PostStatus.PUBLISHED) {
            if (post.getBody() != null && !post.getBody().isBlank()) {
                post.setStatus(PostStatus.PUBLISHED);
                return postRepository.save(post);
            } else { throw new ValidationException("..."); }
        } else { throw new ConflictException("..."); }
    } else { throw new ForbiddenException("..."); }
}
```

---

## Import Organization

```java
// 1. java.* (standard library)
import java.time.Instant;
import java.util.List;
import java.util.Optional;

// 2. javax.*/jakarta.* (extensions)
import jakarta.validation.constraints.NotBlank;

// 3. Third-party libraries (alphabetical by group)
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 4. Project imports
import com.example.user.domain.User;
import com.example.user.dto.CreateUserRequest;

// Rules:
// - Never use wildcard imports (import java.util.*)
// - Group with blank lines between sections
// - Let IDE organize automatically (google-java-format handles this)
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Wildcard imports | Namespace pollution, hidden dependencies | Import specific classes |
| Mutable DTOs | Thread-safety issues, unexpected mutation | Use records |
| Deep inheritance hierarchies | Tight coupling, fragile base class | Composition + interfaces |
| Raw types (`List` instead of `List<User>`) | Type safety bypassed | Always use generics |
| `Optional.get()` without check | `NoSuchElementException` at runtime | `orElseThrow()` or `map()` |
| Empty catch blocks | Silent failures | Log and rethrow or handle |
| String concatenation in loops | O(n^2) performance | `StringBuilder` or `String.join()` |
| Returning `null` from public methods | NullPointerException in callers | Return `Optional` or throw |
| God classes (1000+ lines) | Unmaintainable, untestable | Extract focused services |

---

_Write modern Java that your future self will thank you for. Records, sealed types, and pattern matching are not optional -- they are the language._
