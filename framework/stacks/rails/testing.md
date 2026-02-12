# Rails Testing Standards

Comprehensive testing conventions for Rails with Minitest/RSpec, Capybara, and Selenium Chrome.

---

## Philosophy

- **Feature tests first**: Test full user flows; unit tests for complex logic
- **Fast feedback**: Unit tests run in milliseconds, system tests reserved for critical paths
- **Test behavior, not implementation**: Assert what the user sees and does
- **Factories over fixtures**: Use FactoryBot for flexible, intention-revealing test data
- **Isolation**: Each test runs in a transaction; system tests use database cleaner

---

## Test Organization

```
test/
  models/           # Unit tests for models
  controllers/      # Controller tests (request specs preferred)
  system/           # Full browser tests with Capybara
  integration/      # Multi-controller flows without browser
  helpers/          # Helper method tests
  mailers/          # Mailer tests
  jobs/             # Background job tests
  services/         # Service object tests
  fixtures/         # YAML fixtures (or factories/)
  support/          # Test helpers and configuration
    capybara.rb     # Capybara/Chrome configuration
    stimulus.rb     # Stimulus helpers
```

---

## System Test Configuration (Capybara + Chrome)

### Preventing Flaky Tests from Browser Popups

The most common cause of flaky system tests is Chrome's Password Manager and related popups interfering with user interactions.

```ruby
# test/support/capybara.rb (or spec/support/capybara.rb)

# Chrome arguments to disable popups and ensure deterministic behavior
CHROME_ARGS = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--window-size=1400,900',
  # Password manager popups - THE ROOT CAUSE OF MOST FLAKY TESTS
  '--disable-save-password-bubble',
  '--disable-features=PasswordLeakDetection,PasswordCheck,PasswordImport',
  # Prevent other popups and background activity
  '--disable-component-update',
  '--disable-sync',
  '--disable-background-networking',
].freeze

# Chrome preferences to disable password manager at profile level
CHROME_PREFS = {
  'credentials_enable_service' => false,
  'profile.password_manager_enabled' => false,
  'profile.password_manager_leak_detection' => false,
  'password_manager.leak_detection' => false,
  'profile.default_content_setting_values.notifications' => 2, # Block
  'autofill.profile_enabled' => false,
}.freeze

Capybara.register_driver :selenium_chrome_headless do |app|
  options = Selenium::WebDriver::Chrome::Options.new

  CHROME_ARGS.each { |arg| options.add_argument(arg) }
  CHROME_PREFS.each { |key, value| options.add_preference(key, value) }

  Capybara::Selenium::Driver.new(
    app,
    browser: :chrome,
    options: options
  )
end

Capybara.default_driver = :selenium_chrome_headless
Capybara.javascript_driver = :selenium_chrome_headless

# Reasonable timeouts for CI environments
Capybara.default_max_wait_time = 5
```

### Network Isolation

Prevent tests from making external HTTP requests:

```ruby
# test/test_helper.rb or spec/rails_helper.rb
require 'webmock/minitest' # or 'webmock/rspec'

# Block all external requests, allow localhost
WebMock.disable_net_connect!(
  allow_localhost: true,
  allow: [
    'chromedriver.storage.googleapis.com', # For chromedriver downloads
  ]
)
```

---

## Stimulus Controller Synchronization

When using Hotwire/Stimulus, tests may interact with elements before controllers are connected, causing race conditions.

```ruby
# test/support/stimulus_helpers.rb
module StimulusHelpers
  # Wait for a Stimulus controller to be connected to an element
  def wait_for_stimulus_controller(selector, controller_name, timeout: 5)
    Timeout.timeout(timeout) do
      loop do
        connected = page.evaluate_script(<<~JS)
          (function() {
            const el = document.querySelector('#{selector}');
            if (!el) return false;
            const controller = el.closest('[data-controller*="#{controller_name}"]');
            if (!controller) return false;
            return window.Stimulus?.getControllerForElementAndIdentifier(controller, '#{controller_name}') != null;
          })()
        JS
        break if connected
        sleep 0.1
      end
    end
  rescue Timeout::Error
    raise "Stimulus controller '#{controller_name}' not connected to '#{selector}' within #{timeout}s"
  end

  # Wait for any Stimulus controller on the page to be ready
  def wait_for_stimulus
    page.evaluate_script('window.Stimulus?.controllers?.length > 0') rescue false
    sleep 0.1 # Brief pause for controller initialization
  end
end

# Include in test class
class ApplicationSystemTestCase < ActionDispatch::SystemTestCase
  include StimulusHelpers
end
```

### Usage in Tests

```ruby
class LoginFlowTest < ApplicationSystemTestCase
  test "user can log in" do
    visit new_session_path

    # Wait for form controller to be ready
    wait_for_stimulus_controller('form', 'form-validation')

    fill_in 'Email', with: 'user@example.com'
    fill_in 'Password', with: 'password123'
    click_button 'Sign in'

    assert_selector 'h1', text: 'Dashboard'
  end
end
```

