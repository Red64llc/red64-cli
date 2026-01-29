# Prisma Query Patterns

Best practices for Prisma Client queries, N+1 prevention, transactions, pagination, and performance optimization.

---

## Philosophy

- **Select what you need**: Never fetch entire models when a subset of fields suffices
- **Prevent N+1 at write time**: Use `include` and `select` deliberately, not as an afterthought
- **Type safety end-to-end**: Let Prisma's generated types flow from query to UI component
- **Connection awareness**: Serverless and edge runtimes need connection pooling

---

## Prisma Client Singleton

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Why globalThis**: Next.js dev server clears module cache on every request. Without this, each request creates a new `PrismaClient`, exhausting the connection pool.

---

## Basic Queries

### Find Unique

```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// With specific fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, name: true, email: true },
});
```

### Find Many with Filtering

```typescript
const publishedPosts = await prisma.post.findMany({
  where: {
    status: "PUBLISHED",
    deletedAt: null,
    author: { isActive: true },
  },
  orderBy: { createdAt: "desc" },
  take: 20,
});
```

### Create

```typescript
const user = await prisma.user.create({
  data: {
    email: "jane@example.com",
    name: "Jane Doe",
    hashedPassword: await hash(password),
  },
});
```

### Update

```typescript
const user = await prisma.user.update({
  where: { id: userId },
  data: { name: "Updated Name" },
});
```

### Upsert

```typescript
const user = await prisma.user.upsert({
  where: { email: "jane@example.com" },
  create: { email: "jane@example.com", name: "Jane", hashedPassword: hash },
  update: { name: "Jane" },
});
```

### Delete

```typescript
// Hard delete
await prisma.user.delete({ where: { id: userId } });

// Soft delete (preferred)
await prisma.user.update({
  where: { id: userId },
  data: { deletedAt: new Date() },
});
```

---

## N+1 Prevention

### The Problem

```typescript
// BAD: N+1 - one query per post to fetch author
const posts = await prisma.post.findMany();
for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } });
  // This runs N additional queries
}
```

### Solution: include

```typescript
// GOOD: Single query with JOIN
const posts = await prisma.post.findMany({
  include: {
    author: { select: { id: true, name: true, avatarUrl: true } },
  },
});
// posts[0].author.name is available
```

### Solution: select (Leaner)

```typescript
// BETTER: Only fetch exactly what you need
const posts = await prisma.post.findMany({
  select: {
    id: true,
    title: true,
    createdAt: true,
    author: { select: { name: true, avatarUrl: true } },
  },
});
```

### Nested Includes

```typescript
// Fetch post with author and comments (including comment authors)
const post = await prisma.post.findUnique({
  where: { id: postId },
  include: {
    author: { select: { id: true, name: true } },
    comments: {
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    },
  },
});
```

### When to Use include vs select

| Approach | Use When |
|---|---|
| `include` | Need all model fields plus relations |
| `select` | Need specific fields only (API responses, lists) |

**Rule**: Default to `select` for list queries. Use `include` for detail views where you need the full model.

---

## Pagination

### Offset-Based (Simple, for Admin UIs)

