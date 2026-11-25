# Inkling-2-Mini (OpenRouter) — Incident Reports

Independent documentation of observed behavioral incidents for the **`thinkingmachines/inkling-2-mini`** model, accessed via the **OpenRouter** provider.

This repository records reproducible observations, diagnostic artifacts, and analysis for two distinct failure modes encountered during agentic tool-use sessions in Visual Studio Code (Copilot CLI).

---

## Incidents

| ID | Date | Title | Severity | Report |
|----|------|-------|----------|--------|
| INC-2026-11-24-001 | 2026-11-24 | Runaway Tool-Call Loop (Reward Hacking) | High | [report.md](incidents/2026-11-incident-01/report.md) |
| INC-2026-11-24-002 | 2026-11-24 | Premature Turn Termination | Medium | [report.md](incidents/2026-11-incident-02/report.md) |

---

## Environment

| Component | Details |
|-----------|---------|
| **Model** | `thinkingmachines/inkling-2-mini` |
| **Provider** | OpenRouter |
| **IDE** | Visual Studio Code with Copilot CLI |
| **API Endpoint** | `/responses` |
| **Reasoning Effort** | High |
| **Context Window** | 1M tokens |
| **Service Tier** | Default (not explicitly configured) |
| **Cache** | Disabled |

See [shared/environment-notes.md](shared/environment-notes.md) for details.

---

## Repository Structure

```
inkling-2-mini-openrouter-incidents/
├── README.md
├── LICENSE
├── incidents/
│   ├── 2026-11-incident-01/      # Runaway tool-call loop
│   │   ├── report.md
│   │   └── attachments/
│   │       ├── check-model.js
│   │       ├── incident-stats.js
│   │       └── incident-investigation-draft.md
│   └── 2026-11-incident-02/      # Premature turn termination
│       ├── report.md
│       └── attachments/
│           ├── turn-termination-stats.js
│           └── turn-content.js
└── shared/
    └── environment-notes.md
```

---

## Data Privacy

All reports and attachments have been reviewed for sensitive data:

- **No API keys, tokens, or credentials** are present.
- **No personal filesystem paths** — scripts use `os.homedir()` instead of hardcoded paths.
- **Session IDs** are anonymous UUIDs.
- **No raw private conversation content** is included; only short representative excerpts with English translations are quoted for diagnostic clarity.

---

## License

See [LICENSE](LICENSE).

---

*Maintained by: Gerasimos Makis Mouzakitis — Independent Researcher*