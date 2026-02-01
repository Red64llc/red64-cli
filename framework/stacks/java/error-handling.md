# Error Handling Patterns

Structured error handling for Java 21+ applications with Spring Boot, custom exception hierarchies, Problem Details (RFC 9457), and sealed result types.

---

## Philosophy

- **Fail fast**: Validate inputs early, throw immediately on invalid state
- **Unchecked over checked**: Prefer `RuntimeException` subclasses; checked exceptions create coupling
- **Centralized handling**: `@ControllerAdvice` at the API boundary, not scattered try/catch
- **Structured responses**: Problem Details (RFC 9457) for consistent, machine-readable error payloads

---

## Custom Exception Hierarchy

### Base Exceptions

```java
// src/main/java/com/example/common/exception/AppException.java
public abstract class AppException extends RuntimeException {

    private final String errorCode;
    private final int statusCode;
    private final Map<String, Object> details;

    protected AppException(String message, String errorCode, int statusCode) {
        this(message, errorCode, statusCode, Map.of());
    }

    protected AppException(String message, String errorCode, int statusCode, Map<String, Object> details) {
        super(message);
        this.errorCode = errorCode;
        this.statusCode = statusCode;
        this.details = details;
    }

    public String getErrorCode() { return errorCode; }
    public int getStatusCode() { return statusCode; }
    public Map<String, Object> getDetails() { return details; }
}
```

### Concrete Exceptions

```java
public class NotFoundException extends AppException {
    public NotFoundException(String resource, Object identifier) {
        super(
            "%s not found: %s".formatted(resource, identifier),
            "NOT_FOUND",
            404,
            Map.of("resource", resource, "identifier", identifier.toString())
        );
    }
}

public class ConflictException extends AppException {
    public ConflictException(String message) {
        super(message, "CONFLICT", 409);
    }
}

public class ValidationException extends AppException {
    public ValidationException(String message, Map<String, String> fieldErrors) {
        super(message, "VALIDATION_ERROR", 422, Map.of("fieldErrors", fieldErrors));
    }

    public ValidationException(String message) {
        this(message, Map.of());
    }
}

public class ForbiddenException extends AppException {
    public ForbiddenException(String message) {
        super(message, "FORBIDDEN", 403);
    }
}

public class ExternalServiceException extends AppException {
    public ExternalServiceException(String service, String message, Throwable cause) {
        super("External service error (%s): %s".formatted(service, message), "EXTERNAL_SERVICE_ERROR", 502,
              Map.of("service", service));
        initCause(cause);
    }
}
```

### Usage in Services

```java
@Service
public class UserService {

    private final UserRepository userRepository;

    public User getUser(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("User", id));
    }

    public User createUser(CreateUserRequest request) {
        userRepository.findByEmail(request.email()).ifPresent(existing -> {
            throw new ConflictException("Email already registered: " + request.email());
        });
        var user = new User(request.email(), request.name());
        return userRepository.save(user);
    }
}
```

---

## Spring @ControllerAdvice (Problem Details)

### Global Exception Handler

Spring Boot 3.x supports RFC 9457 Problem Details natively via `ProblemDetail`:

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AppException.class)
    public ProblemDetail handleAppException(AppException ex, HttpServletRequest request) {
        log.warn("app_error: code={}, message={}, path={}",
                 ex.getErrorCode(), ex.getMessage(), request.getRequestURI());

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatusCode.valueOf(ex.getStatusCode()),
            ex.getMessage()
        );
        problem.setTitle(ex.getErrorCode());
        problem.setProperty("errorCode", ex.getErrorCode());
        if (!ex.getDetails().isEmpty()) {
            problem.setProperty("details", ex.getDetails());
        }
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        var fieldErrors = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(
                FieldError::getField,
                fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "invalid",
                (a, b) -> a
            ));

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.UNPROCESSABLE_ENTITY,
            "Validation failed"
        );
        problem.setTitle("VALIDATION_ERROR");
        problem.setProperty("fieldErrors", fieldErrors);
        return problem;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("unhandled_error: path={}, method={}", request.getRequestURI(), request.getMethod(), ex);

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "An unexpected error occurred"
        );
        problem.setTitle("INTERNAL_ERROR");
        return problem;
    }
}
```

### Enable Problem Details in Spring Boot

```yaml
# application.yml
spring:
  mvc:
    problemdetails:
      enabled: true
```

### Example Response (RFC 9457)

```json
{
  "type": "about:blank",
  "title": "NOT_FOUND",
  "status": 404,
  "detail": "User not found: 42",
  "instance": "/api/v1/users/42",
  "errorCode": "NOT_FOUND",
  "details": {
    "resource": "User",
    "identifier": "42"
  }
}
```

---

## Checked vs Unchecked Exceptions

### Decision Table

| Scenario | Exception Type | Rationale |
|---|---|---|
| Business logic violations | Unchecked (`AppException`) | Caller should not be forced to handle |
| Resource not found | Unchecked (`NotFoundException`) | Common flow, handled centrally |
| External service failure | Unchecked (`ExternalServiceException`) | Wrap and rethrow |
| File I/O (must handle) | Checked (wrap in unchecked) | Convert at boundary |
| Programmatic errors (bugs) | Unchecked (`IllegalStateException`) | Should never be caught |

### Wrapping Checked Exceptions

```java
// GOOD: Wrap checked exception at the boundary
public byte[] readConfig(Path path) {
    try {
        return Files.readAllBytes(path);
    } catch (IOException e) {
        throw new ConfigurationException("Failed to read config: " + path, e);
    }
}

