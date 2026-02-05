# Gap Analysis: Artifact Preview

---
**Purpose**: Analyze the gap between requirements and existing codebase to inform implementation strategy decisions.

**Approach**:
- Provide analysis and options, not final implementation choices
- Offer multiple viable alternatives when applicable
- Flag unknowns and constraints explicitly
- Align with existing patterns and architecture limits
---

## Executive Summary

- **Scope**: Add interactive artifact preview capability to the red64-cli terminal UI, enabling users to select artifacts from ArtifactsSidebar using keyboard navigation and view them in a browser with markdown rendering and Mermaid diagrams
- **Key Findings**:
  - This is a **Node.js CLI application** using Ink (React for terminals), NOT a React web application
  - Design decision: Browser-based preview launched from terminal (not in-terminal rendering)
  - Existing ArtifactsSidebar component is presentational-only with no keyboard interaction
  - No markdown-to-HTML conversion, HTTP server, or browser launching capabilities exist
  - Ink provides `useInput` hook for keyboard handling (used in ApprovalScreen, ProgressScreen, GroupedSelect)
  - Service layer pattern well-established (StateStore, WorktreeService, TemplateService)
- **Primary Challenges**:
  - Adding keyboard navigation to ArtifactsSidebar without breaking existing usage
  - Managing ephemeral HTTP server lifecycle (port allocation, auto-shutdown, cleanup)
  - Integrating browser preview workflow into terminal-based CLI UX
- **Recommended Approach**: Option B (Create New Components) - Build dedicated PreviewService, PreviewHTTPServer, PreviewHTMLGenerator, and ContentCache while keeping ArtifactsSidebar changes minimal

## Current State Investigation

### Domain-Related Assets

| Category | Assets Found | Location | Notes |
|----------|--------------|----------|-------|
| **Key Modules** | ArtifactsSidebar | `src/components/ui/ArtifactsSidebar.tsx` | Presentational component displaying artifacts with icons/colors, no interactivity |
| | StartScreen | `src/components/screens/StartScreen.tsx` | Main workflow screen that renders ArtifactsSidebar, owns flow state |
| | ProgressScreen | `src/components/screens/ProgressScreen.tsx` | Uses `useInput` for abort command (q key) |
| | ApprovalScreen | `src/components/screens/ApprovalScreen.tsx` | Uses `useInput` for approve/reject (y/n keys) |
| **Reusable Components** | Spinner, ErrorDisplay | `src/components/ui/` | Loading and error UI patterns established |
| **Services/Utilities** | StateStore | `src/services/StateStore.ts` | Persists artifacts array in flow state JSON |
| | TemplateService | `src/services/TemplateService.ts` | Reads/writes files including markdown |
| | WorktreeService | `src/services/WorktreeService.ts` | Git worktree management, path validation |
| **Input Handling** | useInput (Ink) | Multiple screens | Keyboard input pattern: `useInput((input, key) => { ... })` |
| **Type System** | Artifact interface | `src/types/index.ts` | `{ name, filename, path, phase, createdAt }` |

### Architecture Patterns

- **Dominant patterns**:
  - Service-Oriented Architecture: Clear separation of UI components, business logic services, and external integrations
  - Functional React components with TypeScript strict mode
  - Service instantiation: Factory functions (e.g., `createStateStore()`)
  - State management: React useState in screen components, no global state library
  - File system operations: Node.js fs/promises with async/await

- **Naming conventions**:
  - Components: PascalCase (`ArtifactsSidebar.tsx`)
  - Services: PascalCase with "Service" suffix or descriptive name (`TemplateService.ts`, `PreviewHTTPServer.ts`)
  - Interfaces: PascalCase, exported from `types/index.ts`
  - Service factories: camelCase with "create" prefix (`createStateStore()`)

- **Dependency direction**:
  - Screens (owners) → UI Components (presentational) → Services (business logic) → Node.js APIs
  - Components receive callbacks as props (`onPreview?: (artifact: Artifact) => void`)
  - Services are pure functions or classes with explicit dependencies (dependency injection)

- **Testing approach**:
  - Vitest for unit tests, co-located with source files (`*.test.ts`, `*.test.tsx`)
  - `ink-testing-library` for Ink component testing
  - No E2E tests for CLI interactions currently

### Integration Surfaces