```typescript
interface PaginationParams {
  page: number;
  limit: number;
}

async function getUsers({ page, limit }: PaginationParams) {
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.user.count(),
  ]);

  return {
    items: users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

### Cursor-Based (Scalable, for Feeds)

```typescript
async function getPosts(cursor?: string, limit = 20) {
  const posts = await prisma.post.findMany({
    take: limit + 1, // Fetch one extra to check if there's a next page
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor itself
    }),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  const hasNext = posts.length > limit;
  const items = hasNext ? posts.slice(0, -1) : posts;

  return {
    items,
    hasNext,
    nextCursor: hasNext ? items[items.length - 1]?.id : null,
  };
}
```

### When to Use Each

| Type | Use Case | Tradeoff |
|---|---|---|
| Offset | Admin dashboards, small datasets | Slow on large tables (COUNT + OFFSET) |
| Cursor | Infinite scroll, feeds, public APIs | Cannot jump to arbitrary page |

---

## Transactions

### Interactive Transactions

```typescript
async function transferCredits(fromId: string, toId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const sender = await tx.user.findUnique({ where: { id: fromId } });
    if (!sender || sender.credits < amount) {
      throw new Error("Insufficient credits");
    }

    await tx.user.update({
      where: { id: fromId },
      data: { credits: { decrement: amount } },
    });

    await tx.user.update({
      where: { id: toId },
      data: { credits: { increment: amount } },
    });

    return { fromId, toId, amount };
  });
}
```

### Batch Transactions

```typescript
// Multiple operations in a single transaction
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.post.create({ data: postData }),
]);
```

### Transaction Options

```typescript
await prisma.$transaction(
  async (tx) => { /* ... */ },
  {
    maxWait: 5000,    // Max time to wait for a connection from the pool
    timeout: 10000,   // Max time for the transaction to complete
    isolationLevel: "Serializable", // Strictest isolation
  }
);
```

---

## Filtering Patterns

### Dynamic Filters

```typescript
interface PostFilters {
  status?: string;
  authorId?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

async function getPosts(filters: PostFilters) {
  const where: Prisma.PostWhereInput = {
    deletedAt: null,
    ...(filters.status && { status: filters.status as PostStatus }),
    ...(filters.authorId && { authorId: filters.authorId }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { body: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
    ...(filters.from && { createdAt: { gte: filters.from } }),
    ...(filters.to && { createdAt: { ...( filters.from ? { gte: filters.from } : {}), lte: filters.to } }),
  };

  return prisma.post.findMany({ where, orderBy: { createdAt: "desc" } });
}
```

### Sorting

```typescript
type SortField = "createdAt" | "title" | "updatedAt";
type SortDirection = "asc" | "desc";

function buildOrderBy(sort: string): Prisma.PostOrderByWithRelationInput {
  const desc = sort.startsWith("-");
  const field = (desc ? sort.slice(1) : sort) as SortField;
  return { [field]: desc ? "desc" : "asc" };
}
```

---

## Raw Queries

### When Prisma Client Is Not Enough

```typescript
// Type-safe raw query with tagged template
const users = await prisma.$queryRaw<{ id: string; postCount: number }[]>`
  SELECT u.id, COUNT(p.id)::int AS "postCount"
  FROM users u
  LEFT JOIN posts p ON p.author_id = u.id AND p.deleted_at IS NULL
  GROUP BY u.id
  HAVING COUNT(p.id) > ${minPosts}
  ORDER BY "postCount" DESC
  LIMIT ${limit}
`;
```

**Rule**: Use raw queries only for complex aggregations, window functions, or CTEs that Prisma Client cannot express. Always use tagged templates (never string interpolation) to prevent SQL injection.

---

## Connection Pooling

### Serverless (Vercel / Neon)

```
# .env
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://user:pass@direct-host/db"
```

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Why**: `DATABASE_URL` goes through a connection pooler (PgBouncer/Neon) for query traffic. `directUrl` connects directly for migrations.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Fetching all fields for list views | Over-fetching, slower queries | Use `select` for lists |
| No `include`/`select` on relations | N+1 queries at runtime | Include relations at query time |
| String interpolation in raw queries | SQL injection vulnerability | Use tagged template literals |
| No connection pooling in serverless | Connection exhaustion | Use PgBouncer or Neon pooler |
| Offset pagination on large tables | Slow due to OFFSET scan | Switch to cursor-based pagination |
| Transactions for single operations | Unnecessary overhead | Transactions only for multi-step operations |
| Count queries without filters | Full table scan | Always apply the same `where` clause to count |

---

_Queries define performance. Select only what you need, prevent N+1 at write time, and let Prisma's types guarantee correctness._
