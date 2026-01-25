# Ink Framework

[Purpose: CLI application patterns using Ink - a React-like framework for terminal interfaces]

## Philosophy
- Think in components: terminal UI is a tree of composable elements
- Embrace React mental model: props, state, hooks, and unidirectional data flow
- Keep rendering declarative; let Ink handle terminal output
- Optimize for user experience: responsive, clear feedback, graceful exits

## Project Setup

```bash
# TypeScript project (recommended)
npm init -y
npm install ink react
npm install -D typescript @types/react @types/node tsx
```

tsconfig.json essentials:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true
  }
}
```

## Component Patterns

### Naming and Organization
```
src/
  components/       # Reusable UI components
    Spinner.tsx
    StatusLine.tsx
    ProgressBar.tsx
  screens/          # Full-screen views (if multi-screen)
    MainScreen.tsx
  hooks/            # Custom hooks
    useCommand.ts
  cli.tsx           # Entry point with render()
```

### Component Structure
```tsx
import React, { FC } from 'react';
import { Box, Text } from 'ink';

interface StatusLineProps {
  label: string;
  status: 'pending' | 'success' | 'error';
}

export const StatusLine: FC<StatusLineProps> = ({ label, status }) => {
  const color = status === 'success' ? 'green'
    : status === 'error' ? 'red'
    : 'yellow';

  return (
    <Box>
      <Text color={color}>{label}: {status}</Text>
    </Box>
  );
};
```

### Core Ink Components
- `Box`: Flexbox container (use for layout)
- `Text`: Text output (supports color, bold, dimColor)
- `Newline`, `Spacer`: Layout helpers
- `Static`: Render content once (for logs/history)

## State Management

### Local State (preferred for simple cases)
```tsx
const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
```

### Custom Hooks (for reusable logic)
```tsx
// hooks/useAsync.ts
export function useAsync<T>(asyncFn: () => Promise<T>) {
  const [state, setState] = useState<{
    loading: boolean;
    data: T | null;
    error: Error | null;
  }>({ loading: true, data: null, error: null });

  useEffect(() => {
    asyncFn()
      .then(data => setState({ loading: false, data, error: null }))
      .catch(error => setState({ loading: false, data: null, error }));
  }, []);

  return state;
}
```

## Input Handling

### Keyboard Input
```tsx
import { useInput } from 'ink';

useInput((input, key) => {
  if (key.escape || input === 'q') {
    // Handle exit
  }
  if (key.return) {
    // Handle enter
  }
  if (key.upArrow || key.downArrow) {
    // Handle navigation
  }
});
```

### Text Input (use ink-text-input)
```tsx
import TextInput from 'ink-text-input';

<TextInput value={query} onChange={setQuery} onSubmit={handleSubmit} />
```

## App Lifecycle

### Entry Point Pattern
```tsx
#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { App } from './App.js';

const cli = meow(`
  Usage: mycli <command> [options]

  Commands:
    run     Execute the main task
    config  Configure settings

  Options:
    --help     Show help
    --version  Show version
`, {
  importMeta: import.meta,
  flags: {
    verbose: { type: 'boolean', shortFlag: 'v' }
  }
});

render(<App command={cli.input[0]} flags={cli.flags} />);
```

### Graceful Exit
```tsx
import { useApp } from 'ink';

const { exit } = useApp();

// Exit with success
exit();

// Exit with error
exit(new Error('Something went wrong'));
```

## Error Handling

### Error Boundaries
```tsx
import { Box, Text } from 'ink';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <Text color="red">Error: {this.state.error.message}</Text>;
    }
    return this.props.children;
  }
}
```

### User-Friendly Errors
- Show clear, actionable messages
- Use color coding: red for errors, yellow for warnings
- Provide exit codes (0 success, 1 general error, 2 usage error)

## Testing

### Component Testing
```tsx
import { render } from 'ink-testing-library';
import { StatusLine } from './StatusLine';

test('renders success status', () => {
  const { lastFrame } = render(<StatusLine label="Build" status="success" />);
  expect(lastFrame()).toContain('success');
});
```

### Key Points
- Use `ink-testing-library` for component tests
- `lastFrame()` returns current terminal output as string
- Test user flows with `stdin.write()` for input simulation

## Common Patterns

### Loading States
```tsx
const LoadingSpinner: FC<{ text: string }> = ({ text }) => {
  const [frame, setFrame] = useState(0);
  const frames = ['|', '/', '-', '\\'];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return <Text>{frames[frame]} {text}</Text>;
};
```

### Progress Indicators
- Use `Text` with color for status
- Combine `Box` with `flexDirection="column"` for multi-line
- Consider `ink-spinner` for polished spinners

### Multi-Step Workflows
```tsx
type Step = 'input' | 'confirm' | 'processing' | 'complete';
const [step, setStep] = useState<Step>('input');

// Render different UI based on step
{step === 'input' && <InputScreen onNext={() => setStep('confirm')} />}
{step === 'confirm' && <ConfirmScreen onNext={() => setStep('processing')} />}
// ...
```

## Dependencies (Common)
- `ink` - Core framework
- `react` - React runtime
- `meow` - CLI argument parsing
- `ink-text-input` - Text input component
- `ink-spinner` - Loading spinners
- `ink-select-input` - Selection lists

---
_Focus on component patterns and user experience, not implementation details._
