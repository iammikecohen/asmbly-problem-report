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
