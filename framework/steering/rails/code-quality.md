# Code Quality Standards

Project memory for code quality conventions, testing patterns, and maintainability standards in MediaPulse.

---

## Linting and Style

### RuboCop Configuration
- **Style**: `rubocop-rails-omakase` - Rails default conventions
- Configuration: `.rubocop.yml` inherits from gem
- Run: `bundle exec rubocop`

```ruby
# .rubocop.yml pattern: inherit defaults, override sparingly
inherit_gem: { rubocop-rails-omakase: rubocop.yml }

# Only add project-specific overrides when necessary
```

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Models | Singular, CamelCase | `Source`, `CollectedContent` |
| Controllers | Plural + Controller | `SourcesController` |
| Services | Action-oriented | `ContentCollectionService` |
| Jobs | Descriptive + Job | `CollectContentJob` |
| Tests | Subject + Test | `SourceTest` |

---

## Testing Patterns

### Framework
- **Minitest** (Rails default) with Capybara for system tests
- **WebMock** for HTTP stubbing
- Parallel execution: `parallelize(workers: :number_of_processors)`
- Fixtures: `test/fixtures/*.yml`

### Test Organization
Tests organized by type in `test/` directory:
- `test/models/` - Unit tests for ActiveRecord models
- `test/controllers/` - Controller action tests
- `test/services/` - Service object tests
- `test/integration/` - Multi-component workflow tests
- `test/system/` - Full browser tests (Capybara/Selenium)
- `test/helpers/` - View helper tests
- `test/views/` - View rendering tests
- `test/jobs/` - Background job tests

### Test Style Pattern
```ruby
# Pattern: Descriptive test blocks with setup and clear assertions
class SourceTest < ActiveSupport::TestCase
  setup do
    # Stub external dependencies
    stub_request(:head, /example\.com/).to_return(status: 200)
  end

  # Test naming: describe behavior, not implementation
  test "validates url presence" do
    project = Project.create!(name: "Test", user: users(:one))
    source = Source.new(project: project)

    assert_not source.valid?
    assert_includes source.errors[:url], "can't be blank"
  end

  # Pattern: Test behavior scenarios, not implementation details
  test "detects youtube.com as youtube type" do
    project = Project.create!(name: "Test", user: users(:one))
    source = Source.create!(url: "https://www.youtube.com/watch?v=abc123", project: project)

    assert source.youtube?
  end
end
```

### Service Testing Pattern
```ruby
# Pattern: Inject dependencies for testability
class ContentCollectionServiceTest < ActiveSupport::TestCase
  test "returns error when source is already collecting" do
    source = sources(:one)
    source.update!(status: :collecting)

    service = ContentCollectionService.new(source: source)
    result = service.call

    assert result.error?
    assert_equal :already_collecting, result.error_type
  end

  # Pattern: Use dependency injection for external services
  test "enqueues collection job on success" do
    job_enqueued = false
    mock_enqueuer = ->(id) { job_enqueued = true; OpenStruct.new(job_id: "test-123") }

    service = ContentCollectionService.new(
      source: source,
      skip_credential_check: true,
      job_enqueuer: mock_enqueuer
    )

    result = service.call
    assert result.success?
    assert job_enqueued
  end
end
```

---

## Code Organization

### Service Objects
Place in `app/services/` when logic:
- Spans multiple models
- Involves external APIs
- Has complex business rules
- Needs extensive testing in isolation

```ruby
# Pattern: Result objects for service outcomes
class ContentCollectionService
  class Result
    attr_reader :job_id, :error_type, :error_message

    def initialize(success:, job_id: nil, error_type: nil, error_message: nil)
      @success = success
      @job_id = job_id
      @error_type = error_type
      @error_message = error_message
      freeze
    end

    def success?
      @success
    end

    def error?
      !@success
    end

    # Factory methods for clarity
    def self.success(job_id:)
      new(success: true, job_id: job_id)
    end

    def self.error(type:, message:)
      new(success: false, error_type: type, error_message: message)
    end
  end
end
```

