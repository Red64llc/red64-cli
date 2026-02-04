# Gap Analysis: Preview Artifacts

---
**Purpose**: Analyze the gap between requirements and existing codebase to inform implementation strategy decisions.

**Approach**:
- Provide analysis and options, not final implementation choices
- Offer multiple viable alternatives when applicable
- Flag unknowns and constraints explicitly
- Align with existing patterns and architecture limits
---

## Executive Summary

**Scope**: Add artifact preview capability to the terminal CLI application to allow users to view markdown content and rendered Mermaid diagrams.

**Key Findings**:
- **Critical Context Mismatch**: Requirements assume a browser-based preview window, but this is a terminal (Ink/React) CLI application. Preview must work in terminal or open external viewers.
- **No Markdown/Mermaid Rendering**: Codebase has no markdown or Mermaid rendering libraries. These must be added or external tools invoked.
- **Limited Interactivity**: Current ArtifactsSidebar displays static text. Terminal hyperlinks (OSC 8) or keyboard navigation needed for "clicking" artifacts.
- **File System Integration Exists**: Services already read markdown files from `.red64/specs/` directories.

**Primary Challenges**:
1. Reconciling browser-based requirements with terminal environment constraints
2. Implementing markdown/Mermaid rendering in terminal or delegating to external tools
3. Designing click/interaction model appropriate for terminal UIs
4. Managing preview state and lifecycle in CLI workflow

**Recommended Approach**: Hybrid model with terminal-based interaction triggering external preview via system tools (browser, editor, or specialized terminal markdown viewer).

## Current State Investigation

### Domain-Related Assets

| Category | Assets Found | Location | Notes |
|----------|--------------|----------|-------|
| **Key Modules** | ArtifactsSidebar | `src/components/ui/ArtifactsSidebar.tsx` | Displays artifact list with icons, no interactivity |
| | StartScreen | `src/components/screens/StartScreen.tsx` | Main flow screen that renders ArtifactsSidebar |
| | TemplateService | `src/services/TemplateService.ts` | Reads/writes files including markdown |
| | StateStore | `src/services/StateStore.ts` | Persists artifacts array in flow state |
| **Reusable Components** | None for preview | - | No modal, dialog, or content viewer components exist |
| **Services/Utilities** | File reading utilities | Various services | `readFile` from `node:fs/promises` used throughout |
| | Artifact tracking | `src/types/index.ts` | Artifact interface: name, filename, path, phase, createdAt |

### Architecture Patterns

- **Dominant patterns**:
  - Ink (React for CLI) component-based UI
  - Service layer for file system operations
  - State managed via React hooks in screen components
  - Read-only artifact display (no user interaction with artifacts currently)

- **Naming conventions**:
  - Components: PascalCase (`ArtifactsSidebar.tsx`)
  - Services: PascalCase with "Service" suffix (`TemplateService.ts`)
  - Interfaces: PascalCase, exported from `types/index.ts`

- **Dependency direction**:
  - Components → Services → Node.js FS APIs
  - Screens own state, components are presentational
  - No circular dependencies observed

- **Testing approach**:
  - Vitest for unit tests
  - `ink-testing-library` for component testing
  - No E2E tests mentioned for CLI interactions

### Integration Surfaces

- **Data models/schemas**:
  - `Artifact` interface: `{ name, filename, path, phase, createdAt }`
  - Artifacts stored in flow state, persisted to `.red64/flows/{feature}/state.json`

- **API clients**:
  - N/A - CLI application, no external APIs for artifact content

- **File system operations**:
  - `readFile`, `writeFile` from `node:fs/promises`
  - Markdown files located at `.red64/specs/{feature}/requirements.md`, `design.md`, `tasks.md`, etc.

## Requirements Feasibility Analysis

### Technical Needs (from Requirements)

| Requirement | Technical Need | Category | Complexity |
|-------------|----------------|----------|------------|
| 1.x - Click artifact name | Interactive artifact list / Terminal hyperlinks (OSC 8) / Keyboard selection | UI / Input | Moderate |
| 2.x - Preview window display | Modal/overlay in Ink OR external preview tool invocation | UI / Integration | Complex |
| 2.x - Markdown rendering | Markdown-to-terminal renderer OR external tool (browser/editor) | Rendering / Integration | Complex |
| 3.x - Mermaid diagram rendering | Mermaid CLI (`@mermaid-js/mermaid-cli`) OR external tool | Rendering / Integration | Complex |
| 4.x - Preview window lifecycle | Component state management, close handlers | UI / State | Simple |
| 5.x - Loading/error states | Async file reading, error boundaries | Logic / UI | Simple |
| 6.x - Responsive layout | Ink flexbox layout adapts to terminal size | UI | Moderate |
| 6.x - Accessibility | Keyboard navigation, screen reader compatibility (limited in terminals) | UI / A11y | Moderate |
| 7.x - Window positioning | N/A for terminal (fixed viewport) or browser window control if external | UI / Integration | Simple to Complex |
| 8.x - Performance | File caching, lazy loading (minimal impact for text files) | Logic | Simple |

