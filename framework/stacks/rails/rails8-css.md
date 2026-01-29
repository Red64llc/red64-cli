# Rails 8 CSS Organization & Refactoring Rules

## Core Principles

1. **Component-First Architecture**: Organize CSS around UI components, not pages
2. **Maintainability**: Prefer clarity and organization over brevity
3. **Performance**: Minimize CSS size and optimize for critical rendering path
4. **Consistency**: Follow established patterns throughout the codebase
5. **Rails 8 Native**: Leverage Propshaft and modern CSS features

## File Structure

### Recommended Directory Organization

```
app/assets/stylesheets/
├── application.css           # Main manifest file
├── base/
│   ├── reset.css            # CSS reset/normalize
│   ├── typography.css       # Font definitions, base typography
│   ├── variables.css        # CSS custom properties (colors, spacing, etc.)
│   └── utilities.css        # Utility classes
├── layouts/
│   ├── header.css           # Site header styles
│   ├── footer.css           # Site footer styles
│   ├── sidebar.css          # Sidebar styles
│   └── grid.css             # Layout grid systems
├── components/
│   ├── buttons.css          # Button styles
│   ├── forms.css            # Form elements
│   ├── cards.css            # Card components
│   ├── modals.css           # Modal dialogs
│   ├── tables.css           # Table styles
│   └── navigation.css       # Navigation menus
├── pages/
│   ├── home.css             # Home page specific styles
│   ├── dashboard.css        # Dashboard specific styles
│   └── profile.css          # Profile page specific styles
└── vendor/
    └── overrides.css        # Third-party library overrides
```

## Naming Conventions

### BEM (Block Element Modifier) - Recommended

Use BEM for component-based CSS:

```css
/* Block */
.card { }

/* Element */
.card__header { }
.card__body { }
.card__footer { }

/* Modifier */
.card--featured { }
.card--compact { }
.card__header--dark { }
```

### Naming Rules

1. **Use lowercase with hyphens**: `.user-profile`, not `.userProfile` or `.UserProfile`
2. **Be descriptive**: `.btn-primary` over `.btn-1`
3. **Avoid presentational names**: `.alert-danger` over `.red-box`
4. **Namespace JavaScript hooks**: Use `js-` prefix for JS selectors (`.js-dropdown-toggle`)
5. **Avoid IDs for styling**: Use classes instead

## CSS Custom Properties (Variables)

### Define in base/variables.css

```css
:root {
  /* Colors - Semantic naming */
  --color-primary: #007bff;
  --color-secondary: #6c757d;
  --color-success: #28a745;
  --color-danger: #dc3545;
  --color-warning: #ffc107;
  --color-info: #17a2b8;
  
  /* Neutral colors */
  --color-gray-100: #f8f9fa;
  --color-gray-200: #e9ecef;
  --color-gray-900: #212529;
  
  /* Spacing scale (4px base) */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  
  /* Typography */
  --font-family-base: system-ui, -apple-system, sans-serif;
  --font-family-mono: 'Courier New', monospace;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --line-height-base: 1.5;
  
  /* Borders */
  --border-radius-sm: 0.25rem;
  --border-radius-base: 0.375rem;
  --border-radius-lg: 0.5rem;
  --border-width: 1px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-base: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  
  /* Transitions */
  --transition-fast: 150ms ease-in-out;
  --transition-base: 250ms ease-in-out;
  --transition-slow: 350ms ease-in-out;
  
  /* Z-index scale */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;
}
```

## Component Structure

### Template for New Components

```css
/* ============================================
   Component: Button
   Description: Button styles for all button types
   ============================================ */

/* Base button styles */
.btn {
  display: inline-block;
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  text-align: center;
  text-decoration: none;
  border: var(--border-width) solid transparent;
  border-radius: var(--border-radius-base);
  cursor: pointer;
  transition: all var(--transition-fast);
}

/* Button variants */
.btn--primary {
  background-color: var(--color-primary);
  color: white;
}

.btn--primary:hover {
  background-color: color-mix(in srgb, var(--color-primary) 85%, black);
}

/* Button sizes */
.btn--sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
}

.btn--lg {
  padding: var(--space-3) var(--space-6);
  font-size: var(--font-size-lg);
}

/* Button states */
.btn:disabled,
.btn--disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
```

## Refactoring Strategy

### Step 1: Audit & Categorize

