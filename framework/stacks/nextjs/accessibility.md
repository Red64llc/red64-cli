# Accessibility

Accessibility patterns for Next.js applications with semantic HTML, ARIA, keyboard navigation, focus management, and testing.

---

## Philosophy

- **Semantic first**: Use the right HTML element before reaching for ARIA
- **Keyboard complete**: Every interactive element must be operable without a mouse
- **Visible focus**: Focus indicators are a feature, not a bug
- **Test with real tools**: Automated checks catch 30% of issues; screen readers catch the rest

---

## Semantic HTML

### Use the Right Element

| Need | Correct Element | Not This |
|---|---|---|
| Navigation | `<nav>` | `<div className="nav">` |
| Page sections | `<main>`, `<section>`, `<aside>` | `<div>` |
| Clickable action | `<button>` | `<div onClick>`, `<a href="#">` |
| Link to page | `<a href="/path">` | `<button onClick={navigate}>` |
| List of items | `<ul>` / `<ol>` with `<li>` | Nested `<div>` |
| Form field label | `<label htmlFor="id">` | `<span>` before input |
| Table data | `<table>` with `<thead>`, `<tbody>` | Grid of `<div>` |
| Heading hierarchy | `<h1>` through `<h6>` | `<div className="heading">` |

### Page Structure

```typescript
// app/dashboard/page.tsx
export default async function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading">Statistics</h2>
        <StatsGrid />
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading">Recent Activity</h2>
        <ActivityFeed />
      </section>
    </main>
  );
}
```

### Heading Hierarchy

```typescript
// GOOD: Sequential heading levels
<h1>User Settings</h1>
  <h2>Profile</h2>
    <h3>Avatar</h3>
    <h3>Display Name</h3>
  <h2>Notifications</h2>
    <h3>Email Preferences</h3>

// BAD: Skipped heading levels
<h1>User Settings</h1>
  <h4>Profile</h4>  // Skipped h2 and h3
```

---

## ARIA Patterns

### When to Use ARIA

1. Use semantic HTML first
2. Add ARIA only when HTML semantics are insufficient
3. Never use ARIA to fix broken HTML structure

### Common ARIA Attributes

```typescript
// Live regions for dynamic updates
<div aria-live="polite" aria-atomic="true">
  {notification && <p>{notification}</p>}
</div>

// Loading states
<button disabled={isPending} aria-busy={isPending}>
  {isPending ? "Saving..." : "Save"}
</button>

// Expanded/collapsed
<button aria-expanded={isOpen} aria-controls="menu-panel" onClick={toggle}>
  Menu
</button>
<div id="menu-panel" hidden={!isOpen}>
  {/* menu content */}
</div>

// Required fields
<input aria-required="true" aria-invalid={!!error} aria-describedby="email-error" />
{error && <p id="email-error" role="alert">{error}</p>}
```

### Dialog/Modal Pattern

```typescript
"use client";

import { useRef, useEffect } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="rounded-xl border bg-background p-6 shadow-lg backdrop:bg-black/50"
    >
      <h2 id="dialog-title" className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
      <button onClick={onClose} aria-label="Close dialog" className="absolute right-4 top-4">
        <XIcon />
      </button>
    </dialog>
  );
}
```

---

## Keyboard Navigation

### Focus Management

```typescript
"use client";

import { useRef, useEffect } from "react";

// Auto-focus on mount (for modals, drawers)
export function SearchPanel({ isOpen }: { isOpen: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div role="search">
      <input ref={inputRef} type="search" placeholder="Search..." aria-label="Search" />
    </div>
  );
}
```

### Skip Navigation Link

```typescript
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
```

### Keyboard Shortcuts

```typescript
// Roving tabindex for toolbar/menu
"use client";

import { useState, useRef } from "react";

export function Toolbar({ items }: { items: { label: string; onClick: () => void }[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let nextIndex = index;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (e.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;

    if (nextIndex !== index) {
      e.preventDefault();
      setActiveIndex(nextIndex);
      refs.current[nextIndex]?.focus();
    }
  }

  return (
    <div role="toolbar" aria-label="Actions">
      {items.map((item, i) => (
        <button
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          tabIndex={i === activeIndex ? 0 : -1}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

---

## Next.js Specific Patterns

### Images

```typescript
import Image from "next/image";

