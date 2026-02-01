# Red64 CLI

<div align="center">

### You can't replace 30,000 hours of experience.<br/>But you can encode it.

**I taught the AI coding agent the same way I teach junior devs.**

Code smells to avoid. Patterns that scale. TDD built in. Documentation required.<br/>
The result? Code that lives and evolves—not legacy the day it ships.

[![npm version](https://img.shields.io/npm/v/red64-cli.svg)](https://www.npmjs.com/package/red64-cli)
[![Build](https://github.com/Red64llc/red64-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Red64llc/red64-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Red64](https://img.shields.io/badge/Built%20with-Red64-red)](https://red64.io/ventures)

[Quick Start](#-quick-start) · [Why Red64](#-why-red64) · [Features](#-features) · [Documentation](#-documentation)

</div>

---

## 🎯 The Problem

AI coding tools write code that **works**. But it's not code a senior engineer would approve.

- ❌ No tests (or tests written after the fact)
- ❌ No documentation (good luck onboarding anyone)
- ❌ Silent catch blocks, useEffect data fetching, frontend-only auth checks
- ❌ Commit history that's just "fix" and "update" and "wip"
- ❌ You babysit every. single. line.

The code ships. Then it becomes legacy. Nobody wants to touch it in 6 months.

## ✅ The Solution

Red64 encodes **30,000 hours of CTO experience** into AI-assisted development:

**What the AI learns (code quality):**
- Code smells to avoid (the stuff that breaks at 3 AM)
- Patterns that actually scale (learned from production)
- Stack-specific conventions (Next.js, Rails, FastAPI, etc.)

**How the AI works (process):**
- Isolate every feature in a branch (git worktree)
- Write tests FIRST (TDD built in)
- Small atomic commits (one thing per commit)
- Document everything (requirements, design, decisions)
- High test coverage enforced

**The result:** Code that lives and evolves. We've rewritten features in another language in **days** because the documentation is so complete.

---

## 🚀 Quick Start

```bash
# Install
npm install -g red64-cli

# Initialize in your project
cd /path/to/your/project
red64 init --stack nextjs

# Start a feature (interactive mode)
red64 start "user-auth" "Add login and registration with JWT"

# Or YOLO mode — no babysitting required
red64 start "shopping-cart" "Full cart with checkout" --sandbox -y
```

That's it. Red64 generates requirements → design → tests → implementation → documentation.

Each phase has review checkpoints. Each task = one clean commit. Tests first. Docs included.

---

## 🔥 YOLO Mode (No Babysitting)

Tired of approving every line?

```bash
red64 start "feature-name" "description" --sandbox -y
```

- `--sandbox` = Docker isolation (pulls image from `ghcr.io/red64llc/red64-sandbox`)
- `-y` = Auto-approve all phases (total autonomy)

**Start a feature. Go to lunch. Come back to a completed branch.**

This is safe because:
1. **Steering docs** constrain the AI to your patterns
2. **Sandbox** prevents system damage
3. **Atomic commits** make review easy after completion
4. **Tests are required** — no untested code ships

Other tools: "Accept this change? This one? This one?"<br/>
Red64 YOLO: Review the PR when it's done. Like a senior engineer delegating to a junior.

---

## 🏆 Battle-Tested

We built **6 production companies** with Red64 at [red64.io/ventures](https://red64.io/ventures):

| Company | Industry | Status |
|---------|----------|--------|
| [Saife](https://red64.io/ventures) | InsurTech | Production |
| [EngineValue](https://red64.io/ventures) | Engineering Scorecards | Production |
| [MediaPulse](https://red64.io/ventures) | Digital Presence | Production |
| [TheScriptMarketplace](https://red64.io/ventures) | Entertainment | Production |
| [QueryVault](https://red64.io/ventures) | Data Platform | Production |
| [KYTech](https://red64.io/ventures) | Dev Teams | Production |

Same tool. Same encoded experience. Now open source.

---

## 💡 Why Red64?

### The Teaching Metaphor

Every senior engineer has sat with a junior dev and said:
- *"Don't do that—it's a code smell"*
- *"This pattern breaks at scale"*
- *"Always handle this edge case"*
- *"Here's why we do it this way"*

Red64 teaches AI the same way:

| What Senior Engineers Do | Red64 Equivalent |
|--------------------------|------------------|
| "Here's our style guide" | `steering/tech.md` — Stack standards |
| "Don't do that" | Code smell guardrails |
| "Here's our architecture" | `steering/structure.md` — Codebase patterns |
| "Write tests first" | TDD built into workflow |
| "Document your decisions" | Auto-generated docs per feature |
| "One thing per PR" | Atomic commits, one task per commit |

### What You Get Per Feature

```
feature-branch/
├── REQUIREMENTS.md      # What we're building and why
├── DESIGN.md            # How it works, architecture decisions
├── TASKS.md             # Atomic breakdown with acceptance criteria
├── src/
│   ├── feature.ts       # Implementation
│   └── feature.test.ts  # Tests (written first)
└── docs/
    └── feature.md       # User-facing documentation
```

Every decision traceable. Every line has a reason.

---

## 📊 Comparison

| Feature | Red64 | Cursor | Copilot | Claude Code | Gemini CLI | Aider |
|---------|:-----:|:------:|:-------:|:-----------:|:----------:|:-----:|
| **30K hours expertise encoded** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Autonomous mode** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Sandboxed execution** | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **MCP support** | ✅ | ⚠️ | ✅ | ✅ | ✅ | ❌ |
| **TDD enforced (tests first)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **High coverage enforced** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Auto-generates docs** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Git worktree isolation** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Atomic commits enforced** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Phase gates with review** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Code smell guardrails** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Resumable multi-step flows** | ✅ | ❌ | ❌ | ✅ | ❌ | ⚠️ |
| **Multi-model support** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Battle-tested (production)** | ✅ 6 cos | N/A | N/A | N/A | N/A | N/A |

**Key:** ✅ = Built-in & enforced | ⚠️ = Partial/Optional | ❌ = Not available

> **The difference:** Other tools have autonomous modes. Red64 has autonomous mode **plus** the encoded expertise and enforced process that produces production-quality code.

### When to Use Red64

✅ **Use Red64 when:**
- Building complete features (not quick fixes)
- You want code with tests, docs, and clean history
- You need to walk away and let AI work autonomously
- You're tired of babysitting every line
- You want code that's safe to refactor

❌ **Use other tools when:**
- Making quick, single-file edits
- You want real-time IDE autocomplete
- Exploring or prototyping ideas

---

## ⚡ Features

### MCP Support (Model Context Protocol)

Connect AI to your actual environment:

```bash
red64 init --mcp
```

- Query your database schema
- Read from your documentation
- Access external APIs
- Use custom tools you define

### Multi-Agent Support

Use your preferred AI:

```bash
red64 init --agent claude   # Default
red64 init --agent gemini   # Google Gemini
red64 init --agent codex    # OpenAI Codex
```

### Smart Resume

Interrupted? Just run `start` again:

```bash
red64 start "shopping-cart" "..."
# Detects in-progress flow, offers to resume
```

### Steering Documents

Customize AI behavior in `.red64/steering/`:

- **product.md** — Product vision, user personas
- **tech.md** — Stack standards, code smells to avoid
- **structure.md** — Codebase organization

---

## 📖 Documentation

- [Full Documentation](./docs/README.md)
- [Steering Document Guide](./docs/steering.md)
- [Configuration Reference](./docs/configuration.md)
- [Troubleshooting](./docs/troubleshooting.md)

---

## 🛠 Commands

```bash
red64 init                    # Initialize Red64 in your project
red64 start <feature> <desc>  # Start a new feature
red64 start ... --sandbox -y  # YOLO mode (autonomous)
red64 status [feature]        # Check flow status
red64 list                    # List all active flows
red64 abort <feature>         # Abort and clean up
```

### Flags

| Flag | Description |
|------|-------------|
| `-y, --yes` | Auto-approve all phases (YOLO mode) |
| `--sandbox` | Run in Docker isolation (uses GHCR image by default) |
| `--local-image` | Build and use local sandbox image instead of GHCR (init only) |
| `-m, --model` | Override AI model |
| `-a, --agent` | Set coding agent (claude/gemini/codex) |
| `--verbose` | Show detailed logs |

---

## 🤝 Contributing

We'd love your help encoding more production wisdom:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

**What we're looking for:**
- More code smells to catch
- Stack-specific best practices
- Bug fixes and improvements

---

## 📜 License

MIT — Built by [Yacin Bahi](mailto:yacin@red64.io) at [Red64.io](https://red64.io)

---

<div align="center">

### The code isn't the asset.<br/>The documentation + tests + history is the asset.<br/>The code is just the current implementation.

**[⭐ Star this repo](https://github.com/Red64llc/red64-cli)** if you believe AI should write code like a senior engineer.

</div>