- **Data models/schemas**:
  - `Artifact` interface: `{ readonly name: string; readonly filename: string; readonly path: string; readonly phase: string; readonly createdAt: string; }`
  - Artifacts stored in `FlowState.artifacts` array, persisted to `.red64/flows/{feature}/state.json`

- **File system operations**:
  - `readFile`, `writeFile` from `node:fs/promises`
  - Markdown files located at `.red64/specs/{feature}/requirements.md`, `design.md`, `tasks.md`, `gap-analysis.md`, etc.

- **CLI framework**: Ink 5.x provides:
  - `useInput(callback)` hook for keyboard handling
  - `useApp()` hook for exit control
  - Flexbox layout with `<Box>` and `<Text>` components

## Requirements Feasibility Analysis

### Technical Needs (from Requirements)

| Requirement | Technical Need | Category | Complexity |
|-------------|----------------|----------|------------|
| 1.1-1.6 Artifact Interaction | Add keyboard navigation (Arrow Up/Down, Enter) to ArtifactsSidebar | UI / Input | Moderate |
| 1.4 Loading Indicator | Display loading state while preview is launching | UI | Simple |
| 1.5 Error Messages | Display error for file not found, read errors, server failures | UI / Logic | Simple |
| 2.1-2.8 Markdown Rendering | Convert markdown to HTML with proper formatting (headings, lists, code blocks, links, emphasis, blockquotes) | Logic | Moderate |
| 3.1-3.5 Mermaid Diagrams | Inject Mermaid.js library into HTML for client-side SVG rendering | Logic | Moderate |
| 4.1-4.6 Preview Window Lifecycle | Create ephemeral HTTP server, launch browser, manage cleanup | Logic / External | Complex |
| 5.1-5.5 Content Loading & Error Handling | Read artifact files, handle FS errors, retry on network errors | Logic / Error Handling | Moderate |
| 6.1-6.8 Responsive Layout & Accessibility | Generate responsive HTML with ARIA attributes for browser rendering | Logic | Simple |
| 7.1-7.4 Window Positioning | Control browser window dimensions and position (delegated to OS/browser) | External | Simple |
| 8.1-8.5 Performance & Optimization | Cache artifact content (5 min TTL), code splitting (Mermaid.js loaded on demand), lazy rendering | Logic / Performance | Simple to Moderate |

### Gap Analysis

| Requirement | Gap Type | Description | Impact |
|-------------|----------|-------------|--------|
| 1.1-1.6 Interactive Selection | **Missing** | ArtifactsSidebar has no keyboard input handling, selection state, or callbacks | **High** - Core feature enabler |
| 2.1-2.8 Markdown to HTML Conversion | **Missing** | No markdown parsing library (need `marked` package) | **High** - Primary content transformation |
| 2.x GitHub-style CSS | **Missing** | No CSS for markdown styling (need `github-markdown-css` package) | **High** - Visual presentation |
| 3.1-3.5 Mermaid Rendering | **Missing** | No Mermaid.js integration (need CDN script injection in HTML) | **High** - Diagram visualization |
| 4.x HTTP Server for Preview | **Missing** | No ephemeral server implementation (need Node.js `http` module) | **High** - Preview delivery mechanism |
| 4.x Browser Launcher | **Missing** | No cross-platform browser opener (need `open` package) | **High** - Preview activation |
| 5.x File Reading | **Existing** | TemplateService pattern exists; can extend or create similar | **Low** - Pattern established |
| 8.3 Content Caching | **Missing** | No caching mechanism (need JavaScript Map with TTL tracking) | **Medium** - Performance optimization |
| 7.x Window Positioning | **Constraint** | Browser window control limited to OS/browser defaults; cannot guarantee exact positioning | **Low** - Best-effort via `open` package |
| 8.2 Code Splitting | **Constraint** | Mermaid.js loaded via CDN (not bundled); no runtime code splitting needed in Node.js CLI | **Low** - CDN handles it |

**Gap Types**:
- **Missing**: Capability does not exist in current codebase (7 major gaps)
- **Existing**: Patterns and services available for extension (file reading)
- **Constraint**: External system limitations (browser control, CDN loading)

## Implementation Approach Options

### Option A: Extend Existing Components

**When to consider**: Feature fits naturally into existing structure

