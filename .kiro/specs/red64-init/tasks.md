# Implementation Plan

## Tasks

- [x] 1. Implement CacheService for offline download caching
- [x] 1.1 (P) Create platform-specific cache directory resolution
  - Detect platform (macOS, Linux, Windows) and return appropriate cache root path
  - macOS: `~/Library/Caches/red64`, Linux: `$XDG_CACHE_HOME/red64` or `~/.cache/red64`, Windows: `%LOCALAPPDATA%/red64`
  - Handle edge cases when home directory cannot be determined (fallback to OS temp directory)
  - Provide `getCacheDir()` method returning the resolved path
  - _Requirements: 6.5_

- [x] 1.2 (P) Implement cache entry management
  - Store cache metadata in `cache.json` within the cache directory
  - Implement `has(repo, version)` to check if valid cache entry exists
  - Implement `get(repo, version)` to retrieve cached tarball path with validation
  - Implement `set(repo, version, tarballPath)` to store tarball and update metadata
  - Verify file existence and size match before returning cached entries
  - _Requirements: 6.5, 6.6_

- [x] 1.3 Implement cache maintenance operations
  - Implement `prune(maxAgeMs)` to remove entries older than specified age
  - Implement `clear()` to remove all cache entries
  - Handle file system errors gracefully during cleanup
  - _Requirements: 6.5_

- [x] 2. Implement GitHubService for tarball fetching
- [x] 2.1 Build tarball download capability
  - Construct GitHub API URL for tarball endpoint (`/repos/:owner/:repo/tarball/:ref`)
  - Use native `fetch()` with redirect following to download tarball
  - Support custom repository via `--repo` option and version/tag via `--version` option
  - Stream download with progress reporting via `onProgress` callback
  - Validate repository format (owner/repo) before making requests
  - Handle HTTP status codes and network errors appropriately
  - Depends on CacheService for storing downloaded tarballs
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 2.2 Implement cache-aware fetch with fallback
  - Check CacheService for existing valid entry before downloading
  - Store fresh downloads in cache after successful fetch
  - Support `--no-cache` flag to force fresh download bypassing cache
  - When GitHub fetch fails, offer to use cached version if available
  - Return result indicating whether tarball came from cache
  - _Requirements: 6.5, 6.6, 6.7, 6.8_

- [x] 2.3 (P) Add stack listing capability
  - Implement `listAvailableStacks()` to retrieve available stacks from repository
  - Parse repository structure to find stack template directories
  - Return list of available stack names for guided setup
  - Handle errors when repository structure is invalid
  - _Requirements: 3.1, 3.5_

- [x] 3. Implement TemplateService for file extraction and transformation
- [x] 3.1 (P) Build tarball extraction with kiro-to-red64 renaming
  - Use `tar` npm package for stream-based extraction
  - Rename `.kiro` directory references to `.red64` in file paths
  - Perform case-aware string replacement in file contents (kiro->red64, Kiro->Red64, KIRO->RED64)
  - Report progress during extraction via callback
  - Verify extracted structure matches expected layout
  - _Requirements: 1.3_

- [x] 3.2 (P) Create unified directory structure
  - Create `.red64/steering/` directory for project steering documents
  - Create `.red64/specs/` directory for feature specifications
  - Create `.red64/commands/` directory for Claude slash commands
  - Create `.red64/agents/` directory for agent definitions
  - Create `.red64/templates/` directory for spec and steering templates
  - Create `.red64/settings/` directory for framework configuration and rules
  - Use `mkdir(path, { recursive: true })` for reliable creation
  - Return list of created directories
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3.3 Implement stack template application
  - Locate stack-specific template directory in extracted source (e.g., `stacks/react/`)
  - Copy `product.md`, `tech.md`, `structure.md` templates to `.red64/steering/`
  - Include any additional stack-specific custom steering documents
  - Perform variable substitution for template placeholders (project name, description)
  - Fall back to generic default template set when no matching stack exists
  - Return list of applied steering files
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 4.5, 4.6_

- [x] 4. Implement ConfigService for init configuration
- [x] 4.1 (P) Build configuration read/write operations
  - Implement `load(baseDir)` to read `.red64/config.json` and return parsed config or null
  - Implement `save(baseDir, config)` to write config with atomic file operations
  - Implement `isInitialized(baseDir)` to check if project already has red64 setup
  - Ensure JSON serialization maintains proper formatting
  - Store repo source, version, stack, project type, name, description, and custom values
  - _Requirements: 2.7_

