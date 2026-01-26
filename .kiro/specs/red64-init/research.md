# Research & Design Decisions

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

**Usage**:
- Log research activities and outcomes during the discovery phase.
- Document design decision trade-offs that are too detailed for `design.md`.
- Provide references and evidence for future audits or reuse.
---

## Summary
- **Feature**: `red64-init`
- **Discovery Scope**: New Feature (Greenfield)
- **Key Findings**:
  - GitHub REST API provides tarball download endpoint that avoids rate limits and simplifies download
  - Cross-platform cache directories require platform-specific handling (XDG on Linux, ~/Library/Caches on macOS, %LOCALAPPDATA% on Windows)
  - Ink framework with @inkjs/ui provides all necessary interactive components (Select, TextInput, Spinner) for guided setup

## Research Log

### GitHub API for Repository Download

- **Context**: Requirement 6.1-6.8 specifies fetching framework files from GitHub without requiring git clone.
- **Sources Consulted**:
  - [GitHub REST API - Repository Contents](https://docs.github.com/en/rest/repos/contents)
  - [GitHub REST API - Tree API](https://itsallbinary.com/github-rest-api-tree-api-to-get-remote-repo-files-list-metadata-recursively-programmatically-without-cloning-in-local/)
  - [Downloading Tarball from GitHub](https://www.baeldung.com/linux/github-download-tarball)
- **Findings**:
  - **Tarball approach preferred**: `GET /repos/:owner/:repo/tarball/:ref` returns a 302 redirect to the tarball URL. This is more efficient than fetching files individually.
  - **Tree API limitations**: The recursive tree endpoint has a limit of 100,000 entries and 7MB maximum size. The tarball approach avoids these limits.
  - **No git required**: Tarball download works with pure HTTP, no git binary needed.
  - **Authentication**: For public repos, no auth needed. Private repos require Bearer token in Authorization header.
  - **Redirect handling**: GitHub API returns 302 redirect; HTTP client must follow redirects.
- **Implications**:
  - Use native `fetch()` with redirect following to download tarball
  - Use Node.js `tar` extraction (zlib + tar modules or `tar` npm package)
  - Store version/tag info in config for cache invalidation

### Cross-Platform Cache Directory

- **Context**: Requirement 6.5-6.6 specifies caching fetched files in a user-level cache directory.
- **Sources Consulted**:
  - [xdg-basedir npm package](https://github.com/sindresorhus/xdg-basedir)
  - [@folder/xdg npm package](https://www.npmjs.com/package/@folder/xdg)
  - [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/latest/)
- **Findings**:
  - **Platform-specific locations**:
    - Linux: `$XDG_CACHE_HOME` or `$HOME/.cache`
    - macOS: `$HOME/Library/Caches`
    - Windows: `%LOCALAPPDATA%`
  - **Recommended approach**: Use `os.homedir()` with platform detection for simplicity, or use `env-paths` npm package for full cross-platform support.
  - **Fallback**: If home directory cannot be determined, fall back to OS temp directory.
  - **Cache structure**: `<cache_root>/red64/<version>/<stack>/` allows versioned, stack-specific caching.
- **Implications**:
  - Implement platform-aware cache path resolution
  - Create cache directories with `{ recursive: true }` option
  - Store cache metadata (version, timestamp) for validation

### Node.js File System Best Practices

- **Context**: Need to create directory structures and write files reliably.
- **Sources Consulted**:
  - [Node.js fs/promises documentation](https://nodejs.org/api/fs.html)
  - [Working with folders in Node.js](https://nodejs.org/en/learn/manipulating-files/working-with-folders-in-nodejs)
- **Findings**:
  - Use `fs/promises` API with `async/await` for non-blocking operations
  - `mkdir(path, { recursive: true })` creates parent directories automatically
  - No need to check directory existence before creation with recursive option
  - Use `writeFile()` after ensuring directory exists via `mkdir(dirname(path), { recursive: true })`
  - Set appropriate permissions (e.g., `mode: 0o755` for directories, `mode: 0o644` for files)
- **Implications**:
  - Create a file utility module with `ensureDir()` and `writeFileWithDir()` helpers
  - Use async operations throughout to maintain CLI responsiveness

### Ink Interactive Components

- **Context**: Requirements 4.1-4.8 specify interactive guided setup with prompts and selections.
- **Sources Consulted**:
  - [Ink GitHub Repository](https://github.com/vadimdemedes/ink)
  - [Ink UI Components](https://github.com/vadimdemedes/ink-ui)
  - [LogRocket Ink Tutorial](https://blog.logrocket.com/using-ink-ui-react-build-interactive-custom-clis/)
- **Findings**:
  - **@inkjs/ui already in use**: Project already has `@inkjs/ui` v2.0.0 installed
  - **Available components**: Select, TextInput, Spinner, ProgressBar, Confirm
  - **State management**: Use React useState for form state, step management
  - **Multi-step pattern**: Use discriminated union for step type, render conditionally
  - **Focus management**: TextInput accepts focus prop for multi-input forms
- **Implications**:
  - Leverage existing @inkjs/ui components (already imported in codebase)
  - Create step-based wizard component with clear state transitions
  - Use SelectMenu pattern already established in codebase

### Existing Codebase Analysis

- **Context**: Understand patterns and integration points for the init command.
- **Sources Consulted**: Codebase analysis via Grep and Read
- **Findings**:
  - **InitScreen.tsx exists as placeholder**: Located at `src/components/screens/InitScreen.tsx`, currently shows static text
  - **CommandRouter integration**: Already routes 'init' command to InitScreen
  - **ScreenProps interface**: Provides `args` and `flags` to screens
  - **UI components available**: Spinner, ProgressBar, SelectMenu, StatusLine, Header
  - **Path utilities exist**: `src/utils/paths.ts` provides `.red64/` directory path helpers
  - **Service pattern**: Services in `src/services/` handle business logic (FlowStateMachine, StateStore, etc.)
- **Implications**:
  - Extend InitScreen with full implementation
  - Create new services: GitHubFetcher, CacheManager, TemplateProcessor
  - Extend paths.ts with cache-related path utilities
  - Follow established patterns for components and services

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Multi-Step Wizard | Sequential screens with state machine | Clear UX, resumable, matches Ink patterns | More components to build | Aligns with existing flow pattern |
| Single Screen with Phases | One component with internal phase state | Simpler routing | Complex component, harder to test | Could grow unwieldy |
| Service-Driven Flow | Services emit events, UI reacts | Clean separation | Over-engineering for this scope | Consider for larger features |

**Selected**: Multi-Step Wizard with service layer for GitHub/cache operations. Matches existing codebase patterns and provides testable, maintainable structure.

## Design Decisions

### Decision: Tarball Download over Contents API

- **Context**: Need to download framework files from GitHub efficiently
- **Alternatives Considered**:
  1. Contents API - Fetch each file individually via `/repos/:owner/:repo/contents/:path`
  2. Tree API - Get tree recursively, then fetch each blob
  3. Tarball API - Download entire archive as tarball, extract locally
- **Selected Approach**: Tarball API with local extraction
- **Rationale**:
  - Single HTTP request for all files
  - No rate limit concerns (one request vs hundreds)
  - Efficient bandwidth usage (compressed)
  - Simple implementation with tar extraction
- **Trade-offs**:
  - Downloads everything including unneeded files
  - Requires extraction step
  - Slightly more complex error handling for corrupt archives
- **Follow-up**: Verify tar extraction works correctly with nested directories

### Decision: Platform-Specific Cache Paths

- **Context**: Need to cache downloaded files for offline re-init
- **Alternatives Considered**:
  1. Use fixed ~/.red64-cache directory
  2. Use XDG-compliant paths via npm package
  3. Use Node.js built-in path detection with platform switch
- **Selected Approach**: Platform-specific paths using Node.js os module
- **Rationale**:
  - No additional dependencies needed
  - Respects platform conventions
  - Simple implementation with platform switch
- **Trade-offs**:
  - Must handle edge cases (no home directory)
  - Platform detection code to maintain
- **Follow-up**: Test on Windows, Linux, macOS

### Decision: Init Screen Step Machine

- **Context**: Init has multiple distinct phases requiring user interaction
- **Alternatives Considered**:
  1. Single component with useState for phase
  2. Multiple screen components with parent orchestrator
  3. State machine with explicit transitions
- **Selected Approach**: Step discriminated union with useState in InitScreen
- **Rationale**:
  - Matches existing codebase patterns
  - Simple enough for this feature's complexity
  - Easy to add new steps
- **Trade-offs**:
  - InitScreen becomes larger (can be mitigated with sub-components)
  - Less formal than full state machine
- **Follow-up**: Extract step sub-components if InitScreen grows too large

### Decision: String Replacement for Kiro-to-Red64

- **Context**: Requirement 1.3 specifies renaming "kiro" references to "red64" in fetched files
- **Alternatives Considered**:
  1. Simple string replace on file contents
  2. AST-based transformation for code files
  3. Template variable substitution with markers
- **Selected Approach**: Simple string replacement with case-aware patterns
- **Rationale**:
  - Framework files are config/markdown, not complex code
  - Simple and predictable behavior
  - Easy to test and debug
- **Trade-offs**:
  - Could have false positives in unintended contexts
  - Case sensitivity must be handled (kiro, Kiro, KIRO)
- **Follow-up**: Define exact replacement patterns (kiro->red64, Kiro->Red64, KIRO->RED64, .kiro->.red64)

## Risks & Mitigations

- **Network failures during download**: Implement retry logic with exponential backoff; provide clear error messages with troubleshooting steps; fall back to cache if available.
- **Corrupted tarball**: Validate tarball integrity before extraction; catch extraction errors and prompt re-download.
- **Disk space constraints**: Check available space before extraction; clean old cache entries.
- **Rate limiting**: Tarball approach minimizes requests; cache aggressively; provide --no-cache bypass when needed.
- **Permission errors**: Check write permissions before operations; provide actionable error messages.

## References

- [GitHub REST API - Repository Contents](https://docs.github.com/en/rest/repos/contents) - Official documentation for contents API
- [GitHub REST API - Tarball Download](https://www.baeldung.com/linux/github-download-tarball) - Tarball download approach
- [Node.js File System](https://nodejs.org/api/fs.html) - fs/promises API reference
- [Ink GitHub Repository](https://github.com/vadimdemedes/ink) - Ink framework documentation
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/latest/) - Standard for user directories
