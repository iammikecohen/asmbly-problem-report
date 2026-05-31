# Asmbly Problem Report Dashboard — Design Spec

**Date:** 2026-05-31  
**Status:** Approved

## Overview

A public, read-only dashboard deployed to GitHub Pages that displays open equipment problem reports for Asmbly. Data is sourced from ClickUp, where tasks are created automatically via a Google Form. The dashboard lets anyone view open problems filtered by workspace area, with problems grouped by equipment name within each workspace.

## Data Source

Problem report tasks live in a ClickUp list. Each task is created from a Google Form submission and has:

- **Workspace custom field** — the Area value from the form (e.g. "Woodshop", "Laser Room")
- **Description body** — contains structured text with fields including `Equipment:`, `Summary:`, `Discourse Link:`, and `Slack Post:`, written in a fixed Google Form template format

Statuses that indicate a resolved problem (`closed`, `complete`) are excluded from the dashboard. All other statuses (e.g. "Open", "In Progress") are shown.

## Data Pipeline

A GitHub Actions workflow runs on a **15-minute schedule**:

1. Calls the ClickUp REST API to fetch all non-closed/non-complete tasks from the configured list
2. For each task, reads the `Workspace` custom field and parses the description body using line-prefix matching to extract:
   - `Equipment:` value
   - `Summary:` value
   - `Discourse Link:` URL (if present)
   - `Slack Post:` URL (if present)
3. Tasks missing an Equipment value fall back to `"Unknown Equipment"`
4. Tasks missing a Workspace value are grouped under `"Uncategorized"`
5. Writes `public/data.json` and commits it; GitHub Pages serves the updated file

The ClickUp personal API token is stored as a GitHub Secret (`CLICKUP_API_TOKEN`) and never appears in deployed code. The target list ID is stored as a GitHub Secret or repository variable (`CLICKUP_LIST_ID`) so it can be changed without touching code.

### `data.json` Shape

```json
{
  "updated": "2026-05-31T17:30:00Z",
  "tasks": [
    {
      "id": "abc123",
      "workspace": "Woodshop",
      "equipment": "Belt Sander - Large 36\" Powermatic",
      "summary": "Res tag, limit switch not working",
      "status": "Open",
      "discourse_url": "https://yo.asmbly.org/t/...",
      "slack_url": "https://asmbly-makerspace.slack.com/...",
      "created": "2026-05-29T12:59:00Z"
    }
  ]
}
```

## Frontend

A single `public/index.html` file — vanilla JS, no framework, no build step. On load it fetches `data.json` from the same directory and renders the appropriate view based on the URL hash.

### Routing

| Hash | View |
|------|------|
| `#` or empty | Landing page |
| `#woodshop` | Woodshop workspace view |
| `#laser-room` | Laser Room workspace view |

Workspace slugs are derived at data-generation time: lowercase, spaces replaced with hyphens, non-alphanumeric characters stripped. The slug is stored on each task in `data.json` alongside the display name so the frontend never needs to re-derive it.

Browser back/forward navigate between views naturally via the `hashchange` event.

### Landing Page

Responsive card grid — one card per unique Workspace value in `data.json`. Each card shows:

- Workspace name
- Open problem count
- Color-coded left border: **red** (1+ problems) or **green** (0 problems)

Clicking a card navigates to that workspace's hash route.

### Workspace View

- "← All Workspaces" link returns to landing
- Workspace name as heading with an open-count badge
- Problems **grouped by Equipment name** as section headers
- Under each equipment header, each report shows:
  - Summary text
  - Status badge (styled by status value)
  - Discourse link (if present)
  - Slack link (if present)

### Footer

Every page shows "Last updated X minutes ago" derived from `data.json`'s `updated` timestamp.

## Deployment

- Source lives in a GitHub repository
- `public/` is the GitHub Pages root
- The Actions workflow commits `data.json` directly to `public/` on the default branch
- No build step required — Pages serves `index.html` and `data.json` as-is

## Out of Scope

- Authentication / login
- Writing back to ClickUp (status updates, comments)
- Push notifications or real-time updates
- Mobile-specific native features
