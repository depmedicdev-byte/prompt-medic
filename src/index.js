const rules = require('./rules');
const { estimateTokens, tokensToCostUSD } = require('./tokens');

// Public API: audit({ messages, tools, model? }) => { findings, totals }
//
// `messages` is an array of { role, content } objects (OpenAI/
// Anthropic chat-style). `tools` is an optional array of tool /
// function definitions (OpenAI tool format or Anthropic tool format
// both work). `model` defaults to 'gpt-4o' for cost calculation.

function audit({ messages = [], tools = [], model = 'gpt-4o' } = {}) {
  if (!Array.isArray(messages)) {
    throw new TypeError('audit: messages must be an array');
  }

  const findings = [];

  for (const rule of rules) {
    if (typeof rule.checkAll === 'function') {
      const r = rule.checkAll(messages);
      if (Array.isArray(r)) findings.push(...r);
    }
    if (typeof rule.checkTools === 'function' && tools.length) {
      const r = rule.checkTools(tools);
      if (Array.isArray(r)) findings.push(...r);
    }
    if (typeof rule.check === 'function') {
      for (const msg of messages) {
        const r = rule.check(msg);
        if (r) findings.push(r);
      }
    }
  }

  const totalInputTokens =
    messages.reduce((s, m) => s + estimateTokens(String(m.content || '')), 0) +
    estimateTokens(JSON.stringify(tools || []));

  const totalSavings = findings.reduce((s, f) => s + (f.tokensSaved || 0), 0);
  const cappedSavings = Math.min(totalSavings, Math.floor(totalInputTokens * 0.7));

  return {
    findings,
    totals: {
      inputTokens: totalInputTokens,
      tokensSaveable: cappedSavings,
      percentSaveable: totalInputTokens
        ? Math.round((cappedSavings / totalInputTokens) * 100)
        : 0,
      costPerRequestUSD: tokensToCostUSD(totalInputTokens, model),
      costSaveablePerRequestUSD: tokensToCostUSD(cappedSavings, model),
      model,
    },
  };
}

module.exports = { audit, rules, estimateTokens, tokensToCostUSD };
