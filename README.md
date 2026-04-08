# PRICEIT — AI Marketing Campaign

**Goal:** Acquire first beta users for PRICEIT, a construction pricing platform.

## Target Segments

| Segment | Profile | Priority |
|---|---|---|
| Small Contractors | 1–10 person crews, owner-operators, price jobs manually | High |
| Large Construction Firms | 50+ employees, estimating departments, ERP users | High |

## Campaign Structure

```
.
├── src/
│   ├── sales-pipeline/     # Lead qualification, outreach sequences, CRM flows
│   └── content-ops/        # Blog, case studies, social, email drip campaigns
├── data/
│   ├── leads/              # Prospect lists by segment
│   ├── content/            # Draft assets, calendars
│   └── analytics/          # Conversion tracking, funnel metrics
└── .claude/
    ├── skills/             # AI skill definitions
    └── campaigns/          # Campaign configs
```

## Skills

- **sales-pipeline** — Automates lead scoring, outreach sequences, and pipeline management
- **content-ops** — Manages content calendar, drafts, SEO, and distribution

## Quick Start

```bash
# Run sales pipeline agent
claude --skill sales-pipeline

# Run content ops agent
claude --skill content-ops
```
