# Research & Design Decisions

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

**Usage**:
- Log research activities and outcomes during the discovery phase.
- Document design decision trade-offs that are too detailed for `design.md`.
- Provide references and evidence for future audits or reuse.
---

## Summary
- **Feature**: `preview-artifacts`
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  - Requirements assume browser-based preview but application is a terminal (Ink/React) CLI
  - Multiple terminal markdown renderers available (marked-terminal 7.3.0 most mature)
  - Mermaid ASCII rendering available via multiple tools (mermaid-ascii, beautiful-mermaid)
  - OSC 8 hyperlink support varies by terminal (iTerm2 ✓, Windows Terminal ✓, VSCode limited)
  - Hybrid approach recommended: terminal selection + configurable rendering

## Research Log

### Terminal Environment Context
- **Context**: Requirements document assumes browser-based "preview window" but codebase is an Ink (React for CLI) terminal application.
- **Sources Consulted**:
  - [Ink GitHub Repository](https://github.com/vadimdemedes/ink)
  - Existing codebase analysis (ArtifactsSidebar.tsx, types/index.ts)
  - Gap analysis document
- **Findings**:
  - Ink is a React renderer for terminal UIs using Yoga (Flexbox layout engine)
  - No native "window" concept in terminals; must use modal overlays, external tools, or separate panes
  - Current ArtifactsSidebar is static display-only with no interactivity
  - Worktree paths already tracked in state
- **Implications**: Must reinterpret browser requirements for terminal context. Preview must work in-terminal or delegate to external viewers.

### Markdown Rendering in Terminal
- **Context**: Need to render markdown content in terminal for in-terminal preview mode.
- **Sources Consulted**:
  - [marked-terminal npm](https://www.npmjs.com/package/marked-terminal)
  - [GitHub - marked-terminal](https://github.com/mikaelbr/marked-terminal)
  - [cli-markdown npm](https://www.npmjs.com/package/cli-markdown)
- **Findings**:
  - **marked-terminal** v7.3.0 (published ~1 year ago): Most mature option
    - 803 dependent projects in npm registry
    - Supports syntax highlighting for JavaScript
    - Customizable colors and styles
    - Peer dependency on marked (>=1 <16)
  - Alternative: cli-markdown (smaller, less featured)
  - Both produce colored/styled terminal output suitable for technical documentation
- **Implications**: marked-terminal is production-ready for terminal markdown rendering. Quality sufficient for requirements and design documents.

### Mermaid Diagram Rendering
- **Context**: Requirements specify Mermaid diagram rendering (Requirement 3.x). Terminals don't support SVG natively.
- **Sources Consulted**:
  - [mermaid-ascii GitHub](https://github.com/AlexanderGrooff/mermaid-ascii)
  - [mermaid-ascii-diagrams PyPI](https://pypi.org/project/mermaid-ascii-diagrams/)
  - [beautiful-mermaid GitHub](https://github.com/lukilabs/beautiful-mermaid)
  - [Mermaid ASCII Hacker News](https://news.ycombinator.com/item?id=46804828)
- **Findings**:
  - **mermaid-ascii** (Go): Latest version Feb 1, 2026
    - Renders flowcharts, sequence diagrams, class diagrams
    - Uses Unicode box-drawing characters for prettier output
    - ASCII mode for maximum compatibility
    - Customizable spacing/padding
  - **beautiful-mermaid** (TypeScript/Node.js): TypeScript port of mermaid-ascii
    - Built by Craft for Craft Agents
    - Renders SVG or ASCII art
    - More suitable for Node.js integration
  - **mermaid-ascii-diagrams** (Python): Released Jan 18, 2026
    - Extracts fenced code blocks from Markdown
- **Implications**:
  - ASCII/Unicode Mermaid rendering is feasible but lower fidelity than browser SVG
  - beautiful-mermaid best fit for Node.js/TypeScript integration
  - For high-quality diagrams, browser preview mode required

### Terminal Hyperlink Support (OSC 8)
- **Context**: Evaluate click-to-preview interaction using terminal hyperlinks.
- **Sources Consulted**:
  - [OSC 8 Adoption List](https://github.com/Alhadis/OSC8-Adoption)
  - [OSC 8 Hyperlinks Specification](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
  - [iTerm2 Hyperlinks Feature](https://iterm2.com/feature-reporting/Hyperlinks_in_Terminal_Emulators.html)
  - [VSCode OSC 8 Issue #127229](https://github.com/microsoft/vscode/issues/127229)
- **Findings**:
  - **iTerm2**: Full OSC 8 support since 2017 ✓
  - **Windows Terminal**: Supported in recent versions ✓
  - **GNOME Terminal**: Supported ✓
  - **VSCode Terminal**: Limited/incomplete support (open issue #127229)
  - **Kitty, WezTerm**: Supported ✓
  - **tmux, screen**: No support ✗
  - OSC 8 format: `\u001b]8;;<URL>\u001b\\<TEXT>\u001b]8;;\u001b\\`
- **Implications**:
  - OSC 8 can be used as progressive enhancement
  - Must provide keyboard fallback for unsupported terminals
  - Not universally supported; keyboard navigation is primary interaction

### Cross-Platform Browser Launching
- **Context**: For browser preview mode, need reliable cross-platform launcher.
- **Sources Consulted**:
  - [open npm](https://www.npmjs.com/package/open)
  - [GitHub - open](https://github.com/sindresorhus/open)
  - [chrome-launcher npm](https://www.npmjs.com/package/chrome-launcher)
- **Findings**:
  - **open** v11.0.0 (published 2 months ago): Industry standard
    - 12,730 dependent projects
    - Cross-platform (macOS, Linux, Windows)
    - Opens URLs, files, executables
    - Maintained by Sindre Sorhus
  - **chrome-launcher** v1.2.1: Chrome-specific (646 dependents)
  - **@httptoolkit/browser-launcher** v3.0.1: Recently maintained fork
- **Implications**: `open` package is the correct choice for cross-platform browser launching. Reliable and widely adopted.

### GitHub Flavored Markdown Preview Server
- **Context**: For browser preview mode, need local HTTP server to render markdown as HTML.
- **Sources Consulted**:
  - [markdown-live-preview GitHub](https://github.com/ComotionLabs/markdown-live-preview)
  - [marked GitHub](https://github.com/markedjs/marked)
  - [hads GitHub](https://github.com/sinedied/hads)
  - [node-docserver GitHub](https://github.com/natesilva/node-docserver)
- **Findings**:
  - **markdown-live-preview**: Lightweight, auto-reload, real-time rendering, designed for LLM workflows
  - **marked**: Industry-standard markdown parser (powers marked-terminal)
  - **hads**: Fast, browsable documentation server
  - **node-docserver**: Middleware for Express
- **Implications**:
  - Can build minimal Express server with marked + GitHub CSS
  - Include Mermaid.js client-side library for diagram rendering
  - markdown-live-preview could be adapted or serve as reference

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Terminal-Native | Ink modal overlay, marked-terminal, mermaid-ascii | Works everywhere, no external dependencies | Lower rendering quality, poor Mermaid fidelity | Best for SSH/headless |
| Browser-Only | Local Express server, open browser | High-quality rendering, native Mermaid | Fails in Docker/SSH, breaks CLI flow | Best for local dev |
| Hybrid | Terminal keyboard selection, config flag for preview mode | Supports all environments, user choice | Higher complexity, more test surface | Recommended |
| Editor-Only | Spawn editor (VSCode, vim) | Familiar tools, edit + view | No Mermaid rendering, editor-dependent | Simple fallback |

## Design Decisions

### Decision: Hybrid Architecture with Phased Implementation
- **Context**: Requirements assume browser preview, but application is terminal CLI with varied deployment contexts (local, SSH, Docker sandbox).
- **Alternatives Considered**:
  1. **Terminal-Only**: In-terminal modal with marked-terminal + mermaid-ascii
  2. **Browser-Only**: Local server + open browser
  3. **Hybrid**: Both options with configuration
  4. **Editor-Only**: Spawn system editor
- **Selected Approach**: Hybrid with phased rollout
  - **Phase 1 (MVP)**: Browser preview only (simplest, highest quality)
  - **Phase 2**: Add terminal preview mode
  - **Phase 3**: Add auto-detection logic
- **Rationale**:
  - Browser preview provides highest-quality rendering (native Mermaid)
  - Terminal preview required for SSH/Docker but is lower priority
  - Phased approach reduces initial complexity and risk
  - Auto-detection provides best UX once both modes implemented
- **Trade-offs**:
  - ✅ Covers all use cases eventually
  - ✅ Highest quality rendering in Phase 1
  - ✅ Iterative risk reduction
  - ❌ Phase 1 doesn't work in Docker sandbox
  - ❌ Requires configuration management
  - ❌ More code to maintain long-term

### Decision: Keyboard Navigation Primary, OSC 8 Progressive Enhancement
- **Context**: Need interaction model for selecting artifacts to preview. OSC 8 hyperlinks not universally supported.
- **Alternatives Considered**:
  1. **Keyboard-Only**: Arrow keys + Enter (universal)
  2. **OSC 8-Only**: Clickable hyperlinks (modern terminals)
  3. **Both**: Keyboard with OSC 8 fallback
- **Selected Approach**: Keyboard navigation primary, add OSC 8 as progressive enhancement in Phase 2
- **Rationale**:
  - Keyboard navigation works in all terminals (tmux, screen, VSCode)
  - OSC 8 provides better UX where supported (iTerm2, Windows Terminal)
  - Progressive enhancement maintains universal access
- **Trade-offs**:
  - ✅ Works everywhere
  - ✅ Better UX for modern terminals
  - ❌ Slightly more implementation complexity
  - ❌ Users must learn keyboard shortcuts

### Decision: Browser Preview Uses Local Ephemeral HTTP Server
- **Context**: Browser preview requires serving markdown as HTML with Mermaid rendering.
- **Alternatives Considered**:
  1. **Ephemeral HTTP Server**: Start server on-demand, auto-shutdown
  2. **Long-Lived Server**: Start once, reuse across previews
  3. **Static HTML File**: Generate file, open in browser
  4. **VSCode Extension**: Use VSCode's markdown preview API
- **Selected Approach**: Ephemeral HTTP server (start on preview, shutdown on close)
- **Rationale**:
  - Ephemeral server avoids port conflicts and resource leaks
  - Allows live updates if file changes
  - Simpler than managing server lifecycle across CLI sessions
  - Static HTML would require regeneration on every preview
- **Trade-offs**:
  - ✅ No port conflicts
  - ✅ Clean shutdown
  - ✅ Support for live reload (future)
  - ❌ Slightly slower startup than long-lived server
  - ❌ Port selection logic required

### Decision: Markdown Stack - marked + github-markdown-css + mermaid.js
- **Context**: Browser preview needs markdown-to-HTML converter and styling.
- **Alternatives Considered**:
  1. **marked + github-markdown-css + mermaid.js**: Industry standard, mature
  2. **markdown-it**: Alternative parser, more plugins
  3. **remark/unified**: Modern, pluggable, verbose API
- **Selected Approach**: marked (v14+) + github-markdown-css + mermaid.js (v11+)
- **Rationale**:
  - marked is industry standard (powers marked-terminal)
  - github-markdown-css provides familiar GitHub styling
  - mermaid.js official client-side library for diagrams
  - All three are stable, well-documented, TypeScript-friendly
- **Trade-offs**:
  - ✅ Proven, stable, widely used
  - ✅ GitHub-style rendering
  - ✅ Official Mermaid support
  - ❌ marked less extensible than remark
  - ❌ github-markdown-css requires CDN or bundling

### Decision: Artifact Selection State in ArtifactsSidebar Component
- **Context**: Need to manage selected artifact state for keyboard navigation.
- **Alternatives Considered**:
  1. **Local Component State**: useState in ArtifactsSidebar
  2. **Zustand Store**: Global state management
  3. **Parent State**: StartScreen manages selection
- **Selected Approach**: Local component state with callback prop
- **Rationale**:
  - Selection is ephemeral, doesn't need persistence
  - ArtifactsSidebar owns the UI, should own the state
  - Callback prop allows parent to react to selection
  - Follows colocation principle from steering
- **Trade-offs**:
  - ✅ Simple, clear ownership
  - ✅ No global state pollution
  - ✅ Easy to test
  - ❌ Parent must pass callback
  - ❌ Can't share selection across screens (not needed)

### Decision: Cache Artifact Content in Memory with TTL
- **Context**: Requirements specify 5-minute cache (Requirement 8.3). Avoid redundant file reads.
- **Alternatives Considered**:
  1. **No caching**: Re-read file on every preview
  2. **In-memory cache with TTL**: Map of path → {content, timestamp}
  3. **Cache per phase**: Invalidate on phase change
  4. **Persistent cache**: Write to disk
- **Selected Approach**: In-memory cache with 5-minute TTL (per requirements)
- **Rationale**:
  - Artifacts rarely change during CLI session
  - 5-minute TTL balances freshness and performance
  - In-memory cache simple to implement
  - No disk I/O overhead
- **Trade-offs**:
  - ✅ Fast subsequent previews
  - ✅ Simple implementation
  - ✅ Automatic cleanup
  - ❌ Stale data if file edited externally
  - ❌ Memory overhead for large files (mitigated by TTL)

## Risks & Mitigations

### Risk: Browser Preview Fails in Docker Sandbox
- **Description**: Docker sandbox mode has no GUI, browser won't launch
- **Likelihood**: High (sandbox is headless)
- **Impact**: High (feature unusable in sandbox)
- **Mitigation**:
  - Document limitation in error message
  - Provide clear fallback: "Preview not available in sandbox mode. View artifact at: <path>"
  - Future: Add terminal preview mode in Phase 2

### Risk: Port Conflicts for HTTP Server
- **Description**: Random port selection may conflict with user's running services
- **Likelihood**: Low (ports 3000-3999 chosen randomly)
- **Impact**: Medium (preview fails with confusing error)
- **Mitigation**:
  - Implement port availability check before starting server
  - Retry with different port (up to 3 attempts)
  - Clear error message if all ports fail

### Risk: Mermaid Diagrams Fail to Render in Browser
- **Description**: Invalid Mermaid syntax causes client-side rendering failure
- **Likelihood**: Medium (user-generated diagrams may have errors)
- **Impact**: Low (diagram fails, but markdown still visible)
- **Mitigation**:
  - Mermaid.js has built-in error handling
  - Show error message in place of diagram
  - Document Mermaid syntax validation tools

### Risk: OSC 8 Hyperlinks Interfere with Terminal Multiplexers
- **Description**: tmux/screen don't support OSC 8 and may display escape codes as gibberish
- **Likelihood**: Medium (tmux is common)
- **Impact**: Medium (UI pollution, confusing output)
- **Mitigation**:
  - OSC 8 is Phase 2 feature, not MVP
  - Detect terminal capabilities (check TERM env var)
  - Only emit OSC 8 if terminal supports it
  - Always provide keyboard navigation fallback

### Risk: marked-terminal Rendering Quality Insufficient
- **Description**: Terminal markdown rendering may be hard to read for complex documents
- **Likelihood**: Low (marked-terminal mature and widely used)
- **Impact**: Low (users can use browser mode)
- **Mitigation**:
  - Terminal preview is Phase 2, not MVP
  - Browser mode is primary recommendation
  - Test with actual requirements.md and design.md files

## References

### Terminal Rendering
- [Ink - React for CLIs](https://github.com/vadimdemedes/ink) — React renderer for terminal UIs
- [marked-terminal npm](https://www.npmjs.com/package/marked-terminal) — Markdown to terminal rendering
- [mermaid-ascii GitHub](https://github.com/AlexanderGrooff/mermaid-ascii) — Mermaid ASCII rendering (Go)
- [beautiful-mermaid GitHub](https://github.com/lukilabs/beautiful-mermaid) — Mermaid ASCII/SVG rendering (TypeScript)

### Browser Preview
- [open npm](https://www.npmjs.com/package/open) — Cross-platform opener for URLs/files
- [marked GitHub](https://github.com/markedjs/marked) — Markdown parser and compiler
- [markdown-live-preview GitHub](https://github.com/ComotionLabs/markdown-live-preview) — Live preview server reference

### Terminal Hyperlinks
- [OSC 8 Adoption List](https://github.com/Alhadis/OSC8-Adoption) — Terminal emulator support tracking
- [OSC 8 Specification](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda) — Hyperlinks in terminal emulators
- [iTerm2 Hyperlinks](https://iterm2.com/feature-reporting/Hyperlinks_in_Terminal_Emulators.html) — iTerm2 OSC 8 implementation
- [VSCode OSC 8 Issue](https://github.com/microsoft/vscode/issues/127229) — Pending OSC 8 support in VSCode Terminal
