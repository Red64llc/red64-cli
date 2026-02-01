# Memory Safety

Patterns and practices for memory-safe C code. Manual memory management demands discipline: always check allocations, always free on all paths, and use tools to verify correctness.

---

## Philosophy

- **Every allocation has an owner**: One function allocates, one function frees -- document which
- **Check every malloc**: Never assume allocation succeeds
- **Free and NULL**: After freeing, set the pointer to NULL to prevent use-after-free
- **Verify with tools**: Valgrind, ASan, and UBSan catch what code review misses
- **Ref**: CERT C MEM30-C through MEM36-C, SEI CERT Secure Coding

---

## Always Check malloc Return

```c
/* GOOD: Check allocation and handle failure */
char *buffer = malloc(size);
if (!buffer) {
    log_error("malloc(%zu) failed", size);
    return ERR_NOMEM;
}
memset(buffer, 0, size);

/* GOOD: calloc initializes to zero and checks for overflow */
user_t *users = calloc(count, sizeof(user_t));
if (!users) {
    return ERR_NOMEM;
}

/* BAD: No check -- null dereference if allocation fails */
char *buffer = malloc(size);
memset(buffer, 0, size);  /* Crash if malloc returned NULL */
```

---

## Free and NULL Pattern

```c
/* GOOD: Free and immediately NULL the pointer */
void user_free(user_t *user) {
    if (!user) return;
    free(user->name);
    user->name = NULL;
    free(user->email);
    user->email = NULL;
    free(user);
}

/* GOOD: Safe free macro */
#define SAFE_FREE(ptr) \
    do {               \
        free(ptr);     \
        (ptr) = NULL;  \
    } while (0)

/* Usage */
SAFE_FREE(buffer);
SAFE_FREE(name);

/* BAD: Free without NULL -- dangling pointer */
free(buffer);
/* buffer still holds old address -- use-after-free risk */
if (buffer) {  /* This check is MEANINGLESS after free */
    use(buffer);
}
```

---

## Goto Cleanup for Resource Safety

The `goto cleanup` pattern ensures all resources are freed on every exit path. See error-handling.md for full details.

```c
/* GOOD: All resources freed regardless of which step failed */
int process(const char *input, result_t *out) {
    int rc = ERR_OK;
    char *buffer = NULL;
    FILE *fp = NULL;
    cJSON *json = NULL;

    buffer = malloc(BUFFER_SIZE);
    if (!buffer) { rc = ERR_NOMEM; goto cleanup; }

    fp = fopen(input, "r");
    if (!fp) { rc = ERR_IO; goto cleanup; }

    /* ... use buffer and fp ... */

    json = cJSON_Parse(buffer);
    if (!json) { rc = ERR_VALIDATION; goto cleanup; }

    rc = extract(json, out);

cleanup:
    if (json)   cJSON_Delete(json);
    if (fp)     fclose(fp);
    free(buffer);  /* free(NULL) is safe per C standard */
    return rc;
}

/* BAD: Early returns leak resources */
int process(const char *input, result_t *out) {
    char *buffer = malloc(BUFFER_SIZE);
    if (!buffer) return ERR_NOMEM;

    FILE *fp = fopen(input, "r");
    if (!fp) return ERR_IO;  /* LEAK: buffer not freed */

    /* ... */
}
```

---

## Buffer Overflow Prevention

```c
/* GOOD: Use snprintf instead of sprintf */
char message[256];
snprintf(message, sizeof(message), "User %s logged in from %s", name, ip);

/* GOOD: Use strncpy with explicit null termination */
char dest[64];
strncpy(dest, src, sizeof(dest) - 1);
dest[sizeof(dest) - 1] = '\0';

/* GOOD: Use strncat with remaining space calculation */
char path[PATH_MAX];
strncpy(path, base_dir, sizeof(path) - 1);
path[sizeof(path) - 1] = '\0';
strncat(path, "/", sizeof(path) - strlen(path) - 1);
strncat(path, filename, sizeof(path) - strlen(path) - 1);

/* GOOD: Bounds-check array access */
int get_item(const int *arr, size_t arr_len, size_t index) {
    if (index >= arr_len) {
        return ERR_OUT_OF_BOUNDS;
    }
    return arr[index];
}

/* BAD: sprintf -- no bounds checking */
char message[64];
sprintf(message, "User %s logged in from %s", name, ip);  /* Buffer overflow */

/* BAD: strcpy -- no bounds checking */
char dest[64];
strcpy(dest, src);  /* Overflow if src > 63 chars */

/* BAD: gets -- never use, removed in C11 */
char input[256];
gets(input);  /* Unbounded read from stdin */
```

