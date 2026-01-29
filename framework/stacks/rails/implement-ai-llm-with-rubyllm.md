# AI/LLM Implementation with ruby_llm

Project memory for implementing AI-powered features using the ruby_llm gem in MediaPulse.

---

## Overview

MediaPulse uses the `ruby_llm` gem as a unified interface for multi-provider LLM access. The architecture separates concerns into configuration, client factory, and domain-specific services.

---

## Architecture Layers

### 1. Configuration (`config/initializers/ruby_llm.rb`)
Global setup for ruby_llm gem with API keys and defaults.

```ruby
# Pattern: Configure in initializer, credentials from Rails.credentials
RubyLLM.configure do |config|
  config.anthropic_api_key = Rails.application.credentials.dig(:anthropic, :api_key)
  config.openai_api_key = Rails.application.credentials.dig(:openai, :api_key)
  config.default_model = "claude-sonnet-4-20250514"
  config.max_retries = 3
  config.retry_interval = 0.5
  config.retry_backoff_factor = 2
  config.request_timeout = 120
end
```

### 2. Client Factory (`app/services/llm_client_factory.rb`)
Provider abstraction with task-specific model selection.

```ruby
# Pattern: Factory methods for different use cases
LlmClientFactory.extraction_client  # Claude Haiku - fast, cost-effective
LlmClientFactory.generation_client  # Claude Sonnet - creative, quality
```

### 3. Service Layer (`app/services/llm_service.rb`)
Unified interface for AI operations with error mapping.

```ruby
# Pattern: Domain methods with consistent return types
LlmService.generate_ideas(prompt:, system_prompt:, model:)
LlmService.generate_content(prompt:, system_prompt:, model:)
LlmService.stream(prompt:, system_prompt:, model:, &block)
```

---

## Model Selection Strategy

| Use Case | Model | Rationale |
|----------|-------|-----------|
| **Extraction** (semantic, entities) | Claude Haiku | Fast, cost-effective for structured extraction |
| **Generation** (ideas, content) | Claude Sonnet | Higher quality for creative tasks |
| **Embeddings** | OpenAI text-embedding-3-small | Cost-effective vector generation |

```ruby
# Constants for model IDs (avoid magic strings)
HAIKU_MODEL = "claude-haiku-3-5-20241022"
SONNET_MODEL = "claude-sonnet-4-20250514"
```

---

## Response Handling Pattern

Use immutable Data objects for LLM responses:

```ruby
# Pattern: Immutable value objects for responses
LlmResponse = Data.define(:content, :model, :input_tokens, :output_tokens)

# Usage in service
def build_response(response)
  LlmResponse.new(
    content: response.content,
    model: response.model_id,
    input_tokens: response.input_tokens,
    output_tokens: response.output_tokens
  )
end
```

---

## Prompt Engineering Patterns

### System Prompts
Define persona and output format constraints:

```ruby
# Pattern: Constants for reusable system prompts
SYSTEM_PROMPT = <<~PROMPT
  You are an expert content strategist. Analyze the provided source material and generate
  compelling content ideas. For each idea, provide:
  1. A clear, engaging title
  2. A brief summary (2-3 sentences)
  3. The source indices that support this idea

  Return your response as JSON array with objects containing: title, summary, source_indices
PROMPT
```

### JSON Output Requests
Request structured output with explicit format:

```ruby
# Pattern: Explicit JSON schema in prompt
def build_prompt(content, source_type)
  <<~PROMPT
    Analyze the following #{source_type} content and extract semantic information.

    Return a JSON object with exactly these fields:
    - summary: A 2-3 sentence summary
    - entities: Array of objects with "name" and "type" keys
    - claims: Array of strings representing key assertions
    - confidence: A number between 0.0 and 1.0

    Respond with ONLY valid JSON, no markdown formatting or explanation.

    CONTENT:
    #{content}
  PROMPT
end
```

### Content Truncation
Handle token limits gracefully:

```ruby
# Pattern: Truncate before sending to LLM
MAX_CONTENT_TOKENS = 8000
CHARS_PER_TOKEN = 4

def truncate_content(content)
  max_chars = MAX_CONTENT_TOKENS * CHARS_PER_TOKEN
  return content if content.length <= max_chars
  content[0, max_chars] + "\n\n[Content truncated for processing]"
end
```

---

## JSON Response Parsing

LLMs may wrap JSON in markdown code fences:

```ruby
# Pattern: Extract JSON from potential markdown wrapping
def extract_json(content)
  content = content.strip
  if content.start_with?("```")
    content = content.sub(/\A```\w*\n?/, "")
    content = content.sub(/\n?```\z/, "")
  end
  content.strip
end

