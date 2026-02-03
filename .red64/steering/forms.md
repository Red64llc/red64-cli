# Form Patterns

Form handling with React Hook Form and Zod for type-safe, performant forms with excellent UX.

---

## Philosophy

- **Minimal re-renders**: Uncontrolled inputs with React Hook Form
- **Schema-first validation**: Define shape and rules in Zod, infer types
- **Accessible errors**: Clear, associated error messages
- **Optimistic UX**: Instant feedback, disable during submission

---

## Setup

```bash
pnpm add react-hook-form zod @hookform/resolvers
```

---

## Basic Form

### Schema Definition

```typescript
// features/users/schemas/user.schema.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  role: z.enum(['admin', 'user', 'guest'], {
    errorMap: () => ({ message: 'Please select a role' }),
  }),
  bio: z.string().max(500).optional(),
});

// Infer TypeScript type from schema
export type CreateUserInput = z.infer<typeof createUserSchema>;
```

### Form Component

```typescript
// features/users/components/CreateUserForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, type CreateUserInput } from '../schemas/user.schema';
import { useCreateUser } from '../hooks/useCreateUser';

export function CreateUserForm({ onSuccess }: { onSuccess?: () => void }) {
  const createUser = useCreateUser();

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'user',
      bio: '',
    },
  });

  const onSubmit = (data: CreateUserInput) => {
    createUser.mutate(data, {
      onSuccess: () => {
        form.reset();
        onSuccess?.();
      },
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormField
        label="Name"
        error={form.formState.errors.name?.message}
      >
        <input
          {...form.register('name')}
          type="text"
          aria-invalid={!!form.formState.errors.name}
        />
      </FormField>

      <FormField
        label="Email"
        error={form.formState.errors.email?.message}
      >
        <input
          {...form.register('email')}
          type="email"
          aria-invalid={!!form.formState.errors.email}
        />
      </FormField>

      <FormField
        label="Password"
        error={form.formState.errors.password?.message}
      >
        <input
          {...form.register('password')}
          type="password"
          aria-invalid={!!form.formState.errors.password}
        />
      </FormField>

      <FormField
        label="Role"
        error={form.formState.errors.role?.message}
      >
        <select {...form.register('role')}>
          <option value="">Select a role</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
          <option value="guest">Guest</option>
        </select>
      </FormField>

      <FormField
        label="Bio (optional)"
        error={form.formState.errors.bio?.message}
      >
        <textarea {...form.register('bio')} rows={4} />
      </FormField>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        isLoading={form.formState.isSubmitting}
      >
        Create User
      </Button>
    </form>
  );
}
```

---

## Form Field Component

```typescript
// components/ui/FormField/FormField.tsx
import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface FormFieldProps {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  error,
  description,
  required,
  children,
  className,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <div className={cn('mb-4', className)}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {description && (
        <p id={descriptionId} className="mb-1 text-sm text-gray-500">
          {description}
        </p>
      )}

      {/* Clone child and add props */}
      <div
        className={cn(
          '[&>input]:w-full [&>input]:rounded-md [&>input]:border [&>input]:px-3 [&>input]:py-2',
          '[&>select]:w-full [&>select]:rounded-md [&>select]:border [&>select]:px-3 [&>select]:py-2',
          '[&>textarea]:w-full [&>textarea]:rounded-md [&>textarea]:border [&>textarea]:px-3 [&>textarea]:py-2',
          error && '[&>*]:border-red-500'
        )}
      >
        {children}
      </div>

      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

---

## Advanced Validation

### Cross-Field Validation

```typescript
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain uppercase letter')
      .regex(/[0-9]/, 'Must contain number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'], // Error shown on this field
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });
```

### Conditional Validation

```typescript
const orderSchema = z
  .object({
    deliveryMethod: z.enum(['pickup', 'delivery']),
    address: z.string().optional(),
    city: z.string().optional(),
    zipCode: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.deliveryMethod === 'delivery') {
        return data.address && data.city && data.zipCode;
      }
      return true;
    },
    {
      message: 'Address is required for delivery',
      path: ['address'],
    }
  );

