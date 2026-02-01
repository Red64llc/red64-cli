# Error Handling Patterns

Structured error handling for C projects using return codes, errno, and the goto cleanup pattern for safe resource management.

---

## Philosophy

- **Return codes as the primary pattern**: Functions return `0` for success, negative values for errors
- **Fail fast**: Validate inputs early, return errors immediately on invalid state
- **Resource safety via goto cleanup**: A single cleanup label per function ensures all resources are freed
- **Make errors visible**: Every call that can fail must have its return value checked
- **Ref**: CERT C ERR00-C through ERR06-C, SEI CERT Secure Coding

---

## Return Code Conventions

### Standard Return Pattern

| Return Value | Meaning |
|---|---|
| `0` | Success |
| `-1` or negative | Error (specific codes for specific errors) |
| Positive | Context-dependent (e.g., byte count, item count) |

### Error Code Enum

```c
/* GOOD: Centralized error codes */
typedef enum {
    ERR_OK             =  0,
    ERR_NULL_PARAM     = -1,
    ERR_NOMEM          = -2,
    ERR_NOT_FOUND      = -3,
    ERR_ALREADY_EXISTS = -4,
    ERR_VALIDATION     = -5,
    ERR_IO             = -6,
    ERR_TIMEOUT        = -7,
    ERR_INTERNAL       = -8,
} error_code_t;

/* GOOD: Human-readable error strings */
const char *error_string(error_code_t code) {
    switch (code) {
    case ERR_OK:             return "success";
    case ERR_NULL_PARAM:     return "null parameter";
    case ERR_NOMEM:          return "out of memory";
    case ERR_NOT_FOUND:      return "not found";
    case ERR_ALREADY_EXISTS: return "already exists";
    case ERR_VALIDATION:     return "validation failed";
    case ERR_IO:             return "I/O error";
    case ERR_TIMEOUT:        return "timeout";
    case ERR_INTERNAL:       return "internal error";
    default:                 return "unknown error";
    }
}
```

---

## The goto Cleanup Pattern

The most important error-handling pattern in C. A single `cleanup` label at the end of the function ensures every allocated resource is freed, regardless of which step failed.

### GOOD: goto Cleanup

```c
int process_file(const char *path, result_t *out) {
    int rc = ERR_OK;
    FILE *fp = NULL;
    char *buffer = NULL;
    cJSON *json = NULL;

    if (!path || !out) {
        return ERR_NULL_PARAM;
    }

    fp = fopen(path, "r");
    if (!fp) {
        rc = ERR_IO;
        goto cleanup;
    }

    buffer = malloc(MAX_FILE_SIZE);
    if (!buffer) {
        rc = ERR_NOMEM;
        goto cleanup;
    }

    size_t bytes = fread(buffer, 1, MAX_FILE_SIZE - 1, fp);
    buffer[bytes] = '\0';

    json = cJSON_Parse(buffer);
    if (!json) {
        rc = ERR_VALIDATION;
        goto cleanup;
    }

    rc = extract_result(json, out);

cleanup:
    if (json)   cJSON_Delete(json);
    if (buffer)  free(buffer);
    if (fp)      fclose(fp);
    return rc;
}
```

### BAD: Nested Ifs (The Pyramid of Doom)

```c
/* BAD: Deeply nested, easy to miss a free, hard to maintain */
int process_file(const char *path, result_t *out) {
    if (path && out) {
        FILE *fp = fopen(path, "r");
        if (fp) {
            char *buffer = malloc(MAX_FILE_SIZE);
            if (buffer) {
                size_t bytes = fread(buffer, 1, MAX_FILE_SIZE - 1, fp);
                buffer[bytes] = '\0';
                cJSON *json = cJSON_Parse(buffer);
                if (json) {
                    int rc = extract_result(json, out);
                    cJSON_Delete(json);
                    free(buffer);
                    fclose(fp);
                    return rc;
                }
                free(buffer);
            }
            fclose(fp);
        }
        return ERR_IO;
    }
    return ERR_NULL_PARAM;
}
```

### BAD: Multiple Return Points with Duplicated Cleanup

```c
/* BAD: Cleanup code duplicated at every error point */
int process_file(const char *path, result_t *out) {
    FILE *fp = fopen(path, "r");
    if (!fp) return ERR_IO;

    char *buffer = malloc(MAX_FILE_SIZE);
    if (!buffer) {
        fclose(fp);  /* Must remember to free fp here */
        return ERR_NOMEM;
    }

    cJSON *json = cJSON_Parse(buffer);
    if (!json) {
        free(buffer);   /* Must free buffer AND fp */
        fclose(fp);
        return ERR_VALIDATION;
    }

    /* ... more code, more duplicated cleanup ... */
}
```

---

## errno for System Calls

