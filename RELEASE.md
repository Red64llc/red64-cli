# Release v0.9.1

## New Features
- **Preview Artifacts**: Complete implementation of artifact preview functionality with markdown transformation, ephemeral HTTP server, content caching, and keyboard navigation in the artifacts sidebar
- **LLM-powered Release Notes**: Automated release message generation using AI
- **Detailed Task Tracking**: Enhanced tracking of task start time, end time, and status throughout the development workflow
- **Granular Resume**: Task-by-task resume capability for more precise workflow control

## Bug Fixes
- Fixed menu focus mode issues and improved light/dark mode switching
- Fixed Mermaid diagram rendering
- Removed unnecessary optional package dependency

## Internal
- Red64 framework initialization and configuration
- Multiple specification workflows with gap analysis, design validation, and requirements generation
- Comprehensive test coverage for PreviewHTMLGenerator and ContentCache services
- Release documentation and scripting improvements
# Release v0.10.0

## New Features
- Add support for Terraform in the release workflow

## Bug Fixes
- Fix release notes prepending to ensure correct ordering
- Improve error handling in release script

## Internal
- Update README.md documentation
# Release v0.11.0

## New Features
- Add support for running local models with Ollama
- Add adjustable sidebar width for improved customization
- Add token usage tracking for better visibility into API consumption

## Internal
- Cleanup sidebar UI implementation
- Improve test failure UX with better error messaging
- Enhance resume capabilities with more robust state management
