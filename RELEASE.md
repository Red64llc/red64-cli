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
# Release v0.12.0

## New Features
- Display max context window reached notifications
- Display statistics (tokens, context, cost) in UI
- Track and aggregate cost, token usage, and context metrics across tasks
- Multi-stack toolchain support for improved development workflows
- Test enforcement: Skip failing tests detection and enforce green tests requirement

## Bug Fixes
- CLI now properly exits when crash is detected
- Improved handling when resuming after Docker crash
- Fixed task metrics aggregation

## Internal
- Initialize Red64 framework for spec-driven development
- Optimize token usage by moving tasks to orchestrator
- Add steering documents for testing workflows
# Release v0.13.0

## New Features
- Multi-architecture support for broader platform compatibility
- Configurable task implementation granularity, allowing developers to choose the level of detail when implementing specification tasks

## Bug Fixes
- Minor fixes for resume functionality and token handling

## Internal
- Documentation updates to README
# Release v0.14.0

## New Features
- Added pre-flight check in docker mode to validate environment before execution

## Bug Fixes
- Fixed docker service mocking functionality
# Release v0.15.0

## New Features
- Support for latest Claude Code 2.1.45 requirements