### Gap Analysis

| Requirement | Gap Type | Description | Impact |
|-------------|----------|-------------|--------|
| 1.x - Artifact interaction | **Missing** | ArtifactsSidebar has no click/selection mechanism | **High** - Core feature enabler |
| 2.x - Markdown rendering | **Missing** | No markdown-to-terminal library (e.g., `marked-terminal`) | **High** - Primary content display |
| 3.x - Mermaid rendering | **Missing** | No Mermaid rendering capability in terminal | **High** - Diagram visualization |
| 4.x - Preview UI component | **Missing** | No modal/overlay/panel component for content display | **High** - Content container |
| 2.x - "New window" interpretation | **Constraint** | Terminal CLIs don't have traditional "windows"; must interpret as: terminal overlay, separate terminal pane, or external application | **High** - Architectural decision |
| 6.x - WCAG compliance | **Constraint** | Terminal accessibility limited compared to web; ARIA not applicable | **Medium** - Adjust expectations |
| 7.x - Browser window APIs | **Constraint** | Requirements assume browser environment (window.open, dimensions); not applicable to terminal | **Medium** - Reinterpret as terminal sizing |
| 8.x - Code splitting | **Constraint** | CLI bundles at build time; no runtime code splitting | **Low** - Not applicable |
| All - Browser-centric language | **Unknown** | Requirements use web terminology; unclear if user expects terminal or actual browser preview | **High** - Clarify intent |

**Gap Types**:
- **Missing**: Capability does not exist in current codebase
- **Unknown**: Requires further research to determine feasibility
- **Constraint**: Existing architecture limits implementation options

## Implementation Approach Options

### Option A: Terminal-Native Preview with Markdown Rendering

**When to consider**: User expects in-terminal preview without leaving CLI

**Files/Modules to Create**:
| Component | Responsibility | Integration Points |
|-----------|----------------|-------------------|
| `PreviewModal.tsx` | Full-screen/overlay Ink component for content display | Renders over StartScreen |
| `MarkdownRenderer.tsx` | Converts markdown to terminal-formatted text | Uses `marked` + `marked-terminal` |
| `MermaidRenderer.tsx` | Generates Mermaid diagram as ASCII art or SVG-to-text | Calls `@mermaid-js/mermaid-cli` |
| `ArtifactReader.ts` service | Reads artifact file, caches content | Used by PreviewModal |
| Enhanced `ArtifactsSidebar.tsx` | Adds `useInput` hook for arrow key navigation + Enter to preview | Triggers PreviewModal open |

**Files/Modules to Extend**:
| File | Change Type | Impact Assessment |
|------|-------------|-------------------|
| `ArtifactsSidebar.tsx` | Extend | Add interactive selection state, keyboard handlers | Medium - Component becomes stateful |
| `StartScreen.tsx` | Extend | Conditionally render PreviewModal over main content | Low - Add conditional JSX |
| `package.json` | Extend | Add dependencies: `marked`, `marked-terminal`, `@mermaid-js/mermaid-cli` | Low - Standard npm install |

**Trade-offs**:
- ✅ Keeps user in terminal workflow, no context switching
- ✅ Consistent with CLI application architecture
- ✅ No external tool dependencies for basic markdown (Mermaid requires CLI tool)
- ❌ Limited rendering quality (no colors/formatting like browser)
- ❌ Mermaid as ASCII art has poor visual fidelity; SVG not displayable in most terminals
- ❌ Large modal overlay may obscure important CLI output
- ❌ Scrolling large documents in terminal modal is clunky

**Technical Research Needed**:
- Evaluate `marked-terminal` rendering quality for technical documentation
- Test `@mermaid-js/mermaid-cli` SVG-to-text conversion (if exists) or ASCII art output
- Prototype Ink modal with scrolling for long content
- Assess terminal size constraints for split-screen vs full-screen modal

