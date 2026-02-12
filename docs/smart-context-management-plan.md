# Smart Context Management Plan

> Research and planning document for intelligent context window management in red64-cli orchestration layer.

## 1. Current State Analysis

**Current Strategy**: One session per sub-task
- Each `/red64:spec-impl {task}` spawns a fresh Claude CLI process
- No conversation history preserved between tasks
- Token usage tracked via `TokenUsageParser` but not used for decisions
- State persisted in `FlowState.taskProgress` and `phaseMetrics`

**Strengths**:
- Simple, predictable token usage per task
- No context saturation risk
- Each task gets focused attention

**Limitations**:
- No context reuse between related tasks
- Repetitive context injection (steering docs, specs) per task
- Misses cross-task learning opportunities

---

## 2. Model Context Window Landscape

| Model | Context Window | Notes |
|-------|----------------|-------|
| Claude Opus 4.6 | **1M tokens** (beta) | Requires `context-1m-2025-08-07` header |
| Claude Sonnet 4.5 | **1M tokens** (beta) | Same beta header required |
| Claude Sonnet 4 | **1M tokens** (beta) | Same beta header required |
| Claude Opus 4.5 | 200K tokens | Standard |
| Claude Haiku 4.5 | 200K tokens | Context-aware (budget tracking) |

**Pricing Consideration**: >200K tokens = premium rates (2x input, 1.5x output)

---

## 3. Proposed Architecture: Adaptive Session Management

### 3.1 Core Concept: Session Budget Manager

```
┌─────────────────────────────────────────────────────────────┐
│                   SESSION BUDGET MANAGER                     │
├─────────────────────────────────────────────────────────────┤
│  Context Window Size (model-dependent)                       │
│  ├── 1M models: opus-4.6, sonnet-4.5, sonnet-4              │
│  └── 200K models: opus-4.5, haiku-4.5, haiku-4              │
├─────────────────────────────────────────────────────────────┤
│  Thresholds (configurable)                                   │
│  ├── SOFT_LIMIT: 70% of context window (trigger compaction) │
│  ├── HARD_LIMIT: 85% of context window (force new session)  │
│  └── OPTIMAL_ZONE: 30-60% (ideal operating range)           │
├─────────────────────────────────────────────────────────────┤
│  Strategies                                                  │
│  ├── MULTI_TASK: Batch related tasks in single session      │
│  ├── COMPACTION: Summarize when approaching soft limit      │
│  └── FRESH_SESSION: Reset when hard limit reached           │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Decision Matrix: When to Reuse vs Reset

```
Context State          │ 1M Window Model      │ 200K Window Model
───────────────────────┼──────────────────────┼──────────────────
< 30% used             │ Continue (batch)     │ Continue (batch)
30-60% used            │ Continue (optimal)   │ Continue (optimal)
60-70% used            │ Continue (monitor)   │ Consider compaction
70-85% used            │ Trigger compaction   │ Force compaction
> 85% used             │ Compaction or reset  │ Force new session
───────────────────────┼──────────────────────┼──────────────────
Cross-task dependency? │ Prefer reuse         │ Prefer reuse
Task group boundary?   │ Consider reset       │ Force reset
```

---

## 4. Implementation Components

### 4.1 ContextBudgetService (New)

**Responsibilities**:
- Track cumulative token usage within a session
- Calculate remaining context capacity
- Recommend session strategy (continue/compact/reset)
- Integrate with TokenUsageParser output

**Key Interface**:
```typescript
interface ContextBudgetService {
  // Configuration
  setModelContextWindow(model: string, tokens: number): void;
  setThresholds(soft: number, hard: number): void;

  // Tracking
  recordUsage(taskId: string, usage: TokenUsage): void;
  getCurrentUsage(): number;
  getRemainingBudget(): number;

  // Decision Support
  canFitTask(estimatedTokens: number): boolean;
  shouldCompact(): boolean;
  shouldReset(): boolean;
  getRecommendation(): 'continue' | 'compact' | 'reset';
}
```

### 4.2 SessionManager (Enhanced)

**New Capabilities**:
- Maintain persistent session state (for multi-task batching)
- Support Claude Messages API directly (not just CLI subprocess)
- Enable compaction API integration
- Track session history for context reuse

**Key Interface Enhancement**:
```typescript
interface SessionManager {
  // Session lifecycle
  createSession(model: string, options: SessionOptions): Session;
  continueSession(sessionId: string, task: Task): Promise<TaskResult>;
  compactSession(sessionId: string): Promise<void>;
  resetSession(sessionId: string): void;

  // Multi-task support
  batchTasks(sessionId: string, tasks: Task[]): Promise<TaskResult[]>;

