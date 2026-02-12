# Testing Patterns

Comprehensive testing conventions for Next.js with Vitest, React Testing Library, Playwright, and MSW.

---

## Philosophy

- **Fast feedback**: Unit tests run in milliseconds, no I/O
- **Test behavior, not implementation**: Assert what the user sees and does, not internal state
- **Minimal during development**: Focus on critical paths first; add edge cases in dedicated testing phases
- **Realistic integration**: Use MSW to mock APIs, not implementation details

---

## Test Organization

```
src/
  lib/
    __tests__/
      format-date.test.ts
      user-service.test.ts
  components/
    __tests__/
      user-card.test.tsx
      login-form.test.tsx
  actions/
    __tests__/
      user-actions.test.ts
tests/
  e2e/
    auth.spec.ts
    dashboard.spec.ts
  fixtures/
    users.ts
  helpers/
    setup.ts
```

**Pattern**: Colocate unit tests with source using `__tests__/` directories. Place E2E tests in the project root `tests/e2e/`.

---

## Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/helpers/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/**/*.d.ts", "src/**/__tests__/**"],
    },
  },
});
```

### Setup File

```typescript
// tests/helpers/setup.ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

---

## Unit Testing

### Pure Functions

```typescript
// lib/__tests__/format-date.test.ts
import { describe, it, expect } from "vitest";
import { formatRelativeDate } from "../format-date";

describe("formatRelativeDate", () => {
  it("returns 'just now' for current time", () => {
    expect(formatRelativeDate(new Date())).toBe("just now");
  });

  it("returns '2 hours ago' for two hours past", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeDate(twoHoursAgo)).toBe("2 hours ago");
  });

  it("returns absolute date for dates older than 7 days", () => {
    const oldDate = new Date("2023-01-15");
    expect(formatRelativeDate(oldDate)).toMatch(/Jan 15, 2023/);
  });
});
```

### Service Functions

```typescript
// lib/__tests__/user-service.test.ts
import { describe, it, expect, vi } from "vitest";
import { createUser } from "../services/user-service";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

describe("createUser", () => {
  it("creates a user when email is not taken", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "1",
      email: "jane@example.com",
      name: "Jane",
    } as any);

    const user = await createUser({ email: "jane@example.com", name: "Jane" });

    expect(user.email).toBe("jane@example.com");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: "jane@example.com", name: "Jane" },
    });
  });

  it("throws ConflictError when email exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "1" } as any);

    await expect(
      createUser({ email: "taken@example.com", name: "Test" })
    ).rejects.toThrow("already exists");
  });
});
```

---

## Component Testing

### React Testing Library

```typescript
// components/__tests__/user-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { UserCard } from "../user-card";

describe("UserCard", () => {
  const user = {
    id: "1",
    name: "Jane Doe",
    email: "jane@example.com",
    avatarUrl: null,
  };

  it("renders user name and email", () => {
    render(<UserCard user={user} />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("hides email when showEmail is false", () => {
    render(<UserCard user={user} showEmail={false} />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("jane@example.com")).not.toBeInTheDocument();
  });

  it("renders initials when no avatar URL", () => {
    render(<UserCard user={user} />);

    expect(screen.getByText("JD")).toBeInTheDocument();
  });
});
```

### Testing Interactions

```typescript
// components/__tests__/login-form.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

describe("LoginForm", () => {
  it("submits form with email and password", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "secret123",
    });
  });

  it("shows validation error for invalid email", async () => {
    const user = userEvent.setup();

    render(<LoginForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Invalid email address")).toBeInTheDocument();
  });

  it("disables submit button while pending", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => new Promise(() => {})); // Never resolves

    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });
});
```

---

## API Mocking with MSW

### Setup

```typescript
// tests/helpers/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users", () => {
    return HttpResponse.json({
      items: [
        { id: "1", name: "Jane", email: "jane@example.com" },
        { id: "2", name: "John", email: "john@example.com" },
      ],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  }),

  http.post("/api/users", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: "3", ...body, createdAt: new Date().toISOString() },
      { status: 201 }
    );
  }),
];
```

```typescript
// tests/helpers/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

```typescript
// tests/helpers/setup.ts (add MSW)
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Override Handlers in Tests

```typescript
import { http, HttpResponse } from "msw";
import { server } from "../../tests/helpers/mocks/server";

it("shows error when API fails", async () => {
  server.use(
    http.get("/api/users", () => {
      return HttpResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Server error" } },
        { status: 500 }
      );
    })
  );

  render(<UserList />);

  await screen.findByText("Failed to load users");
});
```

