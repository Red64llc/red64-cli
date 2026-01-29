# Prisma Migrations

Database migration workflow for Prisma ORM with zero-downtime strategies, seed data, and production deployment.

---

## Philosophy

- **Schema-first**: Change `schema.prisma`, then generate the migration
- **Version-controlled**: Every migration is committed and never modified after deployment
- **Reversible in practice**: Plan rollback strategies even though Prisma does not generate down migrations
- **Zero-downtime by default**: Structure changes to avoid locking tables or breaking running code

---

## Migration Workflow

### Development Cycle

```bash
# 1. Edit schema.prisma
# 2. Generate and apply migration
pnpm prisma migrate dev --name add_user_bio

# 3. Prisma automatically:
#    - Generates SQL migration file
#    - Applies it to development database
#    - Regenerates Prisma Client
```

### Migration Commands

| Command | Purpose | Environment |
|---|---|---|
| `prisma migrate dev` | Create and apply migration | Development |
| `prisma migrate dev --name <name>` | Named migration | Development |
| `prisma migrate deploy` | Apply pending migrations | Production/CI |
| `prisma migrate reset` | Drop database, re-apply all migrations + seed | Development |
| `prisma migrate status` | Show pending migrations | Any |
| `prisma db push` | Push schema without migration file | Prototyping only |

### migrate dev vs db push

| Feature | `migrate dev` | `db push` |
|---|---|---|
| Creates migration file | Yes | No |
| Version-controlled | Yes | No |
| Safe for production | Yes | No |
| Handles data loss warnings | Yes | May silently drop data |
| Use case | All real development | Quick prototyping, throwaway databases |

**Rule**: Always use `migrate dev` once your schema is past prototyping phase. Never use `db push` in production.

---

## Migration File Structure

```
prisma/
  migrations/
    20240115103000_init/
      migration.sql
    20240116140000_add_user_bio/
      migration.sql
    20240118090000_add_post_status/
      migration.sql
    migration_lock.toml          # Locks provider (postgresql)
  schema.prisma
  seed.ts
```

### Generated SQL Example

```sql
-- prisma/migrations/20240116140000_add_user_bio/migration.sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN "bio" TEXT;
```

### Naming Convention

```bash
# Format: descriptive verb + subject
pnpm prisma migrate dev --name init
pnpm prisma migrate dev --name add_user_bio
pnpm prisma migrate dev --name add_post_status_index
pnpm prisma migrate dev --name create_comments_table
pnpm prisma migrate dev --name make_email_unique
pnpm prisma migrate dev --name remove_legacy_fields
```

---

## Zero-Downtime Migration Patterns

### Adding a Column

```prisma
// Safe: new nullable column with no default
model User {
  // existing fields...
  bio String? @map("bio")  // New field - nullable, no data migration needed
}
```

```bash
pnpm prisma migrate dev --name add_user_bio
```

### Adding a Required Column (Two-Step)

```
# Step 1: Add as nullable, deploy code that writes to it
model User {
  phoneNumber String? @map("phone_number")
}

# Step 2: After backfilling, make required
model User {
  phoneNumber String @map("phone_number")
}
```

```typescript
// Backfill script (run between step 1 and step 2)
// scripts/backfill-phone.ts
import { prisma } from "../src/lib/prisma";

async function backfill() {
  const batchSize = 1000;
  let processed = 0;

  while (true) {
    const users = await prisma.user.findMany({
      where: { phoneNumber: null },
      take: batchSize,
      select: { id: true },
    });

    if (users.length === 0) break;

    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { phoneNumber: "PENDING" },
    });

    processed += users.length;
    console.log(`Backfilled ${processed} users`);
  }
}

backfill();
```

### Renaming a Column (Three-Step)

```
# Step 1: Add new column, deploy code that writes to both
# Step 2: Backfill new column, deploy code that reads from new column
# Step 3: Remove old column
```

**Rule**: Never rename a column in a single migration. The running application will break between deploy and restart.

### Adding an Index

```prisma
model Post {
  // ...
  @@index([authorId, status])
}
```

For large tables, consider creating the index concurrently by editing the generated SQL:

```sql
-- Edit the migration.sql before applying
CREATE INDEX CONCURRENTLY "Post_authorId_status_idx" ON "posts" ("author_id", "status");
```

**Note**: `CONCURRENTLY` only works in PostgreSQL and cannot run inside a transaction. Edit the migration SQL manually.

---

## Seed Data

### Seed Script

```typescript
// prisma/seed.ts
import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Idempotent: use upsert to avoid duplicates on re-run
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin User",
      hashedPassword: await hash("password123", 12),
      role: UserRole.ADMIN,
    },
  });

  console.log(`Seeded admin user: ${admin.id}`);

  // Seed sample data for development
  if (process.env.NODE_ENV !== "production") {
    const posts = await Promise.all(
      Array.from({ length: 10 }).map((_, i) =>
        prisma.post.upsert({
          where: { id: `seed-post-${i}` },
          update: {},
          create: {
            id: `seed-post-${i}`,
            title: `Sample Post ${i + 1}`,
            body: `Content for post ${i + 1}`,
            authorId: admin.id,
            status: i % 3 === 0 ? "PUBLISHED" : "DRAFT",
          },
        })
      )
    );
    console.log(`Seeded ${posts.length} posts`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

### Configure Seed Command

```json
// package.json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

```bash
# Run seed
pnpm prisma db seed

# Reset + seed
pnpm prisma migrate reset
```

---

## Production Deployment

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml (relevant steps)
- name: Apply migrations
  run: pnpm prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Deploy application
  run: # deploy command
```

### Deployment Order

1. Run `prisma migrate deploy` (applies pending migrations)
2. Deploy new application code
3. Verify health check passes

**Rule**: Always run migrations before deploying new code. The old code must work with the new schema (see zero-downtime patterns above).

### Rollback Strategy

Prisma does not generate down migrations. Plan rollbacks manually:

```bash
# Option 1: Create a new "undo" migration
pnpm prisma migrate dev --name revert_add_bio
# Manually write the SQL to reverse the change

# Option 2: Restore from database backup (last resort)
```

**Best practice**: Design migrations to be forward-only. If adding a column breaks things, the code should handle both states.

---

## Testing Migrations

### Test Against Clean Database

```bash
# Verify all migrations apply cleanly from scratch
pnpm prisma migrate reset --force
pnpm prisma migrate deploy
```

### CI Migration Check

```bash
# In CI, verify no pending migrations exist in development
pnpm prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --exit-code
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `db push` in production | No migration history, data loss risk | Always use `migrate deploy` |
| Editing deployed migrations | Breaks migration checksums | Create new migrations to fix issues |
| Adding NOT NULL without default | Breaks existing rows | Add nullable first, backfill, then constrain |
| Single-step column rename | Running code breaks immediately | Three-step: add, migrate, remove |
| No seed script | Manual data setup for every developer | Maintain `prisma/seed.ts` |
| Skipping CI migration check | Schema drift between environments | Check migration status in CI |

---

_Migrations are deployments. Treat them with the same care: test them, version them, and always have a rollback plan._
