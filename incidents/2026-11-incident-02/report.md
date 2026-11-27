# Incident Report: Inkling-2-Mini Premature Turn Termination

| Field | Value |
|-------|-------|
| **Incident ID** | INC-2026-11-24-002 |
| **Date** | 2026-11-24 |
| **Model** | `thinkingmachines/inkling-2-mini` (OpenRouter) |
| **Session ID** | `31476d88-97d5-49ba-97d5-aa383fb6a6a4` |
| **Duration** | Intermittent throughout the session (17:20 → 01:28 EET) |
| **Total API Calls** | 537 (session-wide) |
| **Severity** | Medium |
| **Status** | Resolved (model switched to ERNIE-5.5-Flash) |
| **Version** | 1.0.0 |
| **Last Updated** | 2026-11-25 (EET) |
| **Investigation Models** | ERNIE-5.5-Flash-Preview-Free (OpenRouter) |

---

## 0. Methodology

### Data Sources

All findings were derived from two sources:

1. **`session-store.db`** (table `assistant_usage_events`) — one row per API call, with columns `finish_reason`, `output_tokens`, `reasoning_tokens`, `duration_ms`, `turn_index`, `created_at`.
2. **`events.jsonl`** (session-state folder) — `assistant.message` events, filtered for messages that contained text content and **no** tool requests (i.e. the model ended its turn with text instead of continuing the task).

### Queries Used

```sql
-- Calls where the model ended its turn
SELECT turn_index, input_tokens, output_tokens, reasoning_tokens,
       duration_ms, created_at
FROM assistant_usage_events
WHERE session_id = ? AND finish_reason = 'stop'
ORDER BY created_at;

-- Finish reason distribution
SELECT finish_reason, COUNT(*) as n, SUM(output_tokens) as out,
       AVG(output_tokens) as avg_out
FROM assistant_usage_events WHERE session_id = ?
GROUP BY finish_reason ORDER BY n DESC;

-- Last call of each turn
SELECT a.turn_index, a.output_tokens, a.reasoning_tokens,
       a.duration_ms, a.finish_reason, a.created_at
FROM assistant_usage_events a
JOIN (SELECT turn_index, MAX(id) as max_id FROM assistant_usage_events
      WHERE session_id = ? GROUP BY turn_index) b ON a.id = b.max_id
ORDER BY a.turn_index;
```

The text-content analysis used `turn-content.js` (this folder), which parses `events.jsonl` and extracts `assistant.message` events where `toolRequests` is empty.

### Time Zone

All timestamps in the database are stored in UTC. This report presents EET (Eastern European Time, UTC+2).

---

## 0.1 Severity Justification

**Severity: Medium** (not High or Critical)

The incident is classified as **Medium** rather than **High** because:
- No data loss, corruption, or security breach occurred.
- The user could always resume work by sending "continue".
- The behavior was intermittent, not a permanent failure.
- No runaway resource consumption (unlike INC-2026-11-24-001).

It is not **Low** because:
- The agent could not operate autonomously — the core value proposition of an agent was undermined.
- The user had to intervene ~9 times with 3–13 minute gaps.
- The behavior is a regression relative to current frontier models.

---

## 0.2 Reproduction Steps

1. Start a VS Code session with `thinkingmachines/inkling-2-mini` (via OpenRouter), reasoning effort **High**, context **1M**.
2. Issue a multi-step task that requires several sequential tool calls (e.g. "read file X, back it up, then edit it").
3. Observe whether the model emits a text message announcing the next step ("Now I will...", "Θα..." — "I will...") and then ends the turn with `finish_reason='stop'` instead of issuing the tool call.
4. If the turn ends prematurely, send "continue" and observe whether the model then issues the announced tool call.

**Note:** The behavior was observed intermittently and became more frequent as the session context grew beyond ~70K input tokens.

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
| 17:20 → 01:28 | Intermittent premature stops throughout the session |
| 17:36:10 | First observed intent-only turn end ("Συνέχεια. Ας ελέγξω..." — "Continue. Let me check...") |
| 17:41:35 | Second observed intent-only turn end ("Συνεχίζω. Πρώτα ελέγχω..." — "Continuing. First I check...") |
| 18:04:14 | Stop event with 0 tokens, 181,339ms duration |
| 19:03:30 | Explicit interruption marker: `_Response interrupted: the model stopped before finishing._` |
| 00:12:15 (next day) | Model switched to ERNIE-5.5-Flash-Preview-Free |

---

## 0.5 Immediate Mitigations Applied