---

## E2E Testing with Playwright

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### Preventing Flaky Tests from Browser Popups

The most common cause of flaky E2E tests is Chrome's Password Manager and related popups interfering with user interactions. Configure Playwright to disable these features:

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

// Chrome arguments to disable popups and ensure deterministic behavior
const CHROMIUM_ARGS = [
  // Password manager popups - THE ROOT CAUSE OF MOST FLAKY TESTS
  "--disable-save-password-bubble",
  "--disable-features=PasswordLeakDetection,PasswordCheck,PasswordImport",
  // Prevent other popups and background activity
  "--disable-component-update",
  "--disable-sync",
  "--disable-background-networking",
];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: CHROMIUM_ARGS,
        },
        // Disable credential-related context options
        contextOptions: {
          ignoreHTTPSErrors: true,
        },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 14"],
        launchOptions: {
          args: CHROMIUM_ARGS,
        },
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### Chrome Arguments Reference

| Argument | Purpose |
|----------|---------|
| `--disable-save-password-bubble` | Prevent "Save password?" popup |
| `--disable-features=PasswordLeakDetection,PasswordCheck,PasswordImport` | Disable password breach detection |
| `--disable-component-update` | Prevent Chrome component updates during tests |
| `--disable-sync` | Disable Chrome sync (prevents account popups) |
| `--disable-background-networking` | Disable background network requests |

### Additional Flakiness Prevention

```typescript
// tests/e2e/helpers/auth.ts
import { Page } from "@playwright/test";

/**
 * Login helper that handles potential flakiness
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");

  // Wait for form to be fully interactive (React hydration)
  await page.waitForSelector('form[data-hydrated="true"]', { timeout: 5000 }).catch(() => {
    // Fallback: wait for button to be enabled
  });

  // Use fill() instead of type() for more reliable input
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  // Wait for button to be enabled before clicking
  const submitButton = page.getByRole("button", { name: "Sign in" });
  await submitButton.waitFor({ state: "visible" });
  await submitButton.click();

  // Wait for navigation to complete
  await page.waitForURL("/dashboard", { timeout: 10000 });
}
```

### E2E Test Pattern

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("user can sign in and see dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });
});
```

### Page Object Pattern

```typescript
// tests/e2e/pages/login-page.ts
import { type Page, type Locator } from "@playwright/test";

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(private page: Page) {
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.submitButton = page.getByRole("button", { name: "Sign in" });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

---

## Test Fixtures

```typescript
// tests/fixtures/users.ts
export const testUsers = {
  admin: {
    id: "user-admin",
    email: "admin@example.com",
    name: "Admin User",
    role: "ADMIN" as const,
  },
  member: {
    id: "user-member",
    email: "member@example.com",
    name: "Regular User",
    role: "MEMBER" as const,
  },
} as const;
```

---

## Test Commands

```bash
# Unit tests (fast feedback)
pnpm vitest run                             # Run once
pnpm vitest                                 # Watch mode
pnpm vitest run src/lib/__tests__/          # Specific directory

# Coverage
pnpm vitest run --coverage

# E2E tests
pnpm playwright test                        # All browsers
pnpm playwright test --project=chromium     # Single browser
pnpm playwright test tests/e2e/auth.spec.ts # Single file
pnpm playwright test --ui                   # Interactive UI mode

# CI pipeline
pnpm vitest run && pnpm playwright test
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Not disabling Chrome password manager | Random popups cause flaky E2E tests | Use CHROMIUM_ARGS to disable password features |
| Testing implementation details | Brittle, breaks on refactor | Test behavior: what the user sees and does |
| Snapshot tests for everything | Meaningless diffs, rubber-stamp approvals | Use snapshots sparingly; prefer explicit assertions |
| No MSW for API calls | Tests depend on real API, flaky | Mock at the network level with MSW |
| Slow unit tests (> 100ms each) | Developers stop running them | Mock I/O, no database in unit tests |
| Testing third-party libraries | Wasted effort | Trust the library; test your integration |
| No E2E for critical paths | Bugs in user flows slip through | E2E test login, signup, and primary workflows |
| Not waiting for React hydration | Interactions fail before JS is ready | Wait for hydration markers or use reliable selectors |

---

_Tests document behavior. Write them for the critical paths first, keep them fast, and assert what the user experiences._
