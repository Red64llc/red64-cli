# Code Quality Standards

Automated code quality tooling for Rust projects: Clippy, rustfmt, cargo-audit, Miri, and CI pipeline configuration.

---

## Philosophy

- **Automate everything**: If a tool can catch it, do not rely on humans to catch it
- **Clippy pedantic by default**: Start strict, selectively allow with justification
- **Format once, never argue**: `cargo fmt` is non-negotiable
- **Security is continuous**: Audit dependencies regularly, not just at release

---

## Clippy (Lint Everything)

### Configuration in `Cargo.toml`

```toml
[lints.clippy]
# Enable pedantic lint group
pedantic = { level = "warn", priority = -1 }

# Selectively allow specific pedantic lints that are too noisy
module_name_repetitions = "allow"
must_use_candidate = "allow"
missing_errors_doc = "allow"
missing_panics_doc = "allow"

# Deny correctness and suspicious lints
correctness = { level = "deny", priority = -1 }
suspicious = { level = "deny", priority = -1 }

# Additional useful lints
nursery = { level = "warn", priority = -1 }
```

### Clippy Lint Groups

| Group | Level | Purpose |
|---|---|---|
| `correctness` | Deny | Likely bugs (e.g., infinite loops, wrong comparisons) |
| `suspicious` | Deny | Code that is probably wrong |
| `style` | Warn | Non-idiomatic code |
| `complexity` | Warn | Unnecessarily complex code |
| `perf` | Warn | Performance anti-patterns |
| `pedantic` | Warn | Very strict, opinionated lints |
| `nursery` | Warn | Experimental but useful lints |

### Running Clippy

```bash
# Standard check (deny warnings in CI)
cargo clippy -- -D warnings

# Check all targets including tests and benchmarks
cargo clippy --all-targets --all-features -- -D warnings

# Fix auto-fixable lints
cargo clippy --fix --allow-dirty

# Check specific package in workspace
cargo clippy -p my-crate -- -D warnings
```

### Inline Lint Overrides

```rust
// GOOD: Allow with justification
#[allow(clippy::cast_possible_truncation)]
// Truncation is intentional: we only need the lower 32 bits for the hash bucket
fn bucket_index(hash: u64) -> u32 {
    hash as u32
}

// BAD: Blanket allow without justification
#[allow(clippy::all)]
fn some_function() {
    // ...
}
```

---

## Formatting with `rustfmt`

### `rustfmt.toml` Configuration

```toml
edition = "2024"
max_width = 100
tab_spaces = 4
use_field_init_shorthand = true
use_try_shorthand = true
imports_granularity = "Crate"
group_imports = "StdExternalCrate"
reorder_imports = true
```

### Running Formatter

```bash
# Format all code
cargo fmt

# Check formatting without modifying (CI)
cargo fmt -- --check

# Format a specific file
rustfmt src/main.rs
```

### Import Organization

`rustfmt` with `group_imports = "StdExternalCrate"` enforces:

```rust
// 1. Standard library
use std::collections::HashMap;
use std::sync::Arc;

// 2. External crates
use axum::extract::State;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

// 3. Local crate
use crate::errors::AppError;
use crate::models::User;
```

---

## Security Auditing

### `cargo audit`

```bash
# Install
cargo install cargo-audit

# Run audit against RustSec advisory database
cargo audit

# Generate JSON report for CI
cargo audit --json

# Fix vulnerable dependencies (interactive)
cargo audit fix
```

### `cargo deny`

Comprehensive dependency policy enforcement:

```bash
# Install
cargo install cargo-deny

# Initialize config
cargo deny init
```

### `deny.toml` Configuration

```toml
[advisories]
vulnerability = "deny"
unmaintained = "warn"
yanked = "warn"

[licenses]
unlicensed = "deny"
allow = [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "Unicode-3.0",
]

[bans]
multiple-versions = "warn"
wildcards = "deny"

[sources]
unknown-registry = "deny"
unknown-git = "deny"
allow-registry = ["https://github.com/rust-lang/crates.io-index"]
```

