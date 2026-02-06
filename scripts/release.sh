#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_step() {
    echo -e "${GREEN}==>${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

print_error() {
    echo -e "${RED}Error:${NC} $1"
}

# Check if version type is provided
VERSION_TYPE=${1:-""}
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "Usage: ./scripts/release.sh <patch|minor|major>"
    echo ""
    echo "  patch  - Bug fixes (0.9.0 -> 0.9.1)"
    echo "  minor  - New features (0.9.0 -> 0.10.0)"
    echo "  major  - Breaking changes (0.9.0 -> 1.0.0)"
    exit 1
fi

# Pre-flight checks
print_step "Running pre-flight checks..."

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    print_error "Working directory is not clean. Commit or stash changes first."
    git status --short
    exit 1
fi

# Check we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    print_warning "Not on main branch (currently on: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Pull latest changes
print_step "Pulling latest changes..."
git pull origin "$CURRENT_BRANCH"

# Run tests
print_step "Running tests..."
CI=true npm run test:run

# Run type check
print_step "Running type check..."
npm run type-check

# Run build
print_step "Building project..."
npm run build

# Get current version before bump
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_step "Current version: v$CURRENT_VERSION"

# Bump version (this also creates a git tag)
print_step "Bumping $VERSION_TYPE version..."
npm version "$VERSION_TYPE" --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
print_step "New version: v$NEW_VERSION"

# Generate release notes using Claude
print_step "Generating release notes with Claude..."

# Get the last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [[ -z "$LAST_TAG" ]]; then
    print_warning "No previous tag found, using all commits"
    GIT_LOG=$(git log --oneline --no-merges | grep -v "WIP:" | grep -v "auto-commit")
else
    print_step "Getting commits since $LAST_TAG..."
    GIT_LOG=$(git log "$LAST_TAG"..HEAD --oneline --no-merges | grep -v "WIP:" | grep -v "auto-commit")
fi

if [[ -z "$GIT_LOG" ]]; then
    print_warning "No meaningful commits found since last release"
    GIT_LOG="No changes recorded"
fi

# Generate release notes with Claude
RELEASE_PROMPT="Generate release notes for version v$NEW_VERSION based on these git commits:

$GIT_LOG

Output ONLY the markdown content for RELEASE.md, nothing else. Use this format:
# Release v$NEW_VERSION

## New Features
- feature descriptions (if any)

## Bug Fixes
- bug fix descriptions (if any)

## Internal
- internal changes (if any)

Group commits logically. Skip empty sections. Be concise."

print_step "Calling Claude to generate release notes..."
RELEASE_CONTENT=$(echo "$RELEASE_PROMPT" | claude --print)

if [[ -z "$RELEASE_CONTENT" ]]; then
    print_error "Failed to generate release notes with Claude"
    exit 1
fi

# Write to RELEASE.md
echo "$RELEASE_CONTENT" > RELEASE.md
print_step "RELEASE.md updated with generated notes"

# Show generated content and ask for confirmation
echo ""
echo "--- Generated RELEASE.md ---"
cat RELEASE.md
echo "-----------------------------"
echo ""

read -p "Accept these release notes? (Y/n/e[dit]) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ee]$ ]]; then
    ${EDITOR:-vim} RELEASE.md
elif [[ $REPLY =~ ^[Nn]$ ]]; then
    print_error "Release notes rejected. Aborting."
    git checkout RELEASE.md 2>/dev/null || true
    git checkout package.json package-lock.json 2>/dev/null || true
    exit 1
fi

# Commit version bump
print_step "Committing version bump..."
git add package.json package-lock.json RELEASE.md
git commit -m "chore(release): v$NEW_VERSION"

# Create git tag
print_step "Creating git tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# Push commits and tags
print_step "Pushing to remote..."
git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"

# Create GitHub release
print_step "Creating GitHub release..."
if command -v gh &> /dev/null; then
    # Extract release notes from RELEASE.md
    RELEASE_NOTES=$(cat RELEASE.md)

    gh release create "v$NEW_VERSION" \
        --title "v$NEW_VERSION" \
        --notes "$RELEASE_NOTES"

    print_step "GitHub release created!"
else
    print_warning "GitHub CLI (gh) not installed. Create release manually at:"
    echo "  https://github.com/Red64llc/red64-cli/releases/new?tag=v$NEW_VERSION"
fi

# Optional: Publish to npm
read -p "Publish to npm? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Publishing to npm..."
    npm publish
    print_step "Published to npm!"
fi

echo ""
print_step "Release v$NEW_VERSION complete!"
