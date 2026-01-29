# Project Structure

## Organization Philosophy

Standard Rails conventions with domain-driven extensions. MVC architecture as foundation, with service objects and query objects added as complexity grows.

---

## Directory Patterns

### Application Core (`app/`)
**Purpose**: All application code following Rails conventions
**Pattern**: Convention over configuration - file location implies behavior

| Directory | Purpose | Naming |
|-----------|---------|--------|
| `models/` | ActiveRecord models, data + associations | Singular, PascalCase (`Project`, `Source`) |
| `controllers/` | Request handling, thin actions | Plural + Controller (`ProjectsController`) |
| `views/` | ERB templates, Turbo Streams | Mirrors controller structure |
| `jobs/` | Background jobs (Solid Queue) | Descriptive + Job (`CollectContentJob`) |
| `mailers/` | Email delivery | Descriptive + Mailer (`NotificationMailer`) |
| `helpers/` | View helpers | Mirrors controller (`ProjectsHelper`) |

### JavaScript (`app/javascript/`)
**Purpose**: Stimulus controllers and application JavaScript
**Pattern**: Importmap-based ESM, no bundler

```
app/javascript/
  application.js          # Entry point, Turbo/Stimulus setup
  controllers/
    application.js        # Stimulus application config
    index.js              # Controller registration
    *_controller.js       # Individual Stimulus controllers
```

### Extensible Patterns (Add as Needed)

**Services** (`app/services/`)
- Complex business logic spanning multiple models
- External service integrations (AI providers, Postiz)
- Named by action: `ContentGenerator`, `SourceCollector`, `IdeaAnalyzer`

**Queries** (`app/queries/`)
- Complex database queries beyond simple scopes
- Named by domain: `PublishedContentQuery`, `UserSourcesQuery`

---

## Naming Conventions

### Ruby
- **Models**: Singular, PascalCase (`Project`, `ContentVersion`)
- **Controllers**: Plural, PascalCase + Controller (`SourcesController`)
- **Tables**: Plural, snake_case (`projects`, `content_versions`)
- **Jobs**: Descriptive + Job (`GenerateIdeasJob`)
- **Services**: Action-oriented (`WorkflowExecutor`, `SourceImporter`)

### JavaScript
- **Stimulus Controllers**: kebab-case + `_controller.js` (`content-editor_controller.js`)
- **Controller names in HTML**: kebab-case (`data-controller="content-editor"`)

### Files
- **Ruby**: snake_case (`project_workflow.rb`)
- **Views**: snake_case, match action (`show.html.erb`, `_form.html.erb`)
- **Partials**: Prefixed with underscore (`_project_card.html.erb`)

---

## Import Organization

### Ruby
```ruby
# Rails auto-loading handles most requires
# Explicit requires only for non-autoloaded code

# Service usage pattern
ContentGenerator.new(project: @project).call
```

### JavaScript (Importmap)
```javascript
// Pinned dependencies from importmap.rb
import "@hotwired/turbo-rails"
import "controllers"

// Relative imports within app/javascript/
import { Controller } from "@hotwired/stimulus"
```

---

## Database Organization

Separate SQLite databases for specialized concerns:

| Database | Purpose | Schema |
|----------|---------|--------|
| Primary | Application data | `db/schema.rb` |
| Queue | Solid Queue jobs | `db/queue_schema.rb` |
| Cache | Solid Cache entries | `db/cache_schema.rb` |
| Cable | Action Cable messages | `db/cable_schema.rb` |

---

## Configuration Patterns

### Environment-Specific (`config/environments/`)
- Development, test, production configurations
- Inherit from `config/application.rb`

### Initializers (`config/initializers/`)
- Third-party library setup
- Application-wide configuration
- Named by concern (`cors.rb`, `ai_client.rb`)

### Credentials
- `config/credentials.yml.enc` for secrets
- Access via `Rails.application.credentials.dig(:key, :subkey)`
- Edit with `bin/rails credentials:edit`

---

## Test Organization (`test/`)

```
test/
  models/           # Model unit tests
  controllers/      # Controller tests
  system/           # Browser-based system tests
  integration/      # Request/response tests
  fixtures/         # Test data (YAML)
  test_helper.rb    # Common test setup
```

**Pattern**: Mirror `app/` structure in `test/`

---

_Document patterns, not file trees. New files following patterns should not require updates._
