# Code Quality Standards

Project memory for code quality conventions, linting, formatting, and security in JavaScript/Node.js.

---

## Philosophy

- **Automate everything**: Machines enforce style; humans review logic
- **Fail fast in CI**: Quality gates catch issues before review
- **Single source of truth**: Configuration in project root, not scattered files
- **Fast feedback**: Sub-second lint and format checks

---

## Linting with ESLint (Flat Config)

### Configuration (`eslint.config.js`)

```javascript
import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';

export default [
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-throw-literal': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'no-param-reassign': 'error',
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
    },
  },

  {
    files: ['src/**/*.js'],
    plugins: { security },
    rules: { ...security.configs.recommended.rules },
  },

  {
    files: ['tests/**/*.js', '**/*.test.js'],
    rules: { 'no-unused-vars': 'off', 'no-console': 'off' },
  },
];
```

---

## Formatting with Prettier

### Configuration (`.prettierrc`)

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

---

## Biome (Alternative to ESLint + Prettier)

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "files": { "ignore": ["dist/", "coverage/", "node_modules/"] }
}
```

**When to use Biome**: Single tool, Rust-based speed, zero-config. Ideal for new projects.

---

## Git Hooks with Husky + lint-staged

```json
{
  "lint-staged": {
    "*.js": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

---

## Code Coverage (Vitest)

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/**/index.js'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
```

---

## Security

### Dependency Auditing

```bash
pnpm audit
npm audit
```

### ESLint Security Plugin

| Rule | Catches |
|------|---------|
| `security/detect-object-injection` | Prototype pollution via dynamic keys |
| `security/detect-non-literal-regexp` | ReDoS |
| `security/detect-eval-with-expression` | Code injection via `eval()` |
| `security/detect-non-literal-fs-filename` | Path traversal attacks |

### Additional Practices

```javascript
// GOOD: Parameterized queries
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// BAD: String interpolation in queries
const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
```

---

## Quality Commands Summary

```bash
# Full quality check (CI)
npx eslint .
npx prettier --check .
npx vitest run --coverage
npm audit

# Development
npx eslint . --fix && npx prettier --write .
npx vitest run tests/unit/ --reporter=dot
```

---

_Focus on patterns over exhaustive rules. Code should be linted, formatted, tested, and audited._