# Pattern: Graceful fallback for parsing failures
def parse_response(response_content)
  json_content = extract_json(response_content)
  parsed = JSON.parse(json_content)
  return {} unless parsed.is_a?(Hash)
  parsed.transform_keys(&:to_sym)
rescue JSON::ParserError => e
  Rails.logger.warn("Failed to parse JSON response: #{e.message}")
  {}
end
```

---

## Error Handling

### Error Hierarchy
Map ruby_llm errors to domain-specific errors:

```ruby
# Pattern: Custom error hierarchy
class LlmService
  class Error < StandardError; end
  class ConfigurationError < Error; end
  class AuthenticationError < Error; end
  class RateLimitError < Error; end
  class ApiError < Error; end
end

# Pattern: Map provider errors to domain errors
rescue RubyLLM::UnauthorizedError => e
  raise AuthenticationError, e.message
rescue RubyLLM::RateLimitError => e
  raise RateLimitError, e.message
rescue RubyLLM::ConfigurationError => e
  raise ConfigurationError, e.message
rescue RubyLLM::Error => e
  raise ApiError, e.message
```

### Validation Before API Calls

```ruby
# Pattern: Fail fast with clear messages
def validate_api_key!
  api_key = Rails.application.credentials.dig(:anthropic, :api_key)
  return if api_key.present?

  raise ConfigurationError,
    "Anthropic API key not configured. Add to credentials: anthropic.api_key"
end
```

---

## Testing LLM Services

### Mocking ruby_llm Calls

```ruby
# Pattern: Stub RubyLLM.chat for unit tests
test "generate_ideas returns LlmResponse" do
  mock_response = Minitest::Mock.new
  mock_response.expect :content, "Generated content"
  mock_response.expect :model_id, "claude-sonnet-4-20250514"
  mock_response.expect :input_tokens, 150
  mock_response.expect :output_tokens, 200

  mock_chat = Minitest::Mock.new
  mock_chat.expect :with_instructions, mock_chat, [String]
  mock_chat.expect :ask, mock_response, [String]

  RubyLLM.stub :chat, mock_chat do
    result = LlmService.generate_ideas(prompt: "Test", system_prompt: "Expert")
    assert_instance_of LlmResponse, result
  end
end
```

### Stubbing Credentials in Tests

```ruby
# Pattern: Stub credentials for test isolation
def stub_anthropic_api_key
  credentials_mock = Class.new do
    def dig(*keys)
      keys == [:anthropic, :api_key] ? "test-api-key" : nil
    end
  end.new
  Rails.application.instance_variable_set(:@credentials, credentials_mock)
end

def reset_credentials_stub
  Rails.application.instance_variable_set(:@credentials, nil)
end
```

### Testing Error Mapping

```ruby
# Pattern: Verify error mapping with mock errors
test "maps RubyLLM::RateLimitError to RateLimitError" do
  error_response = OpenStruct.new(body: "Rate limit exceeded")
  mock_chat = Minitest::Mock.new
  mock_chat.expect :ask, nil do
    raise RubyLLM::RateLimitError.new(error_response)
  end

  RubyLLM.stub :chat, mock_chat do
    assert_raises(LlmService::RateLimitError) do
      LlmService.generate_ideas(prompt: "Test")
    end
  end
end
```

---

## Credential Management

Store API keys in Rails encrypted credentials:

```bash
# Edit credentials
bin/rails credentials:edit

# Structure
anthropic:
  api_key: sk-ant-...
openai:
  api_key: sk-...
```

Access pattern:
```ruby
Rails.application.credentials.dig(:anthropic, :api_key)
```

---

## Domain-Specific Services

Create focused services for specific AI tasks:

| Service | Purpose | Model |
|---------|---------|-------|
| `SemanticProcessing::SemanticExtractor` | Extract entities, claims, topics | Haiku |
| `IdeaGenerationService` | Generate content ideas from sources | Sonnet |
| `ContentGenerationService` | Create platform-specific content | Sonnet |
| `EmbeddingService` | Vector embeddings for similarity | OpenAI |

Each follows the pattern:
- Class method `call` for invocation
- Dependency injection for testability
- Result objects for outcomes
- Error propagation to caller

---

## Quick Reference

### Creating a New LLM Service

1. Define class in `app/services/`
2. Use `LlmClientFactory` for client (extraction or generation)
3. Build prompt with explicit JSON schema
4. Parse response with JSON extraction helper
5. Return immutable result object
6. Map errors to domain-specific types

### Adding Tests

1. Stub `RubyLLM.chat` with mock
2. Stub credentials if validating API keys
3. Test success path with mock responses
4. Test error paths with raised exceptions
5. Verify response structure and types

---

_Focus on patterns, not exhaustive API documentation. See ruby_llm gem docs for full API reference._