**Files/Modules to Extend**:
| File | Change Type | Impact Assessment |
|------|-------------|-------------------|
| `src/components/ui/ArtifactsSidebar.tsx` | Extend | Add state (selectedIndex), useInput hook, onPreview callback prop, highlight selected item | **High** - Component becomes stateful, interactive |
| `src/services/TemplateService.ts` | Extend | Add readArtifactContent method with caching logic inline | **Medium** - Mixing caching with file reading |
| `package.json` | Modify | Add dependencies: marked, github-markdown-css, open | **Low** - Standard npm install |

**New Files (Minimal)**:
| File | Responsibility |
|------|----------------|
| `src/services/PreviewService.ts` | Orchestrate preview: generate HTML, start server, open browser |
| `src/services/PreviewHTTPServer.ts` | Manage ephemeral HTTP server lifecycle |

**Trade-offs**:
- ✅ Fewer new files (2 services instead of 4)
- ✅ Leverages existing TemplateService for file operations
- ❌ ArtifactsSidebar becomes complex (mixing display, state, input handling)
- ❌ Harder to test: sidebar tests need to mock file system, HTTP server, browser launcher
- ❌ Caching logic embedded in TemplateService couples file reading with performance optimization
- ❌ Breaks single responsibility principle: sidebar now responsible for interaction AND preview orchestration

### Option B: Create New Components

**When to consider**: Feature has distinct responsibility or existing components are already complex

**New Components Required**:
| Component | Responsibility | Integration Points |
|-----------|----------------|-------------------|
| `PreviewService` | Orchestrate preview lifecycle: read file (with cache) → generate HTML → start server → open browser | Entry point called by StartScreen; uses ContentCache, PreviewHTMLGenerator, PreviewHTTPServer |
| `PreviewHTTPServer` | Manage ephemeral HTTP server: port allocation, request handling, auto-shutdown, cleanup | Used by PreviewService; Node.js `http` module |
| `PreviewHTMLGenerator` | Transform markdown to complete HTML document with CSS and Mermaid.js scripts | Used by PreviewService; `marked` library, HTML template generation |
| `ContentCache` | In-memory artifact content cache with 5-minute TTL and automatic pruning | Used by PreviewService; JavaScript Map with timestamp tracking |
| Enhanced `ArtifactsSidebar` | Add minimal keyboard input handling (arrow keys, Enter) and onPreview callback prop | Used in StartScreen; calls onPreview callback; minimal state (selectedIndex only) |

**Files/Modules to Extend**:
| File | Change Type | Impact Assessment |
|------|-------------|-------------------|
| `src/components/ui/ArtifactsSidebar.tsx` | Extend | Add selectedIndex state, useInput hook for arrow/Enter keys, highlight selected item, onPreview callback prop | **Medium** - Adds interaction but remains focused on UI |
| `src/components/screens/StartScreen.tsx` | Extend | Instantiate PreviewService, pass onPreview handler to ArtifactsSidebar, handle errors | **Low** - Standard service integration pattern |
| `package.json` | Modify | Add dependencies: marked, github-markdown-css, open | **Low** - Standard npm install |

**Trade-offs**:
- ✅ Clean separation of concerns: UI (sidebar) → Orchestration (PreviewService) → Infrastructure (HTTP server, HTML generator, cache)
- ✅ Each component has single responsibility (easier to understand, test, maintain)
- ✅ ArtifactsSidebar remains focused on display + minimal interaction (not responsible for preview logic)
- ✅ PreviewService is reusable: could be called from other screens (e.g., StatusScreen) in future
- ✅ Follows established service layer pattern (matches StateStore, WorktreeService architecture)
- ✅ Easier to test in isolation: mock PreviewService in sidebar tests; test PreviewService independently with file/HTTP mocks
- ❌ More files to navigate (4 new services + modified sidebar vs. 2 services + modified sidebar in Option A)
- ❌ Requires careful interface design for PreviewService API and service dependencies

### Option C: Hybrid Approach

**When to consider**: Complex features requiring both extension and new creation

**Combination Strategy**:
| Part | Approach | Rationale |
|------|----------|-----------|
| Artifact Selection UI | Extend ArtifactsSidebar with optional `interactive` mode prop | Backward compatible; existing usage unaffected |
| Preview Orchestration | Create PreviewService | Isolates complex browser/server logic from UI |
| HTTP Server | Create PreviewHTTPServer | Dedicated lifecycle management |
| HTML Generation | Inline in PreviewService (no separate generator) | Reduces files; markdown-to-HTML is straightforward |
| Content Caching | Create ContentCache | Centralized caching per Req 8.3 |
| File Reading | Inline in PreviewService (no service extension) | File reading is simple; no need to extend TemplateService |

