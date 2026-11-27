# Inkling-2-Mini (OpenRouter) — Incident Reports

Independent documentation of observed behavioral incidents for the **`thinkingmachines/inkling-2-mini`** model, accessed via the **OpenRouter** provider.

This repository records reproducible observations, diagnostic artifacts, and analysis for three distinct failure modes encountered during agentic tool-use sessions in Visual Studio Code (Copilot CLI).

---

## Incidents

| ID | Date | Title | Severity | Report |
|----|------|-------|----------|--------|
| INC-2026-11-24-001 | 2026-11-24 | Runaway Tool-Call Loop (Reward Hacking) | High | [report.md](incidents/2026-11-incident-01/report.md) |
| INC-2026-11-24-002 | 2026-11-24 | Premature Turn Termination | Medium | [report.md](incidents/2026-11-incident-02/report.md) |
| INC-2026-11-24-003 | 2026-11-24 | Repeated Identical Tool-Call Loop (Investigation Session) | High | [report.md](incidents/2026-11-incident-03/report.md) |

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
├── 2026-11-incident-03/          # Repeated identical tool-call loop
│   ├── report.md
│   └── attachments/
│       ├── incident-stats.js
│       └── repeated-output-check.js
└── shared/
    ├── environment-notes.md
    ├── screenshot_2026-11-26_222011.png   # OpenRouter Total Usage ($) — 24 Nov 2026
    └── screenshot_2026-11-26_222200.png   # OpenRouter Tokens (Total) — 24 Nov 2026
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

## Disclaimer

This repository documents independent, observational findings about the behavior of the `thinkingmachines/inkling-2-mini` model accessed via OpenRouter. The reports reflect the researcher's own sessions and are provided **as-is**, without warranty of any kind. They are not affiliated with, endorsed by, or an official position of Thinking Machines, OpenRouter, Microsoft, or VS Code. Token counts and cost estimates are approximate and depend on the provider and pricing tier that served each request. This material is shared for diagnostic and research purposes only.

The content of the reports was read and checked by the author, **Gerasimos Makis Mouzakitis**, but **may still contain errors**; it has **not** been independently reviewed or verified by a third party. The reports were drafted in collaboration between the author and the LLM model **ERNIE-5.5-Flash-Preview-Free** (both accessed via OpenRouter).

---

*Report prepared by: ERNIE-5.5-Flash-Preview-Free (OpenRouter)*
*Investigation initiated with: Inkling-2-Mini (OpenRouter) — unable to complete*
*Investigation completed with: ERNIE-5.5-Flash-Preview-Free (OpenRouter)*
*Researcher: Gerasimos Makis Mouzakitis — Independent Researcher, MEng (NTUA), former scientific collaborator at the Department of Transportation Planning and Engineering, School of Civil Engineering, NTUA, concept designer and creator of the Athens Traffic Real Time Map*