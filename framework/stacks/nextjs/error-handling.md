# Error Handling

Comprehensive error handling patterns for Next.js 15 App Router with error boundaries, server actions, API routes, and monitoring.

---

## Philosophy

- **Fail visibly**: Never swallow errors silently; always surface them to the user or monitoring
- **Boundaries everywhere**: Every route segment gets an `error.tsx` for graceful degradation
- **Typed errors**: Use custom error classes to distinguish expected from unexpected failures
- **User-friendly messages**: Show actionable text to users, log technical details for developers

---

## Error Boundary Hierarchy

### Route-Level Error Boundary

```typescript
// app/dashboard/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to error monitoring service
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16" role="alert">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground max-w-md text-center">
        We encountered an error loading the dashboard. This has been reported automatically.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-4 max-w-lg overflow-auto rounded bg-red-50 p-4 text-sm text-red-900">
          {error.message}
          {"\n"}
          {error.stack}
        </pre>
      )}
    </div>
  );
}
```

### Global Error Boundary

```typescript
// app/global-error.tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Application Error</h1>
            <p className="text-muted-foreground mt-2">
              Something went wrong. Please try refreshing the page.
            </p>
            <button
              onClick={reset}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

### Not Found

```typescript
// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground text-lg">Page not found</p>
      <Link href="/" className="text-primary underline underline-offset-4">
        Go back home
      </Link>
    </div>
  );
}
```

---

## Custom Error Classes

### Error Hierarchy

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super(`${resource} not found: ${id}`, "NOT_FOUND", 404, { resource, id });
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fieldErrors?: Record<string, string[]>) {
    super(message, "VALIDATION_ERROR", 422, { fieldErrors });
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}
```

---

## Server Component Error Handling

### Try/Catch in Async Components

```typescript
// app/users/[id]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { posts: { take: 10, orderBy: { createdAt: "desc" } } },
  });

  if (!user) {
    notFound();
  }

  return <UserProfile user={user} />;
}
```

### Service-Level Error Handling

```typescript
// lib/services/user-service.ts
import { NotFoundError, ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError("User", id);
  }
  return user;
}

export async function createUser(data: { email: string; name: string }) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new ConflictError(`User with email ${data.email} already exists`);
  }
  return prisma.user.create({ data });
}
```

---

## Server Action Error Handling

### Action Result Pattern

```typescript
// types/actions.ts
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
```

### Safe Action Wrapper

```typescript
// lib/safe-action.ts
import { AppError, ValidationError } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";

export async function safeAction<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: error.message,
        fieldErrors: error.fieldErrors,
      };
    }
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    console.error("Unexpected error in action:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
```

### Usage in Server Actions

```typescript
// actions/users.ts
"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { safeAction } from "@/lib/safe-action";
import { createUser } from "@/lib/services/user-service";
import { revalidatePath } from "next/cache";

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(255),
});

export async function createUserAction(formData: FormData) {
  return safeAction(async () => {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const parsed = createUserSchema.safeParse({
      email: formData.get("email"),
      name: formData.get("name"),
    });

    if (!parsed.success) {
      throw new ValidationError("Invalid input", parsed.error.flatten().fieldErrors);
    }

    const user = await createUser(parsed.data);
    revalidatePath("/users");
    return user;
  });
}
```

---

## API Route Error Handling

### Centralized Error Response

```typescript
// lib/api-error.ts
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.statusCode }
    );
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An internal error occurred" } },
    { status: 500 }
  );
}
```

### Usage

```typescript
// app/api/users/[id]/route.ts
import { handleApiError } from "@/lib/api-error";
import { getUserById } from "@/lib/services/user-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserById(id);
    return Response.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Client-Side Error Handling

### Toast Notifications

```typescript
// components/forms/create-user-form.tsx
"use client";

import { useActionState } from "react";
import { createUserAction } from "@/actions/users";
import { toast } from "sonner";

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await createUserAction(formData);
      if (result.success) {
        toast.success("User created successfully");
      } else {
        toast.error(result.error);
      }
      return result;
    },
    null
  );

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      {state && !state.success && state.fieldErrors?.email && (
        <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
      )}
      <input name="name" required />
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create User"}
      </button>
    </form>
  );
}
```

---

## Error Monitoring

### Sentry Integration

```typescript
// lib/sentry.ts
import * as Sentry from "@sentry/nextjs";

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (error instanceof AppError && error.statusCode < 500) {
    // Expected errors (4xx) - don't send to Sentry
    return;
  }
  Sentry.captureException(error, { extra: context });
}
```

```typescript
// instrumentation.ts (Next.js instrumentation hook)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Empty catch blocks | Errors disappear silently | Log and re-throw or return error state |
| `try/catch` around every line | Unreadable, catch at boundaries | Catch at route/action level, let errors propagate |
| Showing stack traces to users | Security risk, bad UX | User-friendly message + log details server-side |
| Using `Error` for expected cases | Cannot distinguish expected vs unexpected | Custom error classes with codes |
| No `error.tsx` in route segments | White screen on failure | Add error boundaries to all route segments |
| Catching `redirect()` or `notFound()` | These are thrown intentionally by Next.js | Never catch Next.js navigation functions |

---

_Errors are inevitable. Handle them at boundaries, classify them with types, and always tell the user what happened and what they can do about it._