---

### Option B: External Tool Delegation (Browser/Editor)

**When to consider**: User wants rich rendering (browser) or integrated editing (VSCode/editor)

**New Components Required**:
| Component | Responsibility | Integration Points |
|-----------|----------------|-------------------|
| `PreviewLauncher.ts` service | Detects system, opens artifact in appropriate tool | Called from enhanced ArtifactsSidebar |
| `BrowserPreview.ts` | Spawns local HTTP server, serves markdown as HTML, opens browser | Uses `http` module, `open` npm package |
| `EditorPreview.ts` | Opens artifact in system editor (VSCode, vim, etc.) | Uses `child_process.spawn` |
| Enhanced `ArtifactsSidebar.tsx` | Adds selection + action (keyboard or OSC 8 hyperlinks) | Calls PreviewLauncher service |

**Files/Modules to Extend**:
| File | Change Type | Impact Assessment |
|------|-------------|-------------------|
| `ArtifactsSidebar.tsx` | Extend | Add OSC 8 hyperlinks to artifact names OR keyboard selection | Medium - New interaction model |
| `package.json` | Extend | Add dependencies: `open` (cross-platform opener), possibly `marked` + `express` for HTML server | Low - Standard packages |

**Trade-offs**:
- ✅ High-quality rendering (browser shows full markdown + Mermaid natively via GitHub-style renderer)
- ✅ Familiar tools (VSCode, browser) users already know
- ✅ Offloads rendering complexity to specialized tools
- ✅ Mermaid diagrams render perfectly in browser
- ❌ Breaks CLI flow - user leaves terminal
- ❌ Requires browser or editor installed (not guaranteed in all environments, e.g., Docker sandbox mode)
- ❌ Local HTTP server adds complexity and potential port conflicts
- ❌ May not work in remote/SSH sessions without forwarding

**Technical Research Needed**:
- Test OSC 8 hyperlink support across terminal emulators (iTerm2, VSCode terminal, Windows Terminal, Linux terminals)
- Prototype local HTTP server with markdown-to-HTML renderer (marked + GitHub-style CSS)
- Evaluate `open` npm package reliability across OS platforms
- Determine fallback strategy when browser/editor unavailable (sandboxed environments)

---

### Option C: Hybrid - Terminal Selection + Configurable Preview Mode

**When to consider**: Support diverse user preferences and environments

**Combination Strategy**:
| Part | Approach | Rationale |
|------|----------|-----------|
| Artifact Selection | Terminal-native (keyboard + Enter) | Universal, works in all terminals |
| Preview Rendering | User-configurable: `--preview-mode` flag | Flexibility for different contexts |
| - Mode: `terminal` | Option A (in-terminal markdown rendering) | For headless/SSH environments |
| - Mode: `browser` | Option B (local server + browser) | For rich rendering on local machines |
| - Mode: `editor` | Option B (open in VSCode/editor) | For developers wanting to edit simultaneously |
| Default behavior | Auto-detect: browser if local, terminal if SSH | Smart fallback |

**Files/Modules to Create**:
| Component | Responsibility | Integration Points |
|-----------|----------------|-------------------|
| `PreviewOrchestrator.ts` service | Routes preview request to appropriate handler based on mode | Entry point from ArtifactsSidebar |
| `TerminalPreviewHandler.ts` | Implements Option A logic | Called by PreviewOrchestrator |
| `BrowserPreviewHandler.ts` | Implements Option B browser logic | Called by PreviewOrchestrator |
| `EditorPreviewHandler.ts` | Implements Option B editor logic | Called by PreviewOrchestrator |
| `PreviewConfigService.ts` | Reads user preference from config/flags | Used by PreviewOrchestrator |

**Files/Modules to Extend**:
| File | Change Type | Impact Assessment |
|------|-------------|-------------------|
| `ArtifactsSidebar.tsx` | Extend | Add keyboard selection, call PreviewOrchestrator | Medium - Stateful + orchestration |
| `types/index.ts` | Extend | Add `PreviewMode` type, extend `CLIConfig` | Low - Type definitions |
| `ConfigService.ts` | Extend | Add preview mode configuration | Low - New config field |
| `cli.tsx` | Extend | Add `--preview-mode` flag | Low - Argument parsing |

