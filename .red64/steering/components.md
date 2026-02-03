# Component Patterns

Modern React component patterns for building maintainable, accessible, and reusable UI.

---

## Philosophy

- **Composition over inheritance**: Build complex UIs from simple, composable pieces
- **Single responsibility**: Each component does one thing well
- **Props down, events up**: Data flows down, actions flow up
- **Accessibility first**: Build accessible components from the start

---

## Component Structure

### Basic Component

```typescript
// components/ui/Button/Button.tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/utils/cn';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'primary',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
            'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
          },
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4': size === 'md',
            'h-12 px-6 text-lg': size === 'lg',
          },
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Spinner className="mr-2 h-4 w-4" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

### Component with Children

```typescript
// components/ui/Card/Card.tsx
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-6 shadow-sm', className)}>
      {children}
    </div>
  );
}

// Compound components
function CardHeader({ children, className }: CardProps) {
  return <div className={cn('mb-4', className)}>{children}</div>;
}

function CardTitle({ children, className }: CardProps) {
  return <h3 className={cn('text-lg font-semibold', className)}>{children}</h3>;
}

function CardContent({ children, className }: CardProps) {
  return <div className={cn('', className)}>{children}</div>;
}

function CardFooter({ children, className }: CardProps) {
  return <div className={cn('mt-4 flex items-center gap-2', className)}>{children}</div>;
}

// Attach compound components
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Content = CardContent;
Card.Footer = CardFooter;
```

---

## Composition Patterns

### Compound Components

```typescript
// Usage of compound components
<Card>
  <Card.Header>
    <Card.Title>User Profile</Card.Title>
  </Card.Header>
  <Card.Content>
    <p>{user.bio}</p>
  </Card.Content>
  <Card.Footer>
    <Button variant="secondary">Edit</Button>
    <Button>Save</Button>
  </Card.Footer>
</Card>
```

### Slot Pattern (Render Props)

```typescript
// components/DataTable/DataTable.tsx
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  renderEmpty?: () => ReactNode;
  renderLoading?: () => ReactNode;
  isLoading?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  renderEmpty = () => <p>No data</p>,
  renderLoading = () => <Spinner />,
  isLoading,
}: DataTableProps<T>) {
  if (isLoading) {
    return renderLoading();
  }

  if (!data.length) {
    return renderEmpty();
  }

  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col.key}>{col.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Usage
<DataTable
  data={users}
  columns={[
    { key: 'name', header: 'Name', render: (user) => user.name },
    { key: 'email', header: 'Email', render: (user) => user.email },
    { key: 'actions', header: '', render: (user) => <UserActions user={user} /> },
  ]}
  renderEmpty={() => <EmptyState icon={UsersIcon} message="No users found" />}
/>
```

### Children as Function

```typescript
// components/Disclosure/Disclosure.tsx
interface DisclosureProps {
  children: (props: { isOpen: boolean; toggle: () => void }) => ReactNode;
  defaultOpen?: boolean;
}

export function Disclosure({ children, defaultOpen = false }: DisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const toggle = () => setIsOpen((prev) => !prev);

  return <>{children({ isOpen, toggle })}</>;
}

// Usage
<Disclosure>
  {({ isOpen, toggle }) => (
    <div>
      <button onClick={toggle}>
        {isOpen ? 'Hide' : 'Show'} Details
      </button>
      {isOpen && <div>Hidden content here</div>}
    </div>
  )}
</Disclosure>
```

---

## Props Patterns

### Polymorphic Components (as prop)

```typescript
// components/ui/Box/Box.tsx
import { type ElementType, type ComponentPropsWithoutRef } from 'react';

type BoxProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as'>;

export function Box<T extends ElementType = 'div'>({
  as,
  children,
  ...props
}: BoxProps<T>) {
  const Component = as || 'div';
  return <Component {...props}>{children}</Component>;
}

// Usage
<Box as="section" className="p-4">Content</Box>
<Box as="article">Article content</Box>
<Box as="a" href="/about">Link styled as box</Box>
```

### Spreading Native Props

```typescript
// Always extend native element props for flexibility
interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div>
      <label>{label}</label>
      <input
        className={cn('input', error && 'input-error', className)}
        {...props} // Spread all native input props
      />
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}

// All native props work
<Input
  label="Email"
  type="email"
  placeholder="Enter email"
  required
  autoComplete="email"
  onChange={handleChange}
/>
```

### Default Props Pattern

```typescript
// Use default values in destructuring
interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  fallback?: string;
}

