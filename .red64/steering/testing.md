# Testing Patterns

Comprehensive testing patterns for React applications using Vitest, React Testing Library, MSW, and Playwright.

---

## Philosophy

- **Test user behavior, not implementation**: Test what users see and do, not internal state
- **Fast feedback**: Unit tests run in milliseconds; use Vitest's native ESM support
- **Realistic integration**: MSW intercepts at the network level for true integration tests
- **Confidence over coverage**: Focus on critical paths; 100% coverage is not the goal

---

## Test Organization

```
src/
├── features/
│   └── users/
│       ├── components/
│       │   ├── UserList.tsx
│       │   └── UserList.test.tsx       # Co-located component tests
│       └── hooks/
│           ├── useUsers.ts
│           └── useUsers.test.ts        # Co-located hook tests
├── utils/
│   ├── formatters.ts
│   └── formatters.test.ts              # Co-located utility tests
└── test/
    ├── setup.ts                        # Global test setup
    ├── test-utils.tsx                  # Custom render, providers
    └── mocks/
        ├── handlers.ts                 # MSW request handlers
        └── server.ts                   # MSW server setup

tests/                                  # E2E tests at project root
├── e2e/
│   ├── auth.spec.ts
│   └── users.spec.ts
└── playwright.config.ts
```

---

## Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.tsx',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
    // Faster test runs
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
```

---

## Test Setup

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers and cleanup after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Close server after all tests
afterAll(() => server.close());

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

---

## Custom Render with Providers

```typescript
// src/test/test-utils.tsx
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: console.log,
      warn: console.warn,
      error: () => {}, // Suppress error logs in tests
    },
  });
}

interface WrapperProps {
  children: ReactNode;
  initialEntries?: string[];
}

function AllProviders({ children, initialEntries = ['/'] }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
}

