

```json
"What is 2+2?" | claude -p --output-format stream-json --verbose
⎿  {
       "type": "system",
       "subtype": "init",
       "cwd": "/Users/yacin/Workspace/lab/red64-cli",
       "session_id": "fb0ecd72-ed0b-4500-bd3f-37d298869c02",
       "tools": [
         "Task",
         "TaskOutput",
         "Bash",
         "Glob",
         "Grep",
         "ExitPlanMode",
         "Read",
         "Edit",
         "Write",
         "NotebookEdit",
         "WebFetch",
         "TodoWrite",
         "WebSearch",
         "KillShell",
         "AskUserQuestion",
         "Skill",
         "EnterPlanMode"
       ],
       "mcp_servers": [],
       "model": "claude-opus-4-5-20251101",
       "permissionMode": "default",
       "slash_commands": [
         "red64:validate-design",
         "red64:validate-gap",
         "red64:validate-impl",
         "red64:spec-requirements",
         "red64:spec-status",
         "red64:spec-quick",
         "red64:spec-init",
         "red64:spec-design",
         "red64:steering-custom",
         "red64:spec-impl",
         "red64:steering",
         "red64:spec-tasks",
         "compact",
         "context",
         "cost",
         "init",
         "pr-comments",
         "release-notes",
         "review",
         "security-review"
       ],
       "apiKeySource": "none",
       "claude_code_version": "2.0.76",
       "output_style": "default",
       "agents": [
         "general-purpose",
         "statusline-setup",
         "Explore",
         "Plan",
         "claude-code-guide",
         "validate-design-agent",
         "validate-gap-agent",
         "validate-impl-agent",
         "spec-requirements-agent",
         "spec-design-agent",
         "steering-custom-agent",
         "spec-tdd-impl-agent",
         "steering-agent",
         "spec-tasks-agent"
       ],
       "skills": [],
       "plugins": [],
       "uuid": "5ba4b1fb-f616-4d96-ac2c-d046ea400758"
     }
     {
       "type": "assistant",
       "message": {
         "model": "claude-opus-4-5-20251101",
         "id": "msg_01749futwLdeLVYicvVJFsLs",
         "type": "message",
         "role": "assistant",
         "content": [
           {
             "type": "text",
             "text": "4"
           }
         ],
         "stop_reason": null,
         "stop_sequence": null,
         "usage": {
           "input_tokens": 2,
           "cache_creation_input_tokens": 6561,
           "cache_read_input_tokens": 13175,
           "cache_creation": {
             "ephemeral_5m_input_tokens": 6561,
             "ephemeral_1h_input_tokens": 0
           },
           "output_tokens": 1,
           "service_tier": "standard",
           "inference_geo": "not_available"
         },
         "context_management": null
       },
       "parent_tool_use_id": null,
       "session_id": "fb0ecd72-ed0b-4500-bd3f-37d298869c02",
       "uuid": "363517aa-d493-4359-842e-b9a5d5df478c"
     }
     {
       "type": "result",
       "subtype": "success",
       "is_error": false,
       "duration_ms": 1950,
       "duration_api_ms": 1941,
       "num_turns": 1,
       "result": "4",
       "session_id": "fb0ecd72-ed0b-4500-bd3f-37d298869c02",
       "total_cost_usd": 0.04772875,
       "usage": {
         "input_tokens": 2,
         "cache_creation_input_tokens": 6561,
         "cache_read_input_tokens": 13175,
         "output_tokens": 5,
         "server_tool_use": {
           "web_search_requests": 0,
           "web_fetch_requests": 0
         },
         "service_tier": "standard",
         "cache_creation": {
           "ephemeral_1h_input_tokens": 0,
           "ephemeral_5m_input_tokens": 6561
         }
       },
       "modelUsage": {
         "claude-opus-4-5-20251101": {
           "inputTokens": 2,
           "outputTokens": 5,
           "cacheReadInputTokens": 13175,
           "cacheCreationInputTokens": 6561,
           "webSearchRequests": 0,
           "costUSD": 0.04772875,
           "contextWindow": 200000
         }
       },
       "permission_denials": [],
       "uuid": "50da8f56-d416-4e34-a012-5ebcac2bc43e"
     }
```