# Implementation Plan

## Overview
This plan implements artifact preview functionality for the red64-cli terminal application. Users will be able to select artifacts from the ArtifactsSidebar using keyboard navigation and preview them in a browser window with formatted markdown rendering and visual Mermaid diagrams. The implementation follows a browser-first approach (Phase 1 MVP) with keyboard navigation as the primary interaction model.

---

## Tasks

- [ ] 1. Install required dependencies
  - Install `marked` v14.1.3+ for markdown parsing
  - Install `github-markdown-css` v5.7.0+ for GitHub-style CSS
  - Install `open` v11.0.0+ for cross-platform browser launching
  - Add all dependencies to package.json with correct versions
  - _Requirements: 8.2_

- [ ] 2. (P) Create ContentCache service for artifact caching
  - Implement in-memory cache using JavaScript Map with 5-minute TTL
  - Create ContentCacheInterface with get, set, clear, and prune methods
  - Store entries as objects with content (string) and timestamp (number)
  - Implement automatic pruning on get() to remove stale entries (> 300,000ms old)
  - Return null for cache miss or stale entries
  - _Requirements: 8.3_

- [ ] 3. (P) Create PreviewHTMLGenerator service for markdown transformation
  - Implement generateHTML method accepting markdown content and artifact title
  - Use marked library to parse markdown to HTML with default options
  - Generate complete HTML5 document with DOCTYPE, head, and body structure
  - Inject github-markdown-css stylesheet via CDN link in head
  - Include mermaid.js v11+ via CDN with ESM import and startOnLoad initialization
  - Add responsive container styles (max-width 980px on desktop, padding 45px, mobile padding 15px)
  - Set HTML title tag to artifact name parameter
  - Wrap rendered markdown in `<article class="markdown-body">` semantic element
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 4.6_

- [ ] 4. (P) Create PreviewHTTPServer service for ephemeral server lifecycle
  - Implement start method with HTML content and optional preferred port parameters
  - Use Node.js http module to create server serving HTML on GET / request
  - Implement random port selection in range 3000-3999 with availability check
  - Retry with different port on conflict (max 3 attempts)
  - Return ServerStartResult discriminated union (success with url/port or failure with error)
  - Implement shutdown method accepting server URL to close specific server instance
  - Implement shutdownAll method to close all tracked active servers
  - Track active servers in Map keyed by URL
  - Add auto-shutdown after 60 seconds of inactivity using setTimeout
  - Set Content-Type: text/html header for all responses
  - _Requirements: 7.4_

- [ ] 5. Create PreviewService orchestration layer
  - Implement previewArtifact method accepting Artifact interface parameter
  - Validate artifact.path is absolute and within worktree bounds using path.resolve
  - Check ContentCache for artifact content with cache hit optimization
  - Read artifact file using Node.js fs/promises readFile on cache miss
  - Store content in ContentCache after successful file read
  - Delegate HTML generation to PreviewHTMLGenerator with content and artifact.name
  - Start PreviewHTTPServer with generated HTML and retrieve server URL
  - Launch browser using open library with server URL
  - Catch and handle errors for each step with appropriate error codes (FILE_NOT_FOUND, FILE_READ_ERROR, PORT_UNAVAILABLE, BROWSER_LAUNCH_ERROR)
  - Return PreviewResult discriminated union (success with url or failure with PreviewError)
  - Implement shutdownAll method delegating to PreviewHTTPServer.shutdownAll
  - _Requirements: 1.4, 1.5, 5.2, 5.3_

- [ ] 6. Enhance ArtifactsSidebar with keyboard navigation
  - Add local state for selectedIndex using useState (default 0)
  - Implement useInput hook from Ink for Arrow Up, Arrow Down, and Enter key handling
  - Update selectedIndex on Arrow Up (decrement with wrap to last item)
  - Update selectedIndex on Arrow Down (increment with wrap to first item)
  - Clamp selectedIndex to valid range [0, artifacts.length-1] on artifacts prop change
  - Add visual highlighting for selected artifact (different color or indicator)
  - Trigger onPreview callback with selected artifact when Enter key pressed
  - Maintain existing artifact display logic (icons, names, timestamps)
  - _Requirements: 1.1, 1.2, 1.6_

