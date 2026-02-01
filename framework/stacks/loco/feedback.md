# Feedback Guidelines

When reviewing or generating code for a Loco application, apply these checks.

---

## Always Check

1. **Fat models, slim controllers**: Is business logic in models, not controllers?
2. **Generator compliance**: Were new files created via `cargo loco generate`?
3. **Entity files untouched**: Are `_entities/` files unmodified?
4. **Config per environment**: Are dangerous flags disabled in production config?
5. **No `.unwrap()` in handlers**: All error paths handled with `?`?
6. **Worker isolation**: Workers self-contained with serializable args?
7. **Validation on models**: `Validatable` implemented for user-input models?
8. **View structs for responses**: Not returning raw SeaORM entities?

## Red Flags

- Direct SQL in controllers
- `dangerously_*` flags in `config/production.yaml`
- Editing files in `src/models/_entities/`
- Workers referencing controller state
- Missing `down()` in migrations
- Hardcoded configuration values
- `.unwrap()` or `.expect()` in request handlers

## Encourage

- Using generators for all scaffolding
- Domain methods on models with descriptive names
- Structured tracing with typed fields
- Snapshot testing with `insta`
- Request tests for all controller endpoints
- Tagged workers for job categorization
