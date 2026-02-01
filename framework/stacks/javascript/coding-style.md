# JavaScript Coding Style

Coding style conventions beyond what ESLint and Prettier enforce automatically. Opinionated patterns for readable, maintainable JavaScript.

---

## Philosophy

- **Readability counts**: Code is read far more than written
- **Modern syntax**: Use ES2024+ features; do not write ES5-era code
- **Consistency over preference**: Follow the project convention, not personal style
- **Automate what you can**: Let ESLint and Prettier handle formatting; this doc covers judgment calls

---

## Naming Conventions

### Standard JavaScript Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Variables, functions | `camelCase` | `userCount`, `getUser` |
| Classes | `PascalCase` | `UserService`, `AppError` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_PAGE_SIZE` |
| Files, modules | `kebab-case` or `camelCase` | `user-service.js`, `userService.js` |
| Private (convention) | `_leadingUnderscore` or `#private` | `_cache`, `#connection` |
| Enums (object) | `PascalCase` object, `UPPER_SNAKE_CASE` values | `Status.ACTIVE` |
| Environment vars | `UPPER_SNAKE_CASE` | `DATABASE_URL`, `NODE_ENV` |

### Naming Rules

```javascript
// GOOD: Descriptive, reveals intent
const userCount = activeUsers.length;
const isAuthenticated = token !== null;
const MAX_RETRY_ATTEMPTS = 3;

async function getActiveUsers(db) {
  // ...
}

class PaymentProcessingError extends AppError {
  // ...
}

// BAD: Abbreviated, unclear
const uc = au.length;
const auth = token !== null;
const n = 3;
```

### Boolean Naming

Prefix with `is`, `has`, `can`, `should`:

```javascript
const isActive = true;
const hasPermission = user.roles.includes('admin');
const canPublish = post.status === 'draft';
const shouldNotify = preferences.emailEnabled;
```

---

## Variable Declarations

```javascript
// GOOD: const by default, let only when reassignment is needed
const users = await getUsers();
const config = Object.freeze({ port: 3000, host: 'localhost' });

let retryCount = 0;
while (retryCount < MAX_RETRIES) {
  retryCount++;
}

// BAD: var (function-scoped, hoisted, error-prone)
var users = await getUsers();  // Never use var
```

**Rule**: Always use `const`. Use `let` only when the variable must be reassigned. Never use `var`.

---

## Modern JavaScript Features

### Destructuring

```javascript
// GOOD: Destructure objects and arrays
const { name, email, role = 'user' } = user;
const [first, ...rest] = items;
const { data: users, error } = await fetchUsers();

// GOOD: Parameter destructuring
function createUser({ name, email, password }) {
  // ...
}
```

### Optional Chaining and Nullish Coalescing

```javascript
// GOOD: Optional chaining for safe deep access
const city = user?.address?.city;
const firstTag = post?.tags?.[0];

// GOOD: Nullish coalescing for defaults (only null/undefined)
const pageSize = options.pageSize ?? 20;

// BAD: Logical OR for defaults (falsy trap: 0, '', false are overridden)
const pageSize = options.pageSize || 20;  // BUG: pageSize=0 becomes 20
```

### Template Literals

```javascript
// GOOD: Template literals for string interpolation
const message = `User ${user.name} created with ID ${user.id}`;

// BAD: String concatenation
const message = 'User ' + user.name + ' created with ID ' + user.id;
```

---

## Arrow Functions vs Function Declarations

```javascript
// GOOD: Function declarations for named, top-level functions
async function createUser(data) {
  // ...
}

// GOOD: Arrow functions for callbacks and short expressions
const activeUsers = users.filter(user => user.isActive);
const names = users.map(user => user.name);

// BAD: Arrow functions for complex, named functions
const createUser = async (data) => {
  // 30+ lines of complex logic -- hard to find in stack traces
};
```

**Rule**: Use function declarations for named, reusable functions. Use arrow functions for callbacks and array methods.

---

## Function Design

### Size Limits

- **Target**: Under 20 lines of logic
- **Maximum**: 40 lines (extract if longer)
- **Parameters**: Maximum 4; use an options object for more

```javascript
// GOOD: Options object for many parameters
async function queryUsers({ status, role, page = 1, limit = 20, sortBy = 'createdAt' } = {}) {
  // ...
}

// BAD: Too many positional parameters
async function queryUsers(status, role, page, limit, sortBy, sortOrder, includeDeleted) {
  // ...
}
```

### Early Returns (Guard Clauses)

```javascript
// GOOD: Guard clauses
async function publishPost(post, user) {
  if (post.userId !== user.id) {
    throw new AuthorizationError('Cannot publish another user\'s post');
  }
  if (post.status === 'published') {
    throw new ConflictError('Already published');
  }
  if (!post.body) {
    throw new ValidationError('Body required');
  }

  post.status = 'published';
  return postRepo.save(post);
}

// BAD: Deeply nested
async function publishPost(post, user) {
  if (post.userId === user.id) {
    if (post.status !== 'published') {
      if (post.body) {
        post.status = 'published';
        return postRepo.save(post);
      }
    }
  }
}
```

---

## Module Organization

### ESM Module Layout

```javascript
// 1. Node.js built-in imports
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// 2. Third-party imports
import Fastify from 'fastify';
import { z } from 'zod';

// 3. Local imports
import { AppError } from './errors.js';
import { userService } from './services/user-service.js';

// 4. Module-level constants
const MAX_RETRIES = 3;
const DEFAULT_PAGE_SIZE = 20;

// 5. Classes and functions
export class UserController {
  // ...
}
```

### Import Rules

- Always use ESM (`import/export`), never CommonJS (`require/module.exports`)
- Include file extensions in relative imports (`.js`)
- Prefix Node.js built-ins with `node:` (`import { readFile } from 'node:fs/promises'`)
- Group imports: built-ins, third-party, local (separated by blank lines)

---

## Equality and Comparisons

```javascript
// GOOD: Always use strict equality
if (status === 'active') { /* ... */ }
if (count !== 0) { /* ... */ }

// Only acceptable use of == is null check
if (value == null) { /* ... */ }  // Checks both null and undefined

// BAD: Loose equality (type coercion traps)
if (status == 'active') { /* ... */ }
```

---

## Common Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Callback hell | Pyramid of doom, hard to read | async/await |
| `var` declarations | Function-scoped, hoisting bugs | `const` / `let` |
| Implicit globals | Missing declaration pollutes global scope | Always declare variables |
| Mutating function arguments | Caller's object is modified | Return new object with spread |
| Prototype pollution | Merging untrusted input | Validate keys, use structuredClone |
| `||` for defaults | Falsy trap (0, '', false overridden) | Use `??` (nullish coalescing) |

---

## File and Class Size

| Element | Guideline |
|---------|-----------|
| Function | Under 20 lines of logic, max 40 |
| Class | Under 200 lines, max 300 |
| Module | Under 300 lines, max 500 |
| Parameters | Max 4 per function; use options object for more |

---

## Formatting (Handled by Prettier)

These are automated -- do not worry about them manually:

- Line length: 100 characters
- Indentation: 2 spaces
- Semicolons: consistent (pick one, enforce it)
- Quote style: single quotes
- Trailing commas in multi-line constructs

Run `npx prettier --write .` and move on.

---

_Style is a tool for communication. Write code that your future self and teammates will thank you for._