---

## System Test Patterns

### Using Capybara Matchers

```ruby
class UserFlowTest < ApplicationSystemTestCase
  test "user can update profile" do
    user = users(:john)
    sign_in user

    visit edit_profile_path

    fill_in 'Name', with: 'John Updated'
    click_button 'Save'

    # Prefer Capybara matchers with built-in waiting
    assert_text 'Profile updated'
    assert_selector '.flash-notice', text: 'Profile updated'

    # Avoid direct assertions without waiting
    # BAD: assert page.has_content?('Profile updated')
  end
end
```

### Handling JavaScript-Heavy Pages

```ruby
test "dynamic form submission" do
  visit new_item_path

  # Wait for Turbo Frame to load
  within_frame 'item-form' do
    fill_in 'Title', with: 'New Item'
    click_button 'Create'
  end

  # Wait for Turbo Stream update
  assert_selector '#items-list', text: 'New Item'
end
```

### Debugging Flaky Tests

```ruby
# Take screenshot on failure
def teardown
  if !passed?
    take_screenshot
    save_page # Saves HTML for inspection
  end
  super
end

# Or with RSpec
config.after(:each, type: :system) do |example|
  if example.exception
    save_screenshot("tmp/screenshots/#{example.full_description.parameterize}.png")
  end
end
```

---

## Model Tests

```ruby
# test/models/user_test.rb
class UserTest < ActiveSupport::TestCase
  test "validates email presence" do
    user = User.new(email: nil)
    assert_not user.valid?
    assert_includes user.errors[:email], "can't be blank"
  end

  test "validates email uniqueness" do
    existing = users(:john)
    user = User.new(email: existing.email)
    assert_not user.valid?
    assert_includes user.errors[:email], "has already been taken"
  end

  test "normalizes email to lowercase" do
    user = User.create!(email: 'John@Example.COM', password: 'password')
    assert_equal 'john@example.com', user.email
  end
end
```

---

## Request/Controller Tests

Prefer request tests over controller tests for better coverage:

```ruby
# test/integration/users_api_test.rb
class UsersApiTest < ActionDispatch::IntegrationTest
  test "creates user with valid params" do
    assert_difference 'User.count', 1 do
      post users_path, params: {
        user: { email: 'new@example.com', name: 'New User' }
      }, as: :json
    end

    assert_response :created
    assert_equal 'new@example.com', response.parsed_body['email']
  end

  test "returns validation errors" do
    post users_path, params: {
      user: { email: 'invalid', name: '' }
    }, as: :json

    assert_response :unprocessable_entity
    assert response.parsed_body['errors'].key?('email')
  end
end
```

---

## Factory Patterns (FactoryBot)

```ruby
# test/factories/users.rb
FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    name { 'Test User' }
    password { 'password123' }

    trait :admin do
      role { :admin }
    end

    trait :with_posts do
      after(:create) do |user|
        create_list(:post, 3, author: user)
      end
    end
  end
end

# Usage
user = create(:user)
admin = create(:user, :admin)
user_with_posts = create(:user, :with_posts)
```

---

## Test Commands

```bash
# Run all tests
bin/rails test

# Run specific test file
bin/rails test test/models/user_test.rb

# Run specific test by line number
bin/rails test test/models/user_test.rb:15

# Run system tests only
bin/rails test:system

# Run with verbose output
bin/rails test -v

# Run parallel tests (Rails 6+)
bin/rails test --parallel

# Coverage report (with SimpleCov)
COVERAGE=true bin/rails test
```

---

## CI Configuration

```yaml
# .github/workflows/test.yml
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15
      env:
        POSTGRES_PASSWORD: postgres
      options: >-
        --health-cmd pg_isready
        --health-interval 10s

  steps:
    - uses: actions/checkout@v4

    - name: Setup Ruby
      uses: ruby/setup-ruby@v1
      with:
        bundler-cache: true

    - name: Setup Chrome
      uses: browser-actions/setup-chrome@latest

    - name: Setup database
      run: bin/rails db:setup
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost/test

    - name: Run tests
      run: bin/rails test && bin/rails test:system
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost/test
        RAILS_ENV: test
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Not disabling Chrome password manager | Random popups cause flaky tests | Use CHROME_ARGS and CHROME_PREFS above |
| Using `sleep` for synchronization | Slow and unreliable | Use Capybara's built-in waiting matchers |
| Testing private methods directly | Brittle, breaks on refactor | Test through public interface |
| Hitting external APIs in tests | Flaky, slow, may cost money | Use WebMock/VCR to stub |
| Shared state between tests | Order-dependent failures | Reset state in setup/teardown |
| No screenshots on failure | Hard to debug CI failures | Configure automatic screenshots |

---

_System tests should be reserved for critical user journeys. Keep them fast by limiting their scope and ensuring Chrome is configured to be completely non-interactive._
