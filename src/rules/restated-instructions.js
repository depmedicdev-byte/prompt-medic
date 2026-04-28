const { estimateTokens } = require('../tokens');

// Detects when the same instruction is restated in multiple places
// (system prompt + user message, or twice in the same message).
// Common cause: developer copy-pasted "respond in JSON" into both
// system and user, doubling the cost.

const COMMON_INSTRUCTIONS = [
  /\brespond (?:only )?(?:in|as|with) json\b/i,
  /\boutput (?:only |must be )?json\b/i,
  /\bdo not include any (?:explanation|preamble|commentary)\b/i,
  /\bbe concise\b/i,
  /\bbe brief\b/i,
  /\bthink step[ -]by[ -]step\b/i,
  /\b(?:do not|don't) (?:add|include) (?:any )?(?:additional )?text\b/i,
  /\breturn only (?:the )?(?:answer|result|json|code)\b/i,
];

module.exports = {
  id: 'restated-instructions',
  severity: 'warn',
  category: 'cost',
  description: 'The same instruction appears in multiple messages - one of them is wasted tokens.',
  checkAll(messages) {
    const findings = [];
    for (const re of COMMON_INSTRUCTIONS) {
      const hits = [];
      for (let i = 0; i < messages.length; i++) {
        const text = String(messages[i].content || '');
        const m = text.match(re);
        if (m) hits.push({ index: i, role: messages[i].role, match: m[0] });
      }
      if (hits.length > 1) {
        const sample = hits[0].match;
        const wasted = (hits.length - 1) * estimateTokens(sample);
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          message: `instruction "${sample}" appears in ${hits.length} messages (${hits.map((h) => h.role).join(', ')}); ~${wasted} tokens wasted per request`,
          hits: hits.map((h) => `messages[${h.index}] (${h.role})`),
          tokensSaved: wasted,
        });
      }
    }
    return findings;
  },
};
