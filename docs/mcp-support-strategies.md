  # MCP Support Strategy

  The Core Challenge

  Red64 spawns agent CLIs as subprocesses. MCP servers are configured per-agent in different formats/locations. You need to either:
  1. Inject MCP config into each agent's native config system, or
  2. Run MCP servers as sidecars and point agents at them

  ## Agent MCP Config Landscape

  |             | Claude              | Gemini                | Codex                |
  |-------------|---------------------|-----------------------|----------------------|
  | Config file | .mcp.json (project) | .gemini/settings.json | ~/.codex/config.toml |
  | Format      | JSON                | JSON                  | TOML                 |
  | CLI add cmd | claude mcp add      | None (manual edit)    | codex mcp add        |
  | Transports  | stdio, SSE, HTTP    | stdio, SSE, HTTP      | stdio, HTTP          |

  All three support the same mcpServers pattern for stdio: a command + args pair (e.g., npx -y @upstash/context7-mcp).

  ## Recommended Strategy: Config Injection

  Approach: Red64 writes each agent's native MCP config before invocation.

  1. Unified MCP declaration in .red64/config.json:
  {
    "mcpServers": {
      "context7": {
        "command": "npx",
        "args": ["-y", "@upstash/context7-mcp"]
      }
    }
  }
  2. Before spawning an agent, red64 translates this into the agent's native format:
    - Claude: Write/merge .mcp.json in the workspace root
    - Gemini: Write/merge .gemini/settings.json with mcpServers key
    - Codex: Write/merge ~/.codex/config.toml with [mcp_servers.*] sections
  3. After execution, optionally clean up injected configs (or leave them — .mcp.json is project-scoped anyway).

  ###  Sandbox Mode Considerations

  When --sandbox is used, MCP stdio servers run inside the container. This means:

  - npx-based servers (context7, etc.): Work out of the box — npm is already installed in Dockerfile.sandbox. The agent starts the MCP server as a child process via npx.
  - No host networking needed for stdio servers — they're local processes.
  - Remote MCP servers (SSE/HTTP): Work as-is since the container has network access.
  - Config injection path changes: Write configs into the mounted /workspace or into the container's home dir. For Claude/Gemini (project-level configs), writing to /workspace works naturally via the volume mount. For Codex (user-level ~/.codex/config.toml), you'd need to either:
    - Mount a generated config file: -v /tmp/codex-config.toml:/home/agent/.codex/config.toml
    - Or pre-write it before the docker run

  Implementation Steps

  1. Add mcpServers field to InitConfig / .red64/config.json
  2. Create McpConfigWriter service with per-agent adapters that write native config files
  3. Hook into AgentInvoker — call McpConfigWriter before spawn() / docker run
  4. For sandbox mode, handle config placement:
    - Claude/Gemini: write to workspace dir (auto-mounted)
    - Codex: add extra -v mount for config.toml
  5. Add red64 mcp add/remove/list CLI commands as a UX layer over the unified config
  6. Pre-install popular MCP packages in Dockerfile.sandbox to avoid npx download delays on every run (optional optimization)

  Key Decision Point

  Stdio vs Remote for sandbox: Stdio MCP servers are simpler (no ports, no auth) and work identically in local and sandbox modes. Remote (SSE/HTTP) servers also work but may need env vars for auth tokens passed through. I'd recommend supporting stdio first, remote later.

  Risk: Config Conflicts

  If a user already has their own .mcp.json or agent configs, red64's injection could overwrite them. Strategy: merge, don't replace — read existing config, add red64's servers, write back, restore after execution.