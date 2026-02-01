# Docker Image Publishing Guide

## Two Questions

1. **Where is the image hosted?** (a registry — stores the image)
2. **Where does the image run?** (a runtime — executes the image)

This guide focuses on #1 and introduces #2.

---

## Part 1: Hosting the Image (Registry)

### Recommendation: GitHub Container Registry (ghcr.io)

For an open source project on GitHub, **GHCR is the best choice**:

| Feature | GHCR | Docker Hub (Free) |
|---------|------|-------------------|
| **Cost for public images** | Free, unlimited | Free, but rate-limited pulls |
| **Anonymous pulls** | Yes | Yes (with rate limits) |
| **Pull rate limits** | None for public | 100 pulls/6hr (anonymous) |
| **Integration** | Native GitHub Actions | Separate auth setup |
| **Visibility control** | Per-image (independent of repo) | Per-image |
| **Auth in CI** | `GITHUB_TOKEN` (zero config) | Separate Docker Hub token |

**Other free registries** (less relevant for your case):
- **Docker Hub** — 1 free private repo, rate-limited pulls for public
- **GitLab Container Registry** — free, but you're not on GitLab
- **Quay.io** (Red Hat) — free for public, includes vulnerability scanning

### How to Publish to GHCR

#### 1. Manual (one-time test)

```bash
# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Build
docker build -f Dockerfile.sandbox -t ghcr.io/red64llc/red64-sandbox:latest .

# Push
docker push ghcr.io/red64llc/red64-sandbox:latest
```

#### 2. Automated via GitHub Actions (recommended)

Add to `.github/workflows/ci.yml` or create `.github/workflows/docker-publish.yml`:

```yaml
name: Publish Docker Image

on:
  push:
    tags: ['v*']  # Publish on version tags
  workflow_dispatch:  # Manual trigger

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: red64llc/red64-sandbox

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile.sandbox
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

#### 3. Make the image public

After the first push, go to:
`github.com/orgs/Red64llc/packages` → select the package → Settings → Change visibility to **Public**

#### 4. Users pull the image instead of building

```bash
# Users run this instead of docker build
docker pull ghcr.io/red64llc/red64-sandbox:latest
```

Update the README/docs accordingly once published.

---

## Part 2: Running the Image (Runtime) — Overview

The image **runs wherever a user runs `red64 start --sandbox`** — that's their local Docker daemon. No server needed for this use case.

But if you ever want to run Red64 as a **hosted service** (e.g., a web API that kicks off flows), here's the landscape:

### Free/cheap container runtime options

| Provider | Free Tier | Good For |
|----------|-----------|----------|
| **Fly.io** | 3 shared VMs, 256MB each | Small always-on services |
| **Railway** | $5/mo credit (trial) | Quick deploys, good DX |
| **Render** | Free for web services (spins down) | Simple deployments |
| **Google Cloud Run** | 2M requests/mo free | Event-driven / on-demand |
| **AWS Lambda + container** | 1M requests/mo free | Serverless, bursty workloads |

### What to think about later

- Red64 sandbox runs are **long-lived** (minutes, not milliseconds) — serverless (Lambda/Cloud Run) may not be ideal due to timeout limits
- A VM-based approach (Fly.io, Railway, a small VPS) fits better for running full flows
- You'd need to expose an API that triggers `red64 start` inside the container

This is a future concern. For now, the image runs on the user's machine.

---

## Summary: Next Steps

1. Add the GitHub Actions workflow above to auto-publish on tags
2. Make the GHCR package public after first push
3. Update README to show `docker pull` instead of `docker build` for users
4. Later: evaluate Fly.io or Railway if you want hosted execution
