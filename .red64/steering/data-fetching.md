# Data Fetching Patterns

Server state management with TanStack Query for caching, synchronization, and background updates.

---

## Philosophy

- **Server state is different**: API data needs caching, deduplication, background refresh
- **Cache-first**: Serve stale data immediately, refresh in background
- **Optimistic updates**: Update UI before server confirms for better UX
- **Error boundaries**: Handle errors at the right level, not in every component

---

## TanStack Query Setup

### Query Client Configuration

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### Provider Setup

```typescript
// app/App.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## Query Patterns

### Basic Query

```typescript
// features/users/hooks/useUsers.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { User, PaginatedResponse } from '@/types';

// Query key factory
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
};

interface UserFilters {
  page?: number;
  search?: string;
  role?: string;
}

async function fetchUsers(filters: UserFilters): Promise<PaginatedResponse<User>> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.search) params.set('q', filters.search);
  if (filters.role) params.set('role', filters.role);

  return api.get(`users?${params}`).json();
}

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => fetchUsers(filters),
  });
}
```

### Single Resource Query

```typescript
// features/users/hooks/useUser.ts
async function fetchUser(id: number): Promise<User> {
  return api.get(`users/${id}`).json();
}

export function useUser(id: number) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => fetchUser(id),
    enabled: id > 0, // Don't fetch if no ID
  });
}
```

### Dependent Queries

```typescript
// Fetch user, then fetch their posts
function useUserWithPosts(userId: number) {
  const userQuery = useUser(userId);

  const postsQuery = useQuery({
    queryKey: ['users', userId, 'posts'],
    queryFn: () => fetchUserPosts(userId),
    enabled: !!userQuery.data, // Only fetch when user is loaded
  });

  return { user: userQuery, posts: postsQuery };
}
```

### Parallel Queries

```typescript
import { useQueries } from '@tanstack/react-query';

function useUserDetails(userIds: number[]) {
  return useQueries({
    queries: userIds.map((id) => ({
      queryKey: userKeys.detail(id),
      queryFn: () => fetchUser(id),
    })),
  });
}
```

---

## Mutation Patterns

### Basic Mutation

```typescript
// features/users/hooks/useCreateUser.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CreateUserInput {
  name: string;
  email: string;
  role: string;
}

