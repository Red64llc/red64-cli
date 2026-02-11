# Red64 CLI + Qwen3-Coder-Next Integration Spec (v2)

## Status: Draft | Date: 2026-02-07

---

## 1. Priority Reframe

The fastest, highest-value path is **not** building a new `--agent qwen`. It's using what already works:

```bash
red64 init --agent claude
red64 start --model qwen3-coder-next "add user authentication"
```

**Why this is better:**
- Claude Code already works with Qwen3-Coder-Next via OpenAI-compatible backends
- Red64's Claude agent is the **most mature and tested** — battle-hardened across 6 production products
- Zero new command files to write or test
- The value proposition is immediate: "$0/month SDLC-enforced coding on your MacBook"

**What's actually needed:** A `--model` flag (or env var) that configures Claude Code to point at a local Qwen3-Coder-Next instance instead of Anthropic's API.

---

## 2. How Claude Code + Qwen3-Coder-Next Works

### The Connection Chain

```
Red64 CLI → Claude Code CLI → Local Ollama → Qwen3-Coder-Next
```

Claude Code accepts custom backends via environment variables:

```bash
# Option A: Ollama (simplest)
export ANTHROPIC_BASE_URL="http://localhost:11434"
export ANTHROPIC_AUTH_TOKEN="ollama"
claude --model qwen3-coder-next

# Option B: DashScope Claude Code Proxy (cloud, no local GPU)
export ANTHROPIC_BASE_URL="https://dashscope-intl.aliyuncs.com/api/v2/apps/claude-code-proxy"
export ANTHROPIC_AUTH_TOKEN="your-dashscope-api-key"
```

Claude Code's `.claude/commands/red64/` markdown files, sub-agent definitions, and `CLAUDE.md` all work unchanged — the model swap is transparent to the command layer.

### What Red64 Needs to Do

Red64 currently invokes Claude Code during `red64 start`. It needs to:

1. Accept a `--model` flag (or `RED64_MODEL` env var)
2. Set the appropriate `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` before spawning Claude Code
3. Pass `--model <model-name>` to the `claude` CLI invocation

---

## 3. Implementation Spec

### Phase 1: 1-Hour Sprint (MVP — Ship & Write Article)

#### 3.1 Add `--model` Flag to `red64 start`

```bash
# New usage
red64 start --model qwen3-coder-next "add user auth"
red64 start --model qwen3-coder-next --sandbox -y "add user auth"

# Equivalent to current behavior (Anthropic API)
red64 start "add user auth"
```

**Implementation logic (pseudocode):**

```python
def start(feature, description, model=None, sandbox=False, auto_approve=False):
    env = os.environ.copy()

    if model:
        # Check if ANTHROPIC_BASE_URL is already set by user
        if "ANTHROPIC_BASE_URL" not in env:
            # Default to Ollama for local models
            env["ANTHROPIC_BASE_URL"] = "http://localhost:11434"
            env["ANTHROPIC_AUTH_TOKEN"] = env.get("ANTHROPIC_AUTH_TOKEN", "ollama")

        claude_args = ["claude", "--model", model, ...]
    else:
        claude_args = ["claude", ...]

    subprocess.run(claude_args, env=env)
```

**Key design decisions:**
- If `--model` is provided but `ANTHROPIC_BASE_URL` is not set, default to Ollama (`localhost:11434`)
- If user has already set `ANTHROPIC_BASE_URL` (e.g., to DashScope proxy), respect it
- The `--model` flag passes through directly to `claude --model`
- Works with `--sandbox` mode — Docker container just needs network access to host Ollama

#### 3.2 Add Model Config to `.red64/config.json`

Allow persistent model configuration so users don't need `--model` every time:

```json
{
  "agent": "claude",
  "model": "qwen3-coder-next",
  "baseUrl": "http://localhost:11434",
  "authToken": "ollama"
}
```

`red64 init --agent claude --model qwen3-coder-next` would write this config. Subsequent `red64 start` commands read it automatically.

#### 3.3 Update `red64 init`

