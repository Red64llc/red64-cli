# Code Refactoring Patterns

Project memory for safe code refactoring strategies in MediaPulse.

---

## Refactoring Philosophy

Refactoring in MediaPulse follows three core principles:
1. **Safety first**: Tests pass before and after every change
2. **Small steps**: Incremental changes that can be reverted independently
3. **Preserve behavior**: Refactoring changes structure, not functionality

---

## Extraction Patterns

### Service Extraction

Extract business logic from controllers/models when it:
- Spans multiple models
- Involves external APIs
- Has complex business rules
- Needs extensive testing

**Pattern**: Controller to Service
```ruby
# Before: Fat controller action
class CollectionsController < ApplicationController
  def create
    source = @project.sources.find(params[:source_id])
    return render_error if source.collecting?

    credential = Rails.application.credentials.dig(:service, :api_key)
    return render_error("Missing credentials") if credential.blank?

    source.update!(status: :collecting)
    CollectContentJob.perform_later(source.id)
    # ...
  end
end

# After: Thin controller, extracted service
class CollectionsController < ApplicationController
  def create
    result = ContentCollectionService.new(source: @source).call

    if result.success?
      redirect_to @source, notice: "Collection started"
    else
      redirect_to @source, alert: result.error_message
    end
  end
end
```

**Key elements**:
- Service returns Result object (success/error pattern)
- Controller only handles HTTP concerns
- Business logic fully testable in isolation

### Concern Extraction

Extract shared model behavior into concerns when:
- Same logic appears in 3+ models
- Behavior is cohesive and nameable
- Logic is self-contained

**Pattern**: Model to Concern
```ruby
# Before: Duplicated broadcast logic in models
class Source < ApplicationRecord
  after_update_commit :broadcast_status_change, if: :saved_change_to_status?

  def dom_target
    "source_#{id}"
  end

  def broadcast_status_change
    broadcast_replace_later_to(project, target: dom_target, ...)
  end
end

# After: Extracted concern
# app/models/concerns/turbo_broadcastable.rb
module TurboBroadcastable
  extend ActiveSupport::Concern

  included do
    include Turbo::Broadcastable
  end

  def dom_target
    "#{model_name.singular}_#{id}"
  end
end
```

### Strategy Pattern Extraction

Use when type-based conditionals grow complex:

```ruby
# Before: Growing case statement
def process_content(source)
  case source.source_type
  when :youtube then # 50 lines
  when :web then # 40 lines
  when :twitter then # 45 lines
  end
end

# After: Strategy pattern via registry
# ExtractorRegistry.for(:youtube) => YoutubeExtractor
result = ExtractorRegistry.extract(source)
```

**Established patterns**:
- `ExtractorRegistry` maps source types to extractors
- `FeedTypeStrategy` provides type-specific configurations
- New types require only adding entry to registry + implementing class

---

## Safe Refactoring Workflow

### Step 1: Ensure Test Coverage

Before refactoring, verify tests exist:
```bash
# Check existing coverage
bin/rails test test/models/source_test.rb
bin/rails test test/services/

# Add characterization tests if missing
test "current behavior for X" do
  # Document existing behavior before changing
end
```

### Step 2: Make Small, Reversible Changes

**Good**: One concept per commit
```
commit 1: Extract Result class from service
commit 2: Move validation logic to private method
commit 3: Rename extracted method for clarity
```

**Avoid**: Large refactors that touch many files

### Step 3: Verify After Each Change

```bash
# Run related tests
bin/rails test test/services/content_collection_service_test.rb

# Run full suite before pushing
bin/rails test
bundle exec rubocop
```

---

## Dependency Injection for Testability

Services use dependency injection for external calls:

```ruby
class ContentCollectionService
  def initialize(source:, credentials_checker: nil, job_enqueuer: nil)
    @source = source
    @credentials_checker = credentials_checker || method(:default_credentials_checker)
    @job_enqueuer = job_enqueuer || method(:default_job_enqueuer)
  end
end

# In tests: inject mocks
service = ContentCollectionService.new(
  source: source,
  job_enqueuer: ->(id) { OpenStruct.new(job_id: "test-123") }
)
```

**Pattern**: Default to production behavior, override in tests.

---

## Refactoring Signals

### When to Extract

| Signal | Action |
|--------|--------|
| Controller action > 15 lines | Extract to service |
| Model > 150 lines | Consider concerns or query objects |
| Case statement > 3 branches | Consider strategy pattern |
| Same 5+ lines in multiple places | Extract to shared method/concern |
| External API call in model | Move to client class |

### When NOT to Extract

- Single-use logic that fits naturally in one place
- Simple CRUD without business rules
- Premature abstraction (wait for 3+ uses)

---

## Backward Compatibility

### API Deprecation Pattern

When changing public interfaces:

```ruby
# Step 1: Add new method, keep old
def self.config_for(feed_type, custom_rules: nil)
  # new implementation
end

# @deprecated Use config_for instead
def self.prompt_for(feed_type, custom_rules: nil)
  config_for(feed_type, custom_rules: custom_rules).prompt
end

# Step 2: Add deprecation warning (future release)
# Step 3: Remove old method (after deprecation period)
```

### Database Migration Safety

For schema changes that affect running code:

```ruby
# Safe: Add column with default
add_column :sources, :priority, :integer, default: 0

# Safe: Add index concurrently (PostgreSQL)
# For SQLite: migrations run quickly, less concern

# Risky: Rename column
# Use two-step: add new, migrate data, remove old
```

---

## Common Refactoring Targets

### Fat Models

Move to services when models handle:
- Complex state transitions
- Multi-model coordination
- External service calls

Keep in models:
- Validations and associations
- Simple scopes
- Attribute helpers

### Complex Conditionals

Replace nested conditionals with:
- Guard clauses (early returns)
- Strategy/registry patterns
- Polymorphism where appropriate

### Test Duplication

Extract to test helpers:
```ruby
# test/test_helper.rb
def stub_external_services
  stub_request(:head, /example\.com/).to_return(status: 200)
end
```

---

## Refactoring Checklist

Before starting:
- [ ] Tests pass for affected code
- [ ] Understand current behavior fully
- [ ] Plan incremental steps

During refactoring:
- [ ] One logical change per commit
- [ ] Tests pass after each step
- [ ] No behavior changes (unless intentional)

After completing:
- [ ] Full test suite passes
- [ ] RuboCop passes
- [ ] Manual smoke test of affected features

---

_Refactoring improves code structure while preserving behavior. Small, tested steps over large rewrites._
