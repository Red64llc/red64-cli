# AI/LLM Implementation in Python

Project memory for implementing AI-powered features using litellm, OpenAI SDK, and Pydantic structured outputs.

---

## Overview

Python AI integration uses litellm as a unified multi-provider interface, with Pydantic for structured outputs. The architecture separates configuration, client management, and domain-specific services.

---

## Architecture Layers

### 1. Configuration

```python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # LLM providers
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Defaults
    default_llm_model: str = "claude-sonnet-4-20250514"
    extraction_model: str = "claude-haiku-3-5-20241022"
    embedding_model: str = "text-embedding-3-small"

    # Limits
    llm_request_timeout: int = 120
    llm_max_retries: int = 3
```

### 2. Client Layer (litellm)

```python
# app/services/llm_client.py
import litellm
from app.config import settings

# Configure globally
litellm.api_key = settings.openai_api_key
litellm.set_verbose = False

async def completion(
    prompt: str,
    model: str | None = None,
    system_prompt: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """Unified completion call across providers."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = await litellm.acompletion(
        model=model or settings.default_llm_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=settings.llm_request_timeout,
        num_retries=settings.llm_max_retries,
    )
    return response.choices[0].message.content
```

### 3. Alternative: OpenAI SDK Directly

```python
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=settings.openai_api_key)

async def completion(prompt: str, model: str = "gpt-4o") -> str:
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content
```

---

## Model Selection Strategy

| Use Case | Model | Rationale |
|----------|-------|-----------|
| **Extraction** (entities, structured data) | Claude Haiku / GPT-4o-mini | Fast, cost-effective |
| **Generation** (ideas, content) | Claude Sonnet / GPT-4o | Higher quality |
| **Embeddings** | text-embedding-3-small | Cost-effective vectors |
| **Complex reasoning** | Claude Opus / o1 | Multi-step analysis |

```python
# Constants avoid magic strings
EXTRACTION_MODEL = "claude-haiku-3-5-20241022"
GENERATION_MODEL = "claude-sonnet-4-20250514"
EMBEDDING_MODEL = "text-embedding-3-small"
```

---

## Structured Outputs with Pydantic

### Pattern: Type-Safe LLM Responses

```python
from pydantic import BaseModel, Field

class ExtractedIdea(BaseModel):
    title: str = Field(description="Clear, engaging title")
    summary: str = Field(description="2-3 sentence summary")
    source_indices: list[int] = Field(description="Indices of supporting sources")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score")

class IdeaExtractionResult(BaseModel):
    ideas: list[ExtractedIdea]
    overall_theme: str
```

### Using with OpenAI Structured Outputs

```python
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def extract_ideas(content: str) -> IdeaExtractionResult:
    response = await client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        response_format=IdeaExtractionResult,
    )
    return response.choices[0].message.parsed
```

### Using with litellm (JSON mode)

```python
import json

async def extract_ideas(content: str) -> IdeaExtractionResult:
    raw = await completion(
        prompt=f"Extract ideas from:\n\n{content}",
        system_prompt=EXTRACTION_SYSTEM_PROMPT,
        model=EXTRACTION_MODEL,
    )
    parsed = json.loads(extract_json(raw))
    return IdeaExtractionResult.model_validate(parsed)
```

---

## Prompt Engineering Patterns

### System Prompts as Constants

```python
EXTRACTION_SYSTEM_PROMPT = """\
You are an expert content analyst. Extract structured information from the provided content.

Rules:
1. Be precise and factual - only extract what is explicitly stated
2. Provide confidence scores based on evidence strength
3. Return valid JSON matching the requested schema exactly
"""

GENERATION_SYSTEM_PROMPT = """\
You are an expert content strategist. Generate compelling content ideas based on source material.

Rules:
1. Each idea should be actionable and specific
2. Reference source material by index
3. Maintain the original tone and audience
"""
```

### Prompt Templates

```python
from string import Template

IDEA_PROMPT = Template("""\
Analyze the following $source_count source(s) and generate content ideas.

Sources:
$sources

Generate $idea_count unique content ideas as a JSON array with objects containing:
- title: string
- summary: string (2-3 sentences)
- source_indices: list of integers
- confidence: float (0.0 to 1.0)

Respond with ONLY valid JSON, no markdown formatting.
""")

# Usage
prompt = IDEA_PROMPT.substitute(
    source_count=len(sources),
    sources=formatted_sources,
    idea_count=5,
)
```

---

## Streaming

### Async Streaming with litellm

```python
from collections.abc import AsyncIterator

async def stream_completion(
    prompt: str,
    model: str | None = None,
    system_prompt: str | None = None,
) -> AsyncIterator[str]:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = await litellm.acompletion(
        model=model or settings.default_llm_model,
        messages=messages,
        stream=True,
    )

    async for chunk in response:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
```

### FastAPI Streaming Endpoint