### Banned Functions

| Banned | Replacement | Reason |
|---|---|---|
| `sprintf` | `snprintf` | No bounds checking |
| `strcpy` | `strncpy` + null term, or `snprintf` | No bounds checking |
| `strcat` | `strncat` or `snprintf` | No bounds checking |
| `gets` | `fgets` | Removed in C11, unbounded |
| `scanf("%s", ...)` | `scanf("%63s", ...)` with width | Unbounded string read |
| `atoi`, `atol` | `strtol`, `strtoul` | No error detection |

---

## Valgrind Memcheck

```bash
# Full leak check
valgrind --leak-check=full \
    --show-leak-kinds=all \
    --track-origins=yes \
    --error-exitcode=1 \
    ./build/myapp

# With suppression file
valgrind --leak-check=full \
    --suppressions=valgrind.supp \
    --error-exitcode=1 \
    ./build/tests/test_user
```

### What Valgrind Detects

| Issue | Example |
|---|---|
| Memory leak | `malloc` without `free` |
| Use-after-free | Accessing freed memory |
| Invalid read/write | Buffer overflow, out-of-bounds |
| Uninitialized value | Reading memory before writing |
| Double free | Calling `free` twice on same pointer |
| Mismatched free | `free` on stack memory or wrong allocator |

---

## AddressSanitizer (ASan)

Faster than Valgrind, compile-time instrumentation.

```bash
# Build with ASan
cmake -B build-asan -DCMAKE_BUILD_TYPE=Debug \
    -DCMAKE_C_FLAGS="-fsanitize=address -fno-omit-frame-pointer"
cmake --build build-asan

# Run tests under ASan
ctest --test-dir build-asan --output-on-failure

# Enable leak detection (default on Linux, opt-in on macOS)
ASAN_OPTIONS=detect_leaks=1 ./build-asan/myapp
```

### ASan Detects

- Heap buffer overflow
- Stack buffer overflow
- Global buffer overflow
- Use-after-free
- Use-after-scope
- Double free
- Memory leaks (with `detect_leaks=1`)

---

## Arena / Pool Allocators

For performance-critical paths, arena allocators avoid per-object free overhead and eliminate fragmentation.

```c
/* Simple arena allocator */
typedef struct {
    char  *base;
    size_t capacity;
    size_t offset;
} arena_t;

int arena_init(arena_t *a, size_t capacity) {
    a->base = malloc(capacity);
    if (!a->base) return ERR_NOMEM;
    a->capacity = capacity;
    a->offset = 0;
    return ERR_OK;
}

void *arena_alloc(arena_t *a, size_t size) {
    /* Align to 16 bytes */
    size_t aligned = (size + 15) & ~(size_t)15;
    if (a->offset + aligned > a->capacity) {
        return NULL;  /* Out of space */
    }
    void *ptr = a->base + a->offset;
    a->offset += aligned;
    return ptr;
}

void arena_reset(arena_t *a) {
    a->offset = 0;  /* "Free" everything at once */
}

void arena_destroy(arena_t *a) {
    free(a->base);
    a->base = NULL;
    a->capacity = 0;
    a->offset = 0;
}

/* Usage: request-scoped allocation */
int handle_request(const request_t *req, response_t *resp) {
    arena_t arena;
    if (arena_init(&arena, 64 * 1024) != ERR_OK) {
        return ERR_NOMEM;
    }

    char *name = arena_alloc(&arena, 256);
    char *body = arena_alloc(&arena, 4096);
    /* ... use name and body ... */

    arena_destroy(&arena);  /* Single free for all allocations */
    return ERR_OK;
}
```