```c
#include <errno.h>
#include <string.h>

/* GOOD: Check errno after system calls that set it */
int read_file(const char *path, char *buf, size_t buf_size) {
    FILE *fp = fopen(path, "r");
    if (!fp) {
        log_error("fopen failed: %s (errno=%d)", strerror(errno), errno);
        return ERR_IO;
    }

    size_t n = fread(buf, 1, buf_size - 1, fp);
    if (ferror(fp)) {
        log_error("fread failed: %s", strerror(errno));
        fclose(fp);
        return ERR_IO;
    }

    buf[n] = '\0';
    fclose(fp);
    return ERR_OK;
}

/* GOOD: Save errno before calling other functions that may overwrite it */
int safe_open(const char *path) {
    int fd = open(path, O_RDONLY);
    if (fd < 0) {
        int saved_errno = errno;  /* Save before log call */
        log_error("open(%s) failed: %s", path, strerror(saved_errno));
        errno = saved_errno;      /* Restore for caller */
        return -1;
    }
    return fd;
}
```

---

## Error Propagation Macros

```c
/* GOOD: Propagate errors with a macro to reduce boilerplate */
#define RETURN_IF_ERROR(expr)       \
    do {                            \
        int _rc = (expr);           \
        if (_rc != ERR_OK) {        \
            return _rc;             \
        }                           \
    } while (0)

#define GOTO_IF_ERROR(expr, label)  \
    do {                            \
        rc = (expr);                \
        if (rc != ERR_OK) {         \
            goto label;             \
        }                           \
    } while (0)

/* Usage */
int init_system(config_t *cfg) {
    RETURN_IF_ERROR(config_load(cfg));
    RETURN_IF_ERROR(logger_init(cfg->log_level));
    RETURN_IF_ERROR(database_connect(cfg->db_url));
    return ERR_OK;
}

int process_request(const request_t *req, response_t *resp) {
    int rc = ERR_OK;
    char *buffer = NULL;
    db_conn_t *conn = NULL;

    buffer = malloc(BUFFER_SIZE);
    if (!buffer) { rc = ERR_NOMEM; goto cleanup; }

    conn = db_pool_acquire();
    if (!conn) { rc = ERR_INTERNAL; goto cleanup; }

    GOTO_IF_ERROR(validate_request(req), cleanup);
    GOTO_IF_ERROR(execute_query(conn, req, buffer, BUFFER_SIZE), cleanup);
    GOTO_IF_ERROR(build_response(buffer, resp), cleanup);

cleanup:
    if (conn)   db_pool_release(conn);
    if (buffer)  free(buffer);
    return rc;
}
```

---

## Error Logging

```c
/* GOOD: Log with context at the point of failure */
#define LOG_ERROR(fmt, ...) \
    fprintf(stderr, "[ERROR] %s:%d: " fmt "\n", __FILE__, __LINE__, ##__VA_ARGS__)

#define LOG_WARN(fmt, ...) \
    fprintf(stderr, "[WARN]  %s:%d: " fmt "\n", __FILE__, __LINE__, ##__VA_ARGS__)

/* Usage */
int connect_to_server(const char *host, int port) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) {
        LOG_ERROR("socket() failed: %s", strerror(errno));
        return ERR_IO;
    }

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_port = htons((uint16_t)port);

    if (inet_pton(AF_INET, host, &addr.sin_addr) != 1) {
        LOG_ERROR("invalid address: %s", host);
        close(fd);
        return ERR_VALIDATION;
    }

    if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        LOG_ERROR("connect(%s:%d) failed: %s", host, port, strerror(errno));
        close(fd);
        return ERR_IO;
    }

    return fd;
}
```

---

## Output Parameters for Results

```c
/* GOOD: Return error code, write result to output parameter */
int config_get_int(const config_t *cfg, const char *key, int *out_value) {
    if (!cfg || !key || !out_value) {
        return ERR_NULL_PARAM;
    }

    const config_entry_t *entry = config_find(cfg, key);
    if (!entry) {
        return ERR_NOT_FOUND;
    }

    char *endptr = NULL;
    long val = strtol(entry->value, &endptr, 10);
    if (*endptr != '\0') {
        return ERR_VALIDATION;
    }

    *out_value = (int)val;
    return ERR_OK;
}

/* Usage */
int port;
int rc = config_get_int(&cfg, "server.port", &port);
if (rc != ERR_OK) {
    LOG_ERROR("failed to read port: %s", error_string(rc));
    port = DEFAULT_PORT;
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Ignoring return values | Errors propagate silently, crash later | Always check; use `RETURN_IF_ERROR` macro |
| Nested if for resource cleanup | Pyramid of doom, missed frees | `goto cleanup` pattern |
| Duplicated cleanup at each error | Maintenance nightmare, easy to miss | Single `cleanup` label with all frees |
| Using `errno` without checking call result | `errno` is only valid after a failed call | Check return value first, then errno |
| Not saving `errno` before logging | `fprintf`/`log` may overwrite errno | Save to local variable immediately |
| Returning magic numbers | Caller cannot interpret meaning | Use named enum constants |
| `assert()` for runtime errors | Disabled in release builds | `assert` for programmer bugs only; return codes for runtime errors |
| `exit()` deep in library code | Prevents caller from handling error | Return error codes; let `main()` decide |

---

_Errors in C are values. Return them, check them, propagate them, and always clean up. The goto cleanup pattern is your best friend for resource safety._
