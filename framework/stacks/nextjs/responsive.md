# Responsive Design

Mobile-first responsive patterns for Next.js with Tailwind CSS v4, responsive images, fluid typography, and layout strategies.

---

## Philosophy

- **Mobile-first**: Start with the smallest screen, enhance upward
- **Content drives breakpoints**: Break when the content breaks, not at device widths
- **Fluid over fixed**: Use relative units and fluid scales; avoid pixel-perfect design
- **Performance on mobile**: Optimize images, minimize layout shift, respect slow networks

---

## Breakpoint Strategy

### Tailwind Defaults

| Breakpoint | Min Width | Typical Device |
|---|---|---|
| (default) | 0px | Mobile phones |
| `sm` | 640px | Large phones, landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

### Mobile-First Syntax

```typescript
// Tailwind classes apply at the breakpoint and UP
<div className="
  px-4            // Mobile: 16px padding
  sm:px-6         // >= 640px: 24px padding
  lg:px-8         // >= 1024px: 32px padding
">
  <div className="
    grid
    grid-cols-1       // Mobile: single column
    sm:grid-cols-2    // >= 640px: 2 columns
    lg:grid-cols-3    // >= 1024px: 3 columns
    gap-4
    sm:gap-6
  ">
    {items.map((item) => (
      <Card key={item.id} item={item} />
    ))}
  </div>
</div>
```

### Custom Breakpoints (Tailwind v4)

```css
/* app/globals.css */
@theme {
  --breakpoint-xs: 475px;
  --breakpoint-3xl: 1920px;
}
```

---

## Layout Patterns

### Responsive Sidebar

```typescript
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Mobile: top nav, Desktop: sidebar */}
      <aside className="
        w-full border-b bg-muted/50 p-4
        lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-6
      ">
        <nav>
          <MobileNav className="lg:hidden" />
          <DesktopNav className="hidden lg:block" />
        </nav>
      </aside>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
```

### Responsive Grid

```typescript
// Card grid that adapts from 1 to 4 columns
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {items.map((item) => <ItemCard key={item.id} {...item} />)}
</div>

// Two-column content layout
<div className="grid gap-8 lg:grid-cols-[1fr_300px]">
  <article>{mainContent}</article>
  <aside className="hidden lg:block">{sidebar}</aside>
</div>
```

### Responsive Stack

```typescript
// Horizontal on desktop, vertical on mobile
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <h1 className="text-2xl font-bold">Dashboard</h1>
  <div className="flex gap-2">
    <Button variant="outline">Export</Button>
    <Button>Create New</Button>
  </div>
</div>
```

---

## Container Queries

### Tailwind v4 Container Queries

```typescript
// Parent container
<div className="@container">
  <div className="
    flex flex-col gap-2
    @sm:flex-row @sm:items-center @sm:gap-4
    @lg:gap-6
  ">
    <Avatar user={user} />
    <div>
      <h3 className="font-semibold">{user.name}</h3>
      <p className="text-muted-foreground hidden @md:block">{user.bio}</p>
    </div>
  </div>
</div>
```

### When to Use Container vs Media Queries

| Approach | Use When |
|---|---|
| Media queries (`sm:`, `lg:`) | Page-level layout changes |
| Container queries (`@sm:`, `@lg:`) | Component adapts to its container width |

**Rule**: Use container queries for reusable components that appear in different-width containers (sidebars, grids, modals).

---

## Responsive Images

### Next.js Image Component

```typescript
import Image from "next/image";

// Responsive image that fills container
<div className="relative aspect-video w-full">
  <Image
    src="/hero.jpg"
    alt="Hero banner"
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    className="rounded-lg object-cover"
    priority  // Above the fold: skip lazy loading
  />
</div>

// Fixed-size responsive avatar
<Image
  src={user.avatarUrl}
  alt={user.name}
  width={48}
  height={48}
  className="h-12 w-12 rounded-full sm:h-16 sm:w-16"
  sizes="(max-width: 640px) 48px, 64px"
/>
```

### The `sizes` Attribute