// GOOD: Descriptive alt text
<Image src="/team/jane.jpg" alt="Jane Doe, CTO" width={200} height={200} />

// GOOD: Decorative image
<Image src="/pattern.svg" alt="" width={100} height={100} aria-hidden="true" />

// BAD
<Image src="/team/jane.jpg" alt="image" width={200} height={200} />
<Image src="/team/jane.jpg" alt="photo.jpg" width={200} height={200} />
```

### Links

```typescript
import Link from "next/link";

// GOOD: Descriptive link text
<Link href="/settings">Account settings</Link>

// GOOD: Link with context via aria-label
<Link href={`/users/${user.id}`} aria-label={`View profile for ${user.name}`}>
  View profile
</Link>

// BAD: Ambiguous link text
<Link href="/settings">Click here</Link>
```

### Dynamic Route Announcements

```typescript
// components/route-announcer.tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteAnnouncer() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const pageTitle = document.title;
    setAnnouncement(`Navigated to ${pageTitle}`);
  }, [pathname]);

  return (
    <div aria-live="assertive" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
```

---

## Color and Contrast

### Minimum Ratios (WCAG 2.1 AA)

| Element | Minimum Ratio |
|---|---|
| Normal text (< 18px) | 4.5:1 |
| Large text (>= 18px bold, >= 24px) | 3:1 |
| UI components and icons | 3:1 |
| Focus indicators | 3:1 against adjacent colors |

### Never Rely on Color Alone

```typescript
// GOOD: Color + icon + text
<Badge variant="error">
  <AlertIcon className="mr-1" aria-hidden="true" />
  Failed
</Badge>

// BAD: Color only
<span className="text-red-500">Failed</span>
```

---

## Forms

### Accessible Form Pattern

```typescript
export function LoginForm() {
  return (
    <form aria-labelledby="login-heading">
      <h2 id="login-heading">Sign in to your account</h2>

      <div>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-describedby="email-hint"
        />
        <p id="email-hint" className="text-sm text-muted-foreground">
          We will never share your email.
        </p>
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
        {errors.password && (
          <p id="password-error" role="alert" className="text-sm text-destructive">
            {errors.password}
          </p>
        )}
      </div>

      <button type="submit">Sign in</button>
    </form>
  );
}
```

---

## Testing

### Automated Tools

| Tool | Purpose | Integration |
|---|---|---|
| axe-core | Automated a11y checks | Vitest + @axe-core/react |
| Playwright | E2E a11y assertions | Built-in accessibility snapshots |
| eslint-plugin-jsx-a11y | Lint-time checks | ESLint config |

### Axe Integration with Vitest

```typescript
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

test("LoginForm has no accessibility violations", async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual Testing Checklist

- Navigate the entire page using only the keyboard (Tab, Shift+Tab, Enter, Escape, Arrow keys)
- Test with VoiceOver (macOS: Cmd+F5) or NVDA (Windows)
- Zoom to 200% and verify layout does not break
- Enable "Reduce Motion" in OS settings and verify animations respect it
- Test with forced colors mode (Windows High Contrast)

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `<div onClick>` for buttons | Not keyboard accessible, no role | Use `<button>` |
| Missing alt text on images | Screen readers say "image" with no context | Descriptive alt or `alt=""` for decorative |
| `outline: none` without replacement | Keyboard users lose their place | Use `focus-visible` with visible ring |
| Color-only status indicators | Invisible to color-blind users | Add icons, text, or patterns |
| Auto-playing media | Disorienting, cannot be stopped | Never auto-play; provide controls |
| `tabIndex > 0` | Breaks natural tab order | Use `tabIndex={0}` or `tabIndex={-1}` only |

---

_Accessibility is not a feature to add later. It is a quality of well-built software. If it does not work with a keyboard and a screen reader, it does not work._
