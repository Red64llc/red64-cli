# Testing Patterns

Comprehensive Vitest patterns for modern Node.js projects.

---

## Philosophy

- **Fast feedback**: Unit tests run in milliseconds, no I/O
- **Realistic integration**: Test with real HTTP calls and database when it matters
- **Readable tests**: Each test tells a story with arrange-act-assert
- **Native ESM**: Vitest runs ESM natively, no transpilation step

---

## Test Organization

```
tests/
  setup.js                    # Global test setup
  unit/
    services/
      user-service.test.js
    utils/
      validation.test.js
  integration/
    api/
      users.test.js
    repositories/
      user-repo.test.js
  fixtures/
    users.js
```

**Pattern**: Mirror `src/` structure. Suffix all test files with `.test.js`.

---

## Vitest Configuration

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
    testTimeout: 5000,
    hookTimeout: 10000,
  },
});
```

---

## Basic Test Patterns

```javascript
import { describe, it, expect } from 'vitest';
import { calculateTotal } from '../../src/services/pricing.js';

describe('calculateTotal', () => {
  it('sums item prices', () => {
    const items = [{ price: 1000 }, { price: 2500 }];
    expect(calculateTotal(items)).toBe(3500);
  });

  it('returns 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });
});
```

---

## Mocking

### vi.fn() and vi.mock()

```javascript
import { describe, it, expect, vi } from 'vitest';
import { createUser } from '../../src/services/user-service.js';

vi.mock('../../src/repositories/user-repo.js', () => ({
  userRepo: { findByEmail: vi.fn(), save: vi.fn() },
}));

import { userRepo } from '../../src/repositories/user-repo.js';

describe('createUser', () => {
  it('saves user when email is available', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.save.mockResolvedValue({ id: 1, name: 'Alice' });

    const user = await createUser({ name: 'Alice', email: 'alice@test.com', password: 'secret' });

    expect(user.id).toBe(1);
    expect(userRepo.save).toHaveBeenCalledOnce();
  });

  it('throws ConflictError when email exists', async () => {
    userRepo.findByEmail.mockResolvedValue({ id: 99 });

    await expect(
      createUser({ name: 'Bob', email: 'taken@test.com', password: 'secret' }),
    ).rejects.toThrow('Email already registered');
  });
});
```

---

## Testing Async Code

```javascript
it('rejects with NotFoundError for missing user', async () => {
  await expect(userService.getUser(999)).rejects.toThrow('User not found');
  await expect(userService.getUser(999)).rejects.toBeInstanceOf(NotFoundError);
});
```

---

## Integration Testing with Supertest

```javascript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('POST /api/users', () => {
  it('creates a new user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'Alice', email: 'alice@test.com', password: 'secure123' })
      .expect(201);

    expect(response.body.email).toBe('alice@test.com');
    expect(response.body).not.toHaveProperty('password');
  });

  it('returns 422 for invalid data', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: '' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

---

## Test Fixtures

```javascript
// tests/fixtures/users.js
export function buildUser(overrides = {}) {
  return {
    id: 1,
    name: 'Alice',
    email: 'alice@test.com',
    role: 'user',
    isActive: true,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}
```

---

## Parameterized Tests

```javascript
describe('isValidEmail', () => {
  it.each([
    ['user@example.com', true],
    ['invalid', false],
    ['', false],
    ['@example.com', false],
  ])('validates "%s" as %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });
});
```

---

## Test Commands

```bash
npx vitest run tests/unit/ --reporter=dot     # Unit tests, minimal output
npx vitest                                    # Watch mode with HMR
npx vitest run --coverage                     # All tests + coverage
npx vitest run --reporter=junit --outputFile=results.xml  # CI
```

---

_Tests document behavior. Each test should read as a specification of what the code does._
