# Gap Analysis Template

---
**Purpose**: Analyze the gap between requirements and existing codebase to inform implementation strategy decisions.

**Approach**:
- Provide analysis and options, not final implementation choices
- Offer multiple viable alternatives when applicable
- Flag unknowns and constraints explicitly
- Align with existing patterns and architecture limits
---

## Executive Summary

Brief overview (3-5 bullets) covering:
- Scope of analysis
- Key findings
- Primary challenges identified
- Recommended approach

## Current State Investigation

### Domain-Related Assets

| Category | Assets Found | Location | Notes |
|----------|--------------|----------|-------|
| Key Modules | | | |
| Reusable Components | | | |
| Services/Utilities | | | |

### Architecture Patterns

- **Dominant patterns**:
- **Naming conventions**:
- **Dependency direction**:
- **Testing approach**:

### Integration Surfaces

- **Data models/schemas**:
- **API clients**:
- **Auth mechanisms**:

## Requirements Feasibility Analysis

### Technical Needs (from Requirements)

| Requirement | Technical Need | Category | Complexity |
|-------------|----------------|----------|------------|
| 1.x | | Data Model / API / UI / Logic | Simple / Moderate / Complex |

### Gap Analysis

| Requirement | Gap Type | Description | Impact |
|-------------|----------|-------------|--------|
| 1.x | Missing / Unknown / Constraint | | High / Medium / Low |

**Gap Types**:
- **Missing**: Capability does not exist in current codebase
- **Unknown**: Requires further research to determine feasibility
- **Constraint**: Existing architecture limits implementation options

## Implementation Approach Options

### Option A: Extend Existing Components

**When to consider**: Feature fits naturally into existing structure

**Files/Modules to Extend**:
| File | Change Type | Impact Assessment |
|------|-------------|-------------------|
| | Extend / Modify | |

**Trade-offs**:
- Minimal new files, faster initial development
- Leverages existing patterns and infrastructure
- Risk of bloating existing components
- May complicate existing logic

### Option B: Create New Components

**When to consider**: Feature has distinct responsibility or existing components are already complex

**New Components Required**:
| Component | Responsibility | Integration Points |
|-----------|----------------|-------------------|
| | | |

**Trade-offs**:
- Clean separation of concerns
- Easier to test in isolation
- More files to navigate
- Requires careful interface design

### Option C: Hybrid Approach

**When to consider**: Complex features requiring both extension and new creation

**Combination Strategy**:
| Part | Approach | Rationale |
|------|----------|-----------|
| | Extend / Create | |

**Trade-offs**:
- Balanced approach for complex features
- Allows iterative refinement
- More complex planning required
- Potential for inconsistency if not well-coordinated

## Effort and Risk Assessment

### Effort Estimate

| Option | Effort | Justification |
|--------|--------|---------------|
| A | S / M / L / XL | |
| B | S / M / L / XL | |
| C | S / M / L / XL | |

**Effort Scale**:
- **S** (1-3 days): Existing patterns, minimal dependencies, straightforward integration
- **M** (3-7 days): Some new patterns/integrations, moderate complexity
- **L** (1-2 weeks): Significant functionality, multiple integrations or workflows
- **XL** (2+ weeks): Architectural changes, unfamiliar tech, broad impact

### Risk Assessment

| Option | Risk | Justification |
|--------|------|---------------|
| A | High / Medium / Low | |
| B | High / Medium / Low | |
| C | High / Medium / Low | |

**Risk Factors**:
- **High**: Unknown tech, complex integrations, architectural shifts, unclear perf/security path
- **Medium**: New patterns with guidance, manageable integrations, known perf solutions
- **Low**: Extend established patterns, familiar tech, clear scope, minimal integration

## Recommendations for Design Phase

### Preferred Approach

**Recommended Option**: [A / B / C]

**Rationale**:
-

### Key Decisions Required

1.
2.
3.

### Research Items to Carry Forward

| Item | Priority | Reason |
|------|----------|--------|
| | High / Medium / Low | |

## Out of Scope

Items explicitly deferred to design phase:
-
