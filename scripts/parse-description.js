'use strict';

function parseDescription(description) {
  const result = { equipment: null, asset: null, summary: null, discourse_url: null, slack_url: null };
  for (const line of description.split('\n')) {
    const t = line.trim();
    if (/^Equipment:\s*/i.test(t)) {
      result.equipment = t.replace(/^Equipment:\s*/i, '').trim() || null;
    } else if (/^Asset:\s*/i.test(t)) {
      result.asset = t.replace(/^Asset:\s*/i, '').trim() || null;
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
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function getCustomFieldValue(customFields, fieldName) {
  const field = (customFields || []).find(f => f.name === fieldName);
  if (!field) return null;

  if (field.type === 'drop_down' && field.type_config?.options) {
    const option = field.type_config.options.find(
      o => o.orderindex === field.value || o.id === field.value
    );
    return option?.name?.trim() || null;
  }

  return field.value ? String(field.value).trim() : null;
}

function getWorkspaceValue(customFields) {
  return getCustomFieldValue(customFields, 'Workspace');
}

module.exports = { parseDescription, toSlug, getWorkspaceValue, getCustomFieldValue };
