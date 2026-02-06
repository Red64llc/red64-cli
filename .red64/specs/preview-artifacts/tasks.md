# Implementation Plan

## Overview
This plan implements artifact preview functionality for the red64-cli terminal application. Users will be able to select artifacts from the ArtifactsSidebar using keyboard navigation and preview them in a browser window with formatted markdown rendering and visual Mermaid diagrams. The implementation follows a browser-first approach (Phase 1 MVP) with keyboard navigation as the primary interaction model.

---

## Tasks

- [x] 1. (P) Install required dependencies
  - Install `marked` v14.1.3+ for markdown parsing
  - Install `github-markdown-css` v5.7.0+ for GitHub-style CSS
  - Install `open` v11.0.0+ for cross-platform browser launching
  - Add all dependencies to package.json with correct versions
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 4.1_

- [x] 2. (P) Create ContentCache service for artifact caching
  - Implement in-memory cache using JavaScript Map with 5-minute TTL
  - Create ContentCacheInterface with get, set, clear, and prune methods
  - Store entries as objects with content (string) and timestamp (number)
  - Implement automatic pruning on get() to remove stale entries older than 300,000ms
  - Return null for cache miss or stale entries
  - _Requirements: 8.3_

- [x] 3. (P) Create PreviewHTMLGenerator service for markdown transformation
  - Implement generateHTML method accepting markdown content and artifact title
  - Use marked library to parse markdown to HTML with default options
  - Generate complete HTML5 document with DOCTYPE, head, and body structure
  - Inject github-markdown-css stylesheet via CDN link in head
  - Include mermaid.js v11+ via CDN with ESM import and startOnLoad initialization
  - Add responsive container styles with max-width 980px on desktop, padding 45px, and mobile padding 15px
  - Set HTML title tag to artifact name parameter
  - Wrap rendered markdown in `<article class="markdown-body">` semantic element
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.4, 3.5, 4.6, 6.1, 6.2, 6.3_

- [x] 4. (P) Create PreviewHTTPServer service for ephemeral server lifecycle
  - Implement start method with HTML content and optional preferred port parameters
  - Use Node.js http module to create server serving HTML on GET / request
  - Implement random port selection in range 3000-3999 with availability check
  - Retry with different port on conflict with maximum 3 attempts
  - Return ServerStartResult discriminated union (success with url/port or failure with error)
  - Implement shutdown method accepting server URL to close specific server instance
  - Implement shutdownAll method to close all tracked active servers
  - Track active servers in Map keyed by URL
  - Add auto-shutdown after 60 seconds of inactivity using setTimeout
  - Set Content-Type: text/html header for all responses
  - Bind server to localhost only (127.0.0.1) to prevent external network access
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 5. Create PreviewService orchestration layer
  - Implement previewArtifact method accepting Artifact interface parameter
  - Validate artifact.path is absolute and within worktree bounds using path.resolve
  - Check ContentCache for artifact content with cache hit optimization
  - Read artifact file using Node.js fs/promises readFile on cache miss
  - Store content in ContentCache after successful file read
  - Delegate HTML generation to PreviewHTMLGenerator with content and artifact.name
  - Start PreviewHTTPServer with generated HTML and retrieve server URL
  - Launch browser using open library with server URL
  - Catch and handle errors for each step with appropriate error codes
  - Return PreviewResult discriminated union (success with url or failure with PreviewError)
  - Implement shutdownAll method delegating to PreviewHTTPServer.shutdownAll
  - _Requirements: 1.4, 1.5, 5.1, 5.2, 5.3, 8.1, 8.3_

- [x] 6. Enhance ArtifactsSidebar with keyboard navigation
  - Add local state for selectedIndex using useState with default value 0
  - Implement useInput hook from Ink for Arrow Up, Arrow Down, Enter, and Space key handling
  - Update selectedIndex on Arrow Up by decrementing with wrap to last item
  - Update selectedIndex on Arrow Down by incrementing with wrap to first item
  - Clamp selectedIndex to valid range [0, artifacts.length-1] on artifacts prop change
  - Add visual highlighting for selected artifact using different color or indicator
  - Trigger onPreview callback with selected artifact when Enter or Space key pressed
  - Maintain existing artifact display logic including icons, names, and timestamps
  - _Requirements: 1.1, 1.2, 1.6_

- [x] 7. Integrate PreviewService into StartScreen component
  - Instantiate PreviewService singleton with ContentCache, PreviewHTMLGenerator, and PreviewHTTPServer instances
  - Pass onPreview callback prop to ArtifactsSidebar component
  - Implement onPreview handler calling PreviewService.previewArtifact with artifact parameter
  - Handle PreviewResult success case (no action needed as browser opens automatically)
  - Handle PreviewResult failure cases by displaying error messages in terminal UI
  - Display FILE_NOT_FOUND error as "Artifact not found: {path}"
  - Display FILE_READ_ERROR as "Cannot read artifact: {path}. Check permissions."
  - Display PORT_UNAVAILABLE as "Cannot start preview server. All ports busy."
  - Display BROWSER_LAUNCH_ERROR as "Cannot open browser. Preview available at: {url}"
  - Clean up PreviewService on StartScreen unmount by calling shutdownAll
  - _Requirements: 1.1, 1.5, 5.2, 5.3_