**Trade-offs**:
- ✅ Balanced approach: fewer files than Option B (3 services instead of 4)
- ✅ ArtifactsSidebar gains `interactive` prop without breaking existing usage
- ✅ Core services (PreviewService, PreviewHTTPServer, ContentCache) remain isolated
- ❌ HTML generation logic embedded in PreviewService increases its complexity
- ❌ Harder to test HTML generation independently (coupled with PreviewService)
- ❌ Less reusable: if another screen needs HTML generation, logic must be extracted later

## Effort and Risk Assessment

### Effort Estimate

| Option | Effort | Justification |
|--------|--------|---------------|
| A | **M** (4-5 days) | Fewer files but complex integration: ArtifactsSidebar becomes stateful with input handling (1 day), PreviewService orchestration (1 day), PreviewHTTPServer with port allocation (1 day), inline caching and HTML generation (1 day), testing complex coupled components (1 day) |
| B | **M** (5-7 days) | More files but cleaner separation: ArtifactsSidebar keyboard navigation (1 day), PreviewService orchestration (1 day), PreviewHTTPServer lifecycle (1 day), PreviewHTMLGenerator (0.5 day), ContentCache (0.5 day), StartScreen integration (0.5 day), testing isolated components (1-2 days) |
| C | **M** (4-6 days) | Similar to A but with isolated cache: ArtifactsSidebar interactive mode (1 day), PreviewService with inline HTML generation (1.5 days), PreviewHTTPServer (1 day), ContentCache (0.5 day), testing (1-2 days) |

**Effort Scale**:
- **M** (3-7 days): New integrations (browser, HTTP server), moderate complexity (markdown parsing, ephemeral server management), established patterns (service layer) but new domain (server lifecycle)

### Risk Assessment

| Option | Risk | Justification |
|--------|------|---------------|
| A | **Medium** | Tight coupling between UI and external systems (browser, HTTP server, file system); ArtifactsSidebar becomes complex (state + input + callbacks); testing requires extensive mocking; harder to isolate failures; caching logic mixed with file reading increases complexity |
| B | **Low** | Clear boundaries reduce failure propagation; PreviewService isolates all external dependencies (browser, server, file system); easier to test (mock service in UI tests); follows existing service pattern (StateStore, WorktreeService); each component has single responsibility |
| C | **Low-Medium** | Slightly higher than B due to inline HTML generation in PreviewService; cache isolation mitigates some risk; but HTML generation logic harder to test independently; still better than A due to service layer isolation |

**Risk Factors**:
- **Medium (Option A)**: Mixing UI and external system concerns increases coupling; harder to debug browser/server issues when embedded in UI component; caching embedded in TemplateService couples file operations with performance concerns
- **Low (Option B)**: Service layer pattern well-established; external dependencies isolated; clear error boundaries; easier to stub/mock for tests; single responsibility per component
- **Low-Medium (Option C)**: Balance between file count and complexity; risk elevated by inline HTML generation but mitigated by service layer isolation

## Recommendations for Design Phase

### Preferred Approach

**Recommended Option**: **B (Create New Components)**

**Rationale**:
1. **Best aligns with existing architecture**: Service layer pattern is well-established (StateStore, WorktreeService, TemplateService); adding PreviewService, PreviewHTTPServer, PreviewHTMLGenerator, ContentCache follows this convention
2. **Lowest risk**: Clear boundaries prevent failure propagation; external dependencies (browser, HTTP server, file system) isolated from UI; easier to debug and fix issues
3. **Easiest to test**: Mock PreviewService in sidebar tests; test PreviewService, PreviewHTTPServer, PreviewHTMLGenerator, ContentCache independently with focused unit tests; no complex mocking of multiple systems in UI tests
4. **Future-proof**: PreviewService and PreviewHTMLGenerator can be called from other screens (e.g., StatusScreen showing artifacts, ListScreen previewing features) without duplicating logic
5. **Maintains ArtifactsSidebar focus**: Existing component stays primarily presentational; adds minimal interaction (keyboard nav + callback) without becoming a complex controller
6. **Single responsibility**: Each service has one clear job (PreviewService = orchestration, PreviewHTTPServer = server lifecycle, PreviewHTMLGenerator = HTML transformation, ContentCache = caching); easier to understand, maintain, extend
7. **TypeScript strict mode friendly**: Clean interfaces between components/services make types easier to maintain; no complex coupled state

