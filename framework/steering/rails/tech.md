# Technology Stack

## Architecture

Server-rendered Rails application with progressive enhancement via Hotwire. Database-backed infrastructure for queues, caching, and real-time features (Solid Stack).

---

## Core Technologies

- **Language**: Ruby 3.4.7
- **Framework**: Rails 8.1 (`config.load_defaults 8.1`)
- **Runtime**: Puma web server
- **Database**: SQLite3 (development and production-ready)

---

## Key Libraries

### Frontend
- **Hotwire (Turbo + Stimulus)**: SPA-like interactivity without heavy JavaScript
- **Propshaft**: Modern asset pipeline
- **Importmap**: ESM-based JavaScript, no bundler

### Backend
- **Solid Queue**: Database-backed job processing
- **Solid Cache**: Database-backed caching
- **Solid Cable**: Database-backed Action Cable
- **Jbuilder**: JSON API responses
- **Active Storage**: File uploads with image processing

### Deployment
- **Kamal**: Docker-based deployment
- **Thruster**: HTTP caching/compression for Puma

---

## Development Standards

### Code Quality
- **RuboCop Rails Omakase**: Default Rails styling conventions
- Run: `bundle exec rubocop`

### Security
- **Brakeman**: Static security analysis (`bundle exec brakeman`)
- **bundler-audit**: Gem vulnerability scanning
- Credentials via `bin/rails credentials:edit`

### Testing
- **Minitest**: Default Rails testing framework
- **Capybara + Selenium**: System/integration tests
- Tests in `test/` directory with parallel execution

---

## Development Environment

### Required Tools
- Ruby 3.4.7 (see `.ruby-version`)
- SQLite3 2.1+
- Node.js (for asset compilation tooling)

### Common Commands
```bash
# Dev server
bin/rails server

# Console
bin/rails console

# Tests
bin/rails test
bin/rails test:system

# Database
bin/rails db:migrate
bin/rails db:seed

# Code quality
bundle exec rubocop
bundle exec brakeman
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Hotwire over SPA** | Simpler architecture, server-rendered with progressive enhancement |
| **SQLite for all** | Solid Stack enables production SQLite; simpler ops, fewer dependencies |
| **Importmap over bundler** | Native ESM support, no build step for JavaScript |
| **Solid Queue over Sidekiq** | No Redis dependency, database-backed consistency |

---

## AI Integration (Planned)

MediaPulse will integrate with AI services for:
- Content analysis and summarization
- Idea generation from source material
- Multi-platform content adaptation

Specific AI providers and patterns will be documented as implementation progresses.

---

_Document standards and patterns, not every dependency. See `rails.md` for detailed Rails conventions._
