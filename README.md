# Red64 CLI

**Deterministic spec-driven development orchestrator for AI-assisted coding.**

Red64 automates the entire feature development lifecycle—from requirements to implementation—using a structured, phase-gated workflow that ensures quality and traceability.

![Red64 Flow Demo](docs/assets/demo.gif)
<!-- TODO: Add screencast -->

---

## Quick Start

### 1. Install

```bash
# Clone and install
git clone https://github.com/your-org/red64-cli.git
cd red64-cli
npm install
npm link
```

### 2. Initialize your project

```bash
cd /path/to/your/project
red64 init
```

### 3. Start a feature

```bash
red64 start "user-authentication" "Add login and registration with JWT tokens"
```

Red64 will:
1. Create an isolated git worktree
2. Generate requirements (EARS format)
3. Create technical design
4. Break down into implementation tasks
5. Execute each task with commits
6. Complete with a ready-to-review branch

---

## What is Red64?

Red64 is a **spec-driven development orchestrator** that brings structure and determinism to AI-assisted coding. Instead of ad-hoc prompting, Red64 enforces a rigorous workflow:

```
Requirements → Design → Tasks → Implementation
     ↓            ↓        ↓          ↓
  (review)    (review)  (review)   (commits)
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Spec-Driven** | Every feature starts with formal requirements and design |
| **Phase Gates** | Human review required between phases (or auto-approve with `-y`) |
| **Git Isolation** | Each feature runs in its own worktree and branch |
| **Atomic Commits** | One commit per task for clean history |
| **Sandboxed Execution** | Optional Docker isolation for safe agent execution |
| **Resumable Flows** | `start` auto-detects in-progress flows and offers resume |
| **API Health Checks** | Validates Claude API before starting (credits, auth, network) |

### Goals

1. **Predictability**: Same inputs produce consistent outputs through structured phases
2. **Traceability**: Every code change links back to requirements and design decisions
3. **Quality**: Mandatory review gates prevent AI hallucinations from reaching production
4. **Isolation**: Git worktrees prevent work-in-progress from polluting main branch
5. **Efficiency**: Automate the tedious parts while keeping humans in control

---

## Installation

### Requirements

- Node.js >= 20.0.0
- Git
- Claude CLI (`npm install -g @anthropic-ai/claude-cli`)
- Docker (optional, for sandboxed execution)

### From Source

```bash
git clone https://github.com/your-org/red64-cli.git
cd red64-cli
npm install
npm run build
npm link
```

### Verify Installation

```bash
red64 --version
red64 help
```

---

## Commands

### `red64 init`

Initialize Red64 in your project. Creates `.red64/` directory with steering documents.

```bash
red64 init
red64 init --repo owner/repo --stack nextjs
red64 init --agent gemini  # Use Gemini as coding agent
```

**Flags:**
- `-a, --agent <name>` — Coding agent: `claude`, `gemini`, `codex` (default: `claude`)

![red64 init](docs/assets/init.png)
<!-- TODO: Add screenshot -->

### `red64 start <feature> <description>`

Start a new feature development flow, or resume an existing one.

```bash
red64 start "shopping-cart" "Add shopping cart with add/remove items and checkout"
```

**Smart Resume Detection:**

When you run `start` for a feature that's already in progress (at any phase: requirements, design, tasks, or implementation), Red64 will:

1. **Detect uncommitted changes** — If the worktree has uncommitted changes, prompts:
   - Commit changes (WIP commit)
   - Discard changes
   - Cancel

2. **Offer resume or restart** — If an in-progress flow is found, prompts:
   - Resume from current phase
   - Start fresh (discard previous progress)
   - Cancel

This means you can always use `red64 start <feature>` to continue working—no separate resume command needed.

**Flags:**
- `-m, --model <name>` — Model to use (e.g., `claude-3-5-haiku-latest` for dev, `claude-sonnet-4-20250514` for prod)
- `-y, --yes` — Auto-approve all phases (skip review gates)
- `-b, --brownfield` — Enable gap analysis for existing codebases
- `-g, --greenfield` — New feature mode (default)
- `-s, --skip-permissions` — Pass to Claude CLI
- `-t, --tier <name>` — Use specific Claude config tier
- `--sandbox` — Run in Docker isolation
- `--verbose` — Show detailed execution logs

![red64 start](docs/assets/start.png)
<!-- TODO: Add screenshot -->

### `red64 status [feature]`

Show the status of a flow.

```bash
red64 status shopping-cart
red64 status  # Show all flows
```

![red64 status](docs/assets/status.png)
<!-- TODO: Add screenshot -->

### `red64 list`

List all active flows in the repository.

```bash
red64 list
```

### `red64 abort <feature>`

Abort a flow and clean up resources (worktree, branch).

```bash
red64 abort shopping-cart
```

---

## Workflow Phases

### 1. Initialization

Creates spec directory at `.red64/specs/<feature>/` with `spec.json`.

### 2. Requirements Generation

Generates `requirements.md` using EARS (Easy Approach to Requirements Syntax) format:
- Ubiquitous requirements
- Event-driven requirements
- State-driven requirements
- Optional features
- Unwanted behaviors

### 3. Gap Analysis (Brownfield only)

For existing codebases, analyzes what already exists and what needs to be built.

### 4. Design Generation

Creates `design.md` with:
- Architecture decisions
- Component design
- Data models
- API contracts
- File structure

### 5. Task Generation

Breaks down the design into atomic `tasks.md`:
- Each task is independently implementable
- Tasks are ordered by dependency
- Each task produces a commit

### 6. Implementation

Executes tasks sequentially:
- Runs `/red64:spec-impl <feature> <task-id>`
- Commits after each task
- Checkpoints every 3 tasks (optional pause)

### 7. Completion

Flow completes with:
- All tasks implemented
- Clean commit history
- Feature branch ready for PR

---

## Comparison with Other Tools

| Feature | Red64 | Cursor/Copilot | Aider | Claude Code |
|---------|-------|----------------|-------|-------------|
| **Spec-driven workflow** | Yes | No | No | No |
| **Phase gates** | Yes | No | No | No |
| **Git worktree isolation** | Yes | No | No | No |
| **Atomic commits per task** | Yes | No | Yes | No |
| **Requirements generation** | Yes | No | No | No |
| **Design documents** | Yes | No | No | No |
| **Resumable flows** | Yes | No | Partial | No |
| **Docker sandboxing** | Yes | No | No | Yes |
| **IDE integration** | No | Yes | Partial | Yes |
| **Real-time editing** | No | Yes | Yes | Yes |

### When to use Red64

**Use Red64 when:**
- Building complete features (not quick fixes)
- You need traceable requirements and design
- Working on complex, multi-file changes
- You want clean git history with atomic commits
- You need to pause and resume work across sessions

**Use other tools when:**
- Making quick, single-file edits
- Exploring or prototyping ideas
- You need real-time IDE integration
- Working on bug fixes without spec requirements

---

## Limitations

### Current Limitations

1. **No IDE integration** — Red64 is CLI-only; no VS Code or JetBrains plugins yet
2. **Sequential execution** — Tasks run one at a time, no parallelization
3. **No incremental changes** — Regenerating a phase replaces previous output entirely
4. **English-centric** — Prompts and templates are English-only (configurable per spec)

### Known Issues

- Large codebases may hit context limits during design phase
- Docker sandbox requires pre-built image (`docker build -f Dockerfile.sandbox -t red64-sandbox:latest .`)
- Some UI frameworks may not render correctly in all terminals

### Roadmap

- [ ] VS Code extension
- [ ] Parallel task execution
- [ ] Incremental phase editing
- [ ] Web dashboard for flow monitoring

---

## Project Structure

```
.red64/
├── specs/                    # Feature specifications
│   └── <feature>/
│       ├── spec.json         # Spec metadata
│       ├── requirements.md   # EARS requirements
│       ├── design.md         # Technical design
│       └── tasks.md          # Implementation tasks
├── flows/                    # Flow state and logs
│   └── <feature>/
│       ├── state.json        # Current flow state
│       └── flow.log          # Execution log
└── steering/                 # Project-wide guidance
    ├── product.md            # Product context
    ├── tech.md               # Technical standards
    └── structure.md          # Codebase structure
