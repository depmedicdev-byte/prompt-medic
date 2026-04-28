const { estimateTokens } = require('../tokens');

// Detects bloated output-format specifications. Patterns like
// "Please format your output as follows: <example>" are usually
// 3-5x longer than they need to be. A schema reference or a tight
// JSON skeleton is enough.

const PATTERNS = [
  /please (?:format|structure) your (?:output|response|answer) (?:as|in) (?:the )?following/i,
  /your response (?:should|must) (?:be )?(?:formatted|structured) (?:as|in) (?:the )?following/i,
  /follow (?:exactly|strictly) (?:the|this) (?:format|structure|template):/i,
  /here is an example of (?:the|a)? (?:correct|expected|desired) (?:output|response|format):/i,
];

module.exports = {
  id: 'verbose-output-spec',
  severity: 'info',
  category: 'cost',
  description: 'Output-format spec is more verbose than it needs to be.',
  check(message) {
    const text = String(message.content || '');
    if (!text) return null;

    for (const re of PATTERNS) {
      const m = text.match(re);
      if (!m) continue;
      // Find the chunk that follows (up to 2 paragraphs) and estimate
      const idx = text.indexOf(m[0]);
      const chunk = text.slice(idx, idx + 800);
      const compactEquivalent = 'Output format: <JSON schema or terse template>';
      const saved = estimateTokens(chunk) - estimateTokens(compactEquivalent);
      if (saved < 20) continue;
      return {
        ruleId: this.id,
        severity: this.severity,
        message: `verbose output-format spec ("${m[0]}..."); a schema reference saves ~${saved} tokens`,
        hits: [m[0]],
        tokensSaved: saved,
      };
    }
    return null;
  },
};
