# Rails 8 Best Practices and Anti-Patterns

Project memory for Rails 8 development patterns, common pitfalls, and modern conventions.

---

## Rails 8 Specific Features

### Solid Stack (Database-Backed Infrastructure)

Rails 8 replaces Redis dependencies with database-backed adapters:

```ruby
# config/application.rb - Production configuration
config.active_job.queue_adapter = :solid_queue
config.cache_store = :solid_cache_store
config.action_cable.adapter = :solid_cable
```

**Best Practice**: Use Solid Stack for simpler operations (no Redis dependency).

**Anti-Pattern**: Adding Redis for simple queue/cache needs when Solid Stack suffices.

### Modern Browser Enforcement

```ruby
# ApplicationController - Rails 8.1 default
allow_browser versions: :modern
```

**Best Practice**: Keep this default; it gracefully handles legacy browser warnings.

**Anti-Pattern**: Removing this and manually checking browser capabilities.

### Importmap-Based JavaScript

```ruby
# config/importmap.rb - ESM imports without bundler
pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
```

**Best Practice**: Use importmaps for application JS; avoid bundlers unless necessary.

**Anti-Pattern**: Adding Webpack/esbuild for simple JS needs that importmaps handle.

---

## Hotwire Best Practices

### Turbo Frames

Use Turbo Frames for partial page updates without custom JavaScript:

```erb
<%# Best Practice: Scoped updates %>
<%= turbo_frame_tag "sources" do %>
  <%= render @sources %>
<% end %>
```

**Anti-Pattern**: Using JavaScript fetch() for simple HTML replacements.

### Turbo Streams

Use for real-time broadcasts from models:

```ruby
# Model callback pattern (as seen in Source model)
class Source < ApplicationRecord
  include Turbo::Broadcastable

  after_update_commit :broadcast_status_change, if: :saved_change_to_status?

  private

  def broadcast_status_change
    broadcast_replace_later_to(
      project,
      target: dom_target,
      partial: "sources/source",
      locals: { source: self }
    )
  end
end
```

**Best Practice**: Use `broadcast_replace_later_to` for async broadcasts from jobs.

**Anti-Pattern**: Synchronous broadcasts in model callbacks (blocks request).

### Stimulus Controllers

```javascript
// Best Practice: Minimal, focused controllers
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["indicator"]

  connect() {
    // Clean setup with bound handlers
    this.handleLoad = this.handleLoad.bind(this)
    this.element.addEventListener("turbo:frame-load", this.handleLoad)
  }

  disconnect() {
    // Always clean up listeners
    this.element.removeEventListener("turbo:frame-load", this.handleLoad)
  }
}
```

**Anti-Pattern**: Large Stimulus controllers doing too much (split into multiple).

**Anti-Pattern**: Not cleaning up event listeners in `disconnect()`.

---

## Controller Patterns

### RESTful Design

```ruby
# Best Practice: Standard REST actions with respond_to
def create
  @source = @project.sources.build(source_params)

  respond_to do |format|
    if @source.save
      format.html { redirect_to @source, notice: "Created." }
      format.turbo_stream
    else
      format.html { render :new, status: :unprocessable_entity }
      format.turbo_stream { render :form_update, status: :unprocessable_entity }
    end
  end
end
```

**Anti-Pattern**: Custom action names when REST actions work (avoid `do_create`, `process_form`).

### Strong Parameters

```ruby
# Best Practice: Separate params for create vs update when needed
def source_params
  params.require(:source).permit(:url, :title, :notes)
end

def update_params
  # URL is immutable after creation
  params.require(:source).permit(:title, :notes)
end
```

**Anti-Pattern**: Permitting `.permit!` or overly broad parameters.

### Scoped Queries Through Current User

```ruby
# Best Practice: Always scope through authenticated user
def set_source
  @source = Source.joins(:project)
                  .where(projects: { user_id: Current.user.id })
                  .find(params[:id])
end
```

**Anti-Pattern**: `Source.find(params[:id])` without user scoping (authorization bypass).

### Global Exception Handling

```ruby
# Best Practice: Centralized error handling with format awareness
class ApplicationController < ActionController::Base
  rescue_from ActiveRecord::RecordNotFound do |exception|
    respond_to do |format|
      format.html { render file: Rails.public_path.join("404.html"), status: :not_found }
      format.turbo_stream { head :not_found }
      format.json { render json: { error: "Not found" }, status: :not_found }
    end
  end
end
```

**Anti-Pattern**: Handling exceptions in every controller action.

---

## Model Patterns

### Organization Structure

```ruby
class Source < ApplicationRecord
  # 1. Includes
  include Turbo::Broadcastable

  # 2. Associations
  belongs_to :project
  has_many :ideas, through: :idea_sources

  # 3. Enums
  enum :status, { pending: 0, collecting: 1, collected: 2, failed: 3 }

  # 4. Validations
  validates :url, presence: true

  # 5. Scopes
  scope :pending_processing, -> { where(processing_status: :pending) }

  # 6. Callbacks (use sparingly)
  after_create_commit :enqueue_processing, if: :should_process?

  # 7. Public instance methods
  def needs_processing?
    processing_pending? || processing_failed?
  end

  private

  # 8. Private methods
  def enqueue_processing
    ProcessingJob.perform_later(id)
  end
end
```

### Enum Best Practices

```ruby
# Best Practice: Use symbol keys, add prefix for conflicts
enum :status, { pending: 0, failed: 3 }
enum :processing_status, { pending: "pending", failed: "failed" }, prefix: :processing

# Usage: source.pending? vs source.processing_pending?
```