**Trade-offs**:
- ✅ Supports all use cases: local dev, SSH, CI/headless, sandboxed
- ✅ Users choose their preferred experience
- ✅ Graceful degradation (fallback to terminal if browser unavailable)
- ✅ Future-proof: easy to add new modes (e.g., VS Code extension, dedicated app)
- ❌ Higher implementation complexity - three code paths to maintain
- ❌ More testing surface area (must test all modes)
- ❌ User must learn/configure preview mode
- ❌ Requires both Option A and B dependencies

**Phased Implementation**:
1. **Phase 1 (MVP)**: Implement terminal mode only (Option A) - unblocks feature in all environments
2. **Phase 2**: Add browser mode (Option B browser) - enhances experience for local users
3. **Phase 3**: Add editor mode and auto-detection logic

**Risk Mitigation**:
- Start with simplest mode (terminal) to validate workflow and interaction model
- Use feature flag to enable browser/editor modes incrementally
- Comprehensive error handling for each mode with clear user messaging

---

## Effort and Risk Assessment

### Effort Estimate

| Option | Effort | Justification |
|--------|--------|---------------|
| A (Terminal) | **M** (4-6 days) | - PreviewModal component with scrolling: 1-2 days<br>- Markdown renderer integration: 1 day<br>- Mermaid ASCII rendering research + implementation: 1-2 days<br>- Keyboard navigation in ArtifactsSidebar: 1 day<br>- Testing + polish: 1 day |
| B (External) | **M** (3-5 days) | - PreviewLauncher service: 0.5 day<br>- Browser preview with local server: 1-2 days (marked + express + HTML template)<br>- Editor preview: 0.5 day (simpler, just spawn command)<br>- OSC 8 hyperlinks OR keyboard selection: 1 day<br>- Cross-platform testing: 1 day<br>- Fallback logic: 0.5 day |
| C (Hybrid) | **L** (8-10 days) | - Implements both A + B: 7-11 days (sum of above)<br>- PreviewOrchestrator + mode routing: 1 day<br>- Configuration system: 0.5 day<br>- Auto-detection logic: 0.5 day<br>- Integration testing across modes: 1 day<br>- Documentation: 0.5 day |

**Effort Scale**:
- **S** (1-3 days): Existing patterns, minimal dependencies, straightforward integration
- **M** (3-7 days): Some new patterns/integrations, moderate complexity
- **L** (1-2 weeks): Significant functionality, multiple integrations or workflows
- **XL** (2+ weeks): Architectural changes, unfamiliar tech, broad impact

### Risk Assessment

| Option | Risk | Justification |
|--------|------|---------------|
| A (Terminal) | **Medium** | - **Rendering Quality Unknown**: marked-terminal may not handle complex markdown well; Mermaid ASCII art likely poor quality<br>- **UX Friction**: Scrolling in terminal modal less smooth than browser<br>- **Diagram Limitation**: Mermaid diagrams will be hard to read as ASCII<br>- **Mitigation**: Prototype rendering early, set expectations with users |
| B (External) | **Medium** | - **Environment Assumptions**: Fails in Docker sandbox, SSH, or CI environments without browser<br>- **Port Conflicts**: Local server might conflict with user's running services<br>- **Terminal Support**: OSC 8 not universally supported (older terminals, multiplexers)<br>- **Mitigation**: Provide clear error messages, document environment requirements |
| C (Hybrid) | **Low-Medium** | - **Complexity**: More code paths increase bug surface area<br>- **Configuration Overhead**: Users must learn preview modes<br>- **Testing Burden**: Must validate all modes across platforms<br>- **Mitigation**: Phased rollout (start with one mode), comprehensive tests, good defaults |

**Risk Factors**:
- **High**: Unknown tech, complex integrations, architectural shifts, unclear perf/security path
- **Medium**: New patterns with guidance, manageable integrations, known solutions exist
- **Low**: Extend established patterns, familiar tech, clear scope, minimal integration

## Recommendations for Design Phase

### Preferred Approach

**Recommended Option**: **C (Hybrid)** with **Phased Implementation**

**Rationale**:
1. **Requirement Ambiguity Resolution**: Requirements use browser terminology but target a CLI app. Hybrid approach hedges against misinterpretation - if user expects browser, we support it; if terminal, we support that too.
2. **Environment Flexibility**: Supports all deployment contexts (local dev, remote SSH, Docker sandbox, CI).
3. **User Empowerment**: Developers have strong preferences for tools; configurability increases adoption.
4. **Iterative Risk Reduction**: Start with terminal-only (Option A) to validate core workflow, then add browser mode (lower risk of total failure).
5. **Future-Proof**: Easy to extend with new modes (e.g., dedicated preview app, VS Code extension).