### Key Decisions Required

1. **ArtifactsSidebar extension strategy**: Should we:
   - A) Add `interactive` boolean prop (enables keyboard nav conditionally)
   - B) Always make ArtifactsSidebar interactive (breaking change if other screens use it)
   - C) Create separate `InteractiveArtifactsSidebar` wrapper component
   - **Recommendation**: A (optional prop) - backward compatible, no breaking changes, minimal complexity

2. **HTTP server port allocation strategy**: How to select ports?
   - A) Fixed port (e.g., 3000) with error if unavailable
   - B) Random port in range (3000-3999) with availability check
   - C) OS-assigned random port (port 0)
   - **Recommendation**: B (random with check) - balance between predictability and conflict avoidance; easier to debug than OS-random

3. **Server lifecycle management**: When to shut down?
   - A) Manual shutdown (user must close, or cleanup on process exit)
   - B) Auto-shutdown after timeout (e.g., 60 seconds of inactivity)
   - C) Immediate shutdown after browser opens (may cause 404 if browser slow)
   - **Recommendation**: B (auto-shutdown with timeout) - prevents port exhaustion; user can leave browser open; graceful cleanup

4. **Error display location**: Where to show preview errors?
   - A) Inline in ArtifactsSidebar (below artifact list)
   - B) In main output area of StartScreen
   - C) stderr only (no UI display)
   - **Recommendation**: B (main output area) - more visible; follows pattern of other screens (StartScreen already shows errors); doesn't clutter sidebar

5. **Content cache scope**: Where should cache live?
   - A) Global singleton (shared across all preview service instances)
   - B) Instance-level (each PreviewService has its own cache)
   - C) Passed as dependency (caller controls cache instance)
   - **Recommendation**: C (dependency injection) - most flexible; aligns with service pattern (StateStore, WorktreeService also use DI); easier to test

### Research Items to Carry Forward

| Item | Priority | Reason |
|------|----------|--------|
| Ephemeral HTTP server port conflict handling | **High** | Must validate port allocation strategy works reliably across environments; define retry logic and error messages |
| Browser opening behavior across platforms | **High** | Verify `open` package works on macOS, Linux, Windows; test fallback behavior when browser unavailable (CI, Docker, SSH) |
| Mermaid.js initialization timing in browser | **Medium** | Ensure diagrams render before user sees page; validate `startOnLoad` configuration or need for manual init |
| HTML sanitization for markdown content | **Medium** | Verify `marked` default sanitization is sufficient for untrusted content; assess XSS risk for user-generated markdown |
| Server cleanup on process exit/abort | **High** | Ensure HTTP servers close cleanly on SIGINT, SIGTERM, process.exit; prevent orphaned processes and port leaks |
| Content cache memory usage with large files | **Low** | Validate cache doesn't cause memory issues with large markdown files (>1MB); consider size-based eviction |
| Marked library configuration | **Medium** | Determine if default `marked` options are sufficient or need custom renderer for GitHub-style markdown features |
| CDN fallback strategy for offline scenarios | **Low** | Decide if CDN resources (github-markdown-css, mermaid.js) need bundled fallbacks for offline/airgapped environments |

## Out of Scope

Items explicitly deferred to design phase or future iterations:

- **In-terminal markdown rendering**: Not part of initial implementation; browser-based preview is MVP
- **Editing artifacts from preview**: Read-only view only; editing happens in external editor (not CLI responsibility)
- **Multiple simultaneous artifact previews**: Requirements assume one artifact at a time; multi-preview not considered
- **Window resize handling and scroll position memory**: Requirement 7.5 mentions scroll position - defer to Phase 2 or rely on browser behavior
- **Custom theming for preview HTML**: Use GitHub-style CSS defaults; custom themes out of scope
- **Print/export functionality**: Not mentioned in requirements; defer indefinitely
- **Real-time file watching and preview updates**: Preview is snapshot-based; no live reload on file changes
- **Accessibility testing beyond ARIA attributes**: WCAG compliance validation deferred; ARIA attributes included but not formally tested
- **Performance monitoring and metrics**: Requirement 8.x mentions metrics but no telemetry system exists; defer to observability layer if added later
- **Syntax highlighting configuration**: Rely on `marked` and browser defaults; no custom highlight.js or prism.js integration
- **Preview history or back/forward navigation**: Single artifact preview only; no navigation between previously viewed artifacts
