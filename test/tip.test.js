'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pickTip, shouldShowTip } = require('../src/tip.js');

const VERBOSE_FINDING = { ruleId: 'verbose-system-prompt', severity: 'warn' };
const RESTATED_FINDING = { ruleId: 'restated-instructions', severity: 'warn' };
const DUP_FINDING = { ruleId: 'duplicate-context', severity: 'warn' };
const WS_FINDING = { ruleId: 'whitespace-bloat', severity: 'info' };
const FEW_SHOT_FINDING = { ruleId: 'few-shot-bloat', severity: 'info' };

test('pickTip: clean prompt returns null', () => {
  const r = { findings: [], totals: { tokensSaveable: 0 } };
  assert.equal(pickTip(r), null);
});

test('pickTip: only verbose system -> recommends prompt-cache-key', () => {
  const r = { findings: [VERBOSE_FINDING], totals: { tokensSaveable: 200 } };
  const tip = pickTip(r);
  assert.match(tip, /prompt-cache-key/);
  assert.doesNotMatch(tip, /prompt-trim/);
});

test('pickTip: only shrinkable bloat -> recommends prompt-trim', () => {
  const r = { findings: [DUP_FINDING, WS_FINDING], totals: { tokensSaveable: 50 } };
  const tip = pickTip(r);
  assert.match(tip, /prompt-trim/);
  assert.doesNotMatch(tip, /prompt-cache-key/);
});

test('pickTip: both classes -> recommends both', () => {
  const r = {
    findings: [RESTATED_FINDING, FEW_SHOT_FINDING],
    totals: { tokensSaveable: 500 },
  };
  const tip = pickTip(r);
  assert.match(tip, /prompt-cache-key/);
  assert.match(tip, /prompt-trim/);
});

test('pickTip: defends against missing fields', () => {
  assert.equal(pickTip(null), null);
  assert.equal(pickTip({}), null);
  assert.equal(pickTip({ findings: [] }), null);
});

test('shouldShowTip: default TTY case shows it', () => {
  const ok = shouldShowTip({ args: {}, env: {}, stderrIsTTY: true });
  assert.equal(ok, true);
});

test('shouldShowTip: --no-tip suppresses', () => {
  const ok = shouldShowTip({ args: { noTip: true }, env: {}, stderrIsTTY: true });
  assert.equal(ok, false);
});

test('shouldShowTip: --json suppresses', () => {
  const ok = shouldShowTip({ args: { json: true }, env: {}, stderrIsTTY: true });
  assert.equal(ok, false);
});

test('shouldShowTip: --quiet suppresses', () => {
  const ok = shouldShowTip({ args: { quiet: true }, env: {}, stderrIsTTY: true });
  assert.equal(ok, false);
});

test('shouldShowTip: CI env suppresses', () => {
  assert.equal(shouldShowTip({ args: {}, env: { CI: 'true' }, stderrIsTTY: true }), false);
  assert.equal(shouldShowTip({ args: {}, env: { CI: '1' }, stderrIsTTY: true }), false);
});

test('shouldShowTip: PROMPT_MEDIC_NO_TIP=1 suppresses', () => {
  const ok = shouldShowTip({ args: {}, env: { PROMPT_MEDIC_NO_TIP: '1' }, stderrIsTTY: true });
  assert.equal(ok, false);
});

test('shouldShowTip: non-TTY stderr suppresses (clean pipes)', () => {
  const ok = shouldShowTip({ args: {}, env: {}, stderrIsTTY: false });
  assert.equal(ok, false);
});