Before refactoring, categorize existing CSS:
1. **Base styles**: Resets, typography, global styles → `base/`
2. **Layout styles**: Headers, footers, grids → `layouts/`
3. **Component styles**: Buttons, forms, cards → `components/`
4. **Page-specific styles**: Unique to one page → `pages/`
5. **Utility classes**: Single-purpose helpers → `base/utilities.css`

### Step 2: Extract Components

Identify repeated patterns and extract into components:

```css
/* BEFORE: Repeated styles */
.user-card { padding: 16px; border-radius: 8px; }
.product-card { padding: 16px; border-radius: 8px; }
.article-card { padding: 16px; border-radius: 8px; }

/* AFTER: Component + modifiers */
.card {
  padding: var(--space-4);
  border-radius: var(--border-radius-lg);
}

.card--user { /* user-specific styles */ }
.card--product { /* product-specific styles */ }
.card--article { /* article-specific styles */ }
```

### Step 3: Eliminate Duplication

Use CSS custom properties and shared classes:

```css
/* BEFORE: Duplicated values */
.header { background: #007bff; }
.button-primary { background: #007bff; }
.link-primary { color: #007bff; }

/* AFTER: CSS variables */
:root { --color-primary: #007bff; }
.header { background: var(--color-primary); }
.button-primary { background: var(--color-primary); }
.link-primary { color: var(--color-primary); }
```

### Step 4: Simplify Selectors

Replace overly specific selectors:

```css
/* BEFORE: Too specific */
div.container ul.list li.item a.link { color: blue; }

/* AFTER: Simpler, more maintainable */
.list__link { color: var(--color-primary); }
```

### Step 5: Remove Dead Code

1. Search for unused classes in views
2. Use tools like PurgeCSS or look for classes not in `app/views/**/*`
3. Comment out suspicious code first, then remove after testing

## Rails 8 Specific Guidelines

### Application.css Manifest

Use `@import` or native CSS imports (not Sprockets directives):

```css
/* app/assets/stylesheets/application.css */

/* Base styles - load first */
@import "base/variables.css";
@import "base/reset.css";
@import "base/typography.css";
@import "base/utilities.css";

/* Layout styles */
@import "layouts/header.css";
@import "layouts/footer.css";
@import "layouts/grid.css";

/* Component styles */
@import "components/buttons.css";
@import "components/forms.css";
@import "components/cards.css";
@import "components/modals.css";

/* Page-specific styles */
@import "pages/home.css";
@import "pages/dashboard.css";

/* Vendor overrides - load last */
@import "vendor/overrides.css";
```

### Propshaft Optimization

1. Keep files modular for better caching
2. Use meaningful filenames (Propshaft uses content hashing)
3. Consider critical CSS extraction for above-the-fold content

### Turbo Compatibility

Ensure CSS works with Turbo's page transitions:

```css
/* Avoid body classes for page-specific styles */
/* AVOID: body.dashboard .widget { } */

/* PREFER: Scoped classes */
.dashboard-widget { }

/* Or use data attributes on body */
body[data-controller="dashboards"] .widget { }
```

## Modern CSS Features to Leverage

### Container Queries

```css
.card {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card__content {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
```

### Cascade Layers

Organize specificity explicitly:

```css
@layer base, components, utilities, overrides;

@layer base {
  /* Base styles */
}

@layer components {
  /* Component styles */
}

@layer utilities {
  /* Utility classes */
}

@layer overrides {
  /* High-priority overrides */
}
```

### Color Functions

```css
.btn--primary {
  background: var(--color-primary);
}

.btn--primary:hover {
  /* Darken by mixing with black */
  background: color-mix(in srgb, var(--color-primary) 85%, black);
}
```

### Logical Properties

Use logical properties for better i18n support:

```css
/* BEFORE: Physical properties */
.card { margin-left: 1rem; padding-right: 2rem; }

/* AFTER: Logical properties */
.card { margin-inline-start: 1rem; padding-inline-end: 2rem; }
```

## Utility Classes

Keep utilities minimal and semantic:

```css
/* Layout utilities */
.flex { display: flex; }
.grid { display: grid; }
.block { display: block; }
.hidden { display: none; }

/* Spacing utilities - use custom properties */
.mt-4 { margin-top: var(--space-4); }
.p-6 { padding: var(--space-6); }

/* Text utilities */
.text-center { text-align: center; }
.text-sm { font-size: var(--font-size-sm); }
.font-bold { font-weight: 700; }

/* Color utilities */
.text-primary { color: var(--color-primary); }
.bg-gray-100 { background-color: var(--color-gray-100); }
```