- [ ] 7. Integrate PreviewService into StartScreen component
  - Instantiate PreviewService singleton (pass ContentCache, PreviewHTMLGenerator, PreviewHTTPServer instances)
  - Pass onPreview callback prop to ArtifactsSidebar component
  - Implement onPreview handler calling PreviewService.previewArtifact with artifact parameter
  - Handle PreviewResult success case (no action needed, browser opens automatically)
  - Handle PreviewResult failure cases displaying error message in terminal UI
  - Display FILE_NOT_FOUND as "Artifact not found: {path}"
  - Display FILE_READ_ERROR as "Cannot read artifact: {path}. Check permissions."
  - Display PORT_UNAVAILABLE as "Cannot start preview server. All ports busy."
  - Display BROWSER_LAUNCH_ERROR as "Cannot open browser. Preview available at: {url}"
  - Clean up PreviewService on StartScreen unmount calling shutdownAll
  - _Requirements: 1.1, 1.5, 5.2, 5.3_

- [ ] 8. Add error handling and edge case coverage
  - Validate artifact.path exists before file read attempt
  - Handle permission errors for file access with clear user message
  - Handle port exhaustion after 3 retries with actionable error message
  - Handle browser not available (sandbox mode) with manual URL fallback
  - Log all errors to stderr with context (artifact path, error code, timestamp)
  - Test error recovery for file deletion between preview attempts
  - Verify graceful degradation when CDN resources unavailable
  - _Requirements: 1.5, 5.2, 5.3_

- [ ] 9. (P) Write unit tests for ContentCache
  - Test cache hit returns stored content
  - Test cache miss returns null
  - Test stale entry (> 5 minutes) returns null after pruning
  - Test set stores content with current timestamp
  - Test clear removes all entries
  - Test prune removes only stale entries
  - _Requirements: 8.3_

- [ ] 10. (P) Write unit tests for PreviewHTMLGenerator
  - Test generateHTML returns valid HTML5 document structure
  - Test markdown headings (h1-h6) render correctly
  - Test markdown lists (ordered and unordered) render with proper nesting
  - Test code blocks preserve syntax and structure
  - Test inline code renders with monospace styling
  - Test markdown links render as clickable anchors
  - Test bold and italic emphasis render correctly
  - Test Mermaid code blocks are preserved in output (not pre-rendered)
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
  - Test keyboard navigation moves selection with Arrow Up/Down
  - Test selection wraps at list boundaries (first to last, last to first)
  - Test Enter key triggers onPreview callback with selected artifact
  - Test visual highlighting updates for selected artifact
  - Test selection state persists when artifacts array unchanged
  - Test selection resets when artifacts array changes
  - _Requirements: 1.1, 1.2, 1.6_

- [ ] 14. (P) Write integration tests for full preview flow
  - Test end-to-end flow: select artifact → read file → generate HTML → start server → open browser
  - Test cache integration: preview same artifact twice, verify second read from cache
  - Test port conflict handling: start server, start second preview, verify different port used
  - Test error propagation: delete artifact file between reads, verify FILE_NOT_FOUND error displays
  - Verify HTML served by HTTP server contains markdown content
  - Verify Mermaid code blocks render as diagrams in browser (visual check or headless browser test)
  - _Requirements: 1.1, 1.4, 2.1, 3.1, 5.2, 7.4, 8.3_

- [ ]* 15. Write baseline rendering and accessibility tests
  - Test ArtifactsSidebar renders artifact list without errors
  - Test preview window HTML output validates as HTML5
  - Test keyboard navigation meets ARIA best practices (focus management)
  - Test error messages have appropriate ARIA roles
  - Test github-markdown-css maintains WCAG AA contrast ratio (4.5:1 minimum)
  - _Requirements: 1.3, 6.5, 6.7, 6.8_

---

## Notes
- Sequential mode disabled: Tasks marked with `(P)` can execute in parallel
- Task 2-4 (services) are independent and can run concurrently
- Task 9-11 (unit tests) are independent and can run concurrently
- Task 15 is optional and marked with `*` (can be deferred post-MVP for coverage)
- All requirements from requirements.md are covered across tasks
- Design architecture from design.md is preserved (Service-Oriented pattern)
- Browser preview is Phase 1 MVP; terminal preview deferred to Phase 2