```bash
# Run all checks
cargo deny check

# Run specific check
cargo deny check advisories
cargo deny check licenses
cargo deny check bans
```

---

## Miri (Unsafe Code Validation)

### When to Use Miri

Use Miri for any crate that contains `unsafe` code:

```bash
# Install Miri
rustup +nightly component add miri

# Run tests under Miri
cargo +nightly miri test

# Run specific test
cargo +nightly miri test test_name

# Run with stricter checks
MIRIFLAGS="-Zmiri-strict-provenance" cargo +nightly miri test
```

### What Miri Catches

| Issue | Example |
|---|---|
| Use after free | Accessing deallocated memory |
| Out-of-bounds access | Buffer overflows |
| Invalid alignment | Misaligned pointer dereference |
| Data races | Concurrent unsynchronized access |
| Uninitialized memory | Reading uninitialized values |
| Stacked borrows violation | Aliasing rule violations |

```rust
// Miri will catch this:
#[test]
fn test_unsafe_code() {
    let mut data = vec![1, 2, 3];
    let ptr = data.as_ptr();
    data.clear();
    // Miri detects: use after free
    // unsafe { println!("{}", *ptr); }
}
```

---

## Pre-commit Checks

### Git Hook Setup

```bash
#!/bin/sh
# .git/hooks/pre-commit

set -e

echo "Running cargo fmt check..."
cargo fmt -- --check

echo "Running cargo clippy..."
cargo clippy --all-targets --all-features -- -D warnings

echo "Running cargo test..."
cargo test --quiet
```

Or use `cargo-husky` for automated hook management:

```toml
# Cargo.toml
[dev-dependencies]
cargo-husky = { version = "1", features = ["precommit-hook", "run-cargo-fmt", "run-cargo-clippy", "run-cargo-test"] }
```

---

## CI Pipeline

### Recommended CI Steps

```yaml
# Example: GitHub Actions
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      # Formatting
      - name: Check formatting
        run: cargo fmt -- --check

      # Linting
      - name: Clippy
        run: cargo clippy --all-targets --all-features -- -D warnings

      # Tests
      - name: Run tests
        run: cargo nextest run --all-features

      # Security audit
      - name: Security audit
        run: cargo audit

      # Deny check (licenses, advisories, bans)
      - name: Cargo deny
        run: cargo deny check
```

### CI Quality Gates

| Check | Command | Blocks Merge? |
|---|---|---|
| Format | `cargo fmt -- --check` | Yes |
| Lint | `cargo clippy -- -D warnings` | Yes |
| Tests | `cargo nextest run` | Yes |
| Security audit | `cargo audit` | Yes |
| License check | `cargo deny check licenses` | Yes |
| Coverage | `cargo llvm-cov --fail-under 80` | Optional |
| Doc build | `cargo doc --no-deps` | Optional |

---

## Additional Quality Tools

### `cargo-machete` (Unused Dependencies)

```bash
cargo install cargo-machete
cargo machete
```

### `cargo-bloat` (Binary Size Analysis)

```bash
cargo install cargo-bloat
cargo bloat --release
cargo bloat --release --crates  # By crate
```

### `cargo-udeps` (Unused Dependencies - Nightly)

```bash
cargo install cargo-udeps
cargo +nightly udeps
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `#[allow(clippy::all)]` | Disables all safety checks | Allow specific lints with justification |
| No `cargo fmt` in CI | Style debates in PRs | Enforce formatting in CI pipeline |
| Ignoring `cargo audit` | Known vulnerabilities in production | Run audit in CI, block on critical advisories |
| `unsafe` without Miri testing | Memory safety bugs | Test all unsafe code with Miri |
| Wildcard dependencies (`*`) | Non-reproducible builds | Pin at least major version |
| Skipping Clippy pedantic | Missing idiomatic patterns | Enable pedantic, allow specific noisy lints |

---

_Quality is not a phase; it is a continuous process. Automate checks, fail fast in CI, and treat warnings as errors._
