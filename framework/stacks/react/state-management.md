# State Management Patterns

Modern state management for React applications using Zustand for client state and TanStack Query for server state.

---

## Philosophy

- **Separate server and client state**: Server state (API data) and client state (UI state) have different needs
- **Minimal global state**: Keep state local when possible; lift only when necessary
- **Single source of truth**: Each piece of state lives in exactly one place
- **Derived state over stored state**: Compute values from existing state rather than storing duplicates

---

## State Categories

| Category | Definition | Tool | Examples |
|----------|------------|------|----------|
| **Server State** | Data from external sources | TanStack Query | Users list, product data, API responses |
| **Client State** | UI and application state | Zustand | Sidebar open, theme, shopping cart |
| **Local State** | Component-specific state | useState | Form inputs, toggles, modals |
| **URL State** | Route and search params | React Router | Current page, filters, search query |

---

## Zustand for Client State

### Basic Store

```typescript
// stores/ui.store.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'system',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));
```

### Store with Persistence

```typescript
// stores/auth.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
      isAuthenticated: () => get().token !== null,
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }), // Only persist these fields
    }
  )
);
```

### Store with Immer (Complex Updates)

```typescript
// stores/cart.store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>()(
  immer((set, get) => ({
    items: [],

    addItem: (item) =>
      set((state) => {
        const existing = state.items.find((i) => i.id === item.id);
        if (existing) {
          existing.quantity += 1;
        } else {
          state.items.push({ ...item, quantity: 1 });
        }
      }),

    removeItem: (id) =>
      set((state) => {
        state.items = state.items.filter((i) => i.id !== id);
      }),

    updateQuantity: (id, quantity) =>
      set((state) => {
        const item = state.items.find((i) => i.id === id);
        if (item) {
          item.quantity = Math.max(0, quantity);
        }
      }),

    clearCart: () => set({ items: [] }),

    total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }))
);
```

### Slices Pattern (Large Stores)

```typescript
// stores/slices/userSlice.ts
import type { StateCreator } from 'zustand';

export interface UserSlice {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const createUserSlice: StateCreator<UserSlice> = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
});

// stores/slices/preferencesSlice.ts
export interface PreferencesSlice {
  theme: 'light' | 'dark';
  language: string;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: string) => void;
}

export const createPreferencesSlice: StateCreator<PreferencesSlice> = (set) => ({
  theme: 'light',
  language: 'en',
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
});

// stores/app.store.ts
import { create } from 'zustand';
import { createUserSlice, type UserSlice } from './slices/userSlice';
import { createPreferencesSlice, type PreferencesSlice } from './slices/preferencesSlice';

type AppStore = UserSlice & PreferencesSlice;

export const useAppStore = create<AppStore>()((...a) => ({
  ...createUserSlice(...a),
  ...createPreferencesSlice(...a),
}));
```

---

## Zustand Best Practices

### Selectors for Performance

```typescript
// BAD - Subscribes to entire store, re-renders on any change
const { sidebarOpen, theme, user } = useUIStore();

// GOOD - Only subscribes to what's needed
const sidebarOpen = useUIStore((state) => state.sidebarOpen);
const theme = useUIStore((state) => state.theme);

// GOOD - Multiple values with shallow comparison
import { useShallow } from 'zustand/react/shallow';

const { sidebarOpen, theme } = useUIStore(
  useShallow((state) => ({ sidebarOpen: state.sidebarOpen, theme: state.theme }))
);
```

### Actions Outside Components

```typescript
// Access store outside React
const token = useAuthStore.getState().token;
useAuthStore.getState().setAuth(newToken, user);

// Useful in API interceptors, service functions
export const api = ky.create({
  hooks: {
    beforeRequest: [
      (request) => {
        const token = useAuthStore.getState().token;
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
  },
});
```

### Derived State

```typescript
// BAD - Storing computed values
interface CartState {
  items: CartItem[];
  total: number; // Don't store this!
}

// GOOD - Compute from source
interface CartState {
  items: CartItem[];
}

// Option 1: Method in store
export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  // Computed value as method
  getTotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
}));

// Option 2: Selector
const total = useCartStore((state) =>
  state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);
```