### Error Handling Pattern
```ruby
# Pattern: Custom error hierarchy for services
class LlmService
  class Error < StandardError; end
  class ConfigurationError < Error; end
  class AuthenticationError < Error; end
  class RateLimitError < Error; end
  class ApiError < Error; end

  # Map external errors to domain errors
  def generate_ideas(prompt:, system_prompt: nil, model: DEFAULT_MODEL)
    chat = build_chat(model: model, system_prompt: system_prompt)
    response = chat.ask(prompt)
    build_response(response)
  rescue RubyLLM::UnauthorizedError => e
    raise AuthenticationError, e.message
  rescue RubyLLM::RateLimitError => e
    raise RateLimitError, e.message
  end
end
```

### Model Patterns
```ruby
# Pattern: Lean models with clear responsibilities
class Source < ApplicationRecord
  # 1. Includes
  include Turbo::Broadcastable

  # 2. Associations
  belongs_to :project
  belongs_to :feed, optional: true
  has_many :ideas, through: :idea_sources

  # 3. Enums
  enum :source_type, { web: 0, youtube: 1, substack: 2 }
  enum :status, { pending: 0, collecting: 1, collected: 2, failed: 3 }

  # 4. Validations
  validates :url, presence: true, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]) }
  validates :url, uniqueness: { scope: [:project_id, :feed_id], case_sensitive: false }

  # 5. Scopes
  scope :from_feed, ->(feed) { where(feed: feed) }
  scope :manually_added, -> { where(feed: nil) }
  scope :search, ->(query) { where("url LIKE ? OR title LIKE ?", "%#{query}%", "%#{query}%") }

  # 6. Callbacks (use sparingly)
  before_validation :detect_source_type, on: :create

  # 7. Public instance methods
  def has_full_metadata?
    title.present? && description.present? && published_at.present?
  end

  private

  # 8. Private methods
  def detect_source_type
    # implementation
  end
end
```

---

## Security Analysis Tools

### Static Analysis
- **Brakeman**: Security vulnerability scanner
  - Run: `bundle exec brakeman`
  - Check before deployment for SQL injection, XSS, CSRF issues

- **bundler-audit**: Gem vulnerability scanning
  - Configuration: `config/bundler-audit.yml` for ignoring known issues
  - Run: `bundle audit`

### Credential Management
- Use Rails credentials: `bin/rails credentials:edit`
- Access: `Rails.application.credentials.dig(:service, :api_key)`
- Never commit unencrypted secrets
- Filter sensitive params (see `config/initializers/filter_parameter_logging.rb`)

---

## Documentation Standards

### Method Documentation
```ruby
# Pattern: Document public interfaces
# Unified service wrapping ruby_llm gem for multi-provider LLM access
#
# Usage:
#   response = LlmService.generate_ideas(prompt: "...", system_prompt: "...")
#   response.content #=> "Generated ideas..."
#
class LlmService
  # Generate ideas from source content
  #
  # @param prompt [String] Formatted prompt with source content
  # @param system_prompt [String, nil] System instructions
  # @param model [String] Model identifier (default: claude-sonnet-4-20250514)
  # @return [LlmResponse] Response with content and metadata
  # @raise [ConfigurationError] if API key not configured
  def generate_ideas(prompt:, system_prompt: nil, model: DEFAULT_MODEL)
    # implementation
  end
end
```

---

## Quality Commands

```bash
# Run all quality checks
bundle exec rubocop          # Style
bundle exec brakeman         # Security
bundle exec rake test        # Tests
bundle exec rake test:system # System tests

# Development workflow
bin/rails test               # Fast feedback
bin/rails test test/models/  # Focused testing
```

---

_Focus on patterns over exhaustive rules. Code should be readable, testable, and secure._