## Performance Best Practices

1. **Minimize nesting**: Keep selector depth ≤ 3 levels
2. **Avoid expensive properties**: Be cautious with `box-shadow`, `border-radius` on large elements
3. **Use `will-change` sparingly**: Only for animated elements
4. **Prefer `transform` and `opacity`**: For animations (GPU accelerated)
5. **Remove unused CSS**: Regularly audit and remove dead code

## Responsive Design

Use mobile-first approach with custom breakpoints:

```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}

/* Mobile first - base styles apply to all sizes */
.container {
  padding: var(--space-4);
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: var(--space-6);
    max-width: 768px;
    margin-inline: auto;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
  }
}
```

## Accessibility

Ensure CSS supports accessibility:

```css
/* Focus states - always visible */
.btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Don't remove outlines without replacement */
/* NEVER: * { outline: none; } */

/* Ensure sufficient color contrast */
.text-muted {
  color: var(--color-gray-600); /* Ensure 4.5:1 contrast ratio */
}

/* Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .btn {
    border-width: 2px;
  }
}
```

## Documentation

### Component Documentation Template

Add comments at the top of each component file:

```css
/**
 * Component: Card
 * 
 * Description: Flexible container component used throughout the application
 * 
 * Usage:
 *   <div class="card card--elevated">
 *     <div class="card__header">Title</div>
 *     <div class="card__body">Content</div>
 *     <div class="card__footer">Footer</div>
 *   </div>
 * 
 * Modifiers:
 *   --elevated: Adds shadow for elevated appearance
 *   --compact: Reduces padding for tighter layouts
 *   --bordered: Adds border instead of shadow
 * 
 * Dependencies: base/variables.css
 */
```

## Anti-Patterns to Avoid

1. **❌ Inline styles in views**: Keep all styles in CSS files
2. **❌ !important overuse**: Indicates specificity problems
3. **❌ Magic numbers**: Use named variables instead of hardcoded values
4. **❌ Deep nesting**: Keep selectors shallow (max 3 levels)
5. **❌ Non-semantic class names**: `.red-text` → `.text-danger`
6. **❌ ID selectors**: Use classes instead
7. **❌ Element selectors in components**: `.card div` → `.card__content`
8. **❌ Mixing concerns**: Keep layout, component, and utility styles separate

## Code Review Checklist

When reviewing CSS changes:

- [ ] Uses CSS custom properties for values
- [ ] Follows established naming conventions (BEM)
- [ ] Component is in correct directory
- [ ] No duplication of existing styles
- [ ] Responsive design implemented (mobile-first)
- [ ] Accessibility considered (focus states, color contrast)
- [ ] Works with Turbo page transitions
- [ ] No overly specific selectors (depth ≤ 3)
- [ ] Comments added for complex logic
- [ ] Tested in multiple browsers

## Testing Strategy

1. **Visual regression testing**: Use tools like Percy or BackstopJS
2. **Browser testing**: Test in Chrome, Firefox, Safari, Edge
3. **Device testing**: Test on mobile, tablet, desktop
4. **Accessibility testing**: Use axe DevTools or WAVE
5. **Performance testing**: Monitor CSS file sizes and load times

## Maintenance

1. **Regular audits**: Monthly review for unused CSS
2. **Documentation updates**: Keep component docs current
3. **Design token updates**: Centralize changes in variables.css
4. **Performance monitoring**: Track CSS bundle size
5. **Team training**: Ensure all developers follow guidelines

---

## Quick Reference Commands

```bash
# Find unused CSS classes (example grep)
grep -r "class-name" app/views

# Find all occurrences of a color value
grep -r "#007bff" app/assets/stylesheets

# Count lines in CSS files
find app/assets/stylesheets -name "*.css" -exec wc -l {} + | sort -n

# List all CSS files
find app/assets/stylesheets -name "*.css"
```

## Additional Resources

- MDN CSS Documentation: https://developer.mozilla.org/en-US/docs/Web/CSS
- BEM Methodology: https://getbem.com/
- CSS Guidelines: https://cssguidelin.es/
- CUBE CSS: https://cube.fyi/
- Modern CSS Solutions: https://moderncss.dev/
