# Publishing red64-cli to npm

## Prerequisites

- Node.js >= 20.0.0
- npm account (`npm login`)

## Publish

```bash
npm run build
npm publish --access public
```

## User Installation

```bash
# Global install
npm install -g red64-cli
red64 init

# Or one-off with npx
npx red64-cli init
```

## Subsequent Releases

```bash
npm version patch   # bug fixes
npm version minor   # new features
npm version major   # breaking changes

npm run build
npm publish
```

## CI/CD (GitHub Actions)

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Setup: Add `NPM_TOKEN` (from https://www.npmjs.com/settings/~/tokens) to GitHub repository secrets.