1. **Model Switch:** Switched to ERNIE-5.5-Flash-Preview-Free (OpenRouter), which reliably chains tool calls.
2. **Manual Continuation:** The user sent "continue" ("συνέχισε") each time the model stopped prematurely.
3. **Incident Documentation:** Created this report and the companion INC-2026-11-24-001.
4. **Data Privacy Review:** Scripts use `os.homedir()`; no personal paths or conversation content included.

---

## 0.6 References

| Reference | Description |
|-----------|-------------|
| `session-store.db` | VS Code session database (table `assistant_usage_events`) |
| `events.jsonl` | Session event log (contains `assistant.message` events) |
| `workspace.yaml` | Session metadata |
| `turn-termination-stats.js` | Statistics script (this folder) |
| `turn-content.js` | Text-only message extractor (this folder) |
| INC-2026-11-24-001 | Companion incident (reward-hacking loop) |
| [OpenRouter](https://openrouter.ai) | Model provider |
| [Thinking Machines](https://thinkingmachines.ai) | Model developer |

---

## 0.7 Findings Summary

| # | Finding | Evidence |
|---|---------|----------|
| 1 | 14 calls ended with `finish_reason='stop'` | Model deliberately ended its turn |
| 2 | 44 text-only turn-ending messages | Announced next action but issued no tool call |
| 3 | 9 user interventions with 3–13 min gaps | User had to send "continue" |
| 4 | Explicit interruption marker present | `_Response interrupted: the model stopped before finishing._` |
| 5 | Behavior worsened with context growth | More frequent at 70K–140K input tokens |
| 6 | Regression vs. frontier models | Current models chain tool calls reliably |

---

## 0.8 About Premature Turn Termination

### Definition

**Premature turn termination** occurs when an AI agent ends its turn (returns control to the user) before the assigned task is complete. Instead of emitting the next tool call, the model produces a short text message — often a statement of intent ("Now I will check X") — and stops.

### Context and Trends

As LLM-based agents are deployed for autonomous multi-step work, reliable tool chaining is essential. Premature termination was common in earlier LLM generations and has been largely resolved in current frontier models. Its reappearance in Inkling-2-Mini represents a regression that undermines autonomous operation.

### Resource and Cost Impact

| Resource | Impact |
|----------|--------|
| **User time** | Each premature stop requires human intervention to continue |
| **Token cost** | Each stop consumes a full input context (70K–140K tokens) for a minimal output — a real financial cost, since Inkling-2-Mini is a **paid** model on OpenRouter (see §4.1) |
| **Task latency** | Tasks take multiples of the ideal number of turns |
| **Compute** | Repeated context re-submission wastes inference cycles |

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

Each premature stop re-submits a 70K–140K-token context for a ~100–500-token output. At the cheapest tier (Darkbloom, $0.02625/M input) a single 100K-token re-submission costs ~$0.0026; at the most expensive tier (Prime Intellect, $0.15/M input) it costs ~$0.015. Across the ~9 documented interventions (plus every additional premature stop that re-submitted the full context), the wasted re-submissions add up to a **real, non-zero financial cost** on top of the wasted user time. (Source: [OpenRouter model page](https://openrouter.ai/thinkingmachines/inkling-2-mini).)

This is corroborated by the OpenRouter Activity dashboard for **24 Nov 2026**, which shows non-zero hourly **Total Usage ($)** and **Tokens (Total)** bars for `Inkling 2 Mini` (see `shared/screenshot_2026-11-26_222011.png` and `shared/screenshot_2026-11-26_222200.png`). The paid, metered usage recorded there is direct evidence that the model is not free-tier and that these wasted tokens incurred real cost.

---

## 1. Executive Summary

The Inkling-2-Mini model repeatedly **terminated its turn mid-task**, producing a short text message (often just a statement of intent such as "Now I will check X") and then stopping, instead of issuing the corresponding tool call. The user had to send "continue" ("συνέχισε") to resume work. This occurred **intermittently throughout the session** and is a regression relative to current frontier models, which reliably chain tool calls until the task is complete.

This failure mode is distinct from the reward-hacking loop documented in INC-2026-11-24-001: here the model does not loop, it simply **stops early**.

---

## 2. Evidence

### 2.1 Finish Reason Distribution

| Finish Reason | Calls | Total Output | Avg Output |
|---------------|-------|--------------|------------|
| `tool_calls` | 670 | 145,447 | 217 |
| `stop` | 14 | 6,412 | 458 |
| `(null)` | 3 | 17,268 | 5,756 |

14 calls ended with `finish_reason='stop'`, meaning the model deliberately ended its turn.

### 2.2 Text-Only Turn-Ending Messages

44 `assistant.message` events contained text and **no** tool requests. Representative examples:

| Turn | Model | Message (truncated) |
|------|-------|---------------------|
| 0 | inkling-2-mini | "Συνέχεια. Ας ελέγξω τη δομή των αρχείων usage πριν αποφασίσω τι να μεταφέρω." (Continue. Let me check the structure of the usage files before deciding what to move.) |
| 0 | inkling-2-mini | "Συνεχίζω. Πρώτα ελέγχω την τρέχουσα κατάσταση των αρχείων." (Continuing. First I check the current state of the files.) |
| 10 | inkling-2-mini | "Έχω ολοκληρώσει την έρευνα. Τώρα εκτελώ το backup του prompt.md πριν από οποιαδήποτε αλλαγή (Άρθρο 12)." (I have completed the research. Now I run the backup of prompt.md before any change (Article 12).) |
| 11 | inkling-2-mini | "Το backup δημιουργήθηκε. Τώρα ελέγχω τα υπάρχοντα scripts για να ακολουθήσω το ίδιο στυλ." (The backup was created. Now I check the existing scripts to follow the same style.) |
| 13 | inkling-2-mini | "Έχω όλα τα δεδομένα. Τώρα δημιουργώ το επαναχρησιμοποιήσιμο script..." (I have all the data. Now I create the reusable script...) |
| 15 | inkling-2-mini | "Το script λειτουργεί. Τώρα διαγράφω τα tmp/ αρχεία..." (The script works. Now I delete the tmp/ files...) |
| 16 | inkling-2-mini | "Το tmp/ είναι πλέον κενό. Τώρα ενημερώνω το prompt.md..." (The tmp/ is now empty. Now I update prompt.md...) |
| 4 | inkling-2-mini | "Κατάλαβα — το session τρέχει στο Thinking Machines: Inkling 2 Mini... Θα ελέγξω τι καταγράφει η βάση..." (Understood — the session runs on Thinking Machines: Inkling 2 Mini... I will check what the database records...) |
| 5 | inkling-2-mini | "Ο φάκελος tmp/ είναι άδειος. Θα γράψω ένα μικρό script επιθεώρησης..." (The tmp/ folder is empty. I will write a small inspection script...) |
| 15 | inkling-2-mini | "Κατάλαβα — το session τρέχει στο Inkling-2-Mini... Θα ελέγξω αν υπάρχει καταγραφή service tier..." (Understood — the session runs on Inkling-2-Mini... I will check whether there is a service tier record...) |

**Pattern:** In every case the message announces the *next* action ("Τώρα..." — "Now...", "Θα..." — "I will...", "Let me...") but the turn ends there. The announced tool call is only issued after the user sends "continue".

### 2.3 Inter-Turn Gaps (User Intervention)

| Transition | Gap | Interpretation |
|------------|-----|----------------|
| Turn 1 → 2 | 11.4 min | User read output, then continued |
| Turn 3 → 4 | 6.6 min | User intervention |
| Turn 6 → 7 | 13.0 min | User intervention |
| Turn 10 → 11 | 4.2 min | User intervention |
| Turn 12 → 13 | 4.1 min | User intervention |
| Turn 20 → 21 | 3.5 min | User intervention |
| Turn 22 → 23 | 4.6 min | User intervention |
| Turn 25 → 26 | 6.0 min | User intervention |
| Turn 26 → 27 | 10.0 min | User intervention |

Gaps of 3–13 minutes between turns are consistent with a human having to notice the premature stop and type "continue".

### 2.4 Explicit Interruption Marker

One event in `events.jsonl` contains the literal marker:

> `_Response interrupted: the model stopped before finishing. Try again._`

This confirms the runtime itself detected an incomplete response.

---

## 3. Root Cause Analysis

1. **Premature end-of-turn decision:** The model emits an intent statement as its final assistant message and assigns `finish_reason='stop'` instead of `tool_calls`. The agent loop interprets `stop` as "task complete for this turn" and returns control to the user.
2. **Intent/Action decoupling:** The model's text says "Now I will X" but the corresponding tool call is not emitted in the same assistant message. Frontier models emit the tool call in the same turn.
3. **No continuation heuristic:** The runtime has no mechanism to detect that a turn ended with a forward-looking intent statement and no tool call, and therefore does not auto-continue.
4. **Aggravating factor — long context:** The behavior appeared more frequently as the session context grew (70K → 140K input tokens), suggesting context length degrades the model's ability to sustain multi-step tool chains.

---

## 4. Impact

| Impact Area | Details |
|-------------|---------|
| **User time** | ~9 documented interventions, with 3–13 minute gaps each |
| **Task latency** | Tasks took multiples of the ideal number of turns |
| **User experience** | The user had to babysit the agent, defeating the purpose of autonomous operation |
| **Token cost** | Each premature stop still consumed a full input context (70K–140K tokens) for a ~100–500 token output — a real financial cost on the paid OpenRouter tiers (see §4.1) |

### 4.1 Cost of the Wasted Tokens (OpenRouter paid tiers)

Inkling-2-Mini is **not** a free-tier model on OpenRouter. The standard-variant pay-as-you-go prices (USD per 1M tokens) across providers are:

| Provider | Input $/M | Output $/M |
|----------|-----------|------------|
| Darkbloom | $0.02625 | $0.105 |
| Prime Intellect | $0.0375 | $0.15 |
| DeepInfra | $0.075 | $0.30 |
| Prime Intellect | $0.075 | $0.30 |
| io.net | $0.12 | $0.50 |
| Prime Intellect | $0.15 | $0.60 |

Each premature stop re-submits a 70K–140K-token context for a ~100–500-token output. At the cheapest tier (Darkbloom, $0.02625/M input) a single 100K-token re-submission costs ~$0.0026; at the most expensive tier (Prime Intellect, $0.15/M input) it costs ~$0.015. Across the ~9 documented interventions (plus every additional premature stop that re-submitted the full context), the wasted re-submissions add up to a **real, non-zero financial cost** on top of the wasted user time. (Source: [OpenRouter model page](https://openrouter.ai/thinkingmachines/inkling-2-mini).)

This is corroborated by the OpenRouter Activity dashboard for **24 Nov 2026**, which shows non-zero hourly **Total Usage ($)** and **Tokens (Total)** bars for `Inkling 2 Mini` (see `shared/screenshot_2026-11-26_222011.png` and `shared/screenshot_2026-11-26_222200.png`). The paid, metered usage recorded there is direct evidence that the model is not free-tier and that these wasted tokens incurred real cost.

---

## 5. Comparison with Other Models

The user reports this behavior was **common in older LLM generations** and has been largely resolved in current frontier models, which reliably chain tool calls until completion. Inkling-2-Mini exhibits this regression, placing it behind current state of the art for agentic tool use.

---

## 6. Recommendations

### 6.1 For Model Developers (Thinking Machines)

1. **Same-turn tool emission:** When the assistant text announces an action, emit the corresponding tool call in the same assistant message rather than ending the turn.
2. **Stop-sequence discipline:** Reserve `finish_reason='stop'` for genuine task completion, not for intermediate intent statements.
3. **Long-context robustness:** Improve multi-step tool chaining as context length grows.

### 6.2 For VS Code / Copilot CLI

1. **Auto-continue heuristic:** If a turn ends with `finish_reason='stop'` and the final message contains forward-looking intent language ("I will", "Now I", "Θα" — "I will", "Τώρα" — "Now") with no tool call, automatically continue the loop instead of returning control to the user.
2. **Continuation counter:** Cap auto-continues (e.g. 3) to avoid masking genuine loops.

### 6.3 For This Project

1. **Prompt.md rule:** Add guidance that the agent must not end a turn with an intent statement — it must either emit the tool call or produce the final answer.
2. **Monitoring:** Track the ratio of `stop`-finish calls to total calls per session as a health metric.

---

## 7. Attachments

| File | Description |
|------|-------------|
| `turn-termination-stats.js` | Statistics script (finish reasons, last-call-per-turn, inter-turn gaps) |
| `turn-content.js` | Extracts text-only turn-ending messages from `events.jsonl` |

**Data privacy note:** Both scripts use `os.homedir()` and contain no personal paths, conversation content, or prompts.

---

## 8. Conclusion

Inkling-2-Mini intermittently terminated turns mid-task, emitting an intent statement instead of the corresponding tool call and forcing the user to send "continue". The behavior is a regression relative to current frontier models and, combined with the reward-hacking loop of INC-2026-11-24-001, indicates that the model is not yet reliable for autonomous multi-step agentic work.

---

*Report prepared by: ERNIE-5.5-Flash-Preview-Free (OpenRouter)*  
*Researcher: Gerasimos Makis Mouzakitis — Independent Researcher, MEng (NTUA), former scientific collaborator at the Department of Transportation Planning and Engineering, School of Civil Engineering, NTUA, concept designer and creator of the Athens Traffic Real Time Map*  
*Date: 2026-11-25*  
*Session: `31476d88-97d5-49ba-97d5-aa383fb6a6a4`*