```python
from fastapi.responses import StreamingResponse

@router.post("/generate/stream")
async def generate_stream(
    request: GenerateRequest,
    current_user: User = Depends(get_current_user),
):
    async def event_stream():
        async for chunk in stream_completion(
            prompt=request.prompt,
            system_prompt=GENERATION_SYSTEM_PROMPT,
        ):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

---

## Error Handling

### Error Hierarchy

```python
class LLMError(Exception):
    """Base LLM error."""

class LLMConfigError(LLMError):
    """Missing API key or invalid configuration."""

class LLMAuthError(LLMError):
    """Invalid or expired API key."""

class LLMRateLimitError(LLMError):
    """Rate limit exceeded."""

class LLMTimeoutError(LLMError):
    """Request timed out."""

class LLMParseError(LLMError):
    """Failed to parse LLM response."""
```

### Error Mapping

```python
import litellm

async def safe_completion(prompt: str, **kwargs) -> str:
    try:
        return await completion(prompt, **kwargs)
    except litellm.AuthenticationError as e:
        raise LLMAuthError(f"Invalid API key: {e}") from e
    except litellm.RateLimitError as e:
        raise LLMRateLimitError(f"Rate limit exceeded: {e}") from e
    except litellm.Timeout as e:
        raise LLMTimeoutError(f"Request timed out: {e}") from e
    except litellm.APIError as e:
        raise LLMError(f"API error: {e}") from e
```

### Retry with Tenacity

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(LLMRateLimitError),
)
async def completion_with_retry(prompt: str, **kwargs) -> str:
    return await safe_completion(prompt, **kwargs)
```

---

## JSON Response Parsing

```python
import json
import re

def extract_json(content: str) -> str:
    """Extract JSON from potential markdown code fences."""
    content = content.strip()
    # Remove markdown code fences
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", content, re.DOTALL)
    if match:
        return match.group(1).strip()
    return content

def parse_llm_json(content: str, model: type[BaseModel]) -> BaseModel:
    """Parse LLM response into Pydantic model with graceful fallback."""
    try:
        raw = extract_json(content)
        data = json.loads(raw)
        return model.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        raise LLMParseError(f"Failed to parse response: {e}") from e
```

---

## Content Truncation

```python
MAX_CONTENT_TOKENS = 8000
CHARS_PER_TOKEN = 4  # Rough estimate

def truncate_for_llm(content: str, max_tokens: int = MAX_CONTENT_TOKENS) -> str:
    max_chars = max_tokens * CHARS_PER_TOKEN
    if len(content) <= max_chars:
        return content
    return content[:max_chars] + "\n\n[Content truncated for processing]"
```

---

## Domain Services Pattern

```python
class IdeaGenerationService:
    """Generate content ideas from source material."""

    def __init__(self, llm_client: Callable = safe_completion) -> None:
        self._complete = llm_client

    async def generate(
        self,
        sources: list[Source],
        count: int = 5,
    ) -> IdeaExtractionResult:
        formatted = self._format_sources(sources)
        prompt = IDEA_PROMPT.substitute(
            source_count=len(sources),
            sources=formatted,
            idea_count=count,
        )
        raw = await self._complete(
            prompt=prompt,
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            model=GENERATION_MODEL,
        )
        return parse_llm_json(raw, IdeaExtractionResult)

    def _format_sources(self, sources: list[Source]) -> str:
        return "\n\n".join(
            f"[{i}] {s.title}\n{truncate_for_llm(s.content)}"
            for i, s in enumerate(sources)
        )
```

---

## Testing LLM Services

### Mock Completions

```python
from unittest.mock import AsyncMock

async def test_idea_generation():
    mock_response = json.dumps({
        "ideas": [{"title": "Test Idea", "summary": "A test.", "source_indices": [0], "confidence": 0.9}],
        "overall_theme": "Testing",
    })

    service = IdeaGenerationService(llm_client=AsyncMock(return_value=mock_response))
    result = await service.generate(sources=[mock_source])

    assert len(result.ideas) == 1
    assert result.ideas[0].title == "Test Idea"

async def test_handles_parse_error():
    service = IdeaGenerationService(llm_client=AsyncMock(return_value="not json"))

    with pytest.raises(LLMParseError):
        await service.generate(sources=[mock_source])

async def test_handles_rate_limit():
    service = IdeaGenerationService(
        llm_client=AsyncMock(side_effect=LLMRateLimitError("too many requests"))
    )

    with pytest.raises(LLMRateLimitError):
        await service.generate(sources=[mock_source])
```

---

## Credential Management

Store API keys in environment variables, never in code:

```bash
# .env (never committed)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

Access via pydantic-settings:
```python
settings.openai_api_key  # Loaded from OPENAI_API_KEY env var
```

---

## Quick Reference

### Adding a New LLM Service

1. Define Pydantic response model in `app/schemas/`
2. Create service class in `app/services/` with injected `llm_client`
3. Build prompt with explicit output schema
4. Parse response with `parse_llm_json()`
5. Map errors to domain-specific types
6. Test with mocked `llm_client`

---

_Focus on patterns, not exhaustive API documentation. See litellm/openai docs for full API reference._
