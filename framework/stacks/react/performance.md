# Performance Patterns

React performance optimization patterns for fast, responsive applications.

---

## Philosophy

- **Measure first**: Don't optimize without profiling; intuition is often wrong
- **Optimize selectively**: Focus on actual bottlenecks, not hypothetical ones
- **User perception matters**: 100ms feels instant, 300ms feels responsive
- **Bundle size is performance**: Every KB counts on slow connections

---

## Performance Priorities

1. **Initial load time**: Time to First Contentful Paint (FCP)
2. **Time to Interactive (TTI)**: When users can interact
3. **Runtime performance**: Smooth 60fps interactions
4. **Memory usage**: Avoid leaks, minimize footprint

---

## Code Splitting

### Route-Level Splitting (Essential)

```typescript
// app/routes.tsx
import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';

// Lazy load route components
const Dashboard = lazy(() => import('@/features/dashboard/pages/Dashboard'));
const Users = lazy(() => import('@/features/users/pages/Users'));
const Settings = lazy(() => import('@/features/settings/pages/Settings'));

// Loading fallback
function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: 'users/*',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Users />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Settings />
          </Suspense>
        ),
      },
    ],
  },
]);
```

### Component-Level Splitting

```typescript
// Split heavy components
const Chart = lazy(() => import('@/components/Chart'));
const RichTextEditor = lazy(() => import('@/components/RichTextEditor'));
const CodeEditor = lazy(() => import('@/components/CodeEditor'));

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<ChartSkeleton />}>
        <Chart data={data} />
      </Suspense>
    </div>
  );
}
```

### Named Exports with Lazy

```typescript
// For named exports, use intermediate module
// components/Chart/index.ts
export { Chart } from './Chart';

// Lazy import
const Chart = lazy(() =>
  import('@/components/Chart').then((module) => ({ default: module.Chart }))
);
```

---

## Memoization

### When to Use React.memo

```typescript
// Use memo when:
// 1. Component renders often with same props
// 2. Component is expensive to render
// 3. Parent re-renders frequently

// Good candidate: Pure display component rendered in a list
const UserCard = memo(function UserCard({ user }: { user: User }) {
  return (
    <div className="user-card">
      <Avatar src={user.avatar} alt={user.name} />
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
});

// Bad candidate: Simple component, renders rarely
// Don't memo this - overhead not worth it
function PageTitle({ title }: { title: string }) {
  return <h1>{title}</h1>;
}
```

### useMemo for Expensive Computations

```typescript
function DataTable({ data, sortBy, filters }: Props) {
  // Expensive: filtering and sorting large dataset
  const processedData = useMemo(() => {
    let result = [...data];

    // Filter
    if (filters.status) {
      result = result.filter((item) => item.status === filters.status);
    }
    if (filters.search) {
      result = result.filter((item) =>
        item.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortBy.field];
      const bVal = b[sortBy.field];
      return sortBy.direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });

    return result;
  }, [data, sortBy, filters]); // Only recompute when these change

  return <Table data={processedData} />;
}
```

### useCallback for Stable References

```typescript
function ParentComponent() {
  const [items, setItems] = useState<Item[]>([]);

  // Without useCallback: new function every render
  // Children with memo would still re-render
  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []); // Empty deps: function never changes

  const handleUpdate = useCallback((id: string, data: Partial<Item>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...data } : item))
    );
  }, []);

  return (
    <div>
      {items.map((item) => (
        <MemoizedItem
          key={item.id}
          item={item}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  );
}
```

### When NOT to Memoize

```typescript
// Don't memoize:

// 1. Simple/cheap computations
const fullName = `${user.firstName} ${user.lastName}`; // Just string concat

// 2. Primitives that change every render anyway
const now = new Date(); // Always new

// 3. Components that always receive new props
// If parent always creates new objects, memo is useless
<Child data={{ name: 'John' }} /> // New object every render

// 4. Components rendered once
function App() {
  return <Layout />; // Only renders once
}
```

---

## Virtualization

### Long Lists with @tanstack/react-virtual

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Estimated row height
    overscan: 5, // Render 5 extra items above/below viewport
  });

  return (
    <div
      ref={parentRef}
      className="h-[400px] overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ListItem item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### When to Virtualize

| List Size | Recommendation |
|-----------|----------------|
| < 100 items | No virtualization needed |
| 100-500 items | Consider if items are complex |
| 500+ items | Definitely virtualize |

---

## Image Optimization

### Lazy Loading Images

```typescript
// Native lazy loading (modern browsers)
<img src={url} alt={alt} loading="lazy" />

// With intersection observer for more control
function LazyImage({ src, alt, ...props }: ImgProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Load 200px before in view
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className="relative">
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          className={cn('transition-opacity', isLoaded ? 'opacity-100' : 'opacity-0')}
          {...props}
        />
      )}
      {!isLoaded && <Skeleton className="absolute inset-0" />}
    </div>
  );
}
```

### Responsive Images

```typescript
<picture>
  <source
    srcSet="/image-400.webp 400w, /image-800.webp 800w, /image-1200.webp 1200w"
    type="image/webp"
    sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  />
  <img
    src="/image-800.jpg"
    alt="Description"
    loading="lazy"
    decoding="async"
  />
</picture>
```

---

## Debouncing and Throttling

### Debounce Search Input

```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);

  // API call uses debounced value
  const { data } = useSearch(debouncedQuery);

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search..."
    />
  );
}

// hooks/useDebouncedValue.ts
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

### Throttle Scroll Handler

```typescript
import { useThrottle } from '@/hooks/useThrottle';

function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0);
  const throttledScrollY = useThrottle(scrollY, 100);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Use throttledScrollY for expensive operations
  useEffect(() => {
    // This runs at most every 100ms
    trackScrollPosition(throttledScrollY);
  }, [throttledScrollY]);

  return null;
}
```

---

## State Updates Optimization

### Batch Updates

```typescript
// React 18 batches by default in event handlers and effects
// But for async operations, use flushSync if needed

