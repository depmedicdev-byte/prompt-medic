const { estimateTokens } = require('../tokens');

// Few-shot examples are useful but easy to overdo. Modern instruct
// models often perform identically with 1-2 examples versus 8-10,
// at a fraction of the cost. This rule flags message lists that
// look like they have many same-pattern examples.

module.exports = {
  id: 'few-shot-bloat',
  severity: 'info',
  category: 'cost',
  description: 'Many few-shot examples; modern instruct models usually need only 1-3.',
  checkAll(messages) {
    // Heuristic: look for runs of user/assistant alternations BEFORE
    // the final user message, where all the user messages share a
    // similar structure (e.g., all start with "Q:" or all are <100 chars).
    if (messages.length < 6) return [];

    const userMsgs = messages
      .map((m, i) => ({ ...m, index: i }))
      .filter((m) => m.role === 'user');

    if (userMsgs.length < 4) return [];

    // Drop the final user message (the actual query) and look at
    // the rest as candidate few-shots.
    const shots = userMsgs.slice(0, -1);

    // Detect common prefixes
    const prefixes = shots
      .map((m) => String(m.content || '').slice(0, 20).toLowerCase().trim())
      .filter(Boolean);
    const counts = new Map();
    for (const p of prefixes) {
      const head = p.split(/[\s:]/)[0];
      if (!head) continue;
      counts.set(head, (counts.get(head) || 0) + 1);
    }
    let dominantHead = null;
    let dominantCount = 0;
    for (const [k, v] of counts) {
      if (v > dominantCount) {
        dominantHead = k;
        dominantCount = v;
      }
    }

    if (dominantCount < 4) return [];

    // Estimate savings if we cut to 2 shots
    const totalShotTokens = shots.reduce(
      (sum, m) => sum + estimateTokens(String(m.content || '')),
      0,
    );
    const keepRatio = 2 / shots.length;
    const saved = Math.round(totalShotTokens * (1 - keepRatio));

    return [
      {
        ruleId: this.id,
        severity: this.severity,
        message: `${shots.length} few-shot user messages detected (sharing prefix "${dominantHead}"); cutting to 2 saves ~${saved} tokens per request`,
        hits: shots.map((m) => `messages[${m.index}]`),
        tokensSaved: saved,
      },
    ];
  },
};