**Phased Rollout**:
- **Phase 1 (MVP)**: Terminal preview only - validates interaction model, works everywhere
- **Phase 2**: Add browser preview - enhances experience for local users
- **Phase 3**: Add auto-detection and configuration

### Key Decisions Required

1. **Interpretation of Requirements**: Confirm whether "preview window" means:
   - A) In-terminal modal overlay
   - B) External browser/editor window
   - C) User choice (hybrid)
   - **Recommendation**: Clarify with stakeholder; assume C if ambiguous

2. **Mermaid Rendering Strategy**: Choose between:
   - A) ASCII art approximation (low fidelity, works in terminal)
   - B) SVG in browser only (high fidelity, requires browser mode)
   - C) Skip Mermaid rendering initially (show raw code block)
   - **Recommendation**: B (SVG in browser) for quality; C for MVP if time-constrained

3. **Interaction Model**: Select primary activation method:
   - A) Keyboard navigation (arrow keys + Enter) - universal
   - B) OSC 8 hyperlinks (Cmd+Click) - modern terminals only
   - C) Both (fallback logic)
   - **Recommendation**: A (keyboard) for MVP; add B in Phase 2

4. **Default Preview Mode**: Set default behavior:
   - A) Always terminal (safest, works everywhere)
   - B) Auto-detect (browser if local, terminal if SSH)
   - C) Prompt user on first use
   - **Recommendation**: B (auto-detect) for best UX; fallback to A

5. **Caching Strategy**: Decide content caching:
   - A) No caching (re-read file on each preview)
   - B) Cache in memory until flow phase changes
   - C) Cache with TTL (e.g., 5 minutes)
   - **Recommendation**: B (cache per phase) - files don't change during a phase

### Research Items to Carry Forward

| Item | Priority | Reason |
|------|----------|--------|
| Prototype `marked-terminal` rendering | **High** | Must validate terminal markdown quality before committing to Option A |
| Test OSC 8 hyperlink support in common terminals | **High** | Determines feasibility of click-to-preview (iTerm2, VSCode terminal, Windows Terminal, tmux) |
| Evaluate Mermaid ASCII art tools | **Medium** | Understand limitations before promising diagram support in terminal |
| Design local HTTP server architecture | **Medium** | If choosing browser mode, need secure, port-conflict-free solution |
| Benchmark markdown file read performance | **Low** | Likely fast enough (<100ms), but validate for large files (>1MB) |
| Survey terminal size constraints | **Low** | Understand minimum terminal dimensions for readable modal (80x24 baseline?) |
| Investigate iTerm2 inline image protocol | **Low** | Could enable terminal image display for Mermaid, but iTerm2-specific |
| Explore VS Code extension API for preview | **Future** | Alternative to local server if VS Code is primary editor |

## Out of Scope

Items explicitly deferred to design phase or future iterations:

- **Window resize handling**: Requirement 7.5 mentions scroll position memory - defer to Phase 2
- **Multiple artifact preview**: Requirements assume one artifact at a time; multi-preview not considered
- **Editing in preview**: Read-only preview only; editing happens in external editor (not CLI responsibility)
- **Syntax highlighting**: Defer to renderer capabilities (browser has this, terminal limited)
- **Theme customization**: Use terminal/browser defaults; custom themes out of scope
- **Print/export functionality**: Not mentioned in requirements; defer indefinitely
- **Collaborative preview**: Real-time updates if file changes - not applicable to CLI workflow
- **Accessibility beyond keyboard nav**: Screen reader support in terminals is limited; do best-effort only
- **Performance monitoring**: Requirement 8.x mentions metrics - defer to observability layer if added later

---

## Sources

Research findings based on:
- [Ink: React for CLIs - GitHub](https://github.com/vadimdemedes/ink)
- [OSC 8 Hyperlinks Specification - iTerm2](https://iterm2.com/feature-reporting/Hyperlinks_in_Terminal_Emulators.html)
- [OSC 8 Hyperlinks Gist - GitHub](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
- [Mermaid CLI - GitHub](https://github.com/mermaid-js/mermaid-cli)
- [Terminal Hyperlinks Support Tracker - GitHub](https://github.com/Alhadis/OSC8-Adoption)
- [VSCode OSC 8 Support Issue - GitHub](https://github.com/microsoft/vscode/issues/127229)