---

## Local State (useState)

Use local state when:
- State is only used by one component
- State doesn't need to persist
- State is UI-specific (hover, focus, animation)

```typescript
// Modal open state - local to component
function UserActions({ user }: { user: User }) {
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setDeleteModalOpen(true)}>Delete</Button>
      <DeleteModal
        open={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        user={user}
      />
    </>
  );
}
```

---

## useReducer for Complex Local State

```typescript
// Complex state with multiple related values
type FormState = {
  values: Record<string, string>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
};

type FormAction =
  | { type: 'SET_VALUE'; field: string; value: string }
  | { type: 'SET_ERROR'; field: string; error: string }
  | { type: 'SET_TOUCHED'; field: string }
  | { type: 'START_SUBMIT' }
  | { type: 'END_SUBMIT' }
  | { type: 'RESET' };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_VALUE':
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: '' },
      };
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.field]: action.error },
      };
    case 'SET_TOUCHED':
      return {
        ...state,
        touched: { ...state.touched, [action.field]: true },
      };
    case 'START_SUBMIT':
      return { ...state, isSubmitting: true };
    case 'END_SUBMIT':
      return { ...state, isSubmitting: false };
    case 'RESET':
      return initialState;
  }
}
```

---

## Context for Dependency Injection

Use Context for:
- Dependency injection (providing services, clients)
- Theme/i18n that rarely changes
- Feature flags

**Don't use for frequently changing state** (causes unnecessary re-renders).

```typescript
// contexts/ApiContext.tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { ApiClient } from '@/services/api';

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error('useApiClient must be used within ApiProvider');
  }
  return client;
}
```

---

## URL State (React Router)

Store state in URL when:
- State should be shareable via link
- State should survive page refresh
- State represents the current "view" (filters, pagination, search)

```typescript
// Using search params for filters
import { useSearchParams } from 'react-router-dom';

function UserList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const sort = searchParams.get('sort') || 'name';
  const search = searchParams.get('q') || '';

  const setPage = (newPage: number) => {
    setSearchParams((params) => {
      params.set('page', String(newPage));
      return params;
    });
  };

  const setSearch = (query: string) => {
    setSearchParams((params) => {
      if (query) {
        params.set('q', query);
      } else {
        params.delete('q');
      }
      params.set('page', '1'); // Reset to first page
      return params;
    });
  };

  // Use page, sort, search in your query
  const { data } = useUsers({ page, sort, search });

  return (/* ... */);
}
```

---

## State Decision Flowchart

```
Is this data from an API?
├── Yes → TanStack Query (server state)
└── No → Is it needed by multiple components?
    ├── No → useState or useReducer (local state)
    └── Yes → Should it be in the URL?
        ├── Yes → useSearchParams (URL state)
        └── No → Does it persist across sessions?
            ├── Yes → Zustand with persist
            └── No → Zustand (client state)
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Storing API data in Zustand | Stale data, no caching | Use TanStack Query for server state |
| Global state for everything | Unnecessary re-renders | Keep state local when possible |
| Context for frequent updates | Performance issues | Use Zustand with selectors |
| Duplicate state | Sync issues | Single source of truth, derive when needed |
| Not using selectors | Unnecessary re-renders | Always select specific values |
| Storing derived values | Can become stale | Compute on read |

---

## Testing Stores

```typescript
// Reset store between tests
import { useCartStore } from './cart.store';

beforeEach(() => {
  useCartStore.setState({ items: [] });
});

test('adds item to cart', () => {
  const { addItem } = useCartStore.getState();

  addItem({ id: '1', name: 'Product', price: 100 });

  expect(useCartStore.getState().items).toHaveLength(1);
  expect(useCartStore.getState().items[0].quantity).toBe(1);
});

test('increments quantity for existing item', () => {
  useCartStore.setState({
    items: [{ id: '1', name: 'Product', price: 100, quantity: 1 }],
  });

  const { addItem } = useCartStore.getState();
  addItem({ id: '1', name: 'Product', price: 100 });

  expect(useCartStore.getState().items[0].quantity).toBe(2);
});
```

---

_State is data plus the rules for changing it. Keep it minimal, local, and predictable._
