# Prisma Schema Design

Best practices for Prisma schema definition, naming conventions, relations, and type-safe validation.

---

## Philosophy

- **Schema is the source of truth**: Database structure defined in `schema.prisma`, validated by Zod
- **Database enforces integrity**: Constraints live in the schema, not just application code
- **Generated types everywhere**: Prisma Client types flow from schema to UI
- **Thin models, rich services**: Business logic belongs in service functions, not in the schema

---

## Schema Configuration

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Model Definition

### Complete Example

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String
  hashedPassword String    @map("hashed_password")
  bio            String?
  avatarUrl      String?   @map("avatar_url")
  role           UserRole  @default(MEMBER)
  isActive       Boolean   @default(true) @map("is_active")
  lastLoginAt    DateTime? @map("last_login_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  // Relations
  posts    Post[]
  accounts Account[]
  sessions Session[]

  @@map("users")
}
```

### Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Model name | PascalCase singular | `User`, `PostTag` |
| Field name | camelCase | `createdAt`, `hashedPassword` |
| Table name | snake_case plural via `@@map` | `@@map("users")` |
| Column name | snake_case via `@map` | `@map("hashed_password")` |
| Relation field | camelCase, matches related model | `posts`, `author` |
| Enum name | PascalCase | `UserRole`, `PostStatus` |
| Enum values | UPPER_SNAKE_CASE | `ADMIN`, `DRAFT` |

**Why `@map`**: Prisma field names stay camelCase for TypeScript ergonomics while database columns use snake_case (SQL convention).

---

## Field Patterns

### IDs

```prisma
// CUID (default recommendation)
id String @id @default(cuid())

// UUID
id String @id @default(uuid())

// Auto-increment (avoid for distributed systems)
id Int @id @default(autoincrement())
```

**Decision**: Use `cuid()` by default. Non-sequential, URL-safe, and collision-resistant.

### Timestamps

```prisma
// Every model gets these. No exceptions.
createdAt DateTime @default(now()) @map("created_at")
updatedAt DateTime @updatedAt @map("updated_at")
```

### Soft Deletes

```prisma
model Post {
  // ... other fields
  deletedAt DateTime? @map("deleted_at")

  @@index([deletedAt])
  @@map("posts")
}
```

```typescript
// Querying with soft deletes
const activePosts = await prisma.post.findMany({
  where: { deletedAt: null },
});

// Soft delete operation
await prisma.post.update({
  where: { id },
  data: { deletedAt: new Date() },
});
```

### Optional vs Required

```prisma
// Required (non-null) - field must always have a value
name    String

// Optional (nullable) - use ? suffix
bio     String?

// Required with default - automatically set if not provided
role    UserRole @default(MEMBER)
```

**Rule**: Default to required. Only make fields optional when null has genuine meaning (e.g., "not yet set" vs "empty string").

---

## Enums

```prisma
enum UserRole {
  ADMIN
  MEMBER
  VIEWER
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Post {
  status PostStatus @default(DRAFT)
  // ...
}
```

### When to Use Enums vs Strings

| Approach | When to Use |
|---|---|
| Prisma enum | Fixed set of values that rarely changes |
| String field | Values that change often, user-defined categories |

**Note**: Adding a value to a Prisma enum requires a migration. For frequently changing sets, use a string field with Zod validation.

---

## Relations

### One-to-Many

```prisma
model User {
  id    String @id @default(cuid())
  posts Post[]

  @@map("users")
}

model Post {
  id       String @id @default(cuid())
  authorId String @map("author_id")
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
  @@map("posts")
}
```

### One-to-One

```prisma
model User {
  id      String   @id @default(cuid())
  profile Profile?

  @@map("users")
}

model Profile {
  id     String @id @default(cuid())
  userId String @unique @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  bio    String?

  @@map("profiles")
}
```

### Many-to-Many (Explicit Join Table)

```prisma
model Post {
  id   String    @id @default(cuid())
  tags PostTag[]

  @@map("posts")
}

model Tag {
  id    String    @id @default(cuid())
  name  String    @unique
  posts PostTag[]

  @@map("tags")
}

model PostTag {
  postId    String   @map("post_id")
  tagId     String   @map("tag_id")
  createdAt DateTime @default(now()) @map("created_at")
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag       Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@map("post_tags")
}
```

**Rule**: Always use explicit join tables over Prisma's implicit many-to-many. Explicit tables support additional fields (timestamps, ordering) and are easier to query.

### Cascade Behaviors

| Behavior | When to Use |
|---|---|
| `Cascade` | Child cannot exist without parent (comments on post) |
| `SetNull` | Child can exist independently (optional foreign key) |
| `Restrict` | Prevent deleting parent with existing children |
| `NoAction` | Database-level, similar to Restrict |

---

## Indexes

```prisma
model Post {
  id        String     @id @default(cuid())
  authorId  String     @map("author_id")
  status    PostStatus @default(DRAFT)
  slug      String
  createdAt DateTime   @default(now()) @map("created_at")

  // Single-column index
  @@index([authorId])

  // Composite index (query pattern: "posts by author filtered by status")
  @@index([authorId, status])

  // Unique composite (slug unique per author)
  @@unique([authorId, slug])

  @@map("posts")
}
```

### Indexing Rules

- Always index foreign key columns
- Add composite indexes for frequent multi-column queries
- Use unique constraints for business uniqueness rules
- Do not over-index; each index slows writes

---

## JSON Fields

```prisma
model User {
  id          String @id @default(cuid())
  preferences Json   @default("{}")

  @@map("users")
}
```

```typescript
// Type-safe access with Zod
import { z } from "zod";

const preferencesSchema = z.object({
  theme: z.enum(["light", "dark"]).default("light"),
  emailNotifications: z.boolean().default(true),
  language: z.string().default("en"),
});

type UserPreferences = z.infer<typeof preferencesSchema>;

function getPreferences(raw: unknown): UserPreferences {
  return preferencesSchema.parse(raw);
}
```

**Warning**: JSON fields bypass Prisma's type system. Always validate with Zod when reading.

---

## Zod Validation Schemas

### Paired with Prisma Models

```typescript
// lib/validations/user.ts
import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  bio: z.string().max(500).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Implicit many-to-many | Cannot add fields to join table later | Explicit join model with `@@id` |
| No `@map` / `@@map` | Inconsistent naming across TypeScript and SQL | Map camelCase fields to snake_case columns |
| Missing indexes on foreign keys | Slow joins and lookups | `@@index` on every foreign key |
| Business logic in schema | Prisma schema is declarative only | Put logic in service functions |
| `Int` IDs for distributed systems | Collisions across replicas | Use `cuid()` or `uuid()` |
| No timestamps on models | Cannot debug or audit data | Always add `createdAt` and `updatedAt` |
| Storing computed values | Gets out of sync | Compute at query time or use database views |

---

_The schema defines structure and integrity. Validation belongs in Zod. Business rules belong in services._