  // Context state
  getSessionContext(sessionId: string): SessionContext;
}
```

### 4.3 Model-Aware Configuration

```typescript
const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'claude-opus-4-6': {
    contextWindow: 1_000_000,
    supportsCompaction: true,  // beta API
    supports1MContext: true,
    betaHeaders: ['context-1m-2025-08-07', 'compact-2026-01-12'],
    premiumThreshold: 200_000,  // 2x pricing above this
  },
  'claude-sonnet-4-5-20250929': {
    contextWindow: 1_000_000,
    supportsCompaction: false,  // not yet
    supports1MContext: true,
    contextAware: true,  // receives budget updates
    betaHeaders: ['context-1m-2025-08-07'],
    premiumThreshold: 200_000,
  },
  'claude-opus-4-5-20251101': {
    contextWindow: 200_000,
    supportsCompaction: false,
    supports1MContext: false,
    betaHeaders: [],
    premiumThreshold: 200_000,
  },
  // ... other models
};
```

---

## 5. Orchestration Strategy Changes

### 5.1 Current Flow (Per-Task Sessions)

```
Task 1 → New Session → Execute → End Session
Task 2 → New Session → Execute → End Session
Task 3 → New Session → Execute → End Session
```

### 5.2 Proposed Flow (Adaptive Batching)

```
┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATOR DECISION LOOP                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  for each task in pendingTasks:                             │
│    │                                                        │
│    ├── IF no active session:                                │
│    │     CREATE session with model config                   │
│    │     INJECT base context (steering, specs, tools)       │
│    │                                                        │
│    ├── ESTIMATE task token cost (heuristic + history)       │
│    │                                                        │
│    ├── IF budget.canFitTask(estimate):                      │
│    │     CONTINUE session with task                         │
│    │     RECORD actual usage                                │
│    │                                                        │
│    ├── ELSE IF budget.shouldCompact() AND model.supports:   │
│    │     TRIGGER compaction API                             │
│    │     CONTINUE session with task                         │
│    │                                                        │
│    ├── ELSE:                                                │
│    │     PERSIST session state (notes, progress)            │
│    │     CREATE new session                                 │
│    │     INJECT compacted context + base context            │
│    │     CONTINUE with task                                 │
│    │                                                        │
│    └── ON task group boundary:                              │
│          CONSIDER proactive session reset                   │
│          (clean slate for unrelated task group)             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Task Batching Heuristics

**Batch together** (same session):
- Tasks in the same group (e.g., 1.1, 1.2, 1.3)
- Tasks with shared file dependencies
- Sequential implementation steps
- Tasks under 50K estimated tokens total

**Start new session**:
- New task group (e.g., moving from group 1 to group 2)
- Major architectural shift in task scope
- Context budget approaching hard limit
- After validation/PR phases

---

## 6. Compaction Integration

### 6.1 Server-Side Compaction (API-based)

For direct API calls (if moving beyond CLI subprocess):

```typescript
async function invokeWithCompaction(
  messages: Message[],
  options: InvokeOptions
): Promise<Response> {
  return client.beta.messages.create({
    betas: ['compact-2026-01-12'],
    model: 'claude-opus-4-6',
    max_tokens: options.maxTokens,
    messages,
    context_management: {
      edits: [{
        type: 'compact_20260112',
        trigger: { type: 'input_tokens', value: 150_000 },
        pause_after_compaction: true,  // for custom handling
        instructions: `Summarize for spec-driven development:
- Current task: ${options.currentTask}
- Completed: ${options.completedTasks.join(', ')}
- Key decisions and code changes made
- Files modified and their purposes
- Critical context for remaining tasks`
      }]
    }
  });
}
```

### 6.2 Client-Side Compaction (CLI-compatible)

Since AgentInvoker uses CLI subprocess, implement orchestrator-controlled compaction:

```typescript
async function compactSessionContext(
  session: Session,
  completedTasks: TaskEntry[]
): Promise<CompactedContext> {
  // Build compaction prompt
  const prompt = buildCompactionPrompt(session.history, completedTasks);

  // Invoke Claude to generate summary (separate, cheap call)
  const summary = await invokeForSummary(prompt, 'claude-haiku-4-5');

  return {
    summary,
    preservedArtifacts: extractCriticalArtifacts(session),
    taskProgress: completedTasks.map(t => t.id),
    timestamp: Date.now()
  };
}
```

---

## 7. Context Editing Integration

For agentic workflows with heavy tool use:

```typescript
const CONTEXT_EDITING_CONFIG = {
  // Clear old tool results when approaching limits
  toolResultClearing: {
    type: 'clear_tool_uses_20250919',
    trigger: { type: 'input_tokens', value: 100_000 },
    keep: { type: 'tool_uses', value: 10 },  // keep last 10
    exclude_tools: ['memory', 'steering'],   // never clear these
  },

  // Manage thinking blocks (for extended thinking)
  thinkingClearing: {
    type: 'clear_thinking_20251015',
    keep: { type: 'thinking_turns', value: 3 },  // keep last 3 turns
  }
};
```

---

## 8. Token Estimation Heuristics

Build predictive model from historical data:

