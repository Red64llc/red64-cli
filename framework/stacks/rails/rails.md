# Ruby on Rails Conventions

Project memory for Rails 8.1 patterns and conventions in MediaPulse.

---

## Framework Stack

### Core Technologies
- **Rails 8.1** with `config.load_defaults 8.1`
- **Hotwire**: Turbo + Stimulus for reactive UI without heavy JavaScript
- **Propshaft**: Modern asset pipeline (not Sprockets)
- **Importmap**: ESM-based JavaScript, no bundler required
- **Solid Queue**: Database-backed job processing (replaces Sidekiq/Redis)
- **Solid Cache**: Database-backed caching
- **Kamal**: Docker-based deployment

### Database
- **SQLite3** for development (production-ready with proper config)
- Separate databases for queue, cache, and cable (see `db/*_schema.rb`)

---

## Application Architecture

### MVC Patterns

**Models** (`app/models/`)
- Inherit from `ApplicationRecord` (abstract base class)
- Keep models focused on data and associations
- Use validations, scopes, and callbacks appropriately
- Extract complex business logic to service objects

```ruby
# Pattern: Lean models with clear responsibilities
class Content < ApplicationRecord
  belongs_to :user
  has_many :versions, dependent: :destroy

  validates :title, presence: true
  validates :status, inclusion: { in: %w[draft published] }

  scope :published, -> { where(status: "published") }
  scope :by_user, ->(user) { where(user: user) }
end
```

**Controllers** (`app/controllers/`)
- Inherit from `ApplicationController`
- Use `allow_browser versions: :modern` (Rails 8.1 default)
- Keep actions thin, delegate to models/services
- Use strong parameters for all user input

```ruby
# Pattern: RESTful actions with strong parameters
class ContentsController < ApplicationController
  def create
    @content = Current.user.contents.build(content_params)
    if @content.save
      redirect_to @content, notice: "Created successfully"
    else
      render :new, status: :unprocessable_entity
    end
  end

  private

  def content_params
    params.require(:content).permit(:title, :body, :status)
  end
end
```

**Views** (`app/views/`)
- Use Hotwire/Turbo for dynamic updates
- Prefer partials for reusable components
- Use Stimulus controllers for JavaScript behavior

---

## Business Logic Patterns

### Service Objects
Place complex operations in `app/services/`. Use when logic spans multiple models or involves external services.

```ruby
# app/services/content_generator.rb
class ContentGenerator
  def initialize(user:, prompt:)
    @user = user
    @prompt = prompt
  end

  def call
    # Complex AI generation logic
    Result.new(success: true, content: generated_content)
  end

  private

  attr_reader :user, :prompt
end
```

### Query Objects
For complex queries, use `app/queries/` or model scopes.

```ruby
# Pattern: Chainable scopes over query objects for simple cases
Content.published.by_user(user).where("created_at > ?", 1.week.ago)
```

---

## Background Jobs

### Solid Queue Conventions
- Jobs inherit from `ApplicationJob`
- Configure adapter in production: `config.active_job.queue_adapter = :solid_queue`
- Use appropriate queue names for priority

```ruby
# app/jobs/generate_content_job.rb
class GenerateContentJob < ApplicationJob
  queue_as :default

  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveJob::DeserializationError

  def perform(content_id)
    content = Content.find(content_id)
    ContentGenerator.new(content: content).call
  end
end
```

---

## API Patterns

### JSON Responses
Use Jbuilder for JSON APIs. Keep API logic in dedicated controllers.

```ruby
# app/controllers/api/v1/base_controller.rb
module Api
  module V1
    class BaseController < ApplicationController
      skip_before_action :verify_authenticity_token
      before_action :authenticate_api_request
    end
  end
end
```

### Turbo Streams
For real-time updates within the app, prefer Turbo Streams over custom APIs.

```ruby
# Pattern: Broadcast updates via Turbo
respond_to do |format|
  format.html { redirect_to @content }
  format.turbo_stream
end
```

---

## Database Conventions

### Migrations
- Use descriptive, timestamped migration names
- Always include `null: false` for required fields
- Add indexes for foreign keys and frequently queried columns
- Use `references` with `foreign_key: true`

```ruby
# Pattern: Complete migration with constraints
class CreateContents < ActiveRecord::Migration[8.1]
  def change
    create_table :contents do |t|
      t.references :user, null: false, foreign_key: true
      t.string :title, null: false
      t.text :body
      t.string :status, null: false, default: "draft"
      t.timestamps
    end

    add_index :contents, [:user_id, :status]
  end
end
```

### Schema
- Schema file is `db/schema.rb` (default)
- Separate schema files for queue/cache/cable databases

---

## Testing Approach

### Minitest (Default)
- Tests in `test/` directory
- Use fixtures for test data
- Parallel test execution enabled

```ruby
# Pattern: Model test with fixtures
class ContentTest < ActiveSupport::TestCase
  test "validates title presence" do
    content = Content.new(title: nil)
    assert_not content.valid?
    assert_includes content.errors[:title], "can't be blank"
  end
end
```

### System Tests
- Use Capybara with Selenium
- Test user flows end-to-end

```ruby
# test/system/contents_test.rb
class ContentsTest < ApplicationSystemTestCase
  test "creating a content" do
    visit new_content_path
    fill_in "Title", with: "Test Content"
    click_on "Create"
    assert_text "Created successfully"
  end
end
```

---

## Security Practices

### Built-in Protections
- CSRF protection enabled by default
- Strong parameters required
- Parameter filtering for sensitive data (see `filter_parameter_logging.rb`)

### Credentials
- Use `bin/rails credentials:edit` for secrets
- Never commit unencrypted secrets
- Access via `Rails.application.credentials.dig(:key, :subkey)`

### Security Tools
- **Brakeman**: Static security analysis (`bundle exec brakeman`)
- **bundler-audit**: Gem vulnerability scanning

---

## Code Style

### Rubocop Configuration
- Using `rubocop-rails-omakase` (Rails default style)
- Run with `bundle exec rubocop`

### Naming Conventions
- Models: singular, CamelCase (`Content`, `UserProfile`)
- Controllers: plural, CamelCase + Controller (`ContentsController`)
- Tables: plural, snake_case (`contents`, `user_profiles`)
- Jobs: descriptive + Job (`GenerateContentJob`)
- Services: action-oriented (`ContentGenerator`, `WorkflowExecutor`)

---

## Performance

### Caching
- Fragment caching with Solid Cache in production
- Use `cache` helper in views for expensive partials
- Russian doll caching with `touch: true` on associations

### N+1 Prevention
- Use `includes` for eager loading
- Monitor with bullet gem in development (optional)

```ruby
# Pattern: Eager load associations
Content.includes(:user, :versions).published
```

---

## Directory Conventions

```
app/
  controllers/     # Request handling
  models/          # ActiveRecord models
  views/           # ERB templates + Turbo Streams
  jobs/            # Background jobs (Solid Queue)
  services/        # Business logic (create as needed)
  helpers/         # View helpers
  javascript/      # Stimulus controllers
  mailers/         # Email delivery
```

Extend with `app/services/`, `app/queries/` as complexity grows.