import { flushSync } from 'react-dom';

// Normally batched (good)
function handleClick() {
  setCount((c) => c + 1);
  setFlag((f) => !f);
  // React renders once
}

// Manual batching for legacy code or specific needs
function handleAsync() {
  fetchData().then(() => {
    // React 18: Already batched
    setData(data);
    setLoading(false);
  });
}
```

### Avoid State Object Spreads in Loops

```typescript
// BAD: Creates new object for each item
items.forEach((item) => {
  setState((prev) => ({ ...prev, [item.id]: item })); // N state updates
});

// GOOD: Single update with all changes
setState((prev) => {
  const updates: Record<string, Item> = {};
  items.forEach((item) => {
    updates[item.id] = item;
  });
  return { ...prev, ...updates }; // 1 state update
});
```

---

## Bundle Size Optimization

### Import Only What You Need

```typescript
// BAD: Imports entire library
import _ from 'lodash';
_.debounce(fn, 300);

// GOOD: Import specific function
import debounce from 'lodash/debounce';
debounce(fn, 300);

// BEST: Use native or lighter alternative
function debounce(fn: Function, ms: number) {
  let timeout: NodeJS.Timeout;
  return (...args: unknown[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}
```

### Analyze Bundle

```bash
# Vite bundle analyzer
pnpm add -D rollup-plugin-visualizer

# vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
    }),
  ],
});
```

### Tree Shaking

```typescript
// Ensure library supports tree shaking (ESM)
// Check package.json for "module" or "exports" field

// Named exports tree-shake better than default
export { Button } from './Button';
export { Input } from './Input';
// vs
export default { Button, Input }; // Harder to tree-shake
```

---

## Profiling

### React DevTools Profiler

1. Open React DevTools → Profiler tab
2. Click Record
3. Perform the slow action
4. Click Stop
5. Analyze flame graph and ranked chart

### Performance API

```typescript
// Measure component render time
function ExpensiveComponent() {
  useEffect(() => {
    performance.mark('expensive-start');

    return () => {
      performance.mark('expensive-end');
      performance.measure('expensive-render', 'expensive-start', 'expensive-end');
      const measure = performance.getEntriesByName('expensive-render')[0];
      console.log(`Render took ${measure.duration}ms`);
    };
  }, []);

  return <div>...</div>;
}
```

### Why Did You Render (Development)

```typescript
// Install: pnpm add -D @welldone-software/why-did-you-render

// src/wdyr.ts
import React from 'react';

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}

// Import before React in main.tsx
import './wdyr';
import React from 'react';
```

---

## Core Web Vitals

| Metric | Target | Impact |
|--------|--------|--------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Load performance |
| **FID** (First Input Delay) | < 100ms | Interactivity |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability |
| **INP** (Interaction to Next Paint) | < 200ms | Responsiveness |

### Avoid CLS

```typescript
// Reserve space for images
<img src={url} alt={alt} width={400} height={300} />

// Or use aspect ratio
<div className="aspect-video">
  <img src={url} alt={alt} className="h-full w-full object-cover" />
</div>

// Skeleton for async content
{isLoading ? (
  <Skeleton className="h-40 w-full" />
) : (
  <Content data={data} />
)}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Premature optimization | Wasted effort, complexity | Profile first, optimize bottlenecks |
| Memo everything | Memory overhead, complexity | Memo only expensive components |
| Inline objects in JSX | New reference every render | useMemo or extract to variable |
| State in parent for all | Unnecessary re-renders | Colocate state, use Zustand selectors |
| Giant components | Can't optimize parts | Split into smaller components |
| No loading states | Layout shift, bad UX | Use Suspense, skeletons |

---

## Quick Wins Checklist

- [ ] Route-level code splitting with React.lazy
- [ ] Images: loading="lazy", width/height attributes
- [ ] Virtualize lists > 100 items
- [ ] Debounce search/filter inputs (300ms)
- [ ] Use Zustand selectors (not full store)
- [ ] Production build with minification
- [ ] Bundle analyzer check for bloat
- [ ] Remove console.logs in production

---

_Performance is a feature. Measure, optimize the bottlenecks, and ship fast._