- [x] 8. Add error handling and edge case coverage
  - Validate artifact.path exists before file read attempt
  - Handle permission errors for file access with clear user message
  - Handle port exhaustion after 3 retries with actionable error message
  - Handle browser not available (sandbox mode) with manual URL fallback
  - Log all errors to stderr with context including artifact path, error code, and timestamp
  - Test error recovery for file deletion between preview attempts
  - Verify graceful degradation when CDN resources unavailable
  - _Requirements: 1.5, 5.2, 5.3_

- [x] 9. (P) Write unit tests for ContentCache
  - Test cache hit returns stored content
  - Test cache miss returns null
  - Test stale entry older than 5 minutes returns null after pruning
  - Test set stores content with current timestamp
  - Test clear removes all entries
  - Test prune removes only stale entries
  - _Requirements: 8.3_

- [x] 10. (P) Write unit tests for PreviewHTMLGenerator
  - Test generateHTML returns valid HTML5 document structure
  - Test markdown headings h1-h6 render correctly with appropriate hierarchy
  - Test markdown lists (ordered and unordered) render with proper nesting
  - Test code blocks preserve syntax and structure
  - Test inline code renders with monospace styling
  - Test markdown links render as clickable anchors
  - Test bold and italic emphasis render correctly
  - Test Mermaid code blocks are preserved in output without pre-rendering
  - Test HTML title tag contains artifact name parameter
  - Test github-markdown-css stylesheet link is present
  - Test mermaid.js script tag is present with correct CDN URL
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 4.6_

- [ ] 11. (P) Write unit tests for PreviewHTTPServer
  - Test start method binds to available port and returns success result
  - Test start method retries with different port on conflict
  - Test start method returns error after 3 failed port attempts
  - Test server responds with HTML content and Content-Type: text/html header
  - Test shutdown method closes specific server by URL
  - Test shutdownAll closes all tracked servers
  - Test auto-shutdown after 60 seconds timeout
  - _Requirements: 7.4_

- [ ] 12. Write unit tests for PreviewService
  - Mock ContentCache, PreviewHTMLGenerator, PreviewHTTPServer, and open library
  - Test successful preview flow returns success result with URL
  - Test cache hit scenario skips file read
  - Test cache miss scenario reads file and stores in cache
  - Test FILE_NOT_FOUND error when artifact path invalid
  - Test FILE_READ_ERROR when file permissions denied
  - Test PORT_UNAVAILABLE error when all ports busy
  - Test BROWSER_LAUNCH_ERROR when open library fails
  - Test shutdownAll delegates to PreviewHTTPServer.shutdownAll
  - _Requirements: 1.4, 1.5, 5.2, 5.3, 8.3_

- [ ] 13. Write integration tests for ArtifactsSidebar
  - Test keyboard navigation moves selection with Arrow Up and Arrow Down
  - Test selection wraps at list boundaries (first to last and last to first)
  - Test Enter key triggers onPreview callback with selected artifact
  - Test Space key triggers onPreview callback with selected artifact
  - Test visual highlighting updates for selected artifact
  - Test selection state persists when artifacts array unchanged
  - Test selection resets when artifacts array changes
  - _Requirements: 1.1, 1.2, 1.6_

- [ ] 14. (P) Write integration tests for full preview flow
  - Test end-to-end flow: select artifact, read file, generate HTML, start server, open browser
  - Test cache integration: preview same artifact twice and verify second read from cache
  - Test port conflict handling: start server, start second preview, verify different port used
  - Test error propagation: delete artifact file between reads and verify FILE_NOT_FOUND error displays
  - Verify HTML served by HTTP server contains markdown content
  - Verify Mermaid code blocks render as diagrams in browser using visual check or headless browser test
  - _Requirements: 1.1, 1.4, 2.1, 3.1, 5.2, 7.4, 8.3_

- [ ]* 15. Write baseline rendering and accessibility tests
  - Test ArtifactsSidebar renders artifact list without errors
  - Test preview window HTML output validates as HTML5
  - Test keyboard navigation meets ARIA best practices for focus management
  - Test error messages have appropriate ARIA roles
  - Test github-markdown-css maintains WCAG AA contrast ratio with 4.5:1 minimum
  - _Requirements: 1.3, 6.5, 6.7, 6.8_

---

## Notes
- Sequential mode disabled: Tasks marked with `(P)` can execute in parallel
- Tasks 1-4 (dependencies and independent services) can run concurrently
- Tasks 9-11 and 14 (unit tests for isolated services) can run concurrently
- Task 5 depends on tasks 2-4 completion (orchestrates all services)
- Task 6 is independent and can run in parallel with service development
- Task 7 depends on tasks 5-6 completion (integrates services with UI)
- Task 8 depends on task 7 completion (validates full integration)
- Task 12 depends on task 5 completion (tests PreviewService)
- Task 13 depends on task 6 completion (tests ArtifactsSidebar)
- Task 15 is optional and marked with `*` (can be deferred post-MVP for baseline coverage)
- All requirements from requirements.md are covered across tasks
- Design architecture from design.md is preserved with Service-Oriented pattern
- Browser preview is Phase 1 MVP; in-terminal preview deferred to Phase 2
