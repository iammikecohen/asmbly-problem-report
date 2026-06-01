'use strict';

const fs = require('fs');
const path = require('path');
const { parseDescription, toSlug, getWorkspaceValue, getCustomFieldValue } = require('./parse-description');

const API_TOKEN = process.env.CLICKUP_API_TOKEN;
const LIST_ID = process.env.CLICKUP_LIST_ID;
const OUT_FILE = path.join(__dirname, '..', 'docs', 'data.json');

if (!API_TOKEN) throw new Error('CLICKUP_API_TOKEN env var is not set');
if (!LIST_ID) throw new Error('CLICKUP_LIST_ID env var is not set');

const EXCLUDED_STATUSES = new Set(['closed', 'complete', 'completed']);

async function fetchPage(page) {
  const url = `https://api.clickup.com/api/v2/list/${LIST_ID}/task?page=${page}&include_closed=true&subtasks=true`;
  const res = await fetch(url, { headers: { Authorization: API_TOKEN } });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(`ClickUp API authentication failed (${res.status})`);
    }
    const body = await res.text();
    throw new Error(`ClickUp API ${res.status}: ${body}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`ClickUp API ${res.status}: invalid JSON response`);
  }
}

async function fetchPageWithRetry(page, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchPage(page);
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = attempt * 2000;
      console.warn(`Attempt ${attempt} failed (${err.message}), retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function fetchAllTasks() {
  const tasks = [];
  let page = 0;
  while (true) {
    const data = await fetchPageWithRetry(page);
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
      const asset = getCustomFieldValue(t.custom_fields, 'Asset');
      return {
        id: t.id,
        workspace,
        workspace_slug: toSlug(workspace),
        equipment: parsed.equipment || asset || 'Unknown Equipment',
        summary: parsed.summary || t.name || 'No summary',
        status: t.status?.status || 'Unknown',
        discourse_url: parsed.discourse_url,
        slack_url: parsed.slack_url,
        created: t.date_created ? new Date(parseInt(t.date_created, 10)).toISOString() : new Date().toISOString(),
      };
    });

  console.log(`Writing ${tasks.length} open tasks to ${OUT_FILE}`);

  const output = { updated: new Date().toISOString(), tasks };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log('Done.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
