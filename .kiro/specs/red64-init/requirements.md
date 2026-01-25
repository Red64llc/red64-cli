# Requirements Document

## Project Description (Input)
The init command for red64-cli that bootstraps projects with framework files, stack-specific steering templates, and interactive guided setup.

## Introduction
red64-init implements the `red64 init` command which bootstraps a project for red64 spec-driven development flows. It fetches framework files from GitHub, creates the unified `.red64/` directory structure, provides stack-specific steering templates, and offers interactive guided setup with optional AI enhancement.

**Dependency**: Requires red64-cli-scaffold (Ink framework, command routing, UI components).

## Requirements

### Requirement 1: Init Command - Project Bootstrap
**Objective:** As a developer, I want a single command to bootstrap my project for red64 flows, so that I can go from empty project to fully prepared environment quickly.

#### Acceptance Criteria
1. When `red64 init` is invoked, the CLI shall create the `.red64/` unified directory structure.
2. The CLI shall fetch framework files (agents, commands, templates, settings) from a GitHub repository.
3. The CLI shall rename all "kiro" references to "red64" in fetched files during setup.
4. The CLI shall support `--repo <url>` option to specify a custom GitHub repository source.
5. The CLI shall support `--version <tag>` option to fetch a specific release version.
6. If `.red64/` directory already exists, the CLI shall prompt user to overwrite, merge, or abort.
7. The CLI shall display progress during file fetching and setup operations.

### Requirement 2: Unified Directory Structure
**Objective:** As a developer, I want all red64 framework files organized in a single `.red64/` directory, so that project structure is clean and self-contained.

#### Acceptance Criteria
1. The CLI shall create `.red64/steering/` directory for project steering documents.
2. The CLI shall create `.red64/specs/` directory for feature specifications.
3. The CLI shall create `.red64/commands/` directory for Claude slash commands.
4. The CLI shall create `.red64/agents/` directory for agent definitions.
5. The CLI shall create `.red64/templates/` directory for spec and steering templates.
6. The CLI shall create `.red64/settings/` directory for framework configuration and rules.
7. The CLI shall create a `.red64/config.json` file storing init configuration (repo source, version, stack, etc.).

### Requirement 3: Stack-Specific Steering Templates
**Objective:** As a developer, I want the GitHub repository to contain pre-written steering templates for common technology stacks, so that I get stack-appropriate conventions and patterns out of the box.

#### Acceptance Criteria
1. The GitHub repository shall contain steering templates organized by technology stack (e.g., `stacks/react/`, `stacks/nextjs/`, `stacks/nodejs/`, `stacks/python/`, `stacks/go/`, `stacks/rust/`).
2. Each stack template set shall include `product.md`, `tech.md`, and `structure.md` templates with stack-specific content.
3. Stack templates shall include pre-written conventions, patterns, and best practices for that technology.
4. Stack templates may include stack-specific custom steering documents (e.g., testing patterns for Jest vs Pytest, deployment patterns).
5. The CLI shall display available stacks during guided setup for user selection.
6. When no matching stack template exists, the CLI shall use a generic default template set.

### Requirement 4: Interactive Guided Setup with Stack Selection
**Objective:** As a developer, I want the init command to identify my tech stack and fetch matching steering templates, so that I start with a solid foundation instead of blank documents.

#### Acceptance Criteria
1. After fetching framework files, the CLI shall enter an interactive guided setup phase.
2. The CLI shall ask about project type (web app, CLI tool, library, API, etc.).
3. The CLI shall ask about primary technology stack and present available stack options from the repository.
4. The CLI shall fetch the matching stack-specific steering templates based on user selection.
5. The CLI shall populate `.red64/steering/` with the fetched stack templates as the starting point.
6. The CLI shall ask additional questions to customize template placeholders (project name, description, specific conventions).
7. The CLI shall perform guided setup using TypeScript logic without invoking Claude.
8. The CLI shall support `--stack <name>` flag to skip stack selection prompt and use specified stack directly.
9. The CLI shall support `--skip-guided` flag to skip interactive setup entirely and use generic defaults.

### Requirement 5: Steering Command Integration
**Objective:** As a developer, I want the option to enhance my stack-based steering documents with AI assistance, so that I can customize them for my specific project needs.

#### Acceptance Criteria
1. After guided setup completes, the CLI shall display a summary of the fetched stack templates.
2. The CLI shall offer to run `/red64:steering` for AI enhancement and customization of steering docs.
3. The CLI shall offer to run `/red64:steering-custom` for generating additional custom steering docs.
4. The CLI shall allow user to run steering commands multiple times until satisfied.
5. The CLI shall display a summary of steering documents after each enhancement.
6. When user confirms steering is complete, the CLI shall finalize init and display next steps.
7. The CLI shall support `--no-steering` flag to skip the steering enhancement phase entirely.

### Requirement 6: GitHub Framework Fetch
**Objective:** As a developer, I want the CLI to fetch framework files and stack templates from GitHub reliably, so that I always have the latest or specified version of the framework.

#### Acceptance Criteria
1. The CLI shall fetch framework files from a configurable GitHub repository (default: red64 official repo).
2. The CLI shall use GitHub API to download repository contents without requiring git clone.
3. The CLI shall support fetching specific tags or branches via `--version` option.
4. The CLI shall fetch stack-specific steering templates based on the stack identified during guided setup.
5. The CLI shall cache fetched files locally in a user-level cache directory, organized by version and stack.
6. When cached files exist and match requested version/stack, the CLI shall use cache for offline re-init.
7. The CLI shall support `--no-cache` flag to force fresh download.
8. If GitHub fetch fails, the CLI shall display error and offer to use cached version if available.