function customRender(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { initialEntries, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialEntries={initialEntries}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

// Re-export everything from RTL
export * from '@testing-library/react';
export { customRender as render };
```

---

## MSW Setup (Mock Service Worker)

### Server Configuration

```typescript
// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Request Handlers

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3000/api';

export const handlers = [
  // GET /api/users
  http.get(`${API_URL}/users`, () => {
    return HttpResponse.json({
      items: [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ],
      total: 2,
      page: 1,
      perPage: 20,
    });
  }),

  // GET /api/users/:id
  http.get(`${API_URL}/users/:id`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id: Number(id),
      name: 'John Doe',
      email: 'john@example.com',
    });
  }),

  // POST /api/users
  http.post(`${API_URL}/users`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 3, ...body },
      { status: 201 }
    );
  }),

  // DELETE /api/users/:id
  http.delete(`${API_URL}/users/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
```

### Override Handlers in Tests

```typescript
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';

test('shows error when API fails', async () => {
  // Override handler for this test only
  server.use(
    http.get('http://localhost:3000/api/users', () => {
      return HttpResponse.json(
        { error: { code: 'SERVER_ERROR', message: 'Something went wrong' } },
        { status: 500 }
      );
    })
  );

  render(<UserList />);

  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
});
```

---

## Component Testing Patterns

### Basic Component Test

```typescript
// features/users/components/UserCard.test.tsx
import { render, screen } from '@/test/test-utils';
import { UserCard } from './UserCard';

const mockUser = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  role: 'admin',
};

describe('UserCard', () => {
  it('renders user information', () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    render(<UserCard user={mockUser} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledWith(mockUser.id);
  });
});
```

### Testing Async Components

```typescript
// features/users/components/UserList.test.tsx
import { render, screen, waitFor } from '@/test/test-utils';
import { UserList } from './UserList';

describe('UserList', () => {
  it('shows loading state initially', () => {
    render(<UserList />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders users after loading', async () => {
    render(<UserList />);

    // Wait for loading to finish and users to appear
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows empty state when no users', async () => {
    server.use(
      http.get('http://localhost:3000/api/users', () => {
        return HttpResponse.json({ items: [], total: 0 });
      })
    );

    render(<UserList />);

    expect(await screen.findByText(/no users found/i)).toBeInTheDocument();
  });
});
```

### Testing Forms

```typescript
// features/users/components/UserForm.test.tsx
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { UserForm } from './UserForm';

describe('UserForm', () => {
  it('submits form with valid data', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(<UserForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/name/i), 'New User');
    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows validation errors for invalid input', async () => {
    const user = userEvent.setup();

    render(<UserForm />);

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });

  it('shows server error on API failure', async () => {
    server.use(
      http.post('http://localhost:3000/api/users', () => {
        return HttpResponse.json(
          { error: { message: 'Email already exists' } },
          { status: 409 }
        );
      })
    );

    const user = userEvent.setup();
    render(<UserForm />);

    await user.type(screen.getByLabelText(/name/i), 'Test');
    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/email already exists/i)).toBeInTheDocument();
  });
});
```

---

## Hook Testing Patterns

### Testing with renderHook

```typescript
// features/users/hooks/useUsers.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUsers } from './useUsers';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useUsers', () => {
  it('fetches users successfully', async () => {
    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.items[0].name).toBe('John Doe');
  });

  it('handles errors', async () => {
    server.use(
      http.get('http://localhost:3000/api/users', () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      })
    );

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
```

### Testing Custom Hooks with State

```typescript
// hooks/useDebounce.test.ts
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));

    expect(result.current).toBe('initial');
  });

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });

    // Value hasn't changed yet
    expect(result.current).toBe('initial');

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });
});
```

---

## Utility Testing Patterns

```typescript
// utils/formatters.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, truncate } from './formatters';

describe('formatCurrency', () => {
  it('formats USD currency', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('handles negative numbers', () => {
    expect(formatCurrency(-100, 'USD')).toBe('-$100.00');
  });
});

describe('formatDate', () => {
  it('formats date in default format', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date)).toBe('Jan 15, 2024');
  });

  it('formats date with custom format', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2024-01-15');
  });
});

describe('truncate', () => {
  it.each([
    ['Hello World', 5, 'Hello...'],
    ['Hi', 5, 'Hi'],
    ['', 5, ''],
  ])('truncates "%s" with limit %i to "%s"', (input, limit, expected) => {
    expect(truncate(input, limit)).toBe(expected);
  });
});
```

---

## E2E Testing with Playwright

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Example

```typescript
// tests/e2e/users.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Users', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users');
  });

  test('displays list of users', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
    await expect(page.getByTestId('user-card')).toHaveCount(2);
  });

  test('creates a new user', async ({ page }) => {
    await page.getByRole('button', { name: /add user/i }).click();

    await page.getByLabel(/name/i).fill('New User');
    await page.getByLabel(/email/i).fill('new@example.com');
    await page.getByRole('button', { name: /submit/i }).click();

    await expect(page.getByText('User created successfully')).toBeVisible();
    await expect(page.getByText('New User')).toBeVisible();
  });

  test('shows validation errors', async ({ page }) => {
    await page.getByRole('button', { name: /add user/i }).click();
    await page.getByRole('button', { name: /submit/i }).click();

    await expect(page.getByText(/name is required/i)).toBeVisible();
    await expect(page.getByText(/email is required/i)).toBeVisible();
  });
});
```

---

## Test Commands

```bash
# Unit/Integration Tests (Vitest)
pnpm test                    # Watch mode
pnpm test:run                # Single run
pnpm test:coverage           # With coverage report
pnpm test:ui                 # Vitest UI

# Run specific tests
pnpm test UserList           # Match by filename
pnpm test --grep "submits"   # Match by test name

# E2E Tests (Playwright)
pnpm test:e2e                # Run all E2E tests
pnpm test:e2e --ui           # Interactive UI mode
pnpm test:e2e --project=chromium  # Single browser

# Debug
pnpm test:e2e --debug        # Step through tests
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Testing implementation details | Brittle tests | Test user-visible behavior |
| Snapshot testing everything | Meaningless snapshots | Snapshot only stable output |
| Mocking everything | Tests don't reflect reality | Use MSW for real network behavior |
| No test isolation | Flaky tests | Fresh QueryClient per test |
| `waitFor` with no assertion | Silent failures | Always assert inside waitFor |
| `getByTestId` everywhere | Not accessible | Prefer accessible queries |

---

## Query Priority

Use queries in this order (most to least preferred):

1. `getByRole` - Accessible, how users interact
2. `getByLabelText` - For form inputs
3. `getByPlaceholderText` - When label is not available
4. `getByText` - For non-interactive elements
5. `getByTestId` - Last resort for elements without accessible names

---

_Tests document behavior. Each test should read as a specification of what the code does for real users._
