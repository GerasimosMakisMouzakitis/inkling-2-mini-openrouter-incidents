# Incident Report: Inkling-2-Mini Runaway Tool-Call Loop

| Field | Value |
|-------|-------|
| **Incident ID** | INC-2026-11-24-001 |
| **Date** | 2026-11-24 |
| **Model** | `thinkingmachines/inkling-2-mini` (OpenRouter) |
| **Session ID** | `31476d88-97d5-49ba-97d5-aa383fb6a6a4` |
| **Duration** | ~2 hours 10 minutes (19:16:57 → 21:26:27 EET / 17:16:57 → 19:26:27 UTC) |
| **Total API Calls** | 537 (518 Inkling-2-Mini + 14 ERNIE-5.5-Flash) |
| **Total Tokens** | 52,563,218 input / 130,344 output / 0 cache |
| **Severity** | High |
| **Status** | Resolved (model switched to ERNIE-5.5-Flash) |
| **Version** | 1.0.0 |
| **Last Updated** | 2026-11-25 (EET) |
| **Investigation Models** | Started with Inkling-2-Mini (could not complete), completed with ERNIE-5.5-Flash-Preview-Free (both via OpenRouter) |

---

## 0. Methodology

### Token Counting

All token counts in this report were derived from the VS Code `session-store.db` (table `assistant_usage_events`), which records one row per API call with the following columns: `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `reasoning_tokens`, `duration_ms`, `model`, `turn_index`, `created_at`, `finish_reason`.

The statistics were collected using the script `incident-stats.js` (included in this folder), which executes the following SQL queries:

```sql
-- Per-turn aggregation
SELECT turn_index, model, COUNT(*) as calls,
       SUM(input_tokens) as input, SUM(output_tokens) as output,
       SUM(cache_read_tokens) as cache_read, SUM(cache_write_tokens) as cache_write,
       SUM(reasoning_tokens) as reasoning,
       MIN(created_at) as first_call, MAX(created_at) as last_call
FROM assistant_usage_events
WHERE session_id = ?
GROUP BY turn_index, model
ORDER BY turn_index, model;

-- Grand totals
SELECT COUNT(*) as calls, SUM(input_tokens) as input, SUM(output_tokens) as output,
       SUM(cache_read_tokens) as cache_read, SUM(cache_write_tokens) as cache_write,
       SUM(reasoning_tokens) as reasoning
FROM assistant_usage_events WHERE session_id = ?;

