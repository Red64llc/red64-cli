# Red64 CLI

Red64 Flow Orchestrator - Deterministic spec-driven development CLI.

## Requirements

- Node.js >= 20.0.0

## Installation

```bash
npm install
```

## Development

### Run CLI in development mode

```bash
npm run dev
```

This runs the CLI using `tsx` for TypeScript execution without building.

### Run with arguments

```bash
npm run dev -- help
npm run dev -- start my-feature "Feature description"
npm run dev -- status my-feature
npm run dev -- list
npm run dev -- resume my-feature
npm run dev -- abort my-feature
npm run dev -- init
```

### Global flags

```bash
npm run dev -- --skip-permissions start my-feature "desc"
npm run dev -- --brownfield start my-feature "desc"
npm run dev -- --greenfield start my-feature "desc"
npm run dev -- --tier pro start my-feature "desc"
```

## Build

```bash
npm run build
```

After building, you can run the CLI directly:

```bash
node dist/cli.js help
```

Or link it globally:

```bash
npm link
red64 help
```

## Testing

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm test -- --watch
```

### Run tests with UI

```bash
npm run test:ui
```

### Run specific test file

```bash
npm test -- src/types/index.test.ts
npm test -- src/services/FlowStateMachine.test.ts
```

### Type checking

```bash
npm run type-check
```

## Project Structure

```
src/
├── cli.tsx              # CLI entry point
├── cli/
│   ├── parseArgs.ts     # Argument parsing
│   └── validateFlags.ts # Flag validation
├── components/
│   ├── App.tsx          # Root component
│   ├── GlobalConfig.tsx # Global config context
│   ├── CommandRouter.tsx
│   ├── screens/         # Screen components
│   └── ui/              # Reusable UI components
├── services/
│   ├── FlowStateMachine.ts
│   ├── StateStore.ts
│   ├── AgentInvoker.ts
│   └── PhaseExecutor.ts
├── types/
│   └── index.ts         # Type definitions
└── utils/
    └── git.ts           # Git operations
```

## Commands

| Command | Description |
|---------|-------------|
| `help` | Display help information |
| `init` | Initialize project configuration |
| `start <feature> <description>` | Start a new flow |
| `resume <feature>` | Resume an existing flow |
| `status [feature]` | Show flow status |
| `list` | List all active flows |
| `abort <feature>` | Abort and cleanup a flow |