async function createUser(input: CreateUserInput): Promise<User> {
  return api.post('users', { json: input }).json();
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      // Invalidate and refetch user list
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

### Update Mutation with Optimistic Updates

```typescript
// features/users/hooks/useUpdateUser.ts
interface UpdateUserInput {
  id: number;
  data: Partial<User>;
}

async function updateUser({ id, data }: UpdateUserInput): Promise<User> {
  return api.patch(`users/${id}`, { json: data }).json();
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUser,
    // Optimistic update
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: userKeys.detail(id) });

      // Snapshot previous value
      const previousUser = queryClient.getQueryData<User>(userKeys.detail(id));

      // Optimistically update
      if (previousUser) {
        queryClient.setQueryData<User>(userKeys.detail(id), {
          ...previousUser,
          ...data,
        });
      }

      return { previousUser };
    },
    onError: (_err, { id }, context) => {
      // Rollback on error
      if (context?.previousUser) {
        queryClient.setQueryData(userKeys.detail(id), context.previousUser);
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Refetch to ensure server state
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

### Delete Mutation

```typescript
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

---

## Usage in Components

### Query Component

```typescript
// features/users/components/UserList.tsx
import { useUsers } from '../hooks/useUsers';

export function UserList({ filters }: { filters: UserFilters }) {
  const { data, isLoading, isError, error, refetch } = useUsers(filters);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return (
      <ErrorMessage
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data?.items.length) {
    return <EmptyState message="No users found" />;
  }

  return (
    <ul>
      {data.items.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </ul>
  );
}
```

### Mutation Component

```typescript
// features/users/components/CreateUserForm.tsx
import { useCreateUser } from '../hooks/useCreateUser';

export function CreateUserForm({ onSuccess }: { onSuccess?: () => void }) {
  const createUser = useCreateUser();

  const handleSubmit = (data: CreateUserInput) => {
    createUser.mutate(data, {
      onSuccess: () => {
        toast.success('User created');
        onSuccess?.();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      {/* Form fields */}
      <Button type="submit" disabled={createUser.isPending}>
        {createUser.isPending ? 'Creating...' : 'Create User'}
      </Button>
    </form>
  );
}
```

---

## API Client Setup

### ky Configuration

```typescript
// services/api.ts
import ky from 'ky';
import { useAuthStore } from '@/stores/auth.store';

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL,
  timeout: 30000,
  hooks: {
    beforeRequest: [
      (request) => {
        const token = useAuthStore.getState().token;
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401) {
          useAuthStore.getState().clearAuth();
          window.location.href = '/login';
        }
        return response;
      },
    ],
  },
});
```

### Type-safe API with Zod

```typescript
// features/users/api/users.api.ts
import { z } from 'zod';
import { api } from '@/services/api';

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.string().datetime(),
});

const PaginatedUsersSchema = z.object({
  items: z.array(UserSchema),
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
  hasNext: z.boolean(),
});

export type User = z.infer<typeof UserSchema>;
export type PaginatedUsers = z.infer<typeof PaginatedUsersSchema>;

export async function fetchUsers(filters: UserFilters): Promise<PaginatedUsers> {
  const response = await api.get('users', { searchParams: filters }).json();
  return PaginatedUsersSchema.parse(response); // Runtime validation
}
```

---

## Prefetching and Preloading

### Prefetch on Hover

```typescript
function UserListItem({ user }: { user: User }) {
  const queryClient = useQueryClient();

  const prefetchUser = () => {
    queryClient.prefetchQuery({
      queryKey: userKeys.detail(user.id),
      queryFn: () => fetchUser(user.id),
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };

  return (
    <Link
      to={`/users/${user.id}`}
      onMouseEnter={prefetchUser}
      onFocus={prefetchUser}
    >
      {user.name}
    </Link>
  );
}
```

### Prefetch on Route Load

```typescript
// app/routes.tsx
import { queryClient } from '@/lib/query-client';

export const router = createBrowserRouter([
  {
    path: '/users/:id',
    element: <UserDetail />,
    loader: async ({ params }) => {
      const id = Number(params.id);
      // Prefetch data before rendering
      await queryClient.ensureQueryData({
        queryKey: userKeys.detail(id),
        queryFn: () => fetchUser(id),
      });
      return null;
    },
  },
]);
```

---

## Infinite Queries (Pagination)

```typescript
// features/posts/hooks/usePosts.ts
import { useInfiniteQuery } from '@tanstack/react-query';

export function usePosts() {
  return useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam }) => fetchPosts({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.prevCursor,
  });
}

// Usage
function PostList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePosts();

  return (
    <>
      {data?.pages.map((page) =>
        page.items.map((post) => <PostCard key={post.id} post={post} />)
      )}
      {hasNextPage && (
        <Button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </Button>
      )}
    </>
  );
}
```

---

## Error Handling

### Query Error Boundary

```typescript
// components/QueryErrorBoundary.tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

export function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div className="error-container">
              <p>Something went wrong: {error.message}</p>
              <Button onClick={resetErrorBoundary}>Try again</Button>
            </div>
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

### Global Error Handling

```typescript
// lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: (error) => {
        // Only throw for specific errors to be caught by boundary
        return error instanceof NetworkError;
      },
    },
    mutations: {
      onError: (error) => {
        // Global mutation error handling
        toast.error(error.message);
      },
    },
  },
});
```

---

## Suspense Mode

```typescript
// Enable suspense for a query
export function useUser(id: number) {
  return useSuspenseQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => fetchUser(id),
  });
}

// Usage with Suspense boundary
function UserPage({ userId }: { userId: number }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <UserDetail userId={userId} />
    </Suspense>
  );
}

function UserDetail({ userId }: { userId: number }) {
  const { data: user } = useUser(userId); // Never undefined with suspense
  return <div>{user.name}</div>;
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Storing query data in Zustand | Double source of truth | Let TanStack Query manage server state |
| No query keys | Cache conflicts | Use query key factories |
| Fetching in useEffect | Missing caching, deduplication | Use useQuery |
| Manual refetch everywhere | Stale data | Configure staleTime, use invalidation |
| Not handling loading/error | Bad UX | Always handle all states |
| Inline query functions | No reuse, hard to test | Extract to separate files |

---

_Server state is not your state. TanStack Query manages it better than you can._
