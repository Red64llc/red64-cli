# Red64 CLI

Spec-driven development for AI coding agents.

Red64 wraps your existing AI coding tool — Claude Code, Gemini CLI, or local models — with a structured workflow that turns a prompt into requirements, design docs, tests, and code. Each feature gets its own branch, its own specs, and atomic commits.

```bash
npm install -g red64-cli
```

## How it works

You describe a feature in plain English. Red64 runs it through four phases before any code gets written:

```
                          ┌─────────────────┐
                          │   your prompt    │
                          │                  │
                          │ "add coupon to   │
                          │  checkout flow"  │
                          └────────┬─────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │        REQUIREMENTS          │
                    │                              │
                    │  User stories, acceptance    │
                    │  criteria (EARS notation)    │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │          DESIGN              │
                    │                              │
                    │  Architecture, sequence      │
                    │  diagrams, tech decisions    │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │           TASKS              │
                    │                              │
                    │  Discrete tasks, ordered     │
                    │  by dependency               │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       IMPLEMENTATION         │
                    │                              │
                    │  TDD: tests first, then      │
                    │  code, one commit per task   │
                    └──────────────────────────────┘
```

Each phase produces a file you can read and review:

```
.red64/specs/support-coupon-checkout/
├── REQUIREMENTS.md
├── DESIGN.md
└── TASKS.md
```

These files are the real output. The code follows from them.

## Quick start

```bash
# Initialize in your project (once)
cd your-project
red64 init --agent claude --stack nextjs

# Start a feature
red64 start support-coupon-checkout "user should be able to add a coupon while checking out"
```

Red64 walks through each phase and asks for your approval before moving on. When it reaches implementation, it writes tests first, then code, committing each task individually.

To let it run without stopping:

```bash
red64 start support-coupon-checkout "add coupon to checkout" --sandbox -y
```

`--sandbox` isolates execution in Docker. `-y` approves all phases automatically. You review the finished branch when it's done.

## What gets generated

For a feature called `support-coupon-checkout`, you end up with:

```
your-project/
├── .red64/
│   └── specs/
│       └── support-coupon-checkout/
│           ├── REQUIREMENTS.md    ← user stories, acceptance criteria
│           ├── DESIGN.md          ← architecture, sequence diagrams
│           └── TASKS.md           ← discrete tasks with dependencies
├── src/
│   ├── checkout/
│   │   └── coupon.ts              ← implementation
│   └── ...
└── tests/
    ├── checkout/
    │   └── coupon.test.ts         ← written before the implementation
    └── ...
```

Every task is a separate commit. The branch has a clean, reviewable history.

## Isolation

Each feature runs in its own git worktree, so multiple features can be developed in parallel without conflicts. With `--sandbox`, the AI agent runs inside a Docker container and can't touch your host system.

```
┌──────────────────────────────────────────────────┐
│  your repo (main)                                │
│                                                  │
│   ┌─────────────────┐  ┌─────────────────┐      │
│   │ worktree:       │  │ worktree:       │      │
│   │ feature-a       │  │ feature-b       │      │
│   │                 │  │                 │      │
│   │ ┌─────────────┐ │  │ ┌─────────────┐ │      │
│   │ │ Docker      │ │  │ │ Docker      │ │      │
│   │ │ sandbox     │ │  │ │ sandbox     │ │      │
│   │ └─────────────┘ │  │ └─────────────┘ │      │
│   └─────────────────┘  └─────────────────┘      │
│                                                  │
└──────────────────────────────────────────────────┘
```

## Agents

Red64 doesn't call LLM APIs directly. It copies command definitions into your project that your AI coding tool reads natively. Pick your agent:

```bash
red64 init --agent claude    # Claude Code
red64 init --agent gemini    # Gemini CLI
red64 init --agent codex     # OpenAI Codex CLI
```

### Local models

You can use open-source models with Claude Code's custom backend support. No API costs:

```bash
# Start Ollama with a local model
ollama pull qwen3-coder-next

# Initialize with local model
red64 init --agent claude --model qwen3-coder-next

# Same workflow, running locally
red64 start "add-auth" "add login with JWT" --sandbox -y
```

## Steering documents

Red64 reads markdown files in `.red64/steering/` to tailor the AI's behavior to your project:

- **product.md** — Product vision, user personas, business context
- **tech.md** — Stack standards, patterns to follow, code smells to avoid
- **structure.md** — Codebase organization, naming conventions

These are optional but useful on larger projects.

## Commands

```
red64 init                          Initialize Red64 in your project
red64 start <name> <description>   Start a new feature
red64 status [name]                 Check progress on a feature
red64 list                          List all active features
red64 abort <name>                  Stop and clean up a feature
```

### Flags

```
-y, --yes       Auto-approve all phases
--sandbox       Run in Docker isolation
-m, --model     Override AI model
-a, --agent     Set coding agent (claude/gemini/codex)
--verbose        Show detailed logs
```

## MCP support

Connect the AI to your environment with Model Context Protocol:

```bash
red64 init --mcp
```

This lets the AI query your database schema, read docs, or use custom tools during development.

## How it compares

Red64 is a workflow layer, not an IDE or editor plugin. It sits on top of whatever AI coding tool you already use and adds structure.

If you've seen spec-driven approaches like Kiro: Red64 does the same thing but works with your existing tools instead of requiring a proprietary IDE. It also enforces TDD — tests are written first, not as an afterthought.

## The idea

AI coding tools generate code fast, but the output tends to degrade after a few iterations. Requirements drift, tests don't exist, documentation is missing, and commit history is meaningless.

Red64 enforces the same process a senior engineering team would follow: gather requirements, design the solution, plan the work, then implement with tests and clean commits. The AI does the work, but the structure keeps it honest.

The philosophy: **the code isn't the asset. The docs, tests, and history are the asset.** We've rewritten features in entirely different languages in days because the specs were complete enough to work from.

## Install

```bash
# npm
npm install -g red64-cli

# or clone
git clone https://github.com/Red64llc/red64-cli.git
cd red64-cli && npm install && npm link
```

Requires Node.js 18+ and one of: Claude Code, Gemini CLI, or Codex CLI.

## Documentation

- [Full docs](./docs/README.md)
- [Steering guide](./docs/steering.md)
- [Configuration reference](./docs/configuration.md)
- [Troubleshooting](./docs/troubleshooting.md)

## Contributing

1. Fork the repo
2. Create a feature branch
3. Run tests: `npm test`
4. Open a PR

## License

MIT — see [LICENSE](./LICENSE)