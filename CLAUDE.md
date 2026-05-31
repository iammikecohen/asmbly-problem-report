# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`asmbly-problem-report` — a public, read-only dashboard deployed to GitHub Pages that shows open equipment problem reports for Asmbly. Data is sourced from ClickUp (populated by Google Form submissions) and refreshed every 15 minutes via GitHub Actions.

## Common Commands

```bash
npm test                    # Run Jest unit tests (parse-description.js)
node scripts/fetch-clickup.js  # Fetch data manually (requires env vars below)
python3 -m http.server 8080    # Serve public/ locally for browser testing
```

## Environment Variables (for local fetch)

```
CLICKUP_API_TOKEN=your_clickup_personal_api_token
CLICKUP_LIST_ID=901310067725
```

## Architecture

**Data pipeline:** `.github/workflows/update-data.yml` runs on a 15-minute cron, calls `scripts/fetch-clickup.js`, which fetches from the ClickUp REST API v2, parses task descriptions, and writes `public/data.json`. The token stays in GitHub Secrets and is never deployed.

**Frontend:** `public/index.html` is a single self-contained file — no build step. It fetches `data.json` on load and renders a hash-routed SPA:
- `#` (empty) → workspace card grid (landing)
- `#<slug>` → workspace detail view (problems grouped by equipment)

**Parsing:** ClickUp task descriptions follow a fixed Google Form template. `scripts/parse-description.js` extracts `Equipment:`, `Summary:`, `Discourse Link:`, and `Slack Post:` fields line-by-line. The `Workspace` custom field on each task is the area name.

**Deployment:** GitHub Pages serves from the `/public` folder on the `main` branch. Every push to `main` redeploys automatically.
