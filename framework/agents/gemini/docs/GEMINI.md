# Red64 Spec-Driven Development

This project uses Red64 for AI-assisted spec-driven development with Gemini.

## Project Context

### Paths
- Steering: `.red64/steering/`
- Specs: `.red64/specs/`

### Steering vs Specification

**Steering** (`.red64/steering/`) - Guide AI with project-wide rules and context
**Specs** (`.red64/specs/`) - Formalize development process for individual features

### Active Specifications
- Check `.red64/specs/` for active specifications
- Use `spec-status [feature-name]` to check progress

## Development Guidelines
- Think in English, generate responses in English. All Markdown content written to project files (e.g., requirements.md, design.md, tasks.md, research.md, validation reports) MUST be written in the target language configured for this specification (see spec.json.language).

## Minimal Workflow
- Phase 0 (optional): `steering`, `steering-custom`
- Phase 1 (Specification):
  - `spec-init "description"`
  - `spec-requirements {feature}`
  - `validate-gap {feature}` (optional: for existing codebase)
  - `spec-design {feature}`
  - `validate-design {feature}` (optional: design review)
  - `spec-tasks {feature}`
- Phase 2 (Implementation): `spec-impl {feature} [tasks]`
  - `validate-impl {feature}` (optional: after implementation)
- Progress check: `spec-status {feature}` (use anytime)

## Development Rules
- 3-phase approval workflow: Requirements → Design → Tasks → Implementation
- Human review required each phase
- Keep steering current and verify alignment with `spec-status`
- Follow the user's instructions precisely, and within that scope act autonomously

## Steering Configuration
- Load entire `.red64/steering/` as project memory
- Default files: `product.md`, `tech.md`, `structure.md`
- Custom files are supported (managed via `steering-custom`)