export function Avatar({
  src,
  alt,
  size = 'md', // Default value
  fallback,
}: AvatarProps) {
  const [error, setError] = useState(false);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  };

  if (error || !src) {
    return (
      <div className={cn('rounded-full bg-gray-200', sizeClasses[size])}>
        {fallback || alt.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn('rounded-full object-cover', sizeClasses[size])}
      onError={() => setError(true)}
    />
  );
}
```

---

## Controlled vs Uncontrolled

### Controlled Component

```typescript
// Parent controls the state
interface ControlledInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ControlledInput({ value, onChange }: ControlledInputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Usage
const [email, setEmail] = useState('');
<ControlledInput value={email} onChange={setEmail} />
```

### Uncontrolled Component

```typescript
// Component manages its own state
export function UncontrolledInput({ defaultValue }: { defaultValue?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const getValue = () => inputRef.current?.value;

  return <input ref={inputRef} defaultValue={defaultValue} />;
}
```

### Hybrid (Controlled with Default)

```typescript
// Support both controlled and uncontrolled usage
interface HybridInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export function HybridInput({ value, defaultValue, onChange }: HybridInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');

  // Use controlled value if provided, otherwise use internal
  const currentValue = value !== undefined ? value : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  return <input value={currentValue} onChange={handleChange} />;
}
```

---

## Event Handling

### Event Handler Types

```typescript
interface FormProps {
  onSubmit: (data: FormData) => void;
  // Use React event types
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}
```

### Preventing Default

```typescript
function Form({ onSubmit }: FormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Process form
    onSubmit(new FormData(e.currentTarget));
  };

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

### Event Delegation

```typescript
function List({ items, onItemClick }: { items: Item[]; onItemClick: (id: string) => void }) {
  // Single handler on parent, not individual handlers
  const handleClick = (e: React.MouseEvent<HTMLUListElement>) => {
    const target = e.target as HTMLElement;
    const item = target.closest('[data-item-id]');
    if (item) {
      onItemClick(item.getAttribute('data-item-id')!);
    }
  };

  return (
    <ul onClick={handleClick}>
      {items.map((item) => (
        <li key={item.id} data-item-id={item.id}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

---

## Accessibility Patterns

### Keyboard Navigation

```typescript
function Menu({ items }: { items: MenuItem[] }) {
  const [focusIndex, setFocusIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex((i) => (i + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex((i) => (i - 1 + items.length) % items.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        items[focusIndex].action();
        break;
    }
  };

  return (
    <ul role="menu" onKeyDown={handleKeyDown}>
      {items.map((item, index) => (
        <li
          key={item.id}
          role="menuitem"
          tabIndex={index === focusIndex ? 0 : -1}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}
```

### ARIA Attributes

```typescript
function ExpandableSection({ title, children }: { title: string; children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  return (
    <div>
      <button
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {title}
        <ChevronIcon className={isExpanded ? 'rotate-180' : ''} />
      </button>
      <div
        id={contentId}
        role="region"
        aria-labelledby={contentId}
        hidden={!isExpanded}
      >
        {children}
      </div>
    </div>
  );
}
```

### Focus Management

```typescript
function Modal({ isOpen, onClose, children }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button when modal opens
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Trap focus inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
      <button ref={closeButtonRef} onClick={onClose}>
        Close
      </button>
      {children}
    </div>
  );
}
```

---

## Using Radix UI Primitives

```typescript
// Build accessible components on top of Radix
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/utils/cn';

export function Dialog({ children, ...props }: DialogPrimitive.DialogProps) {
  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>;
}

export function DialogTrigger({ children, ...props }: DialogPrimitive.DialogTriggerProps) {
  return <DialogPrimitive.Trigger asChild {...props}>{children}</DialogPrimitive.Trigger>;
}

export function DialogContent({ children, className, ...props }: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'rounded-lg bg-white p-6 shadow-lg',
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// Usage
<Dialog>
  <DialogTrigger>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <h2>Dialog Title</h2>
    <p>Dialog content here</p>
  </DialogContent>
</Dialog>
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Props drilling | Hard to maintain | Use context or composition |
| Huge components | Hard to test, understand | Split into smaller components |
| Business logic in components | Not reusable, hard to test | Extract to hooks or services |
| Inline styles everywhere | No consistency | Use Tailwind or CSS modules |
| Missing key prop | Performance issues, bugs | Always provide stable keys |
| forwardRef forgotten | Can't access ref | Use forwardRef for reusable components |

---

_Components are the atoms of your UI. Keep them small, focused, and composable._
