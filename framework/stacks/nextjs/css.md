# CSS and Styling

Tailwind CSS v4 patterns for Next.js projects with design tokens, component variants, and dark mode.

---

## Philosophy

- **Utility-first**: Compose styles in markup; extract components, not CSS classes
- **Design tokens**: Define colors, spacing, and typography as CSS custom properties
- **No custom CSS unless necessary**: Tailwind utilities handle 95% of cases
- **Consistent variants**: Use class-variance-authority for component style APIs

---

## Tailwind CSS v4 Configuration

### CSS-First Config (No `tailwind.config.js`)

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Colors */
  --color-brand-50: oklch(0.97 0.02 250);
  --color-brand-500: oklch(0.55 0.2 250);
  --color-brand-900: oklch(0.25 0.1 250);

  /* Semantic colors */
  --color-background: var(--color-white);
  --color-foreground: var(--color-gray-950);
  --color-muted: var(--color-gray-100);
  --color-muted-foreground: var(--color-gray-500);
  --color-border: var(--color-gray-200);
  --color-primary: var(--color-brand-500);
  --color-destructive: oklch(0.55 0.2 25);

  /* Typography */
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 oklch(0 0 0 / 0.05);
}
```

### Dark Mode

```css
/* app/globals.css (continued) */
@variant dark (&:where(.dark, .dark *));

@theme {
  /* Light mode defaults above, dark mode overrides: */
}

.dark {
  --color-background: var(--color-gray-950);
  --color-foreground: var(--color-gray-50);
  --color-muted: var(--color-gray-900);
  --color-muted-foreground: var(--color-gray-400);
  --color-border: var(--color-gray-800);
}
```

### Dark Mode Toggle

```typescript
// components/theme-toggle.tsx
"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(stored === "dark" || (!stored && prefersDark));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button onClick={() => setDark(!dark)} aria-label="Toggle dark mode">
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
```

---

## The `cn()` Utility

### Setup

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Usage

```typescript
import { cn } from "@/lib/utils";

interface BadgeProps {
  variant: "success" | "warning" | "error";
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-green-100 text-green-800": variant === "success",
          "bg-yellow-100 text-yellow-800": variant === "warning",
          "bg-red-100 text-red-800": variant === "error",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
```

**Why `cn()`**: `clsx` handles conditionals, `twMerge` resolves conflicting Tailwind classes (e.g., a passed `className` of `bg-blue-500` correctly overrides an internal `bg-green-100`).

---

## Component Variants with CVA

### Setup

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary/90",
        secondary: "bg-muted text-foreground hover:bg-muted/80",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border border-border bg-transparent hover:bg-muted",
        ghost: "hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export function Button({
  variant,
  size,
  isLoading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export { buttonVariants };
```

---

## Common Patterns

### Container

```css
/* Use Tailwind's container or define a custom one */
@utility container {
  margin-inline: auto;
  padding-inline: 1rem;
  max-width: 80rem;
}
```

### Focus Styles

```typescript
// Consistent focus ring across all interactive elements
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
```

### Animations

```css
/* app/globals.css */
@theme {
  --animate-fade-in: fade-in 0.2s ease-out;
  --animate-slide-up: slide-up 0.3s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## Layout Patterns

### Sidebar Layout

```typescript
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r bg-muted/50">
        <nav className="p-4">
          {/* nav items */}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

### Centered Content

```typescript
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `@apply` everywhere | Defeats utility-first purpose | Extract React components instead |
| Hardcoded colors | Inconsistent, no dark mode | Use design tokens from `@theme` |
| `!important` in utilities | Fragile, hard to override | Use `cn()` to merge conflicts |
| CSS modules + Tailwind | Two styling systems to maintain | Pick one; prefer Tailwind |
| Inline `style={{}}` | No design system, no responsive | Use Tailwind utilities |
| Magic numbers for spacing | Inconsistent spacing | Use Tailwind's spacing scale |

---

_Style components with utilities. Extract React components, not CSS classes. Let the design system enforce consistency._