---

## RAII-Like Patterns with GCC/Clang Cleanup Attribute

```c
/* GCC/Clang extension: __attribute__((cleanup)) */
static void free_ptr(void *p) {
    free(*(void **)p);
}

static void close_file(FILE **fp) {
    if (*fp) fclose(*fp);
}

#define AUTO_FREE __attribute__((cleanup(free_ptr)))
#define AUTO_CLOSE __attribute__((cleanup(close_file)))

/* Usage: automatic cleanup on scope exit */
int read_config(const char *path, config_t *out) {
    AUTO_FREE char *buffer = malloc(4096);
    if (!buffer) return ERR_NOMEM;

    AUTO_CLOSE FILE *fp = fopen(path, "r");
    if (!fp) return ERR_IO;

    size_t n = fread(buffer, 1, 4095, fp);
    buffer[n] = '\0';

    return parse_config(buffer, out);
    /* fp closed and buffer freed automatically at scope exit */
}

/* GOOD: Scope guard macro for arbitrary cleanup */
#define DEFER(fn) __attribute__((cleanup(fn)))
```

**Note**: `__attribute__((cleanup))` is a GCC/Clang extension, not standard C. Use for internal code; prefer goto cleanup for portable library code.

---

## Dangling Pointer Prevention

```c
/* GOOD: NULL after free prevents use-after-free */
free(user->name);
user->name = NULL;

/* GOOD: Invalidate pointer after transferring ownership */
connection_t *conn = connection_create();
pool_add(pool, conn);  /* Pool now owns conn */
conn = NULL;            /* Prevent accidental use */

/* BAD: Returning pointer to local stack variable */
char *get_greeting(void) {
    char buf[64];
    snprintf(buf, sizeof(buf), "Hello, World!");
    return buf;  /* DANGLING: buf is on stack, destroyed on return */
}

/* GOOD: Return heap-allocated or caller-provided buffer */
char *get_greeting(void) {
    char *buf = malloc(64);
    if (!buf) return NULL;
    snprintf(buf, 64, "Hello, World!");
    return buf;  /* Caller must free */
}

int get_greeting(char *buf, size_t buf_size) {
    snprintf(buf, buf_size, "Hello, World!");
    return ERR_OK;
}
```

---

## Double-Free Prevention

```c
/* GOOD: Idempotent destroy function */
void resource_destroy(resource_t **res) {
    if (!res || !*res) return;

    free((*res)->data);
    free(*res);
    *res = NULL;  /* Prevents double-free if called again */
}

/* Usage */
resource_t *r = resource_create();
resource_destroy(&r);  /* r is now NULL */
resource_destroy(&r);  /* Safe: no-op because r is NULL */

/* BAD: Non-idempotent free */
void resource_destroy(resource_t *res) {
    free(res->data);  /* Crash on double call */
    free(res);
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Unchecked `malloc` | Null dereference crash | Always check return, handle `ERR_NOMEM` |
| `free()` without NULL | Dangling pointer, use-after-free | `SAFE_FREE` macro or manual NULL after free |
| `sprintf`, `strcpy`, `strcat` | Buffer overflow | `snprintf`, `strncpy` + null term |
| Returning pointer to stack variable | Dangling pointer, UB | Return heap-allocated or use output parameter |
| No Valgrind/ASan in CI | Memory bugs reach production | Run sanitizers on every test |
| Manual cleanup at each error point | Missed frees, duplicated code | `goto cleanup` pattern |
| Mixing allocators | Heap corruption | Match `malloc`/`free`, `calloc`/`free`, custom pairs |
| VLA (variable-length arrays) | Stack overflow, no error handling | Use `malloc` with size check |
| `realloc` without temp pointer | Leak on failure | `tmp = realloc(ptr, n); if (tmp) ptr = tmp;` |

---

_Memory safety in C is achieved through discipline, patterns, and tools. Check every allocation, free on every path, NULL after free, and verify with sanitizers._