// BAD: Propagating checked exceptions through the entire call chain
public byte[] readConfig(Path path) throws IOException {  // forces all callers to handle
    return Files.readAllBytes(path);
}
```

---

## Result Pattern with Sealed Interfaces

For expected business outcomes where exceptions feel too heavy:

```java
public sealed interface Result<T>
    permits Result.Success, Result.Failure {

    record Success<T>(T value) implements Result<T> {}
    record Failure<T>(String error, String code) implements Result<T> {}

    default T orElseThrow() {
        return switch (this) {
            case Success<T> s -> s.value();
            case Failure<T> f -> throw new AppException(f.error(), f.code(), 400) {};
        };
    }

    default <R> Result<R> map(Function<T, R> mapper) {
        return switch (this) {
            case Success<T> s -> new Success<>(mapper.apply(s.value()));
            case Failure<T> f -> new Failure<>(f.error(), f.code());
        };
    }
}
```

### Usage

```java
public Result<User> createUser(CreateUserRequest request) {
    if (userRepository.existsByEmail(request.email())) {
        return new Result.Failure<>("Email already registered", "DUPLICATE_EMAIL");
    }
    var user = new User(request.email(), request.name());
    return new Result.Success<>(userRepository.save(user));
}

// Caller
Result<User> result = userService.createUser(request);
return switch (result) {
    case Result.Success<User> s -> ResponseEntity.created(uri).body(UserResponse.from(s.value()));
    case Result.Failure<User> f -> ResponseEntity.status(409).body(ProblemDetail.forStatusAndDetail(
        HttpStatus.CONFLICT, f.error()));
};
```

### When to Use Each

| Pattern | Use Case |
|---|---|
| Exceptions | Infrastructure errors, auth failures, unexpected failures |
| Result | Expected business outcomes (duplicate email, insufficient funds, validation) |

---

## Exception Chaining

Always preserve the original cause:

```java
// GOOD: Chain with cause
try {
    var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
} catch (IOException | InterruptedException e) {
    throw new ExternalServiceException("payment-api", e.getMessage(), e);
}

// BAD: Losing the original cause
try {
    var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
} catch (IOException e) {
    throw new ExternalServiceException("payment-api", "request failed", null);  // cause lost!
}
```

---

## Retry with Resilience4j

```java
@Service
public class PaymentClient {

    private final RetryRegistry retryRegistry;

    @Retry(name = "paymentService", fallbackMethod = "paymentFallback")
    public PaymentResult charge(long amountCents, String token) {
        // HTTP call to payment provider
        return restClient.post()
            .uri("/charges")
            .body(new ChargeRequest(amountCents, token))
            .retrieve()
            .body(PaymentResult.class);
    }

    private PaymentResult paymentFallback(long amountCents, String token, Exception ex) {
        log.error("payment_failed_after_retries: amount={}, error={}", amountCents, ex.getMessage());
        throw new ExternalServiceException("payment", "Payment service unavailable", ex);
    }
}
```

```yaml
# application.yml
resilience4j:
  retry:
    instances:
      paymentService:
        maxAttempts: 3
        waitDuration: 1s
        exponentialBackoffMultiplier: 2
        retryExceptions:
          - java.io.IOException
          - org.springframework.web.client.ResourceAccessException
        ignoreExceptions:
          - com.example.common.exception.ValidationException
```

---

## What Never to Catch

```java
// BAD: Never catch Throwable -- includes OutOfMemoryError, StackOverflowError
try {
    process();
} catch (Throwable t) {
    log.error("Something happened", t);
}

// BAD: Never catch and silently swallow
try {
    riskyOperation();
} catch (Exception e) {
    // swallowed -- silent failure, impossible to debug
}

// BAD: Catching InterruptedException without restoring interrupt status
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    // Thread interrupt flag is cleared -- must restore it
}

// GOOD: Restore interrupt status
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    throw new ServiceException("Operation interrupted", e);
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Catching `Throwable` | Catches `Error` (OOM, StackOverflow) | Catch specific exceptions |
| Empty catch blocks | Silent failures, impossible to debug | Log and rethrow or handle properly |
| Checked exceptions everywhere | Forces boilerplate on every caller | Wrap in `RuntimeException` subclass |
| Returning error codes/strings | No type safety, easy to ignore | Use `Result` type or throw |
| Stack traces in API responses | Security risk, bad UX | `ProblemDetail` with safe messages |
| `Exception` as method signature | Caller has no idea what to expect | Declare specific exceptions or use unchecked |
| `try/catch` around every method | Cluttered, hides control flow | Centralized `@ControllerAdvice` |
| `e.printStackTrace()` | Goes to stderr, not structured logging | Use SLF4J logger |

---

_Errors are data. Classify them in a hierarchy, handle them centrally, and present them as Problem Details. Never swallow exceptions silently._
