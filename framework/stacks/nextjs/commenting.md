# Code Commenting Standards

Documentation and commenting conventions for TypeScript and React codebases, favoring self-documenting code with strategic comments.

---

## Philosophy

- **Code is the source of truth**: Comments explain why, not what
- **Self-documenting first**: Clear names and structure beat comments every time
- **Evergreen only**: No temporal comments about recent changes or fixes
- **Public APIs deserve docs**: JSDoc for exported functions, types, and components

---

## When to Comment vs Self-Document

### Do Not Comment

```typescript
// BAD: Comment restates the code
// Check if user is active
if (user.isActive) { ... }

// BAD: Comment about a recent change
// Fixed bug where users could submit empty names (PR #142)
const name = formData.get("name");

// BAD: Commented-out code
// const oldLogic = computeLegacyScore(user);
const score = computeScore(user);
```

### Do Comment

```typescript
// GOOD: Explains a non-obvious business rule
// Users created before 2023 have unlimited storage due to legacy pricing
if (user.createdAt < LEGACY_CUTOFF_DATE) {
  return Infinity;
}

// GOOD: Explains a workaround
// Prisma does not support upsert with composite keys in SQLite,
// so we use a transaction with findFirst + create/update instead
await prisma.$transaction(async (tx) => { ... });

// GOOD: Documents a performance decision
// Batched in chunks of 100 to avoid exceeding Postgres parameter limit (65535)
for (const chunk of chunks(items, 100)) { ... }
```

---

## JSDoc for Public APIs

### Exported Functions

```typescript
/**
 * Formats a date relative to now (e.g., "2 hours ago", "yesterday").
 *
 * Falls back to absolute date format for dates older than 7 days.
 *
 * @param date - The date to format
 * @param locale - BCP 47 locale string (defaults to "en-US")
 * @returns Formatted relative or absolute date string
 *
 * @example
 * ```ts
 * formatRelativeDate(new Date()) // "just now"
 * formatRelativeDate(subDays(new Date(), 2)) // "2 days ago"
 * ```
 */
export function formatRelativeDate(date: Date, locale = "en-US"): string {
  // ...
}
```

### Exported Types

```typescript
/**
 * Result of a server action that may fail with field-level errors.
 *
 * @typeParam T - The shape of field errors (keys are field names, values are error messages)
 */
export type ActionResult<T extends Record<string, string[]> = Record<string, string[]>> =
  | { success: true }
  | { success: false; error: string; fieldErrors?: T };
```

### React Components

```typescript
/**
 * Displays a user avatar with fallback initials.
 *
 * Renders the user's profile image when available, otherwise shows
 * initials derived from the user's name on a colored background.
 *
 * @example
 * ```tsx
 * <UserAvatar user={currentUser} size="lg" />
 * <UserAvatar user={currentUser} size="sm" className="ring-2 ring-white" />
 * ```
 */
export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  // ...
}
```

---

## TSDoc Tags Reference

| Tag | Usage |
|---|---|
| `@param name` | Describe a function parameter |
| `@returns` | Describe the return value |
| `@throws` | Document exceptions that may be thrown |
| `@example` | Provide usage examples (fenced code blocks) |
| `@typeParam T` | Describe a generic type parameter |
| `@see` | Reference related functions or documentation |
| `@deprecated` | Mark as deprecated with migration guidance |
| `@internal` | Mark as not part of the public API |

### Deprecation Pattern

```typescript
/**
 * @deprecated Use `formatRelativeDate` instead. Will be removed in v3.0.
 * @see formatRelativeDate
 */
export function timeAgo(date: Date): string {
  return formatRelativeDate(date);
}
```

---

## TODO Conventions

### Format

```typescript
// TODO(username): Brief description of what needs to be done
// TODO(yacin): Add pagination support when user count exceeds 1000

// TODO: Acceptable when author is obvious from git blame
// TODO: Replace with server action once Next.js supports streaming responses in actions
```

### Rules

- Include a name or context when the TODO is non-trivial
- Never use TODO as an excuse to leave broken code -- the code must work without the TODO being resolved
- Do not use FIXME, HACK, or XXX -- use TODO with a clear description instead
- Periodically audit TODOs and convert to issues or delete stale ones

---

## File-Level Comments

### When Needed

```typescript
/**
 * Prisma client singleton for Next.js.
 *
 * In development, Next.js clears the Node.js module cache on every request,
 * which would create a new PrismaClient instance each time. This module
 * stores the client on `globalThis` to prevent connection pool exhaustion.
 *
 * @see https://www.prisma.io/docs/guides/nextjs
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### When Not Needed

Do not add file-level comments to simple component files, route handlers, or utility files where the filename and exports make the purpose obvious.

---

## Inline Comment Style

```typescript
// Single-line comments use double slash with a space after
// Capitalize the first word. No trailing period for short comments

// Multi-line comments that explain a complex block
// should use consecutive single-line comments rather than
// block comments (/* */). This makes it easier to toggle
// individual lines during development.

/*
 * Block comments are reserved for JSDoc on exported symbols
 * and file-level documentation only.
 */
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Commenting every line | Noise, goes stale instantly | Write self-documenting code |
| `// Fixed in PR #142` | Temporal, use git history instead | Delete; `git blame` has this info |
| Commented-out code | Confusion about what is active | Delete; git has the history |
| `// This is a hack` without explanation | Unhelpful | Explain why the hack exists and when it can be removed |
| Missing JSDoc on public API | Users guess at behavior | Document all exported functions and types |
| `@author` tags | Redundant with git blame | Let version control track authorship |

---

_The best code reads like well-written prose. Comments are footnotes -- essential for context, distracting when overused._
