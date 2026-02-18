# Red64 CLI
<div align="center">

Run AI coding agents autonomously — no babysitting, no vendor lock-in.

Red64 lets you start a feature and walk away. Agents run in full isolation (Docker sandbox + git worktree), execute autonomously in YOLO mode, and report back through Telegram so you can monitor and control the workflow from your phone. Run locally with open-source models at zero cost, or deploy to your own cloud. Use whatever AI tool you already have — Claude Code, Gemini CLI, Codex — and switch between them freely.

As a bonus, every feature automatically goes through a full spec-driven pipeline: requirements, design docs, TDD, and atomic commits. The same SDLC discipline that senior engineering teams follow, enforced on every agent, on every feature, for free.
</div>

```bash
npm install -g red64-cli
cd my-project
red64 init --agent claude
red64 start coupon-in-checkout "add support for coupon in checkout flow" -y --sandbox --model haiku
```

<div align="center">

[![npm version](https://img.shields.io/npm/v/red64-cli.svg)](https://www.npmjs.com/package/red64-cli)
[![Build](https://github.com/Red64llc/red64-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Red64llc/red64-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Red64](https://img.shields.io/badge/Built%20with-Red64-red)](https://red64.io/ventures)

</div>

## Features

<table>
<tr>
<td width="50%" valign="top">

### 🔄 Autonomous Mode
Start a feature, walk away. `--sandbox` runs the agent in Docker, `-y` auto-approves every phase. You review the finished branch — not every step.

```bash
red64 start "checkout" "add coupons" --sandbox -y
```

</td>
<td width="50%" valign="top">

### 🤖 Multi-Agent
Works with whatever AI coding tool you already use. Same spec-driven workflow across all of them.

**claude** · **gemini** · **codex**

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💻 Local Models
Run the full pipeline on your machine with open-source models. Zero API costs. Same SDLC enforcement.

```bash
red64 init --agent claude --model qwen3-coder-next
```

</td>
<td width="50%" valign="top">

### 📡 Telegram Bot
Monitor and control your agents remotely. Get notified when a phase completes, approve or reject from your phone.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### ☁️ Cloud Mode
Run Red64 on your own infrastructure. Same workflow, but the agent executes in your cloud instead of your laptop.

</td>
<td width="50%" valign="top">

### 🔒 Isolation
Every feature gets its own git worktree and optional Docker sandbox. Parallel development with no conflicts, no risk.

</td>
</tr>
</table>

<img width="1918" height="791" alt="Screenshot 2026-02-13 at 11 36 12 AM" src="https://github.com/user-attachments/assets/ccdaa394-8ad3-440a-9c44-07e0c2473509" />

## How it works

You describe a feature in plain English. Red64 turns that into a testable specification before any code gets written:

```
                          ┌──────────────────┐
                          │   your prompt    │
                          │                  │
                          │ "add coupon to   │
                          │  checkout flow"  │
                          └────────┬─────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │        REQUIREMENTS          │
                    │                              │
                    │  User stories, acceptance    │
                    │  criteria (EARS notation)    │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │          DESIGN              │
                    │                              │
                    │  Architecture, sequence      │
                    │  diagrams, tech decisions    │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │           TASKS              │
                    │                              │
                    │  Discrete tasks, ordered     │
                    │  by dependency               │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
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

These files *are* the product. The code is a derivative.

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
┌──────────────────────────────────────────────┐
│  your repo (main)                            │
│                                              │
│   ┌─────────────────┐  ┌─────────────────┐   │
│   │ worktree:       │  │ worktree:       │   │
│   │ feature-a       │  │ feature-b       │   │
│   │                 │  │                 │   │
│   │ ┌─────────────┐ │  │ ┌─────────────┐ │   │
│   │ │ Docker      │ │  │ │ Docker      │ │   │
│   │ │ sandbox     │ │  │ │ sandbox     │ │   │
│   │ └─────────────┘ │  │ └─────────────┘ │   │
│   └─────────────────┘  └─────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
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

The industry is converging on test-driven specification — the idea that you define what "done" looks like before generating code. AWS Kiro, for instance, requires a testable spec before any code is created.

Red64 follows the same principle but works with your existing tools instead of requiring a proprietary IDE. It also enforces TDD at implementation — tests are written first, not as an afterthought.

## Why specifications

The most expensive failure in AI-assisted development isn't the agent that disobeys — it's the agent that executes a flawed specification flawlessly. Studies show AI-generated code produces 1.7x more logic issues than human-written code. Not syntax errors. The code does the *wrong thing* correctly.

When production costs approach zero, the bottleneck shifts entirely to the precision of your intent. Vague prompts scale errors at the same speed they scale output. The teams seeing 10–80x leverage from AI aren't typing faster — they're specifying better: acceptance criteria, testable conditions, architecture decisions documented before implementation begins.

Red64 enforces this discipline automatically. You describe what you want. The tool produces requirements, design, and a test plan before any code exists. The AI implements against that spec, not against a loose prompt.

**The code isn't the asset. The docs, tests, and history are the asset.** We've rewritten features in entirely different languages in days because the specs were complete enough to work from.

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
