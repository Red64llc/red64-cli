# C Coding Style

Coding style conventions for modern C projects. Opinionated patterns for readable, maintainable C17/C23 code beyond what clang-format enforces automatically.

---

## Philosophy

- **Explicit over implicit**: C gives you control; use it deliberately and visibly
- **Consistency above all**: snake_case everywhere, K&R braces, predictable structure
- **Const correctness**: If it does not change, mark it `const`
- **Minimal scope**: Static for internal linkage, block-scoped variables, small functions
- **Automate what you can**: Let clang-format handle layout; this doc covers judgment calls

---

## Naming Conventions

### Standard C Naming

| Element | Convention | Example |
|---|---|---|
| Functions | `snake_case` | `parse_config`, `get_user_count` |
| Variables, parameters | `snake_case` | `user_count`, `max_retries` |
| Typedefs (structs, enums) | `snake_case_t` | `user_t`, `config_t`, `error_code_t` |
| Macros | `UPPER_CASE` | `MAX_BUFFER_SIZE`, `LOG_ERROR` |
| Constants (`#define`, `enum`) | `UPPER_CASE` | `MAX_RETRIES`, `STATUS_OK` |
| Enum values | `PREFIX_UPPER_CASE` | `ERR_NOT_FOUND`, `STATUS_ACTIVE` |
| Struct members | `snake_case` | `first_name`, `retry_count` |
| File-local (static) functions | `snake_case` (no prefix needed) | `validate_input` |
| Global variables (avoid) | `g_snake_case` | `g_config`, `g_logger` |
| Pointer variables | `*` attached to name | `int *ptr`, `char *name` |

### Naming Rules

```c
/* GOOD: Descriptive, reveals intent */
int active_user_count = get_active_users(db);
bool is_authenticated = token_validate(token);

#define MAX_RETRY_ATTEMPTS 3

typedef struct {
    int         id;
    const char *name;
    const char *email;
} user_t;

int user_find_by_email(const char *email, user_t *out_user);

/* BAD: Abbreviated, unclear, inconsistent */
int auc = getAU(db);
bool auth = tokVal(tok);
#define n 3
typedef struct { int Id; char *Name; } User;
```

### Boolean Naming

Prefix with `is_`, `has_`, `can_`, `should_`:

```c
bool is_active = true;
bool has_permission = check_access(user, resource);
bool can_publish = (post->status == STATUS_DRAFT);
bool should_notify = user->preferences.notifications_enabled;
```

---

## Brace Style (K&R)

Opening brace on the same line as the statement. Functions may optionally place the brace on the next line (BSD/Allman variant), but K&R is preferred for consistency.

```c
/* GOOD: K&R brace style */
if (count > 0) {
    process_items(items, count);
} else {
    log_warn("no items to process");
}

for (size_t i = 0; i < len; i++) {
    buffer[i] = 0;
}

typedef struct {
    int   id;
    char *name;
} user_t;

int parse_config(const char *path, config_t *out) {
    FILE *fp = fopen(path, "r");
    if (!fp) {
        return -1;
    }
    /* ... */
    fclose(fp);
    return 0;
}

/* BAD: Allman/GNU style (inconsistent with project) */
if (count > 0)
{
    process_items(items, count);
}
```

---

## Function Design

### Size and Parameter Limits

| Element | Guideline |
|---|---|
| Function body | Under 30 lines of logic, max 50 |
| Source file | Under 500 lines, max 800 |
| Header file | Under 200 lines, max 400 |
| Parameters | Max 5; use a struct/options for more |
| Nesting depth | Max 3 levels; extract helper functions |

### Early Returns with Guard Clauses

```c
/* GOOD: Guard clauses reduce nesting */
int user_create(const create_request_t *req, user_t *out) {
    if (!req || !out) {
        return ERR_NULL_PARAM;
    }
    if (strlen(req->email) == 0) {
        return ERR_VALIDATION;
    }
    if (user_exists_by_email(req->email)) {
        return ERR_ALREADY_EXISTS;
    }

    /* Main logic at base indentation */
    out->id = next_id();
    out->name = strdup(req->name);
    out->email = strdup(req->email);
    return 0;
}

/* BAD: Deeply nested conditional logic */
int user_create(const create_request_t *req, user_t *out) {
    if (req && out) {
        if (strlen(req->email) > 0) {
            if (!user_exists_by_email(req->email)) {
                out->id = next_id();
                out->name = strdup(req->name);
                out->email = strdup(req->email);
                return 0;
            }
            return ERR_ALREADY_EXISTS;
        }
        return ERR_VALIDATION;
    }
    return ERR_NULL_PARAM;
}
```

