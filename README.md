# Red64 CLI

<div align="center">

### 30,000 hours of experience building software.<br/>The SDLC that makes AI-generated code maintainable.

**20 years of building products. 1+ year of AI-first development. Captured in a CLI.**

TDD built in. Code smells to avoid. Documentation required. Quality gates enforced.<br/>
The process that turns AI code into production-ready software.
The result? Code that lives and evolves—not legacy the day it ships.

[![npm version](https://img.shields.io/npm/v/red64-cli.svg)](https://www.npmjs.com/package/red64-cli)
[![Build](https://github.com/Red64llc/red64-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Red64llc/red64-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Red64](https://img.shields.io/badge/Built%20with-Red64-red)](https://red64.io/ventures)

[Quick Start](#-quick-start) · [Why Red64](#-why-red64) · [Features](#-features) · [Documentation](#-documentation)

</div>

<img width="1283" height="378" alt="Red64 CLI screenshot (claude)" src="https://github.com/user-attachments/assets/cc309998-340b-4764-af83-902efc26b58f" />

---

## 🎯 The Problem

I've spent 20 years building products and writing software. 30,000 hours of experience. Then I went all-in on AI coding tools:

**They're incredible for building a feature.** But then you start iterating—and you hit a wall:

- ❌ Code quality goes down the drain
- ❌ No testing (or tests written after the fact)
- ❌ No documentation/specs (good luck iterating on anything)
- ❌ No careful design review, no code review
- ❌ No quality gates—code smells everywhere
- ❌ Large commits that can't be easily rolled back
- ❌ No non-regression tests, so things start breaking

**This is the same problem that arises in any team with no processes, no gates, no constraints.**

## ✅ The Solution

The solution is what I've been doing for 20 years: **Software Development Life Cycle and Processes.** The stuff tech leaders and experience software professional implement in their teams. The stuff that separates "it works" from "it's maintainable."

**Red64 CLI captures both:**

1. **My 30,000 hours of experience** — code smells to avoid, patterns that scale, production wisdom
2. **My process for working with AI** — the SDLC that makes AI-generated code maintainable

**The process (HOW the software professional works):**
- Isolate every feature in a branch (git worktree)
- Write tests FIRST (TDD built in)
- Small atomic commits (one thing per commit)
- Document everything (REQUIREMENTS.md, DESIGN.md)
- High test coverage enforced
- Quality gates at every phase

**The expertise (WHAT the software professional builds):**
- Code smells to avoid (the stuff that breaks at 3 AM)
- Patterns and anti-patterns for Python, Next, Ruby, Rails etc...
- Stack-specific conventions (Next.js, Rails, FastAPI, etc.)

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

- `--sandbox` = Docker isolation (AI can't break your system, pulls image from `ghcr.io/red64llc/red64-sandbox`)
- `-y` = Auto-approve all phases (total autonomy)

**Start a feature. Go to lunch. Come back to a completed branch—with tests, docs, and clean commits.**

With other tools, YOLO mode means "write code fast with no oversight."<br/>
With Red64, autonomous mode means "follow the SDLC with no babysitting."

The AI still:
1. Writes tests FIRST (TDD enforced)
2. Documents everything (REQUIREMENTS.md, DESIGN.md)
3. Makes atomic commits (easy to review, easy to rollback)
4. Passes quality gates (no code smells ship)

**Review the PR when it's done. Like a senior engineer delegating to a junior who's been properly onboarded.**

---

## 🏆 Battle-Tested

We built **6 production products** with Red64 at [red64.io/ventures](https://red64.io/ventures):

| Company | Industry | Status |
|---------|----------|--------|
| [Saife](https://red64.io/ventures) | InsurTech | Production |
| [EngineValue](https://red64.io/ventures) | Engineering Scorecards | Production |
| [MediaPulse](https://red64.io/ventures) | Digital Presence | Production |
| [TheScriptMarketplace](https://red64.io/ventures) | Entertainment | Production |
| [QueryVault](https://red64.io/ventures) | Data Platform | Production |
| [Kafi](Internal product) | Virtual Executive Assistant | Production |

Same tool. Same encoded experience. Now open source.

---

## 💡 Why Red64?

### Two Decades of Experience, Encoded

I've spent 20 years building products—30,000 hours of learning what works and what breaks. Then I spent a year going all-in on AI coding tools.

**The pattern is always the same:**

1. **Week 1:** "This is amazing! I shipped a feature in a day!"
2. **Week 4:** "Why is everything breaking? Why is the code so messy?"
3. **Week 8:** "I'm afraid to touch anything. Time to rewrite."

**The missing ingredient?** SDLC. The stuff that takes 20 years to learn. The stuff I've been teaching engineers my entire career.

Red64 gives you both:

| What Goes Wrong Without SDLC | Red64 Solution |
|------------------------------|----------------|
| No tests → things break when you iterate | TDD built in (tests FIRST) |
| No docs → can't remember why anything works | REQUIREMENTS.md + DESIGN.md per feature |
| Huge commits → can't rollback, can't review | Atomic commits (one task = one commit) |
| No quality gates → code smells everywhere | Guardrails from 30K hours of experience |
| Babysitting every line → slow, exhausting | Autonomous mode with SDLC guardrails |

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

Every decision traceable. Every line has a reason. **Code that survives iteration.**

---

## 📊 Comparison

| Feature | Red64 | Cursor | Copilot | Claude Code | Gemini CLI | Aider |
|---------|:-----:|:------:|:-------:|:-----------:|:----------:|:-----:|
| **30K hours expertise encoded** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **SDLC/Process enforced** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
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

### MCP Server Support

Configure MCP servers once, and Red64 automatically injects them into whichever agent you use (Claude, Gemini, or Codex):

```bash
# Add an MCP server
red64 mcp add context7 npx -y @upstash/context7-mcp

# List configured servers
red64 mcp list

# Remove a server
red64 mcp remove context7
```

MCP servers are stored in `.red64/config.json` and translated into each agent's native config format before invocation. Configs are cleaned up after execution so your personal agent settings stay untouched.

Works in both local and `--sandbox` mode (stdio servers run inside the container).

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
red64 init --agent gemini     # Initialize Red64 in your project
red64 start <feature> <desc>  # Start a new feature
red64 start ... --sandbox -y  # YOLO mode (autonomous)
red64 status [feature]        # Check flow status
red64 list                    # List all active flows
red64 abort <feature>         # Abort and clean up
red64 mcp list                # List configured MCP servers
red64 mcp add <name> <cmd>    # Add an MCP server
red64 mcp remove <name>       # Remove an MCP server
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