```bash
# New usage
red64 init --agent claude --model qwen3-coder-next

# What it does:
# 1. Same as current `red64 init --agent claude` (copies .claude/, .red64/, CLAUDE.md)
# 2. Additionally writes model config to .red64/config.json
# 3. Prints setup instructions for Ollama if model is local
```

**Post-init output should include:**

```
✓ Red64 initialized with Claude Code + qwen3-coder-next

To use locally (free, private):
  1. Install Ollama: curl -fsSL https://ollama.com/install.sh | sh
  2. Pull model:     ollama pull qwen3-coder-next  (~46GB)
  3. Start coding:   red64 start "your feature description"

To use via DashScope API (no GPU required):
  export ANTHROPIC_BASE_URL="https://dashscope-intl.aliyuncs.com/api/v2/apps/claude-code-proxy"
  export ANTHROPIC_AUTH_TOKEN="your-dashscope-api-key"
  red64 start "your feature description"
```

#### 3.4 Sandbox Mode Networking

When using `--sandbox` (Docker isolation), the container needs to reach the host's Ollama:

```bash
# Linux: use host networking or --add-host
docker run --add-host=host.docker.internal:host-gateway ...

# macOS/Windows: host.docker.internal works by default
```

Red64's sandbox launcher should:
- Detect if `--model` is set and base URL points to localhost
- Adjust the Docker networking accordingly
- Map `localhost:11434` to `host.docker.internal:11434` inside the container

#### 3.5 Time Breakdown

| Task | Time |
|------|------|
| Add `--model` flag to `red64 start` + env var passthrough | 20 min |
| Add model field to `.red64/config.json` + read logic | 15 min |
| Update `red64 init` to accept `--model` and print setup instructions | 10 min |
| Test: `red64 init --agent claude --model qwen3-coder-next` → full flow | 15 min |
| **Total** | **60 min** |

---

### Phase 2: Hardening & DX (Week 1-2)

#### 2.1 Model Presets

Instead of requiring users to know model names and URLs:

```bash
red64 init --agent claude --model qwen-local     # Preset: Ollama + qwen3-coder-next
red64 init --agent claude --model qwen-cloud     # Preset: DashScope proxy
red64 init --agent claude --model deepseek-local  # Future: DeepSeek via Ollama
```

**Preset registry:**

```python
MODEL_PRESETS = {
    "qwen-local": {
        "model": "qwen3-coder-next",
        "baseUrl": "http://localhost:11434",
        "authToken": "ollama",
        "setup": "ollama pull qwen3-coder-next"
    },
    "qwen-cloud": {
        "model": "qwen3-coder-plus",
        "baseUrl": "https://dashscope-intl.aliyuncs.com/api/v2/apps/claude-code-proxy",
        "authTokenEnv": "DASHSCOPE_API_KEY",
        "setup": "Get API key at https://dashscope.console.aliyun.com/"
    }
}
```

#### 2.2 Health Check on Start

Before spawning Claude Code, verify the model is reachable:

```bash
$ red64 start "add user auth"
⠋ Checking qwen3-coder-next at localhost:11434...
✓ Model ready (Qwen3-Coder-Next 80B-A3B, Q4_K quantization)
⠋ Starting Claude Code...
```

If Ollama isn't running or model isn't pulled:

```
✗ Cannot reach qwen3-coder-next at localhost:11434

Quick fix:
  ollama serve          # Start Ollama
  ollama pull qwen3-coder-next  # Pull model (~46GB)
```

#### 2.3 Prompt Tuning for Qwen3-Coder-Next

The existing `.claude/commands/red64/` prompts were written for Claude. Qwen3-Coder-Next has different characteristics that may warrant adjustments:

