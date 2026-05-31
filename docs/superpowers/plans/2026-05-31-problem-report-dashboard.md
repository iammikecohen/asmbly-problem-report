# Asmbly Problem Report Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public GitHub Pages dashboard showing open Asmbly equipment problem reports, refreshed from ClickUp every 15 minutes via GitHub Actions.

**Architecture:** A scheduled GitHub Actions workflow fetches tasks from the ClickUp REST API, parses each task's description body to extract Equipment/Summary/links, and writes a static `public/data.json`. A single `public/index.html` reads that file on load and renders a hash-routed single-page app: a workspace card grid on the landing page, and a per-workspace view that groups open problems by equipment name.

**Tech Stack:** Vanilla JS (no build step), Node.js 20 (fetch script + tests), Jest 29 (parser unit tests), GitHub Actions (scheduler + commit), ClickUp REST API v2

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `public/data.json`

- [ ] **Step 1: Initialize git repository**

```bash
cd /Volumes/Apps/code/asmbly_problem_report
git init
```

Expected: `Initialized empty Git repository in .../asmbly_problem_report/.git/`

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "asmbly-problem-report",
  "version": "1.0.0",
  "description": "Asmbly equipment problem report dashboard",
  "private": true,
  "scripts": {
    "test": "jest",
    "fetch": "node scripts/fetch-clickup.js"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, `package-lock.json` written.

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
.superpowers/
```

- [ ] **Step 5: Create placeholder `public/data.json`**

```json
{
  "updated": "2026-01-01T00:00:00Z",
  "tasks": []
}
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore public/data.json CLAUDE.md .mcp.json docs/
git commit -m "chore: initial project scaffold"
```

---

### Task 2: Description Parser + Utilities (TDD)

**Files:**
- Create: `scripts/parse-description.js`
- Create: `scripts/parse-description.test.js`

The description body has a fixed format from the Google Form template. This task builds and tests the three pure functions needed by the fetcher.

- [ ] **Step 1: Create `scripts/parse-description.test.js` with failing tests**

```javascript
'use strict';

const { parseDescription, toSlug, getWorkspaceValue } = require('./parse-description');

const EXAMPLE_DESC = `Issue type: Equipment Problem
Area:  Woodshop
Equipment:  Belt Sander - Large 36" Powermatic
Summary:  Res tag, limit switch not working
Additional Info:  Some details here.

Discourse Link: https://yo.asmbly.org/t/test/1
Slack Post: https://asmbly-makerspace.slack.com/archives/C063/p123

Report generated from a filing.`;

describe('parseDescription', () => {
  test('extracts equipment', () => {
    expect(parseDescription(EXAMPLE_DESC).equipment).toBe('Belt Sander - Large 36" Powermatic');
  });

  test('extracts summary', () => {
    expect(parseDescription(EXAMPLE_DESC).summary).toBe('Res tag, limit switch not working');
  });

  test('extracts discourse_url', () => {
    expect(parseDescription(EXAMPLE_DESC).discourse_url).toBe('https://yo.asmbly.org/t/test/1');
  });

  test('extracts slack_url', () => {
    expect(parseDescription(EXAMPLE_DESC).slack_url).toBe('https://asmbly-makerspace.slack.com/archives/C063/p123');
  });

  test('returns null for missing fields', () => {
    const result = parseDescription('Issue type: Equipment Problem\nSummary: test only');
    expect(result.equipment).toBeNull();
    expect(result.discourse_url).toBeNull();
    expect(result.slack_url).toBeNull();
  });

  test('handles empty description', () => {
    const result = parseDescription('');
    expect(result.equipment).toBeNull();
    expect(result.summary).toBeNull();
    expect(result.discourse_url).toBeNull();
    expect(result.slack_url).toBeNull();
  });
});

describe('toSlug', () => {
  test('lowercases single word', () => {
    expect(toSlug('Woodshop')).toBe('woodshop');
  });

  test('replaces spaces with hyphens', () => {
    expect(toSlug('Metal Shop')).toBe('metal-shop');
    expect(toSlug('South Mezzanine')).toBe('south-mezzanine');
  });

  test('collapses multiple spaces', () => {
    expect(toSlug('Big  Space')).toBe('big-space');
  });

  test('strips non-alphanumeric characters', () => {
    expect(toSlug('Laser/CNC Room')).toBe('lasercnc-room');
  });
});

describe('getWorkspaceValue', () => {
  test('returns value from text field', () => {
    const fields = [{ name: 'Workspace', type: 'text', value: 'Woodshop' }];
    expect(getWorkspaceValue(fields)).toBe('Woodshop');
  });

  test('returns option name from dropdown field', () => {
    const fields = [{
      name: 'Workspace',
      type: 'drop_down',
      value: 1,
      type_config: {
        options: [
          { orderindex: 0, name: 'Metal Shop' },
          { orderindex: 1, name: 'Woodshop' },
        ],
      },
    }];
    expect(getWorkspaceValue(fields)).toBe('Woodshop');
  });

  test('returns null when Workspace field not present', () => {
    expect(getWorkspaceValue([])).toBeNull();
    expect(getWorkspaceValue(null)).toBeNull();
  });

  test('returns null when value is empty string', () => {
    const fields = [{ name: 'Workspace', type: 'text', value: '' }];
    expect(getWorkspaceValue(fields)).toBeNull();
  });

  test('trims whitespace from value', () => {
    const fields = [{ name: 'Workspace', type: 'text', value: '  Woodshop  ' }];
    expect(getWorkspaceValue(fields)).toBe('Woodshop');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: All tests fail with `Cannot find module './parse-description'`.

- [ ] **Step 3: Create `scripts/parse-description.js`**

```javascript
'use strict';

function parseDescription(description) {
  const result = { equipment: null, summary: null, discourse_url: null, slack_url: null };
  for (const line of description.split('\n')) {
    const t = line.trim();
    if (/^Equipment:\s*/i.test(t)) {
      result.equipment = t.replace(/^Equipment:\s*/i, '').trim() || null;
    } else if (/^Summary:\s*/i.test(t)) {
      result.summary = t.replace(/^Summary:\s*/i, '').trim() || null;
    } else if (/^Discourse Link:\s*/i.test(t)) {
      result.discourse_url = t.replace(/^Discourse Link:\s*/i, '').trim() || null;
    } else if (/^Slack Post:\s*/i.test(t)) {
      result.slack_url = t.replace(/^Slack Post:\s*/i, '').trim() || null;
    }
  }
  return result;
}

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function getWorkspaceValue(customFields) {
  const field = (customFields || []).find(f => f.name === 'Workspace');
  if (!field) return null;

  if (field.type === 'drop_down' && field.type_config?.options) {
    const option = field.type_config.options.find(
      o => o.orderindex === field.value || o.id === field.value
    );
    return option?.name?.trim() || null;
  }

  return field.value ? String(field.value).trim() : null;
}

module.exports = { parseDescription, toSlug, getWorkspaceValue };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: All 12 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse-description.js scripts/parse-description.test.js
git commit -m "feat: description parser and workspace utilities"
```

---

### Task 3: ClickUp Data Fetcher

**Files:**
- Create: `scripts/fetch-clickup.js`

This script is the only file that makes network calls, so it has no unit tests. Validate by running it against the real API locally before the next task.

- [ ] **Step 1: Create `scripts/fetch-clickup.js`**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const { parseDescription, toSlug, getWorkspaceValue } = require('./parse-description');

const API_TOKEN = process.env.CLICKUP_API_TOKEN;
const LIST_ID = process.env.CLICKUP_LIST_ID;
const OUT_FILE = path.join(__dirname, '..', 'public', 'data.json');

if (!API_TOKEN) throw new Error('CLICKUP_API_TOKEN env var is not set');
if (!LIST_ID) throw new Error('CLICKUP_LIST_ID env var is not set');

const EXCLUDED_STATUSES = new Set(['closed', 'complete', 'completed']);

async function fetchPage(page) {
  const url = `https://api.clickup.com/api/v2/list/${LIST_ID}/task?page=${page}&include_closed=true&subtasks=true`;
  const res = await fetch(url, { headers: { Authorization: API_TOKEN } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp API ${res.status}: ${body}`);
  }
  return res.json();
}

async function fetchAllTasks() {
  const tasks = [];
  let page = 0;
  while (true) {
    const data = await fetchPage(page);
    const batch = data.tasks || [];
    tasks.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return tasks;
}

async function main() {
  console.log(`Fetching tasks from list ${LIST_ID}...`);
  const raw = await fetchAllTasks();
  console.log(`Fetched ${raw.length} total tasks`);

  const tasks = raw
    .filter(t => !EXCLUDED_STATUSES.has((t.status?.status || '').toLowerCase()))
    .map(t => {
      const workspace = getWorkspaceValue(t.custom_fields) || 'Uncategorized';
      const parsed = parseDescription(t.description || '');
      return {
        id: t.id,
        workspace,
        workspace_slug: toSlug(workspace),
        equipment: parsed.equipment || 'Unknown Equipment',
        summary: parsed.summary || t.name,
        status: t.status?.status || 'Unknown',
        discourse_url: parsed.discourse_url,
        slack_url: parsed.slack_url,
        created: new Date(parseInt(t.date_created, 10)).toISOString(),
      };
    });

  console.log(`Writing ${tasks.length} open tasks to ${OUT_FILE}`);

  const output = { updated: new Date().toISOString(), tasks };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log('Done.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
```

- [ ] **Step 2: Smoke-test against the real ClickUp API**

You need your ClickUp personal API token and the list ID from the board URL. The list ID is in the board URL: `https://sharing.clickup.com/90131034630/b/h/6-901310067725-2/...` → list ID is `901310067725`.

```bash
CLICKUP_API_TOKEN=your_token_here CLICKUP_LIST_ID=901310067725 node scripts/fetch-clickup.js
```

Expected output:
```
Fetching tasks from list 901310067725...
Fetched N total tasks
Writing M open tasks to .../public/data.json
Done.
```

Then verify `public/data.json` looks correct:
```bash
node -e "const d=require('./public/data.json'); console.log(d.tasks.slice(0,2))"
```

Confirm tasks have `workspace`, `equipment`, `summary`, and `status` fields populated.

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-clickup.js
git commit -m "feat: ClickUp data fetcher"
```

---

### Task 4: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/update-data.yml`

- [ ] **Step 1: Create `.github/workflows/update-data.yml`**

```yaml
name: Update ClickUp Data

on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Fetch ClickUp data
        env:
          CLICKUP_API_TOKEN: ${{ secrets.CLICKUP_API_TOKEN }}
          CLICKUP_LIST_ID: ${{ vars.CLICKUP_LIST_ID }}
        run: node scripts/fetch-clickup.js

      - name: Commit updated data.json
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data.json
          git diff --staged --quiet || git commit -m "chore: update problem report data"
          git push
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/update-data.yml
git commit -m "feat: scheduled GitHub Actions workflow to refresh data"
```

---

### Task 5: Frontend — HTML Shell, CSS, and Landing Page

**Files:**
- Create: `public/index.html`

- [ ] **Step 1: Create `public/index.html` with full HTML, CSS, and landing page JS**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Asmbly Problem Reports</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      --bg: #0f1117;
      --surface: #1e2030;
      --surface-hover: #252840;
      --text: #e0e0e0;
      --text-muted: #888;
      --accent: #4a9eff;
      --red: #e74c3c;
      --yellow: #f39c12;
      --green: #2ecc71;
      --border: #2a2d45;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
    }

    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    header h1 { margin: 0; font-size: 1.2rem; font-weight: 600; }

    .updated { font-size: 0.8rem; color: var(--text-muted); }

    main { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }

    /* Landing */
    .workspace-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }

    .workspace-card {
      background: var(--surface);
      border-radius: 8px;
      padding: 1.2rem;
      border-left: 4px solid var(--border);
      cursor: pointer;
      text-decoration: none;
      color: var(--text);
      display: block;
      transition: background 0.15s;
    }

    .workspace-card:hover { background: var(--surface-hover); }
    .workspace-card.has-problems { border-left-color: var(--red); }
    .workspace-card.no-problems { border-left-color: var(--green); }

    .workspace-card .ws-name { font-size: 1rem; font-weight: 600; }

    .workspace-card .ws-count {
      font-size: 2rem;
      font-weight: 700;
      line-height: 1;
      margin: 0.4rem 0 0.2rem;
    }

    .workspace-card.has-problems .ws-count { color: var(--red); }
    .workspace-card.no-problems .ws-count { color: var(--green); }

    .workspace-card .ws-label { font-size: 0.75rem; color: var(--text-muted); }

    /* Workspace detail */
    .back-link {
      color: var(--accent);
      text-decoration: none;
      font-size: 0.9rem;
      display: inline-block;
      margin-bottom: 1rem;
    }

    .back-link:hover { text-decoration: underline; }

    .workspace-heading {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .workspace-heading h2 { margin: 0; font-size: 1.5rem; }

    /* Badges */
    .badge {
      font-size: 0.75rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-weight: 600;
      white-space: nowrap;
    }

    .badge-red    { background: rgba(231,76,60,0.15);  color: var(--red); }
    .badge-yellow { background: rgba(243,156,18,0.15); color: var(--yellow); }
    .badge-green  { background: rgba(46,204,113,0.15); color: var(--green); }
    .badge-muted  { background: rgba(255,255,255,0.08); color: var(--text-muted); }

    /* Equipment group */
    .equipment-group { margin-bottom: 1.75rem; }

    .equipment-name {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid var(--border);
    }

    .problem-card {
      background: var(--surface);
      border-radius: 6px;
      padding: 0.9rem 1rem;
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .problem-summary { font-size: 0.9rem; flex: 1; }

    .problem-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.35rem;
      flex-shrink: 0;
    }

    .problem-meta a {
      color: var(--accent);
      font-size: 0.8rem;
      text-decoration: none;
    }

    .problem-meta a:hover { text-decoration: underline; }

    .empty-state, .loading {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
    }

    footer {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-muted);
      font-size: 0.8rem;
      border-top: 1px solid var(--border);
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>Asmbly Problem Reports</h1>
    <span class="updated" id="updated-time"></span>
  </header>
  <main id="app">
    <div class="loading">Loading...</div>
  </main>
  <footer id="footer"></footer>

  <script>
    let data = null;

    // ── Utilities ──────────────────────────────────────────────

    function esc(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function toSlug(name) {
      return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    function relativeTime(iso) {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
      if (diff < 1) return 'Updated just now';
      if (diff === 1) return 'Updated 1 minute ago';
      return `Updated ${diff} minutes ago`;
    }

    function groupBy(arr, key) {
      return arr.reduce((acc, item) => {
        const k = item[key] || 'Unknown';
        (acc[k] = acc[k] || []).push(item);
        return acc;
      }, {});
    }

    function statusBadgeClass(status) {
      const s = (status || '').toLowerCase();
      if (s === 'open') return 'badge-red';
      if (s.includes('progress') || s.includes('review')) return 'badge-yellow';
      return 'badge-muted';
    }

    // ── Rendering ─────────────────────────────────────────────

    function renderLanding() {
      const byWorkspace = groupBy(data.tasks, 'workspace');
      const sorted = Object.entries(byWorkspace)
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

      if (sorted.length === 0) {
        document.getElementById('app').innerHTML =
          '<div class="empty-state">No open problems reported.</div>';
        return;
      }

      const cards = sorted.map(([name, tasks]) => {
        const slug = tasks[0]?.workspace_slug || toSlug(name);
        const count = tasks.length;
        const cls = count > 0 ? 'has-problems' : 'no-problems';
        const label = count === 1 ? 'open problem' : 'open problems';
        return `<a class="workspace-card ${cls}" href="#${slug}">
          <div class="ws-name">${esc(name)}</div>
          <div class="ws-count">${count}</div>
          <div class="ws-label">${label}</div>
        </a>`;
      }).join('');

      document.getElementById('app').innerHTML =
        `<div class="workspace-grid">${cards}</div>`;
    }

    function renderWorkspace(slug) {
      const tasks = data.tasks.filter(t => t.workspace_slug === slug);
      const name = tasks[0]?.workspace || slug;

      const back = `<a class="back-link" href="#">← All Workspaces</a>`;

      if (tasks.length === 0) {
        document.getElementById('app').innerHTML =
          `${back}<div class="empty-state">No open problems in this workspace.</div>`;
        return;
      }

      const countBadge = `<span class="badge badge-red">${tasks.length} open</span>`;
      const heading = `<div class="workspace-heading">
        <h2>${esc(name)}</h2>${countBadge}
      </div>`;

      const byEquipment = groupBy(tasks, 'equipment');
      const groups = Object.entries(byEquipment).map(([equip, problems]) => {
        const cards = problems.map(t => {
          const links = [
            t.discourse_url
              ? `<a href="${esc(t.discourse_url)}" target="_blank" rel="noopener">Discourse ↗</a>`
              : '',
            t.slack_url
              ? `<a href="${esc(t.slack_url)}" target="_blank" rel="noopener">Slack ↗</a>`
              : '',
          ].filter(Boolean).join('');

          return `<div class="problem-card">
            <div class="problem-summary">${esc(t.summary)}</div>
            <div class="problem-meta">
              <span class="badge ${statusBadgeClass(t.status)}">${esc(t.status)}</span>
              ${links}
            </div>
          </div>`;
        }).join('');

        return `<div class="equipment-group">
          <div class="equipment-name">${esc(equip)}</div>
          ${cards}
        </div>`;
      }).join('');

      document.getElementById('app').innerHTML = `${back}${heading}${groups}`;
    }

    // ── Routing ───────────────────────────────────────────────

    function render() {
      if (!data) return;
      const slug = window.location.hash.slice(1);
      slug ? renderWorkspace(slug) : renderLanding();
    }

    // ── Bootstrap ─────────────────────────────────────────────

    async function init() {
      const res = await fetch('./data.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();

      const timeText = relativeTime(data.updated);
      document.getElementById('updated-time').textContent = timeText;
      document.getElementById('footer').textContent = timeText;

      render();
    }

    window.addEventListener('hashchange', render);

    init().catch(err => {
      document.getElementById('app').innerHTML =
        `<div class="empty-state">Failed to load data: ${esc(err.message)}</div>`;
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Smoke-test locally**

```bash
cd public && python3 -m http.server 8080
```

Open `http://localhost:8080` in a browser. With the placeholder `data.json` (empty tasks array) you should see "No open problems reported." with no JS errors in the console.

To test with real data, run the fetcher first (requires env vars from Task 3 Step 2), then reload the server.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: frontend dashboard with landing and workspace views"
```

---

### Task 6: Push to GitHub and Configure Deployment

**Files:** none new — configuration only

- [ ] **Step 1: Create a new GitHub repository**

Go to https://github.com/new. Name it `asmbly-problem-report`. Set visibility to **Public**. Do not initialize with README/gitignore.

- [ ] **Step 2: Push to GitHub**

```bash
git remote add origin https://github.com/<your-org-or-username>/asmbly-problem-report.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Add GitHub Secret and Variable**

In the repository on GitHub: **Settings → Secrets and variables → Actions**

1. Under **Secrets**, click "New repository secret":
   - Name: `CLICKUP_API_TOKEN`
   - Value: your ClickUp personal API token (Settings → Apps → API Token in ClickUp)

2. Under **Variables**, click "New repository variable":
   - Name: `CLICKUP_LIST_ID`
   - Value: `901310067725`

- [ ] **Step 4: Enable GitHub Pages**

In the repository: **Settings → Pages**

- Source: **Deploy from a branch**
- Branch: `main`
- Folder: `/public`
- Click **Save**

GitHub will show the Pages URL (e.g. `https://<org>.github.io/asmbly-problem-report`). It may take a minute to deploy.

- [ ] **Step 5: Trigger the workflow manually**

In the repository: **Actions → Update ClickUp Data → Run workflow**

After it completes, check that `public/data.json` was updated with real tasks and the Pages site shows live data.

- [ ] **Step 6: Verify the live site**

Open the Pages URL. Confirm:
- Workspace cards appear on the landing page
- Clicking a workspace card navigates to the workspace view
- Problems are grouped by equipment
- Discourse and Slack links are present where applicable
- "Updated X minutes ago" reflects the last workflow run

---

## Post-Deploy Notes

- The workflow runs every 15 minutes. GitHub Actions may delay scheduled runs by a few minutes during high load.
- To change the refresh interval, edit the `cron` value in `.github/workflows/update-data.yml`.
- To add a new workspace, no code changes are needed — workspaces are derived from the ClickUp data automatically.
- To find your ClickUp personal API token: ClickUp → your avatar (bottom-left) → **Settings → Apps → API Token**.
