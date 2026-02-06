# Release v0.9.0

## New Features

### Preview Artifacts
A new feature allowing specification artifacts (markdown, design docs, etc.) to be previewed in a browser with live rendering.

- **ContentCache service** - Caches artifact content for efficient preview rendering
- **PreviewHTMLGenerator** - Transforms markdown to styled HTML with Mermaid diagram support
- **PreviewHTTPServer** - Ephemeral HTTP server lifecycle management for local previews
- **PreviewService** - Orchestration layer coordinating all preview components
- **ArtifactsSidebar keyboard navigation** - Navigate artifacts using keyboard shortcuts
- **StartScreen integration** - Preview functionality accessible from the main interface

### Task Tracking Improvements
- Detailed tracking of task start, end, and status timestamps
- More granular resume capability (task-by-task level)

## Bug Fixes

- Fixed menu focus mode behavior
- Fixed Mermaid diagram rendering issues
- Fixed light/dark mode theme switching
- Removed unnecessary optional package dependency

## Internal

- Initialized red64 framework configuration
- Added unit tests for PreviewHTMLGenerator
- Added unit tests for ContentCache
- Added comprehensive error handling and edge case coverage