**Anti-Pattern**: String-based enums without prefix when names conflict.

### Scopes Over Query Methods

```ruby
# Best Practice: Chainable scopes
scope :from_feed, ->(feed) { where(feed: feed) }
scope :with_full_metadata, -> { where.not(title: [nil, ""]).where.not(description: [nil, ""]) }

# Usage: Source.from_feed(feed).with_full_metadata.collected
```

**Anti-Pattern**: Class methods that return single records or non-chainable results.

### Callback Discipline

```ruby
# Best Practice: Callbacks for model-internal concerns only
after_create_commit :enqueue_job, if: :should_enqueue?  # Acceptable
before_validation :normalize_url, on: :create           # Acceptable

# Anti-Pattern: Business logic in callbacks
after_save :send_notification_email    # Move to service/controller
after_save :update_related_records     # Use transactions in service
```

---

## Background Job Patterns

### Job Structure

```ruby
class CollectContentJob < ApplicationJob
  queue_as :default

  # Retry transient errors with backoff
  retry_on ApiClient::ApiError,
           wait: :polynomially_longer,
           attempts: 3 do |job, error|
    job.send(:mark_failed, error)
  end

  # Discard non-retryable errors
  discard_on ApiClient::ConfigurationError do |job, error|
    job.send(:mark_failed, error)
  end

  discard_on ActiveRecord::RecordNotFound

  def perform(source_id)
    source = Source.find_by(id: source_id)
    return if source.nil?  # Deleted while queued

    # Job logic here
  end

  private

  def mark_failed(error)
    # Handle failure state
  end
end
```

**Best Practice**: Use `find_by` + nil check for records that might be deleted.

**Anti-Pattern**: Using `find` without handling `RecordNotFound` in jobs.

### Rate Limit Handling

```ruby
# Best Practice: Extract wait time from rate limit errors
retry_on ApiClient::RateLimitError,
         wait: ->(executions, exception) { exception.retry_after || (executions**4) + 2 },
         attempts: 3
```

---

## Service Object Patterns

### Result Objects

```ruby
# Best Practice: Explicit result types
class ContentCollectionService
  class Result
    attr_reader :job_id, :error_type, :error_message

    def success? = @success
    def error? = !@success

    def self.success(job_id:)
      new(success: true, job_id: job_id)
    end

    def self.error(type:, message:)
      new(success: false, error_type: type, error_message: message)
    end
  end
end
```

**Anti-Pattern**: Returning `true`/`false` or raising exceptions for expected failures.

### Error Hierarchy

```ruby
# Best Practice: Domain-specific error classes
class LlmService
  class Error < StandardError; end
  class ConfigurationError < Error; end
  class AuthenticationError < Error; end
  class RateLimitError < Error; end

  def call
    # Map external errors to domain errors
  rescue ExternalLib::UnauthorizedError => e
    raise AuthenticationError, e.message
  end
end
```

---

## Security Practices

### Current User Pattern

```ruby
# Best Practice: Thread-safe current user via Current
class Current < ActiveSupport::CurrentAttributes
  attribute :user, :session
end

# Set in controller
Current.user = user_from_session
```

### Credential Sanitization

```ruby
# Best Practice: Sanitize error messages
def log_error_safely(message)
  sanitized = message.gsub(/[a-zA-Z0-9_-]{20,}/, "[FILTERED]")
  Rails.logger.error(sanitized)
end
```

**Anti-Pattern**: Logging raw API responses that may contain keys.

### Input Validation

```ruby
# Best Practice: Validate URLs explicitly
validates :url, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]) }
validates :image_url, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]), allow_blank: true }
```

---

## Performance Anti-Patterns

### N+1 Queries

```ruby
# Anti-Pattern
@sources.each { |s| s.project.name }

# Best Practice
@sources = Source.includes(:project)
```

### Unbounded Queries

```ruby
# Anti-Pattern
Source.all.each { |s| process(s) }

# Best Practice
Source.find_each(batch_size: 100) { |s| process(s) }
```

### Missing Indexes

```ruby
# Best Practice: Index foreign keys and common query columns
add_index :sources, [:project_id, :status]
add_index :sources, [:feed_id, :created_at]
```

---

## Testing Anti-Patterns

### Testing Implementation Instead of Behavior

```ruby
# Anti-Pattern
test "calls the right method" do
  expect(service).to receive(:internal_method)
  service.call
end

# Best Practice
test "returns success when valid" do
  result = service.call
  assert result.success?
end
```

### Missing HTTP Stubs

```ruby
# Best Practice: Stub external requests in setup
setup do
  stub_request(:head, /example\.com/).to_return(status: 200)
end
```

---

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Forgetting `status: :unprocessable_entity` on render | Always include for form errors |
| Using `find` in jobs for deletable records | Use `find_by` with nil check |
| Inline Turbo Stream logic | Create `.turbo_stream.erb` views |
| Synchronous broadcasts in callbacks | Use `broadcast_*_later_to` |
| Raw SQL with user input | Use parameterized queries or scopes |
| Large service objects | Split by responsibility |
| Callbacks for business logic | Move to services |

---

## Quick Reference

```bash
# Development commands
bin/rails server
bin/rails console
bin/rails test
bin/rails test:system

# Code quality
bundle exec rubocop
bundle exec brakeman

# Database
bin/rails db:migrate
bin/rails db:seed
```

---

_Focus on Rails 8 conventions and modern patterns. See `rails.md` for additional conventions._