```typescript
// Tell the browser how wide the image will be at each breakpoint
// so it can pick the right srcset image

// Full width on mobile, half on tablet, third on desktop
sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"

// Fixed width that changes at breakpoint
sizes="(max-width: 640px) 48px, 64px"
```

**Rule**: Always provide `sizes` when using `fill` or responsive images. Without it, the browser downloads the largest image regardless of viewport.

---

## Fluid Typography

### Clamp-Based Scaling

```css
/* app/globals.css */
@theme {
  --font-size-fluid-sm: clamp(0.875rem, 0.8rem + 0.25vw, 1rem);
  --font-size-fluid-base: clamp(1rem, 0.9rem + 0.35vw, 1.125rem);
  --font-size-fluid-lg: clamp(1.25rem, 1rem + 0.75vw, 1.5rem);
  --font-size-fluid-xl: clamp(1.5rem, 1.1rem + 1.25vw, 2.25rem);
  --font-size-fluid-2xl: clamp(2rem, 1.2rem + 2.5vw, 3rem);
}
```

```typescript
// Usage
<h1 className="text-[length:var(--font-size-fluid-2xl)] font-bold">
  Welcome Back
</h1>
<p className="text-[length:var(--font-size-fluid-base)]">
  Here is your dashboard overview.
</p>
```

### Responsive Text with Tailwind

```typescript
// Simple breakpoint-based sizing
<h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
  Page Title
</h1>

// Truncation on small screens
<p className="truncate sm:whitespace-normal">
  {longDescription}
</p>
```

---

## Touch Targets

### Minimum Sizes

```typescript
// Minimum 44x44px touch target (WCAG 2.5.5)
<button className="min-h-[44px] min-w-[44px] p-2">
  <TrashIcon className="h-5 w-5" />
</button>

// Icon button with adequate touch area
<button className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted">
  <MenuIcon className="h-5 w-5" />
</button>

// Link list with sufficient spacing
<nav>
  <ul className="space-y-1">
    {links.map((link) => (
      <li key={link.href}>
        <Link href={link.href} className="block rounded-md px-3 py-2 hover:bg-muted">
          {link.label}
        </Link>
      </li>
    ))}
  </ul>
</nav>
```

---

## Viewport Units

```typescript
// Full viewport height (mobile-safe)
<div className="min-h-dvh flex items-center justify-center">
  <LoginForm />
</div>

// Sticky header that accounts for mobile browser chrome
<header className="sticky top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <nav className="container flex h-full items-center">
    {/* ... */}
  </nav>
</header>
```

| Unit | Behavior |
|---|---|
| `vh` | Static viewport height (ignores mobile browser chrome) |
| `dvh` | Dynamic viewport height (accounts for mobile URL bar) |
| `svh` | Smallest viewport height |
| `lvh` | Largest viewport height |

**Rule**: Use `dvh` for full-page layouts on mobile. Use `vh` only for non-critical measurements.

---

## Responsive Tables

```typescript
// Stack on mobile, table on desktop
<div className="overflow-x-auto">
  <table className="w-full min-w-[600px]">
    <thead className="hidden sm:table-header-group">
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Role</th>
      </tr>
    </thead>
    <tbody>
      {users.map((user) => (
        <tr key={user.id} className="flex flex-col border-b p-4 sm:table-row sm:p-0">
          <td className="font-medium sm:p-3" data-label="Name">{user.name}</td>
          <td className="text-muted-foreground sm:p-3" data-label="Email">{user.email}</td>
          <td className="sm:p-3" data-label="Role"><Badge>{user.role}</Badge></td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Desktop-first CSS | Mobile styles require overrides | Start with mobile, enhance upward |
| Fixed pixel widths | Does not adapt to screen size | Use percentages, `max-w-*`, or grid |
| Missing `sizes` on images | Browser downloads oversized images | Always specify `sizes` with responsive images |
| Horizontal scroll on mobile | Content cut off or hidden | Test at 320px width minimum |
| Small touch targets | Frustrating on mobile, a11y failure | Minimum 44x44px tap area |
| Using `vh` for full-height layouts | Broken on mobile browsers | Use `dvh` or `min-h-screen` |

---

_Design for the smallest screen first, then add complexity. If it works on a phone, it will work everywhere._
