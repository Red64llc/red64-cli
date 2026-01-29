# Validation Patterns

Zod schema validation for Next.js with server actions, API routes, forms, and reusable schema design.

---

## Philosophy

- **Single source of truth**: Define schemas once, use on both client and server
- **Server is the authority**: Client validation improves UX; server validation enforces rules
- **Fail early, fail clearly**: Validate at the boundary, return specific field errors
- **Type inference**: Derive TypeScript types from Zod schemas, never duplicate

---

## Zod Schema Basics

### Defining Schemas

```typescript
// lib/validations/user.ts
import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  avatarUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
});

// Derive TypeScript types from schemas
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

### Common Field Patterns

```typescript
// Email
z.string().email("Invalid email address")

// Password with rules
z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/)

// Optional string that can be empty
z.string().optional().or(z.literal(""))

// URL (optional)
z.string().url().optional()

// Enum
z.enum(["ADMIN", "MEMBER", "VIEWER"])

// Date string from form input
z.string().pipe(z.coerce.date())

// Positive integer
z.coerce.number().int().positive()

// Boolean from checkbox (form sends "on" or undefined)
z.string().optional().transform((val) => val === "on")

// ID (cuid format)
z.string().cuid()
```

---

## Server Action Validation

### Basic Pattern

```typescript
// actions/users.ts
"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createUserSchema } from "@/lib/validations/user";

type ActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be signed in" };
  }

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        hashedPassword: await hash(parsed.data.password, 12),
      },
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return { fieldErrors: { email: ["Email is already taken"] } };
    }
    return { error: "Failed to create user" };
  }

  revalidatePath("/users");
  return { success: true };
}
```

---

## API Route Validation

### Request Body Validation

```typescript
// app/api/posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  tags: z.array(z.string()).max(10).default([]),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = createPostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: parsed.error.flatten(),
        },
      },
      { status: 422 }
    );
  }

  // parsed.data is fully typed
  const post = await prisma.post.create({ data: parsed.data });
  return NextResponse.json(post, { status: 201 });
}
```

### Query Parameter Validation

```typescript
const listPostsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  search: z.string().max(200).optional(),
  sort: z.string().regex(/^-?(createdAt|title|updatedAt)$/).default("-createdAt"),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const parsed = listPostsSchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid parameters" } },
      { status: 422 }
    );
  }

  const { page, limit, status, search, sort } = parsed.data;
  // ... query with validated params
}
```

---

## Form Validation with React Hook Form

### Client-Side with Zod Resolver

```typescript
// components/forms/create-user-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, type CreateUserInput } from "@/lib/validations/user";
import { createUserAction } from "@/actions/users";

export function CreateUserForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  });

  async function onSubmit(data: CreateUserInput) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));

    const result = await createUserAction({}, formData);

    if (result.fieldErrors) {
      Object.entries(result.fieldErrors).forEach(([field, messages]) => {
        setError(field as keyof CreateUserInput, {
          message: messages[0],
        });
      });
      return;
    }

    if (result.error) {
      setError("root", { message: result.error });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="name">Name</label>
        <input id="name" type="text" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" {...register("password")} aria-invalid={!!errors.password} />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create User"}
      </button>
    </form>
  );
}
```

---

## Reusable Schema Patterns

### Shared Field Schemas

```typescript
// lib/validations/shared.ts
import { z } from "zod";

export const emailSchema = z.string().email("Invalid email address").toLowerCase().trim();
export const passwordSchema = z.string().min(8, "At least 8 characters").regex(/[A-Z]/, "Needs uppercase").regex(/[0-9]/, "Needs a number");
export const nameSchema = z.string().min(1, "Required").max(255).trim();
export const idSchema = z.string().cuid("Invalid ID");
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

### Composing Schemas

```typescript
// lib/validations/user.ts
import { emailSchema, passwordSchema, nameSchema } from "./shared";

export const createUserSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Partial schema for updates
export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial()
  .extend({
    bio: z.string().max(500).optional(),
  });
```

---

## Advanced Patterns

### Discriminated Unions

```typescript
const notificationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("email"),
    email: z.string().email(),
    subject: z.string().min(1),
  }),
  z.object({
    type: z.literal("sms"),
    phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),
    message: z.string().max(160),
  }),
  z.object({
    type: z.literal("push"),
    token: z.string(),
    title: z.string().min(1),
    body: z.string().max(500),
  }),
]);

type Notification = z.infer<typeof notificationSchema>;
// Type is automatically narrowed based on "type" field
```

### Transform and Refine

```typescript
// Transform: change the output type
const slugSchema = z.string().transform((val) =>
  val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
);

// Refine: custom validation logic
const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate > data.startDate,
  { message: "End date must be after start date", path: ["endDate"] }
);

// Superrefine: multiple custom errors
const registerSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });
  }
});
```

### Preprocessing Form Data

```typescript
// FormData sends everything as strings
// Use z.coerce or z.preprocess to handle this

const productSchema = z.object({
  name: z.string().min(1),
  price: z.coerce.number().positive("Price must be positive"),
  quantity: z.coerce.number().int().nonnegative(),
  isActive: z.preprocess((val) => val === "on" || val === "true", z.boolean()),
  categories: z.preprocess(
    (val) => (typeof val === "string" ? val.split(",").map((s) => s.trim()) : val),
    z.array(z.string())
  ),
});
```

---

## Error Message Customization

### Per-Field Messages

```typescript
const schema = z.object({
  email: z.string({
    required_error: "Email is required",
    invalid_type_error: "Email must be a string",
  }).email("Please enter a valid email address"),
});
```

### Error Mapping

```typescript
// lib/validations/format-errors.ts
import type { ZodError } from "zod";

export function formatZodErrors(error: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!formatted[path]) {
      formatted[path] = issue.message;
    }
  }
  return formatted;
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Client-only validation | Server trusts unvalidated data | Always validate on server; client is UX only |
| Duplicating types and schemas | Types drift from validation | Derive types with `z.infer<typeof schema>` |
| Generic error messages | Users cannot fix their input | Specific, field-level error messages |
| Validating in the route handler | Duplicated across handlers | Shared schemas in `lib/validations/` |
| `z.any()` or `z.unknown()` passthrough | Defeats the purpose of validation | Define the exact shape you expect |
| No `safeParse` | Throws on invalid input | Use `safeParse` and handle errors gracefully |

---

_Validate at the boundary, fail with specificity, and let Zod's type inference eliminate the gap between runtime checks and compile-time types._
