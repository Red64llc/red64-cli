# Technology Stack

## Project: {{projectName}}

## Architecture

Component-based architecture with unidirectional data flow. React components handle UI rendering while hooks manage state and side effects.

## Core Technologies

- **Language**: TypeScript 5.x (strict mode)
- **Framework**: React 18+
- **Runtime**: Node.js 20+ (development), Browser (production)
- **Build Tool**: Vite / Create React App / Next.js

## Key Libraries

- **State Management**: React Context / Redux / Zustand
- **Routing**: React Router / Next.js Router
- **Styling**: Tailwind CSS / CSS Modules / Styled Components
- **HTTP Client**: fetch / axios / TanStack Query

## Development Standards

### Type Safety
- TypeScript strict mode enabled
- No `any` types except for third-party library edge cases
- Explicit return types for exported functions
- Interface over type for object shapes

### Code Quality
- ESLint with recommended React rules
- Prettier for formatting
- Husky pre-commit hooks

### Testing
- Vitest / Jest for unit tests
- React Testing Library for component tests
- Playwright / Cypress for E2E tests
- Minimum 80% coverage for business logic

## Development Environment

### Required Tools
- Node.js 20+
- npm / yarn / pnpm
- VS Code with React extensions

### Common Commands
```bash
# Dev: npm run dev
# Build: npm run build
# Test: npm test
# Lint: npm run lint
```

## Key Technical Decisions

- **Functional Components**: Always use functional components with hooks
- **Custom Hooks**: Extract reusable logic into custom hooks
- **Composition**: Prefer composition over inheritance
- **Immutability**: Never mutate state directly

---
_Document standards and patterns, not every dependency_