```typescript
interface TaskTokenEstimator {
  // Learn from completed tasks
  recordActualUsage(task: Task, usage: TokenUsage): void;

  // Estimate for pending tasks
  estimateTokens(task: Task): TokenEstimate;
}

// Estimation factors:
// - Base context size (steering + spec docs)
// - Task description length
// - Historical average for similar task types
// - File count mentioned in task
// - UI mode indicator (UI tasks tend to be larger)
```

---

## 9. Cost Optimization Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ COST OPTIMIZATION RULES                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 1. STAY UNDER 200K when possible (avoid premium pricing)    │
│    └── Proactively compact/reset before crossing            │
│                                                              │
│ 2. USE PROMPT CACHING                                        │
│    ├── Cache system prompts (steering, spec docs)           │
│    ├── Cache compaction summaries                           │
│    └── Add cache_control breakpoints strategically          │
│                                                              │
│ 3. MODEL SELECTION                                           │
│    ├── Opus 4.6: Complex tasks, long sessions               │
│    ├── Sonnet 4.5: Standard tasks, good balance             │
│    └── Haiku 4.5: Compaction summaries, simple tasks        │
│                                                              │
│ 4. BATCH RELATED TASKS                                       │
│    └── Amortize base context cost across multiple tasks     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Configuration Interface

User-configurable settings:

```typescript
interface ContextManagementConfig {
  // Strategy selection
  strategy: 'per-task' | 'adaptive' | 'aggressive-batching';

  // Thresholds (as percentage of context window)
  softLimitPercent: number;   // default: 70
  hardLimitPercent: number;   // default: 85

  // Compaction
  enableCompaction: boolean;  // default: true (if model supports)
  compactionModel: string;    // default: same model or 'claude-haiku-4-5'
  customCompactionInstructions?: string;

  // Cost optimization
  preferSubPremiumContext: boolean;  // stay under 200K
  enablePromptCaching: boolean;

  // Multi-task batching
  maxTasksPerSession: number;        // default: 5
  batchRelatedTasks: boolean;        // default: true
  resetOnTaskGroupBoundary: boolean; // default: true
}
```

---

## 11. Implementation Phases

### Phase 1: Foundation
1. Create `ContextBudgetService` with token tracking
2. Enhance `TokenUsageParser` to aggregate across tasks
3. Add model configuration registry
4. Implement session-level usage tracking in `FlowState`

### Phase 2: Adaptive Decisions
1. Implement task batching heuristics
2. Add token estimation from historical data
3. Build decision logic in orchestrator (continue/compact/reset)
4. Add configuration interface

### Phase 3: Compaction Integration
1. Implement orchestrator-controlled compaction (CLI-compatible)
2. Add compaction summaries to FlowState
3. Build context reconstruction from compacted state
4. Add custom compaction instructions per workflow type

### Phase 4: API Mode (Optional)
1. Add direct Claude API client (bypass CLI for long sessions)
2. Integrate server-side compaction API
3. Implement context editing (tool/thinking clearing)
4. Enable streaming with compaction events

### Phase 5: Optimization
1. Implement prompt caching strategy
2. Add cost tracking and reporting
3. Build token estimation ML model from historical data
4. Add session analytics dashboard

---

## 12. Key Metrics to Track

```typescript
interface ContextMetrics {
  // Per-session
  sessionId: string;
  tasksCompleted: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  compactionCount: number;
  peakContextUsage: number;

  // Per-workflow
  workflowId: string;
  sessionsCreated: number;
  averageTasksPerSession: number;
  totalCost: number;
  costSavingsFromBatching: number;

  // Efficiency
  contextUtilization: number;  // actual used vs. available
  cacheHitRate: number;
  compactionEfficiency: number;  // tokens saved vs. cost
}
```

---

## 13. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Context pollution across tasks | Reset on task group boundaries; structured context injection |
| Compaction losing critical context | Custom instructions; preserve artifacts; pauseable compaction |
| Cost spikes from 1M usage | Soft limit warnings; prefer <200K; user-configurable thresholds |
| Model-specific API changes | Abstract behind service interfaces; feature flags |
| CLI subprocess limitations | Maintain CLI path for compatibility; add API mode as enhancement |

---

## 14. References

- [Anthropic Context Windows Documentation](https://platform.claude.com/docs/en/build-with-claude/context-windows)
- [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Server-Side Compaction API](https://platform.claude.com/docs/en/build-with-claude/compaction)
- [Context Editing API](https://platform.claude.com/docs/en/build-with-claude/context-editing)

---

## Summary

The smart context management system transforms the orchestrator from a simple "one session per task" model to an adaptive system that:

1. **Monitors** context usage in real-time via enhanced token tracking
2. **Decides** intelligently when to continue, compact, or reset sessions
3. **Optimizes** for both cost (stay under 200K when possible) and capability (leverage 1M when needed)
4. **Adapts** to different model capabilities automatically
5. **Preserves** critical context through intelligent compaction

This enables efficient processing of multi-task workflows while avoiding context saturation and unnecessary API costs.