// Or use discriminated union
const orderSchema = z.discriminatedUnion('deliveryMethod', [
  z.object({
    deliveryMethod: z.literal('pickup'),
  }),
  z.object({
    deliveryMethod: z.literal('delivery'),
    address: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    zipCode: z.string().regex(/^\d{5}$/, 'Invalid zip code'),
  }),
]);
```

### Async Validation

```typescript
const usernameSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .refine(
      async (username) => {
        // Check if username is available
        const response = await fetch(`/api/check-username?q=${username}`);
        const { available } = await response.json();
        return available;
      },
      { message: 'Username is already taken' }
    ),
});

// Use mode: 'onBlur' for async validation
const form = useForm({
  resolver: zodResolver(usernameSchema),
  mode: 'onBlur', // Validate on blur instead of every keystroke
});
```

---

## Controlled Components with Controller

For custom/third-party components that don't support `ref`:

```typescript
import { Controller, useForm } from 'react-hook-form';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';

function EventForm() {
  const form = useForm<EventInput>({
    resolver: zodResolver(eventSchema),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* DatePicker needs Controller */}
      <Controller
        name="date"
        control={form.control}
        render={({ field, fieldState }) => (
          <FormField label="Event Date" error={fieldState.error?.message}>
            <DatePicker
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          </FormField>
        )}
      />

      {/* Custom Select component */}
      <Controller
        name="category"
        control={form.control}
        render={({ field, fieldState }) => (
          <FormField label="Category" error={fieldState.error?.message}>
            <Select
              options={categories}
              value={field.value}
              onChange={field.onChange}
              placeholder="Select category"
            />
          </FormField>
        )}
      />

      <Button type="submit">Create Event</Button>
    </form>
  );
}
```

---

## Array Fields

```typescript
import { useFieldArray, useForm } from 'react-hook-form';

const teamSchema = z.object({
  name: z.string().min(1),
  members: z
    .array(
      z.object({
        name: z.string().min(1, 'Member name is required'),
        email: z.string().email('Invalid email'),
      })
    )
    .min(1, 'At least one member required'),
});

function TeamForm() {
  const form = useForm<TeamInput>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      members: [{ name: '', email: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'members',
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField label="Team Name" error={form.formState.errors.name?.message}>
        <input {...form.register('name')} />
      </FormField>

      <div className="space-y-4">
        <h3>Team Members</h3>
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-4">
            <FormField
              label="Name"
              error={form.formState.errors.members?.[index]?.name?.message}
            >
              <input {...form.register(`members.${index}.name`)} />
            </FormField>

            <FormField
              label="Email"
              error={form.formState.errors.members?.[index]?.email?.message}
            >
              <input {...form.register(`members.${index}.email`)} type="email" />
            </FormField>

            {fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => remove(index)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}

        <Button type="button" variant="secondary" onClick={() => append({ name: '', email: '' })}>
          Add Member
        </Button>
      </div>

      <Button type="submit">Create Team</Button>
    </form>
  );
}
```

---

## Form with File Upload

```typescript
const profileSchema = z.object({
  name: z.string().min(1),
  avatar: z
    .instanceof(FileList)
    .refine((files) => files.length <= 1, 'Only one file allowed')
    .refine(
      (files) => files.length === 0 || files[0].size <= 5 * 1024 * 1024,
      'File must be less than 5MB'
    )
    .refine(
      (files) => files.length === 0 || ['image/jpeg', 'image/png'].includes(files[0].type),
      'Only JPEG and PNG allowed'
    )
    .optional(),
});

function ProfileForm() {
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
  });

  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField label="Avatar" error={form.formState.errors.avatar?.message}>
        <input
          {...form.register('avatar')}
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => {
            form.register('avatar').onChange(e);
            handleFileChange(e);
          }}
        />
        {preview && <img src={preview} alt="Preview" className="mt-2 h-20 w-20 rounded" />}
      </FormField>

      <Button type="submit">Save</Button>
    </form>
  );
}
```

---

## Multi-Step Forms

```typescript
const stepSchemas = [
  z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  }),
  z.object({
    email: z.string().email(),
    phone: z.string().min(10),
  }),
  z.object({
    address: z.string().min(1),
    city: z.string().min(1),
  }),
];

function MultiStepForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({});

  const form = useForm({
    resolver: zodResolver(stepSchemas[step]),
    defaultValues: formData,
  });

  const onNext = (data: Record<string, unknown>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    if (step < stepSchemas.length - 1) {
      setStep((s) => s + 1);
    } else {
      // Final submission
      submitFinalForm({ ...formData, ...data });
    }
  };

  const onBack = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <form onSubmit={form.handleSubmit(onNext)}>
      {/* Step indicator */}
      <div className="mb-8 flex justify-between">
        {stepSchemas.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 flex-1 rounded',
              i <= step ? 'bg-blue-500' : 'bg-gray-200'
            )}
          />
        ))}
      </div>

      {/* Step content */}
      {step === 0 && <PersonalInfoStep form={form} />}
      {step === 1 && <ContactInfoStep form={form} />}
      {step === 2 && <AddressStep form={form} />}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button type="button" variant="ghost" onClick={onBack} disabled={step === 0}>
          Back
        </Button>
        <Button type="submit">
          {step === stepSchemas.length - 1 ? 'Submit' : 'Next'}
        </Button>
      </div>
    </form>
  );
}
```

---

## Server Errors

```typescript
function LoginForm() {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const login = useLogin();

  const onSubmit = async (data: LoginInput) => {
    try {
      await login.mutateAsync(data);
    } catch (error) {
      if (error instanceof ApiError) {
        // Set server-side validation errors
        if (error.code === 'INVALID_CREDENTIALS') {
          form.setError('email', { message: 'Invalid email or password' });
        } else if (error.code === 'ACCOUNT_LOCKED') {
          form.setError('root', { message: 'Account is locked. Please contact support.' });
        }
      }
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Root error (not tied to specific field) */}
      {form.formState.errors.root && (
        <Alert variant="error">{form.formState.errors.root.message}</Alert>
      )}

      <FormField label="Email" error={form.formState.errors.email?.message}>
        <input {...form.register('email')} type="email" />
      </FormField>

      <FormField label="Password" error={form.formState.errors.password?.message}>
        <input {...form.register('password')} type="password" />
      </FormField>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        Login
      </Button>
    </form>
  );
}
```

---

## Form Hooks

### Extract Form Logic

```typescript
// features/users/hooks/useUserForm.ts
export function useUserForm(options?: { onSuccess?: () => void }) {
  const createUser = useCreateUser();

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'user',
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createUser.mutate(data, {
      onSuccess: () => {
        form.reset();
        options?.onSuccess?.();
      },
      onError: (error) => {
        form.setError('root', { message: error.message });
      },
    });
  });

  return {
    form,
    onSubmit,
    isSubmitting: form.formState.isSubmitting || createUser.isPending,
    isSuccess: createUser.isSuccess,
  };
}

// Usage in component
function CreateUserForm({ onSuccess }: Props) {
  const { form, onSubmit, isSubmitting } = useUserForm({ onSuccess });

  return (
    <form onSubmit={onSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Controlled inputs for everything | Re-renders on every keystroke | Use React Hook Form (uncontrolled) |
| Validation in component | Not reusable, hard to test | Use Zod schemas |
| Not using resolver | Manual error handling | Use @hookform/resolvers |
| Disabled submit always | Bad UX | Disable only during submission |
| No loading state | User doesn't know it's working | Show spinner/loading text |
| Alert for every error | Overwhelming | Inline field errors |
| Form without noValidate | Browser validation conflicts | Add noValidate to form |

---

_Forms are user input. Make them fast, validate thoroughly, and provide clear feedback._