---

## Header Guards

### Preferred: `#pragma once`

```c
/* GOOD: Simple, no name collisions */
#pragma once

#include <stddef.h>
#include <stdbool.h>

typedef struct {
    int id;
    char *name;
} user_t;

int user_create(const char *name, user_t *out);
```

### Alternative: Traditional Include Guards

```c
/* ACCEPTABLE: Required for some compilers or coding standards */
#ifndef MYPROJECT_USER_H
#define MYPROJECT_USER_H

#include <stddef.h>

/* ... */

#endif /* MYPROJECT_USER_H */
```

**Pattern**: `PROJECT_DIRECTORY_FILENAME_H` for traditional guards to avoid collisions.

---

## Include Order

```c
/* 1. Corresponding header (for .c files) */
#include "myproject/user.h"

/* 2. C standard library */
#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* 3. POSIX / system headers */
#include <unistd.h>
#include <sys/types.h>

/* 4. Third-party libraries */
#include <cJSON.h>
#include <curl/curl.h>

/* 5. Project headers */
#include "myproject/config.h"
#include "myproject/error.h"
```

**Rule**: Alphabetical within each group. Blank line between groups. The corresponding header is always first to verify it is self-contained.

---

## Const Correctness

```c
/* GOOD: Const on pointers that should not be modified */
void print_user(const user_t *user) {
    printf("Name: %s\n", user->name);
}

/* GOOD: Const on data that functions should not mutate */
int count_active(const user_t *users, size_t len) {
    int count = 0;
    for (size_t i = 0; i < len; i++) {
        if (users[i].is_active) {
            count++;
        }
    }
    return count;
}

/* GOOD: Const for string parameters */
int parse_config(const char *path, config_t *out);

/* BAD: Missing const -- caller cannot trust function will not modify data */
int count_active(user_t *users, size_t len);
void print_user(user_t *user);
```

---

## Static for Internal Linkage

```c
/* GOOD: Static functions are file-private (internal linkage) */
static int validate_email(const char *email) {
    if (!email || strlen(email) == 0) {
        return -1;
    }
    return strchr(email, '@') ? 0 : -1;
}

/* GOOD: Static variables for file-scoped state */
static int s_initialized = 0;
static config_t s_config;

/* Public API function (declared in header) */
int config_init(const char *path) {
    if (s_initialized) {
        return ERR_ALREADY_INIT;
    }
    int rc = parse_config_file(path, &s_config);
    if (rc == 0) {
        s_initialized = 1;
    }
    return rc;
}

/* BAD: Non-static helper visible to linker -- potential name collision */
int validate_email(const char *email) { /* ... */ }
```

---

## Typedef Conventions

```c
/* GOOD: Typedef structs with _t suffix */
typedef struct {
    int   id;
    char *name;
    char *email;
} user_t;

/* GOOD: Typedef enums */
typedef enum {
    STATUS_OK       = 0,
    STATUS_ERROR    = -1,
    STATUS_TIMEOUT  = -2,
} status_t;

/* GOOD: Opaque types for encapsulation */
/* In header: */
typedef struct database database_t;

/* In source: */
struct database {
    void *handle;
    char *connection_string;
};

/* BAD: No typedef, verbose usage everywhere */
struct user {
    int id;
    char *name;
};
void print(struct user *u);  /* Requires 'struct' keyword each time */
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| camelCase or PascalCase for functions | Inconsistent with C ecosystem | `snake_case` for all functions and variables |
| Hungarian notation (`iCount`, `szName`) | Adds noise, types change | Descriptive `snake_case` names |
| Single-letter variable names | Unreadable outside tiny loops | Full descriptive names; `i`, `j`, `n` only for loop counters |
| Missing `const` on pointer parameters | Caller cannot trust immutability | Add `const` to all read-only pointer params |
| Non-static file-local functions | Pollutes global symbol table, name collisions | Mark all internal functions `static` |
| Macro constants for typed values | No type safety, no scope | Use `enum` or `static const` where possible |
| Functions over 50 lines | Hard to read, test, and maintain | Extract helper functions |
| Deep nesting (>3 levels) | Cognitive complexity | Guard clauses, early returns, extract functions |

---

_Consistency is the highest virtue in C style. Write code that reads like well-organized prose: clear names, flat structure, explicit intent._
