# API Design Standards

Next.js App Router API conventions for route handlers, server actions, request validation, and consistent response patterns.

---

## Philosophy

- **Server Actions first**: Use server actions for mutations; reserve route handlers for external/webhook APIs
- **Type-safe end-to-end**: Zod validates input, TypeScript types flow from server to client
- **Consistent responses**: Every route handler follows the same response envelope
- **Thin handlers**: Validation and response formatting in the handler, business logic in services

---

## Route Handler Conventions

### File Structure

```
app/
  api/
    health/
      route.ts              # GET /api/health
    users/
      route.ts              # GET, POST /api/users
      [id]/
        route.ts            # GET, PATCH, DELETE /api/users/:id
    webhooks/
      stripe/
        route.ts            # POST /api/webhooks/stripe
```

### Basic Route Handler

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, createdAt: true },
    }),
    prisma.user.count(),
  ]);

  return NextResponse.json({
    items: users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
      { status: 422 }
    );
  }

  const user = await prisma.user.create({ data: parsed.data });
  return NextResponse.json(user, { status: 201 });
}
```

---

## HTTP Methods and Status Codes

### RESTful Conventions

| Method | URL Pattern | Action | Status |
|---|---|---|---|
| `GET` | `/api/users` | List users | 200 |
| `GET` | `/api/users/42` | Get single user | 200 |
| `POST` | `/api/users` | Create user | 201 |
| `PATCH` | `/api/users/42` | Partial update | 200 |
| `DELETE` | `/api/users/42` | Delete user | 204 |

### URL Naming Rules

```
# GOOD
GET  /api/users
POST /api/users
GET  /api/users/42/posts

# BAD
GET  /api/getUsers
POST /api/createUser
GET  /api/user/42/getAllPosts
```

- Plural nouns for resources: `/users`, `/posts`
- Lowercase with hyphens for multi-word: `/api-keys`, `/user-profiles`
- No verbs in URLs (HTTP methods convey action)
- No trailing slashes
- Maximum two levels of nesting

---

## Response Envelope

### Success: Single Resource

```json
{
  "id": 42,
  "email": "user@example.com",
  "name": "Jane Doe",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Success: Collection

```json
{
  "items": [...],
  "total": 142,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

### Error Response

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": { "resource": "User", "id": "42" }
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Invalid request body or params |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate resource or state conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## Server Actions vs Route Handlers

### When to Use Each

| Use Case | Approach |
|---|---|
| Form submissions | Server Action |
| Data mutations from UI | Server Action |
| External API consumers | Route Handler |
| Webhooks | Route Handler |
| File uploads with progress | Route Handler |
| CORS-enabled endpoints | Route Handler |
| Streaming responses | Route Handler |

### Server Action Pattern

```typescript
// app/actions/users.ts
"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255),
  bio: z.string().max(500).optional(),
});

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    bio: formData.get("bio"),
  });

  if (!parsed.success) {
    return { error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
  });

  revalidatePath("/profile");
  return { success: true };
}
```

---

## Middleware

### Authentication Middleware

```typescript
// middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");
  const isPublicApi = req.nextUrl.pathname.startsWith("/api/health") ||
                      req.nextUrl.pathname.startsWith("/api/webhooks");

  if (isApiRoute && !isPublicApi && !req.auth) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};
```

### CORS for Route Handlers

```typescript
// app/api/public/route.ts
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://example.com",
  process.env.NODE_ENV === "development" && "http://localhost:3001",
].filter(Boolean) as string[];

function corsHeaders(origin: string | null) {
  const headers = new Headers();
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function GET(request: NextRequest) {
  const data = { message: "Hello" };
  return NextResponse.json(data, {
    headers: corsHeaders(request.headers.get("origin")),
  });
}
```

---

## Rate Limiting

### Token Bucket with Headers

```typescript
// lib/rate-limit.ts
const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key) ?? { tokens: options.limit, lastRefill: now };

  const elapsed = now - record.lastRefill;
  const refillRate = options.limit / options.windowMs;
  record.tokens = Math.min(options.limit, record.tokens + elapsed * refillRate);
  record.lastRefill = now;

  if (record.tokens < 1) {
    rateLimitMap.set(key, record);
    return { success: false, remaining: 0, reset: Math.ceil(options.windowMs / 1000) };
  }

  record.tokens -= 1;
  rateLimitMap.set(key, record);
  return { success: true, remaining: Math.floor(record.tokens), reset: Math.ceil(options.windowMs / 1000) };
}

// Usage in route handler
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success, remaining, reset } = rateLimit(ip, { limit: 10, windowMs: 60_000 });

  if (!success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(reset),
        },
      }
    );
  }

  // ... handle request
}
```

---

## Streaming Responses

```typescript
// app/api/stream/route.ts
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of ["Hello", " ", "World"]) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((r) => setTimeout(r, 100));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

---

## Health Check

```typescript
// app/api/health/route.ts
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "connected" });
  } catch {
    return Response.json(
      { status: "error", database: "disconnected" },
      { status: 503 }
    );
  }
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Verbs in URLs | Not RESTful | Use HTTP methods to convey action |
| Using route handlers for form submissions | Unnecessary complexity | Use server actions for UI mutations |
| No input validation | Security risk, bad data | Validate with zod in every handler |
| Business logic in route handlers | Hard to test, duplicated | Extract to service functions |
| Returning raw Prisma errors | Leaks schema details | Map to error envelope with safe messages |
| No rate limiting on auth endpoints | Brute force vulnerability | Rate limit login and signup endpoints |

---

_APIs are contracts. Validate every input, standardize every output, and keep business logic out of handlers._