- **Non-thinking mode:** Qwen3-Coder-Next doesn't do chain-of-thought. If any Red64 prompts rely on Claude's extended thinking, they may need restructuring.
- **Tool calling fidelity:** Test whether Qwen3-Coder-Next handles Claude Code's tool schemas (file edit, shell exec, search) with the same reliability. If certain tools fail, prompts may need to guide the model more explicitly.
- **Context budget:** Local deployment often runs with 32K-64K context (vs Claude's 200K). Red64's multi-phase SDLC generates substantial context. May need to add context-clearing guidance between phases.
- **Sampling:** Qwen3-Coder-Next recommends `temperature=1.0, top_p=0.95, top_k=40`. Claude Code may have its own defaults that override. Investigate whether Red64 can pass sampling params.

**Deliverable:** A `CLAUDE.md` appendix or model-specific steering section:

```markdown
## Model-Specific Guidance (Qwen3-Coder-Next)
- Be explicit and instruction-dense in your reasoning
- When executing multi-step tasks, verify each step before proceeding
- Prefer smaller, focused file edits over large rewrites
- Clear context between implementation tasks for best results
```

#### 2.4 Documentation

Update Red64's README with a new section:

```markdown
## Run Locally with Open Source Models

Red64 works with open-source models via Claude Code's custom backend support.

### Qwen3-Coder-Next (Recommended for Local)
80B model, 3B active params. Runs on a 64GB MacBook or single GPU.

\`\`\`bash
# One-time setup
ollama pull qwen3-coder-next

# Initialize project
red64 init --agent claude --model qwen3-coder-next

# Start building
red64 start "add user authentication" --sandbox -y
\`\`\`

No API costs. No cloud. Full SDLC enforcement.
```

---

### Phase 3: Qwen Code CLI Support (Month 2+, Lower Priority)

#### 3.1 Why Lower Priority

- Claude Code is proven with Red64's SDLC commands
- Qwen Code is newer, less battle-tested
- The Claude agent commands are the most refined
- Users who want Qwen3-Coder-Next can already use it via Claude Code

#### 3.2 When It Makes Sense

- When users want a **fully open-source stack** (no Claude Code dependency at all)
- When Qwen Code's Qwen3-Coder-specific parser gives materially better results
- If Qwen Code gains features that Claude Code lacks

#### 3.3 Command Format Compatibility

Your instinct is right to question the source. Let's compare:

**Claude Code commands** (`.claude/commands/red64/*.md`):

```markdown
# Command prompt content
Read `.red64/specs/$1/spec.json`...
Use $ARGUMENTS for the feature description.
```

**Qwen Code commands** (`.qwen/commands/*.md`):

```markdown
---
description: Optional description
---

Prompt content here.
Use {{args}} for parameters.
Use @{path/to/file} for file injection.
```

**Key differences:**

| Feature | Claude Code | Qwen Code |
|---------|------------|-----------|
| File format | Markdown | Markdown with YAML frontmatter |
| Parameters | `$ARGUMENTS`, `$1`, `$2` | `{{args}}` |
| File injection | Agent reads files on its own | `@{path}` syntax |
| Directory | `.claude/commands/` | `.qwen/commands/` |
| Description | In filename or comment | YAML `description:` field |

**Recommendation: Start from Claude's markdown files**, not Gemini's TOML. The conversion is:

1. Add YAML frontmatter (`---\ndescription: ...\n---`)
2. Replace `$ARGUMENTS` → `{{args}}`
3. Replace `$1`, `$2` → parse from `{{args}}` (or use Qwen Code's argument handling)
4. Optionally add `@{.red64/steering/*.md}` for explicit file injection

The Claude commands are more mature and have been tested across 6 products. The TOML format is specific to Gemini CLI and would require more structural changes.

---

### Phase 4: Extended Roadmap

#### 4.1 `red64 serve` — Local Model Lifecycle (Month 2-3)

```bash
red64 serve qwen3-coder-next          # Pulls + starts Ollama
red64 serve qwen3-coder-next --vllm   # Spins up vLLM Docker with correct flags
red64 serve --stop                     # Tears down
```

Abstracts `--tool-call-parser qwen3_coder`, `--enable-auto-tool-choice`, tensor parallelism, and context length tuning.

#### 4.2 Generic Model Backend (Month 3)

```bash
red64 init --agent claude --model custom \
  --base-url http://localhost:8000/v1 \
  --model-name "my-finetuned-model"
```

Unlocks any OpenAI-compatible endpoint: DeepSeek, Fireworks, Together AI, self-hosted vLLM.

#### 4.3 Context Window Adaptation (Month 3-4)

Detect model's effective context window and adapt SDLC phases:
- Summarize earlier phases before feeding into later ones
- Split large implementations into context-appropriate chunks
- Auto-clear between tasks when context is limited

---

## 4. Risk Assessment

### Phase 1 Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Claude Code tool calling works differently with Qwen backend | Medium | Test the full SDLC flow end-to-end before publishing. Focus on `spec-impl` which is the most tool-heavy phase. |
| Ollama's Claude Code compatibility has edge cases | Medium | The community has documented this working. Pin to known-good Ollama version in docs. |
| 32K context limit on local models breaks multi-phase flows | Medium | Add "clear context between tasks" as explicit guidance. Red64 already recommends this in prompts. |
| Sandbox mode can't reach host Ollama | Low | Well-understood Docker networking problem. Document `host.docker.internal` solution. |

### Known Limitations to Document

- **Speed:** Qwen3-Coder-Next on consumer hardware is slower than Claude API (~10-30 tok/s vs instant). Set expectations.
- **Quality:** While benchmarks are competitive, real-world SDLC tasks may have gaps vs Claude Sonnet. Be honest about this.
- **Context:** 32K-64K practical context on consumer hardware vs 200K with Claude API. Multi-phase workflows may need adaptation.

---

## 5. Article Outline: "Red64 + Qwen3-Coder-Next: Zero-Cost SDLC on Your MacBook"

### Hook
"What if you could run a production-grade SDLC — requirements, design, TDD, atomic commits, documentation — entirely on your laptop, with zero API costs?"

### Structure
1. **The Problem:** AI tools write code fast but create debt faster (the iteration wall)
2. **Why Red64 Exists:** SDLC processes that make AI code maintainable
3. **The Missing Piece:** Until now, Red64 required paid API access ($20-200/mo)
4. **Enter Qwen3-Coder-Next:** 80B MoE model, 3B active params, runs on a 64GB MacBook
5. **Setup (5 minutes):**
   ```bash
   ollama pull qwen3-coder-next
   red64 init --agent claude --model qwen3-coder-next
   red64 start "add user authentication" --sandbox -y
   ```
6. **Demo:** Walk through a feature going init → requirements → design → tasks → TDD impl
7. **Honest Take:** Where it works great, where Claude is still better, and why the process layer matters more than the model
8. **The Bigger Picture:** Model-agnostic SDLC means no vendor lock-in, ever

### Key Message
The process is the product, not the model. Red64 makes AI-generated code maintainable. Qwen3-Coder-Next makes Red64 free. Together they eliminate the two biggest barriers to AI-first development: **quality** (iteration wall) and **cost** (API subscriptions).

### Target Channels
- **Hacker News:** "Show HN: Red64 — SDLC-enforced AI coding, now runs locally for free with Qwen3-Coder-Next"
- **Reddit r/ClaudeCode:** "Run Red64's full SDLC pipeline with Claude Code + Qwen3-Coder-Next on your MacBook"
- **Twitter/X:** 60s demo video of the full flow running locally
- **LinkedIn:** Enterprise data privacy angle — SDLC + open source + local deployment

---

## 6. Summary: What Ships When

| Phase | What | Effort | Value |
|-------|------|--------|-------|
| **1 (now)** | `--model` flag → Claude Code + Qwen3-Coder-Next | 1 hour | Article-ready, $0 SDLC |
| **2.1** | Model presets (`qwen-local`, `qwen-cloud`) | 2-3 days | Better DX |
| **2.2** | Health check + setup guidance on start | 2-3 days | Fewer support issues |
| **2.3** | Qwen-optimized prompt tuning | 1-2 weeks | Better output quality |
| **2.4** | README + docs update | 1 day | Discoverability |
| **3** | Qwen Code CLI agent (from Claude md files) | 2-4 weeks | Full open-source stack |
| **4.1** | `red64 serve` model lifecycle | Month 2-3 | One-command setup |
| **4.2** | Generic model backend | Month 3 | Any model, any provider |
| **4.3** | Context window adaptation | Month 3-4 | Reliability on limited HW |