```

---

## Configuration

### Steering Documents

Customize AI behavior by editing `.red64/steering/`:

- **product.md** — Product vision, user personas, business rules
- **tech.md** — Tech stack, coding standards, patterns to use/avoid
- **structure.md** — Codebase organization, file naming conventions

### Coding Agents

Red64 supports multiple coding agents. Set the agent at init time:

```bash
red64 init --agent claude   # Default - Anthropic Claude
red64 init --agent gemini   # Google Gemini
red64 init --agent codex    # OpenAI Codex
```

The agent is stored in `.red64/config.json` and used for all subsequent commands.

### Model Selection

Override the model per command for cost optimization:

```bash
# Development (cheap, fast models)
red64 start "feature" "desc" --model claude-3-5-haiku-latest
red64 start "feature" "desc" --model gemini-2.0-flash
red64 start "feature" "desc" --model gpt-4o-mini

# Production (best quality models)
red64 start "feature" "desc" --model claude-sonnet-4-20250514
red64 start "feature" "desc" --model gemini-2.5-pro
red64 start "feature" "desc" --model o1
```

| Agent | Cheap (Dev) | Best (Prod) |
|-------|-------------|-------------|
| Claude | `claude-3-5-haiku-latest` | `claude-sonnet-4-20250514` |
| Gemini | `gemini-2.0-flash` | `gemini-2.5-pro` |
| Codex | `gpt-4o-mini` | `o1` |

### Claude Tiers

Use different Claude configurations with `--tier`:

```bash
red64 start "feature" "desc" --tier pro
# Uses ~/.claude-pro/ for configuration
```

---

## Development

### Run in development mode

```bash
npm run dev -- start my-feature "Feature description"
```

### Run tests

```bash
npm test
npm run test:ui
```

### Build

```bash
npm run build
```

### Type checking

```bash
npm run type-check
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

---

## License

MIT

---

## Acknowledgments

- Built by Yacin Bahi, yacin@Red64.io
- Inspired by spec-driven development and EARS requirements methodology
- Uses [Ink](https://github.com/vadimdemedes/ink) for terminal UI