- [x] 5. Implement InitScreen wizard step components
- [x] 5.1 Build WelcomeStep component
  - Display welcome message introducing the init process
  - Check for existing `.red64/` directory in project
  - When directory exists, prompt user to choose: overwrite, merge, or abort
  - Call `onNext()` to proceed or `onError()` to abort based on user choice
  - _Requirements: 1.6_

- [x] 5.2 Build FetchStep component
  - Display spinner during download with progress indication
  - Show download phase (connecting, downloading, caching) and bytes received
  - Call GitHubService to fetch framework tarball
  - Report errors with actionable suggestions (retry, use cache, check network)
  - Transition to next step on successful completion
  - _Requirements: 1.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 5.3 Build SetupStep component for guided configuration
  - Ask about project type (web app, CLI tool, library, API, other)
  - Display available stack options retrieved from repository
  - Ask about primary technology stack with selection interface
  - Gather project name and description via text inputs
  - Support additional questions for customizing template placeholders
  - Allow skipping with `--skip-guided` flag using generic defaults
  - Support `--stack` flag to bypass stack selection prompt
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8, 4.9_

- [x] 5.4 Build SteeringStep component
  - Display summary of fetched stack templates applied to steering directory
  - Offer option to run `/red64:steering` for AI enhancement of steering docs
  - Offer option to run `/red64:steering-custom` for generating additional custom docs
  - Allow user to run steering commands multiple times until satisfied
  - Display updated summary after each enhancement
  - Allow user to confirm steering is complete and proceed
  - Support `--no-steering` flag to skip enhancement phase entirely
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 5.5 Build CompleteStep component
  - Display summary of created directories and files
  - Show applied stack template information
  - Display path to config.json
  - List steering files in the project
  - Show suggested next steps for the user
  - _Requirements: 5.6_

- [x] 6. Implement InitScreen orchestration
- [x] 6.1 Build InitScreen state management
  - Define step discriminated union type for wizard states
  - Manage transitions between welcome, checking-existing, conflict-prompt, fetching, extracting, guided-setup, applying-templates, steering-prompt, complete, and error states
  - Track fetch progress, setup data, and initialization summary
  - Handle flags (--repo, --version, --stack, --skip-guided, --no-steering, --no-cache)
  - _Requirements: 1.1, 1.4, 1.5, 4.8, 4.9, 5.7, 6.7_

- [x] 6.2 Implement InitScreen service coordination
  - Call CacheService to check for cached version before fetch
  - Call GitHubService to download framework tarball when needed
  - Call TemplateService to extract files and apply stack templates
  - Call ConfigService to persist init configuration
  - Coordinate step transitions based on service results
  - Handle errors from each service and display appropriate recovery options
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 6.3 Render step components based on current state
  - Conditionally render WelcomeStep, FetchStep, SetupStep, SteeringStep, or CompleteStep
  - Pass appropriate props and callbacks to each step component
  - Handle error state by displaying error message with recovery suggestions
  - Integrate with existing CommandRouter pattern using ScreenProps interface
  - _Requirements: 1.6, 1.7, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 7. Integration testing and error handling
- [x] 7.1 Test full init flow end-to-end
  - Test `red64 init` with no flags completing interactive flow
  - Test `red64 init --stack react --skip-guided` for non-interactive mode
  - Test `red64 init` with existing `.red64/` directory handling (overwrite/merge/abort)
  - Test `red64 init --no-cache` forcing fresh download
  - Verify `.red64/` structure is created correctly with all subdirectories
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 7.2 Test cache operations and offline behavior
  - Verify cache stores tarball after successful download
  - Verify cache hit on subsequent init with same version
  - Test offline re-init using cached files
  - Test cache bypass with `--no-cache` flag
  - Test cache fallback when GitHub fetch fails
  - _Requirements: 6.5, 6.6, 6.7, 6.8_

- [x] 7.3 Test stack template application
  - Verify stack templates are correctly copied to steering directory
  - Test variable substitution in templates (project name, description)
  - Test fallback to generic templates when stack not found
  - Verify stack-specific custom steering documents are included
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.4, 4.5, 4.6_

- [x] 7.4 Test error handling and recovery
  - Test network failure during download with retry and cache fallback
  - Test permission errors with actionable error messages
  - Test corrupted tarball detection and re-download offer
  - Test invalid repository format validation
  - Verify error states display recovery suggestions
  - _Requirements: 6.8_
