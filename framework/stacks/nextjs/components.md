# Component Patterns

Server and client component architecture for Next.js 15 App Router with composition, error boundaries, and loading states.

---

## Philosophy

- **Server by default**: Every component is a Server Component unless it needs interactivity
- **Push client boundaries down**: Keep `"use client"` as close to the leaves as possible
- **Composition over props**: Use children and slots instead of deeply nested prop objects
- **Explicit boundaries**: Every async operation gets a Suspense boundary, every failure gets an Error Boundary

---

## Server vs Client Components

### Decision Tree

| Need | Component Type |
|---|---|
| Fetch data, access database | Server Component |
| Read from filesystem, access env vars | Server Component |
| Render static or async content | Server Component |
| useState, useEffect, useRef | Client Component (`"use client"`) |
| Event handlers (onClick, onChange) | Client Component |
| Browser APIs (localStorage, window) | Client Component |
| Third-party hooks (useForm, useSWR) | Client Component |

### Server Component (Default)

```typescript
// app/users/page.tsx -- Server Component (no directive needed)
import { prisma } from "@/lib/prisma";
import { UserCard } from "@/components/user-card";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>
    </main>
  );
}
```

### Client Component (Opt-In)

```typescript
// components/like-button.tsx
"use client";

import { useState, useTransition } from "react";
import { toggleLike } from "@/actions/posts";

interface LikeButtonProps {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
}

export function LikeButton({ postId, initialLiked, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    startTransition(() => toggleLike(postId));
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5"
      aria-label={liked ? "Unlike post" : "Like post"}
    >
      <HeartIcon filled={liked} />
      <span>{count}</span>
    </button>
  );
}
```

---

## Composition Patterns

### Children Pattern

```typescript
interface PageLayoutProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageLayout({ title, description, actions, children }: PageLayoutProps) {
  return (
    <div className="container py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
```

### Compound Components

```typescript
// components/card.tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return <div className={cn("rounded-lg border bg-card p-6", className)}>{children}</div>;
}

function CardHeader({ children, className }: CardProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-lg font-semibold", className)}>{children}</h3>;
}

function CardContent({ children, className }: CardProps) {
  return <div className={cn("text-sm", className)}>{children}</div>;
}

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Content = CardContent;
```

```tsx
// Usage
<Card>
  <Card.Header>
    <Card.Title>Monthly Revenue</Card.Title>
  </Card.Header>
  <Card.Content>
    <RevenueChart data={data} />
  </Card.Content>
</Card>
```

### Render Props (Rare)

```typescript
// Use only when children pattern is insufficient
interface DataListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
}

export function DataList<T>({ items, renderItem, emptyState }: DataListProps<T>) {
  if (items.length === 0) {
    return emptyState ?? <p className="text-muted-foreground">No items found.</p>;
  }
  return <ul className="divide-y">{items.map((item, i) => <li key={i}>{renderItem(item, i)}</li>)}</ul>;
}
```

---

## Props Design

### Required vs Optional

```typescript
interface UserCardProps {
  // Required: component cannot render without these
  user: { id: string; name: string; email: string; avatarUrl?: string };

  // Optional with defaults: common customizations
  size?: "sm" | "md" | "lg";
  showEmail?: boolean;

  // Optional: extension points
  className?: string;
  actions?: React.ReactNode;
}

export function UserCard({
  user,
  size = "md",
  showEmail = true,
  className,
  actions,
}: UserCardProps) {
  // ...
}
```

### Extending HTML Elements

```typescript
import { type ComponentProps } from "react";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner className="mr-2" />}
      {children}
    </button>
  );
}
```

---

## Error Boundaries

### Route-Level Error Boundary

```typescript
// app/dashboard/error.tsx
"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16" role="alert">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground max-w-md text-center">
        An error occurred while loading the dashboard. Please try again.
      </p>
      <button onClick={reset} className="rounded-md bg-primary px-4 py-2 text-white">
        Try again
      </button>
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
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Application Error</h1>
            <p className="mt-2">Something went wrong. Please refresh the page.</p>
            <button onClick={reset} className="mt-4 rounded bg-blue-600 px-4 py-2 text-white">
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

---

## Suspense and Loading States

### Streaming with Suspense

```typescript
// app/dashboard/page.tsx
import { Suspense } from "react";
import { RevenueChart } from "@/components/revenue-chart";
import { RecentOrders } from "@/components/recent-orders";
import { StatsSkeleton, TableSkeleton } from "@/components/skeletons";

export default function DashboardPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Suspense fallback={<StatsSkeleton />}>
        <RevenueChart />
      </Suspense>
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}
```

### Route-Level Loading

```typescript
// app/dashboard/loading.tsx
import { DashboardSkeleton } from "@/components/skeletons";

export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
```

### Skeleton Components

```typescript
// components/skeletons.tsx
export function StatsSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border p-6">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="mt-4 h-8 w-32 rounded bg-muted" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded bg-muted" />
      ))}
    </div>
  );
}
```

---

## Component File Structure

### Single Component File

```
components/
  user-card.tsx            # Component + types in one file
```

### Complex Component with Parts

```
components/
  data-table/
    data-table.tsx         # Main component
    columns.tsx            # Column definitions
    toolbar.tsx            # Filter/search toolbar
    pagination.tsx         # Pagination controls
    index.ts               # Re-export: export { DataTable } from "./data-table"
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `"use client"` at the top of every file | Sends everything to the client | Default to server, opt in to client |
| Fetching data in client components | Extra round trips, no streaming | Fetch in server components, pass as props |
| Prop drilling through many layers | Fragile, hard to refactor | Composition with children/slots or context |
| God components (500+ lines) | Untestable, hard to read | Split into composed sub-components |
| Inline functions in JSX | Re-created every render | Extract to named functions or useCallback |
| Missing Suspense boundaries | All-or-nothing loading | Wrap async components individually |

---

_Components are the atoms of your UI. Keep them small, composable, and server-rendered by default._
