const { test } = require('node:test');
const assert = require('node:assert/strict');
const { audit, estimateTokens } = require('../src/index.js');

test('clean prompt produces no findings', () => {
  const r = audit({
    messages: [
      { role: 'system', content: 'Translate user input to French.' },
      { role: 'user', content: 'Hello, world.' },
    ],
  });
  assert.equal(r.findings.length, 0);
});

test('verbose system prompt is flagged', () => {
  const r = audit({
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant. As an AI language model, please make sure to be polite. It is very important that you respond in JSON.',
      },
    ],
  });
  const ids = r.findings.map((f) => f.ruleId);
  assert.ok(ids.includes('verbose-system-prompt'), 'verbose-system-prompt should fire');
});

test('restated instructions across messages flagged', () => {
  const r = audit({
    messages: [
      { role: 'system', content: 'Respond only in JSON.' },
      { role: 'user', content: 'Question: tell me a joke. Respond only in JSON.' },
    ],
  });
  const ids = r.findings.map((f) => f.ruleId);
  assert.ok(ids.includes('restated-instructions'));
});

test('duplicate-context detects repeated paragraphs', () => {
  const para = 'The quick brown fox jumps over the lazy dog. '.repeat(4).trim();
  const r = audit({
    messages: [
      { role: 'system', content: para },
      { role: 'user', content: 'Question follows.\n\n' + para },
    ],
  });
  const ids = r.findings.map((f) => f.ruleId);
  assert.ok(ids.includes('duplicate-context'));
});

test('bloated tool definitions: large total budget', () => {
  const tools = [];
  for (let i = 0; i < 20; i++) {
    tools.push({
      type: 'function',
      function: {
        name: `tool_${i}`,
        description: 'a'.repeat(400),
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
  }
  const r = audit({ messages: [{ role: 'user', content: 'hi' }], tools });
  const ids = r.findings.map((f) => f.ruleId);
  assert.ok(ids.includes('bloated-tool-defs'));
});

test('totals include cost estimate', () => {
  const r = audit({
    messages: [{ role: 'user', content: 'hello world' }],
    model: 'gpt-4o',
  });
  assert.ok(typeof r.totals.costPerRequestUSD === 'number');
  assert.ok(r.totals.inputTokens > 0);
});

test('estimateTokens is monotonic', () => {
  assert.ok(estimateTokens('a'.repeat(400)) > estimateTokens('a'.repeat(100)));
});

test('few-shot bloat fires on many user messages', () => {
  const messages = [
    { role: 'system', content: 'classify' },
    ...Array.from({ length: 6 }).flatMap((_, i) => [
      { role: 'user', content: `Q: example question ${i} that is long enough to count.` },
      { role: 'assistant', content: `A: answer ${i}` },
    ]),
    { role: 'user', content: 'Q: real question.' },
  ];
  const r = audit({ messages });
  const ids = r.findings.map((f) => f.ruleId);
  assert.ok(ids.includes('few-shot-bloat'));
});

test('whitespace-bloat fires on triple blanks', () => {
  const r = audit({
    messages: [
      { role: 'user', content: 'line one\n\n\n\nline two\n\n\n\nline three' },
    ],
  });
  const ids = r.findings.map((f) => f.ruleId);
  assert.ok(ids.includes('whitespace-bloat'));
});