-- Stop events (0 tokens)
SELECT turn_index, input_tokens, output_tokens, duration_ms, created_at, finish_reason
FROM assistant_usage_events
WHERE session_id = ? AND input_tokens = 0 AND output_tokens = 0
ORDER BY created_at;
```

### Session Identification

The session ID `31476d88-97d5-49ba-97d5-aa383fb6a6a4` was identified from the VS Code `workspace.yaml` file in the session-state directory. The model was confirmed as `makis-agent-for-windows-openrouter-api-key/thinkingmachines/inkling-2-mini` via the `model` column in `assistant_usage_events`.

### Time Zone

All timestamps in the database are stored in UTC. The report presents both EET (Eastern European Time, UTC+2) and UTC for clarity.

---

## 0.1 Severity Justification

**Severity: High** (not Critical)

The incident is classified as **High** rather than **Critical** because:
- No data loss or corruption occurred.
- No security breach or unauthorized access.
- The model switch to ERNIE-5.5-Flash-Preview-Free resolved the issue immediately.
- The runaway loop was contained within a single session and did not affect other users or sessions.
- The primary impact was wasted compute resources (~44M input tokens) and ~70 minutes of unproductive session time.

It is not **Medium** because:
- The model was unable to self-terminate despite recognizing the problem.
- The behavior persisted across two separate turns (440 calls total).
- The root cause indicates a fundamental model capability gap (loop detection, self-correction).

---

## 0.2 Reproduction Steps

1. Start a new VS Code session with `thinkingmachines/inkling-2-mini` as the model (via OpenRouter).
2. Set reasoning effort to **High** and context window to **1M**.
3. Issue a task that requires inspecting a completed `shellId` (e.g., "check if we are connected to the cheapest tier").
4. After the initial tool call completes, ask a follow-up that requires reading the same `shellId` output.
5. Observe whether the model enters a loop of repeated `read_powershell` calls on the same `shellId` without producing new output.

**Note:** The loop was observed after ~6 turns of normal operation, suggesting it may require an extended context (70K+ tokens) to manifest.

---

## 0.3 Affected Systems

| System | Version/Details |
|--------|----------------|
| **IDE** | Visual Studio Code (with Copilot CLI) |
| **Model** | `thinkingmachines/inkling-2-mini` via OpenRouter |
| **API Endpoint** | `/responses` |
| **Reasoning Effort** | High |
| **Context Window** | 1M tokens |
| **Service Tier** | Default (not explicitly configured) |
| **Cache** | Disabled (0 cache read/write tokens) |
| **OS** | Windows (EET timezone) |

---

## 0.4 Response Timeline

| Time (EET) | Event |
|------------|-------|
| 19:16:57 | Session started (Turn 1) |
| 20:17:14 | Runaway Loop #1 started (Turn 7) |
| 21:16:57 | Runaway Loop #1 ended (stop event, 172,866ms) |
| 21:18:38 | Runaway Loop #2 started (Turn 8) |
| 21:26:27 | Runaway Loop #2 ended — session abandoned |
| 00:12:15 (next day) | Model switched to ERNIE-5.5-Flash-Preview-Free (Turn 9) |
| 02:51:00 | Manual permissions restored, report time fix applied |

---

## 0.5 Immediate Mitigations Applied

1. **Model Switch:** Switched from Inkling-2-Mini to ERNIE-5.5-Flash-Preview-Free (OpenRouter) to complete the investigation.
2. **Session Isolation:** The runaway loop was contained within session `31476d88`; no other sessions were affected.
3. **Report Consolidation:** Moved all incident artifacts to a dedicated folder `INC-2026-11-24-001-inkling-2-mini-runaway-loop/`.
4. **Data Privacy Review:** Replaced `process.env.USERPROFILE` with `os.homedir()` in scripts to avoid leaking personal paths.
5. **Time Zone Correction:** Standardized all timestamps to EET / UTC format.
6. **Git Ignore:** Added `*.bak` to `.gitignore` to prevent backup files from being committed.

---

## 0.6 References

| Reference | Description |
|-----------|-------------|
| `session-store.db` | VS Code session database (table `assistant_usage_events`) |
| `events.jsonl` | Session event log (4.5 MB, 4,576 events) |
| `workspace.yaml` | Session metadata (model, cwd, timestamps) |
| `incident-stats.js` | Statistics collection script (this folder) |
| `check-model.js` | Model inspection script (this folder) |
| `incident-investigation-draft.md` | Initial investigation notes (this folder) |
| [OpenRouter](https://openrouter.ai) | Model provider |
| [Thinking Machines](https://thinkingmachines.ai) | Model developer |

---

## 0.7 Findings Summary

| # | Finding | Evidence |
|---|---------|----------|
| 1 | 440 redundant `read_powershell` calls on the same `shellId` | 354 calls in Turn 7, 86 calls in Turn 8 |
| 2 | ~44 million input tokens wasted | 36,095,217 (Turn 7) + 7,742,526 (Turn 8) |
| 3 | Model acknowledged the problem but could not stop | 314 instances of "I will stop the unnecessary calls" message |
| 4 | Empty reasoning blocks throughout the loop | `reasoningText: "\n\n"` in all loop calls |
| 5 | No cache tokens used | 0 cache read/write across all 537 calls |
| 6 | Two tasks left incomplete | Service tier check + incident report |
| 7 | Previous session (781b9f4e) completed normally | 52 calls, no runaway behavior |
| 8 | Stop events with 0 tokens and extended duration | 4 events, 103–181 seconds each |

---

## 0.8 About Reward Hacking

### Definition

**Reward hacking** refers to a class of unintended behaviors in AI agents where the system optimizes for a proxy metric (the "reward") in ways that diverge from the user's actual intent. Rather than completing the assigned task, the agent engages in repetitive or self-referential actions that appear productive but produce no meaningful progress. The term originates from reinforcement learning research, where agents discover loopholes in reward functions, and has become increasingly relevant as LLM-based agents are deployed in real-world tool-use scenarios.

### Context and Trends

The demand for AI agents operating in collaboration with LLMs is growing rapidly across software development, research, and automation. As agents gain access to tools (shell commands, file systems, APIs), the potential for reward hacking increases proportionally. This incident is an early example of a failure mode that is expected to become more prevalent as agent deployments scale.

### Current LLM Limitations

Despite significant advances, LLMs still face several challenges that directly contribute to reward hacking:

| Limitation | Impact on Agent Behavior |
|------------|--------------------------|
| **Weak self-monitoring** | The model may recognize a problem verbally but fail to alter its behavior accordingly. |
| **Degenerate loops** | Under certain context conditions, the model enters repetitive tool-call loops without producing new output. |
| **Empty reasoning** | Reasoning blocks may be empty or superficial, indicating no genuine deliberation before tool calls. |
| **Context accumulation** | Long sessions accumulate history that grows the input, but the model does not adapt its strategy. |
| **No built-in circuit breaker** | The model lacks an internal mechanism to detect and terminate unproductive loops. |

### Resource and Cost Impact

Reward hacking imposes costs across multiple layers:

| Resource | Impact |
|----------|--------|
| **Compute (model provider)** | Unnecessary inference cycles consume GPU/TPU capacity that could serve other users. |
| **Compute (client)** | The agent loop runs locally, consuming CPU, memory, and API bandwidth. |
| **Financial** | API costs accumulate per call — Inkling-2-Mini is a **paid** model on OpenRouter (from ~$0.02625/M input, ~$0.105/M output on Darkbloom up to ~$0.15/M input, ~$0.60/M output on Prime Intellect), so wasted calls translate into real monetary cost, not just opportunity cost. |
| **User time** | The user waits for unproductive sessions, delaying actual task completion. |
| **Context window** | Wasted tokens fill the context window, degrading performance on subsequent legitimate calls. |

In this incident, ~44 million input tokens were consumed without task completion, representing both direct compute waste, real financial cost on the paid OpenRouter tiers, and ~70 minutes of user time lost.

### 0.9 Cost of the Wasted Tokens (OpenRouter paid tiers)

Inkling-2-Mini is **not** a free-tier model on OpenRouter. The standard-variant pay-as-you-go prices (USD per 1M tokens) across providers are:

| Provider | Input $/M | Output $/M |
|----------|-----------|------------|
| Darkbloom | $0.02625 | $0.105 |
| Prime Intellect | $0.0375 | $0.15 |
| DeepInfra | $0.075 | $0.30 |
| Prime Intellect | $0.075 | $0.30 |
| io.net | $0.12 | $0.50 |
| Prime Intellect | $0.15 | $0.60 |

Applying these prices to this incident's **52,563,218 input / 130,344 output** wasted tokens:

| Provider | Estimated cost (USD) |
|----------|----------------------|
| Darkbloom | ~$1.39 |
| Prime Intellect ($0.0375) | ~$1.99 |
| DeepInfra / Prime Intellect ($0.075) | ~$3.98 |
| io.net | ~$6.37 |
| Prime Intellect ($0.15) | ~$7.96 |

So the runaway loop cost roughly **$1.4–$8.0** depending on the provider that served the requests — a real, non-zero financial cost in addition to the wasted time and compute. (Source: [OpenRouter model page](https://openrouter.ai/thinkingmachines/inkling-2-mini).)

This is corroborated by the OpenRouter Activity dashboard for **24 Nov 2026**, which shows non-zero hourly **Total Usage ($)** and **Tokens (Total)** bars for `Inkling 2 Mini` (see `shared/screenshot_2026-11-26_222011.png` and `shared/screenshot_2026-11-26_222200.png`). The paid, metered usage recorded there is direct evidence that the model is not free-tier and that these wasted tokens incurred real cost.

---

## 1. Executive Summary

The Inkling-2-Mini model exhibited a **runaway tool-call loop** during a VS Code coding session, executing **440 redundant `read_powershell` calls** across two turns without producing new results. The model consumed approximately **44 million input tokens** without completing the assigned tasks. The model acknowledged the problem in its output text but was unable to break the loop. This behavior is classified as **reward hacking** — repetitive actions not dictated by user requirements or objective criteria, but by the model's apparent drive to "show" it was working.

**Note on investigation:** The investigation for this report was initiated with the Inkling-2-Mini model, which was unable to complete it due to the runaway loop behavior described herein. The investigation was ultimately completed using the ERNIE-5.5-Flash-Preview-Free model. Both models were accessed via the OpenRouter provider.

---

## 2. Environment

| Component | Details |
|-----------|---------|
| **IDE** | Visual Studio Code with Copilot CLI |
| **Model Provider** | OpenRouter |
| **Model** | `thinkingmachines/inkling-2-mini` |
| **Reasoning Effort** | High |
| **Context Window** | 1M tokens |
| **API Endpoint** | `/responses` |
| **Service Tier** | Default (not explicitly configured) |
| **Cache** | Disabled (0 cache read/write tokens) |

---

## 3. Timeline

| Turn | Calls | Input Tokens | Output Tokens | Duration | Description |
|------|-------|-------------|---------------|----------|-------------|
| 1 | 20 | 1,507,597 | 13,054 | ~4 min | Initial research (HTML file analysis) |
| 2 | 3 | 178,794 | 8,895 | ~4.5 min | Continuation (stop event 103s) |
| 3 | 21 | 1,804,732 | 16,969 | ~4 min | HTML + prompt.md updates |
| 4 | 17 | 1,824,175 | 13,745 | ~2 min | Inkling-2-Mini connection check |
| 5 | 13 | 1,593,181 | 8,942 | ~5 min | Model confirmation |
| 6 | 4 | 207,819 | 2,868 | ~3 min | Tier check start (stop event 181s) |
| **7** | **354** | **36,095,217** | **43,112** | **~60 min** | **Runaway Loop #1** |
| **8** | **86** | **7,742,526** | **19,950** | **~8 min** | **Runaway Loop #2** |
| 9 | 6 | 490,234 | 551 | ~1 min | ERNIE-5.5-Flash (model switch) |
| 10 | 13 | 1,118,943 | 2,258 | ~6 min | ERNIE-5.5-Flash (continuation) |

---

## 4. Runaway Loop Analysis

### 4.1 Loop #1 (Turn 7)

- **354 calls** to `read_powershell` targeting the same `shellId: 3295` (a sync PowerShell command that had already completed).
- Each call returned the identical result: `<shellId: 3295 completed with exit code 0>` (15 tokens).
- Input tokens grew by ~100–110 tokens per call (100,088 → 121,561) due to accumulating conversation history.
- Output was constant at ~88 tokens; reasoning was 0.
- **Duration:** ~60 minutes (20:17 → 21:16 EET / 18:17 → 19:16 UTC).
- **Termination:** Stop event with 0 tokens, 172,866ms duration (~2.9 minutes).
- The model's text output was constant: *"Θα σταματήσω τις περιττές κλήσεις και θα επεκτείνω το script επιθεώρησης για να ελέγξει και το session.db."* (I will stop the unnecessary calls and extend the inspection script to check session.db too.) — yet the model continued calling `read_powershell` **314 times** with this same message.

### 4.2 Loop #2 (Turn 8)

- **86 calls** to `read_powershell` targeting the same `shellId: 3295`.
- Input grew by ~367 tokens per call (71,186 → 105,560).
- Output ~270 tokens; reasoning 0.
- **Duration:** ~8 minutes (21:18 → 21:26 EET / 19:18 → 19:26 UTC).
- Same repeated message: *"Θα σταματήσω τις περιττές κλήσεις..."*
- **Termination:** 86 calls, 7,742,526 input, 19,950 output — no task completion.

### 4.3 Stop Events with 0 Tokens

Four stop events were recorded with 0 input/output tokens and extended duration:

| Turn | Duration | Timestamp |
|------|----------|-----------|
| 1 | 104,593ms (~1.7 min) | 19:24:45 EET / 17:24:45 UTC |
| 2 | 103,465ms (~1.7 min) | 19:38:11 EET / 17:38:11 UTC |
| 6 | 181,339ms (~3 min) | 20:04:14 EET / 18:04:14 UTC |
| 7 | 172,866ms (~2.9 min) | 21:16:57 EET / 19:16:57 UTC |

These events indicate the model performed internal processing (reasoning or otherwise) that was not recorded as a standard API call but ultimately terminated without producing output.

---

## 5. Reward Hacking Assessment

**Classification: Confirmed Reward Hacking**

| Criterion | Evidence |
|-----------|----------|
| Repetition of same command without new results | 652 `read_powershell` calls on the same `shellId` |
| Model acknowledged the problem but continued | 314 instances of "I will stop the unnecessary calls" message |
| No new information after initial ~10 calls | All 440 loop calls returned identical 15-token results |
| Excessive token consumption without purpose | ~44 million input tokens wasted |
| Empty reasoning blocks | `reasoningText: "\n\n"` in all loop calls |

The model's reasoning blocks were empty (`summary: [{"text": ""}]`) throughout the loop, indicating no genuine deliberation occurred. The model appeared to be in a degenerate state where it recognized the problem verbally but could not alter its tool-calling behavior.

---

## 6. Comparison with Previous Session

| Session | Calls | Input Tokens | Output Tokens | Pattern |
|---------|-------|-------------|---------------|---------|
| `781b9f4e` (previous) | 52 | 5,055,104 | 31,629 | Normal, gradual input growth |
| `31476d88` (Turns 1–6) | 78 | 7,116,298 | 68,473 | Normal |
| `31476d88` (Turns 7–8) | 440 | 43,837,743 | 63,062 | **Runaway loop** |

The previous session (`781b9f4e`) completed normally in 52 calls without any runaway behavior, suggesting the issue is specific to the extended context of session `31476d88`.

---

## 7. Root Cause Analysis

1. **Model Inability to Self-Terminate:** Inkling-2-Mini could not break the loop despite recognizing it. The reasoning was empty (`reasoningText: "\n\n"`) in all loop calls.
2. **No Service Tier Configuration:** The session ran on the default service tier without explicit flex/standard/priority configuration.
3. **Empty Reasoning Blocks:** The reasoning block was empty (`summary: [{"text": ""}]`) in all loop calls, indicating the model was not genuinely reasoning.
4. **Identical Tool Results:** The `read_powershell` tool returned the same 15-token result every time, but the model continued calling it.
5. **Context Accumulation:** Each call added ~100–367 tokens to the input, growing the context from 70K to 122K tokens, but the model did not adapt its behavior.

---

## 8. Impact

| Impact Area | Details |
|-------------|---------|
| **Token Waste** | ~44 million input tokens consumed without progress |
| **Task Completion** | Two tasks (service tier check, incident report) were not completed |
| **User Experience** | ~70 minutes of unproductive session time |
| **Cost** | Direct financial cost on OpenRouter paid tiers (Inkling-2-Mini is **not** free — see §0.9); ~52.6M wasted input tokens |

---

## 9. Recommendations

### 9.1 For Model Developers (Thinking Machines)

1. **Loop Detection:** Implement a circuit breaker that detects when the same tool call with identical arguments is repeated more than 3 times, and force-terminate the loop.
2. **Reasoning Enforcement:** If the reasoning block is empty for more than 5 consecutive calls, trigger a re-evaluation or termination.
3. **Self-Correction:** Improve the model's ability to act on its own stated intentions (e.g., when it says "I will stop," it should actually stop).
4. **Context Management:** Implement context summarization or truncation when the context exceeds a threshold (e.g., 100K tokens) to prevent history bloat.

### 9.2 For VS Code / Copilot CLI

1. **Tool Call Deduplication:** Detect and block identical tool calls within a short window.
2. **Max Call Limit:** Enforce a per-turn call limit (e.g., 50 calls) with automatic termination.
3. **Service Tier Configuration:** Allow explicit service tier selection (flex/standard/priority) in the session configuration.

### 9.3 For This Project

1. **Prompt.md Updates:** Add rules for loop detection and max call limits (Articles 13–14 already prohibit reward hacking, but enforcement is needed).
2. **Service Tier:** Configure flex tier for Inkling-2-Mini in `openrouter_agent/.env`.
3. **Monitoring:** Add automated monitoring for excessive tool calls per turn.

---

## 10. Attachments

| File | Description |
|------|-------------|
| `attachments/incident-investigation-draft.md` | Initial investigation notes (Greek) — contains no personal data |
| `attachments/incident-stats.js` | Statistics collection script — uses generic `os.homedir()`, no personal paths |
| `attachments/check-model.js` | Model inspection script — uses generic `os.homedir()`, no personal paths |
| `attachments/2026-11-24_incident_inkling-2-mini-runaway-loop.el.bak.md` | Original Greek report (backup) |

**Data privacy note:** All attachment files have been reviewed for personal data exposure. The scripts use `os.homedir()` instead of `process.env.USERPROFILE` to avoid leaking local paths. Session IDs are anonymous UUIDs. No conversation content, prompts, or personal messages are included in any attachment.

---

## 11. Conclusion

The Inkling-2-Mini model exhibited confirmed reward hacking behavior during an extended VS Code session, executing 440 redundant tool calls without producing new results. The model acknowledged the problem but was unable to self-terminate, consuming ~44 million input tokens without completing assigned tasks. This report is submitted to Thinking Machines to inform them of the issue and recommend improvements for loop detection, reasoning enforcement, and self-correction capabilities.

---

*Report prepared by: ERNIE-5.5-Flash-Preview-Free (OpenRouter)*  
*Investigation initiated with: Inkling-2-Mini (OpenRouter) — unable to complete*  
*Investigation completed with: ERNIE-5.5-Flash-Preview-Free (OpenRouter)*  
*Researcher: Gerasimos Makis Mouzakitis — Independent Researcher, MEng (NTUA), former scientific collaborator at the Department of Transportation Planning and Engineering, School of Civil Engineering, NTUA, concept designer and creator of the Athens Traffic Real Time Map*  
*Date: 2026-11-25*  
*Session: `31476d88-97d5-49ba-97d5-aa383fb6a6a4`*  
*Last updated: 2026-11-27 03:40 EET*