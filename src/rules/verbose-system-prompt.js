const { estimateTokens } = require('../tokens');

const VERBOSE_PHRASES = [
  ['You are a helpful assistant', ''],
  ['As an AI language model,', ''],
  ['I want you to act as', 'Act as'],
  ['Please make sure to', ''],
  ['It is very important that you', ''],
  ['Please remember that', ''],
  ['You should always strive to', ''],
  ['In order to', 'To'],
  ['As a matter of fact,', ''],
  ['It is worth noting that', ''],
  ['Please note that', ''],
  ['I would like you to', ''],
];

module.exports = {
  id: 'verbose-system-prompt',
  severity: 'warn',
  category: 'cost',
  description: 'System prompt contains verbose filler phrases that LLMs already understand without.',
  check(message) {
    if (message.role !== 'system') return null;
    const text = String(message.content || '');
    if (!text) return null;

    const hits = [];
    let savings = 0;
    for (const [phrase, replacement] of VERBOSE_PHRASES) {
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = text.match(re);
      if (!matches) continue;
      hits.push(`"${phrase}" -> "${replacement}" (${matches.length}x)`);
      const before = matches.join(' ');
      const after = matches.map(() => replacement).join(' ');
      savings += estimateTokens(before) - estimateTokens(after);
    }
    if (hits.length === 0) return null;

    return {
      ruleId: this.id,
      severity: this.severity,
      message: `system prompt has ${hits.length} verbose filler pattern${hits.length === 1 ? '' : 's'}; estimated savings ~${savings} tokens per request`,
      hits,
      tokensSaved: savings,
    };
  },
};
