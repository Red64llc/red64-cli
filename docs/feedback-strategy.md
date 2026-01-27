# Implementation Feedback Strategy for Red64-CLI

## Executive Summary

This report proposes a strategy for providing automated implementation feedback to sandboxed agents in red64-cli. The goal is to enable agents to self-correct during implementation through three feedback channels: **code quality**, **testing**, and **UI/GUI verification**.

**Recommendation**: Adopt a **Code-as-Tool** approach (inspired by Anthropic's MCP article) where the sandboxed agent writes and executes analysis scripts rather than calling predefined tools. Complement this with pre-installed CLI utilities for browser automation and testing.

---

## Background: Lessons from Anthropic's MCP Article

The [Anthropic engineering article](https://www.anthropic.com/engineering/code-execution-with-mcp) reveals a critical insight:

> **"Large language models excel at writing code, so developers should leverage this strength."**

Key takeaways:

| Problem with Direct Tools | Code-as-Tool Solution |
|---------------------------|----------------------|
| Tool definitions consume 150K+ tokens | Filesystem discovery reduces to ~2K tokens |
| Data passes through model multiple times | Agent processes data in execution environment |
| Rigid tool interfaces | Flexible code adapts to any situation |
| Chained tool calls add latency | Single code execution with loops/conditionals |

**Implication for Red64**: Instead of building MCP servers for each feedback type, let the sandboxed agent **write analysis scripts** that run inside the container. The agent can adapt its analysis approach based on the project's stack, existing tools, and specific requirements.

---

## Feedback Categories & Strategies

### 1. Code Quality Feedback

**Goal**: Detect code smells, pattern violations, security vulnerabilities during implementation.

#### Recommended Approach: Pre-installed Analyzers + Agent-Driven Execution

**Pre-install in Dockerfile.sandbox:**
```dockerfile
# Static analysis tools
RUN npm install -g eslint typescript @typescript-eslint/parser
RUN npm install -g @biomejs/biome  # Fast, unified linter
RUN pip3 install semgrep           # Security-focused SAST

# Optional: Language-specific
RUN npm install -g stylelint       # CSS
RUN pip3 install ruff              # Python
```

**Agent workflow:**
1. Agent detects project's existing linting setup (eslint.config.js, biome.json, etc.)
2. Agent writes a shell script to run appropriate analyzers
3. Agent parses JSON output and incorporates feedback
4. Agent fixes issues before marking task complete

**Why not MCP?**
- ESLint/Biome already have excellent CLI interfaces
- Agent can read existing project configs (adapts to project conventions)
- No token overhead from tool definitions
- Agent can combine multiple tools in single script

**Example agent-generated script:**
```bash
#!/bin/bash
# Agent writes this based on project detection
npx eslint src/ --format json > /tmp/lint-results.json
npx tsc --noEmit 2>&1 | tee /tmp/type-check.txt
semgrep --config auto --json src/ > /tmp/security-scan.json
```

---

### 2. Testing Feedback

**Goal**: Run test suites, measure coverage, verify behavior matches specs.

#### Recommended Approach: Native Test Runner Integration

**Pre-install in Dockerfile.sandbox:**
```dockerfile
# Test runners (project will have its own, but these are fallbacks)
RUN npm install -g jest vitest @vitest/coverage-v8
RUN npm install -g playwright @playwright/test
```

**Agent workflow:**
1. Agent detects project's test framework (jest.config.*, vitest.config.*, etc.)
2. Agent runs tests with coverage flags
3. Agent reads coverage report (lcov, json) to identify untested code
4. Agent writes additional tests for uncovered paths

**Coverage-driven implementation loop:**
```
┌─────────────────────────────────────────────────┐
│  1. Implement feature code                      │
│  2. Run: npm test -- --coverage --json          │
│  3. Parse coverage report                       │
│  4. If coverage < threshold:                    │
│     - Identify uncovered lines                  │
│     - Write tests for those paths               │
│     - Goto step 2                               │
│  5. Mark task complete                          │
└─────────────────────────────────────────────────┘
```

**Integration with task execution:**
The `TaskRunner` should expose test commands from `package.json` or detect them. Agent can then:
- Run `npm test` after each implementation
- Parse exit code and output
- Self-correct on failures

---

### 3. UI/GUI Capture and Analysis

**Goal**: Verify implemented UI matches design specs through visual inspection.

#### Recommended Approach: Agent-Browser CLI

[**agent-browser**](https://github.com/vercel-labs/agent-browser) is ideal for red64-cli because:

| Feature | Benefit for Red64 |
|---------|-------------------|
| CLI-based | Works seamlessly in Docker |
| AI-optimized snapshots | Accessibility tree with element refs |
| Stateless commands | Perfect for sandboxed execution |
| Screenshot capture | Visual verification |
| No scripting required | Agent issues discrete commands |

**Pre-install in Dockerfile.sandbox:**
```dockerfile
# Browser automation
RUN npm install -g agent-browser
RUN npx agent-browser install --with-deps
```

**Agent workflow for UI verification:**
```
1. Start dev server: npm run dev (background)
2. Navigate: agent-browser goto http://localhost:3000/feature
3. Capture: agent-browser screenshot --full-page /tmp/ui-capture.png
4. Snapshot: agent-browser snapshot > /tmp/accessibility-tree.json
5. Agent analyzes screenshot + accessibility tree vs. design spec
6. Agent identifies mismatches and fixes code
7. Repeat until UI matches spec
```

**Why agent-browser over Playwright MCP?**
- **Simpler**: No MCP protocol overhead
- **AI-native**: Accessibility tree designed for LLM consumption
- **Stateless**: Each command is independent (fits sandbox model)
- **Lightweight**: CLI spawning vs. persistent MCP connection

---

## Architecture Proposal

### Option A: Enhanced Sandbox (Recommended)

```
┌──────────────────────────────────────────────────────────────┐
│                    Docker Sandbox Container                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                     Claude CLI                          │ │
│  │  (writes and executes analysis scripts)                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                                │
│              ┌───────────────┼───────────────┐               │
│              ▼               ▼               ▼               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Code Quality │  │   Testing    │  │   UI Capture     │   │
│  │  - ESLint    │  │  - Jest      │  │  - agent-browser │   │
│  │  - Biome     │  │  - Vitest    │  │  - screenshots   │   │
│  │  - Semgrep   │  │  - Coverage  │  │  - a11y tree     │   │
│  │  - TSC       │  │  - Playwright│  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                              │                                │
│                              ▼                                │
│                    /workspace (mounted)                       │
└──────────────────────────────────────────────────────────────┘
```

**Pros:**
- Self-contained, reproducible environment
- Agent has full control over analysis approach
- No external dependencies during execution
- Aligns with Anthropic's "code as tool" philosophy

**Cons:**
- Larger Docker image (~2-3GB with browsers)
- Need to keep tools updated in image

---

### Option B: Hybrid (Container + External Services)

```
┌─────────────────────┐         ┌─────────────────────┐
│   Docker Sandbox    │         │  External Services  │
│  ┌───────────────┐  │  HTTP   │  ┌───────────────┐  │
│  │  Claude CLI   │──┼────────►│  │ SonarQube API │  │
│  └───────────────┘  │         │  └───────────────┘  │
│         │           │         │  ┌───────────────┐  │
│         ▼           │────────►│  │ Percy/Applitools│ │
│  ┌───────────────┐  │         │  └───────────────┘  │
│  │ Local tools   │  │         └─────────────────────┘
│  │ (jest, eslint)│  │
│  └───────────────┘  │
└─────────────────────┘
```

**Pros:**
- Leverage specialized cloud services
- Smaller container image
- Professional reports/dashboards

**Cons:**
- Network dependency
- Additional costs (SonarCloud, Percy, etc.)
- More complex configuration
- Latency for external API calls

---

### Option C: MCP-Based (Not Recommended)

Given Anthropic's findings, a pure MCP approach is **not recommended** because:
1. Tool definitions consume excessive tokens
2. STDIO MCP servers don't work well in Docker
3. Agent can achieve same results by writing code
4. More complexity for no clear benefit

---

## Implementation Roadmap

### Phase 1: Enhanced Dockerfile

**Update `Dockerfile.sandbox`:**
```dockerfile
FROM ubuntu:22.04

# ... existing setup ...

# Code quality tools
RUN npm install -g eslint typescript @biomejs/biome
RUN pip3 install semgrep

# Browser automation
RUN npm install -g agent-browser
RUN npx agent-browser install --with-deps

# Testing utilities
RUN npm install -g jest vitest @vitest/coverage-v8
```

### Phase 2: Feedback Loop Integration

**Modify `PhaseExecutor` to inject feedback instructions:**

The implementation prompt (`/red64:spec-impl`) should include:
```
After implementing each change:
1. Run project tests: npm test
2. Run linting: npm run lint (or detect and run appropriate linter)
3. Fix any failures before proceeding

For UI changes:
1. Start dev server if not running
2. Capture screenshot: agent-browser screenshot http://localhost:PORT/path
3. Compare against design spec
4. Fix visual discrepancies
```

### Phase 3: Orchestrator Validation

**Add validation gates in `StartScreen.tsx`:**

After each task implementation:
1. Orchestrator runs quality checks independently
2. If checks fail, task is NOT marked complete
3. Agent receives feedback and must retry

```typescript
interface TaskValidation {
  testsPass: boolean;
  lintingPass: boolean;
  coverageThreshold: number;
  visualDiff?: {
    screenshotPath: string;
    diffPercentage: number;
  };
}
```

### Phase 4: Visual Regression Baseline

For UI-heavy features:
1. Design spec includes reference screenshots
2. After implementation, capture actual screenshots
3. Agent compares and iterates until match
4. Store approved screenshots as baselines

---

## Tool Recommendations Summary

| Feedback Type | Recommended Tool | Alternative | Why |
|---------------|------------------|-------------|-----|
| **Linting** | Biome | ESLint | Faster, unified (lint + format) |
| **Type checking** | TSC | - | Standard for TS projects |
| **Security** | Semgrep | SonarQube | Lightweight, OWASP rules built-in |
| **Unit tests** | Project's runner | Jest/Vitest | Respect project conventions |
| **Coverage** | V8/Istanbul | - | Standard, JSON output |
| **UI capture** | agent-browser | Playwright | AI-native, CLI-based |
| **Visual diff** | BackstopJS | Percy | Open-source, self-hosted |

---

## Key Design Decisions

### 1. Agent-Driven vs. Orchestrator-Driven

**Recommendation: Agent-driven with orchestrator validation**

- Agent runs feedback tools and self-corrects (faster iteration)
- Orchestrator validates before marking complete (ensures quality)

### 2. Blocking vs. Advisory Feedback

**Recommendation: Blocking for tests, advisory for quality**

- Test failures: Block task completion
- Lint warnings: Log but allow completion
- Security issues: Block on high/critical severity

### 3. Pre-installed vs. Project Tools

**Recommendation: Prefer project tools, fallback to pre-installed**

Agent should detect and use:
- Project's eslint config over generic rules
- Project's test runner over pre-installed
- Project's existing scripts (`npm run lint`, `npm test`)

---

## Conclusion

The optimal strategy for red64-cli is:

1. **Embrace code-as-tool**: Let agents write analysis scripts rather than building MCP servers
2. **Pre-install CLI utilities**: agent-browser, Biome, Semgrep in the sandbox
3. **Respect project conventions**: Agent detects and uses existing linters/test runners
4. **Implement validation gates**: Orchestrator enforces quality before task completion
5. **Support visual verification**: agent-browser for screenshot capture + accessibility analysis

This approach is:
- **Simpler** than MCP (no protocol overhead)
- **More flexible** (agent adapts to any project)
- **Aligned with Anthropic's research** (code execution > tool calling)
- **Practical** (uses existing, well-maintained tools)

---

## Sources

- [Code Execution with MCP - Anthropic Engineering](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [agent-browser - Vercel Labs](https://github.com/vercel-labs/agent-browser)
- [SonarQube](https://www.sonarsource.com/products/sonarqube/)
- [Best Static Code Analysis Tools 2025 - Qodo](https://www.qodo.ai/blog/best-static-code-analysis-tools/)
- [Visual Testing Tools - BrowserStack](https://www.browserstack.com/guide/visual-testing-tools)
- [Top Visual Regression Testing Tools - Katalon](https://katalon.com/resources-center/blog/visual-regression-testing-tools)
- [Visual Testing Tools 2026 - testRigor](https://testrigor.com/blog/visual-testing-tools/)
