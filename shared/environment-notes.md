# Environment Notes

Shared setup and configuration details for all incidents in this repository.

## Model Configuration

| Setting | Value |
|---------|-------|
| **Model** | `thinkingmachines/inkling-2-mini` |
| **Provider** | OpenRouter |
| **API Endpoint** | `/responses` |
| **Reasoning Effort** | High |
| **Context Window** | 1M tokens |
| **Service Tier** | Default (not explicitly configured) |
| **Cache** | Disabled (0 cache read/write tokens) |

## IDE / Runtime

| Component | Details |
|-----------|---------|
| **IDE** | Visual Studio Code with Copilot CLI |
| **OS** | Windows (EET timezone, UTC+2) |
| **Session Store** | `%USERPROFILE%\.copilot\session-store.db` (table `assistant_usage_events`) |
| **Event Log** | `session-state\<id>\events.jsonl` |

## Data Collection

Token and call statistics were extracted from the VS Code `session-store.db` using the scripts in each incident's `attachments/` folder. All scripts use `os.homedir()` to avoid hardcoding personal paths.

## Time Zone

All database timestamps are stored in UTC. Reports present both EET (UTC+2) and UTC for clarity.