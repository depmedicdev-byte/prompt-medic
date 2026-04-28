const { estimateTokens } = require('../tokens');

// Whitespace tokens add up. Triple+ blank lines, trailing spaces,
// and extreme indentation in pasted text all cost tokens for no
// model benefit.

module.exports = {
  id: 'whitespace-bloat',
  severity: 'info',
  category: 'cost',
  description: 'Excess whitespace adds tokens with no model benefit.',
  check(message) {
    const text = String(message.content || '');
    if (!text) return null;

    const issues = [];
    let saved = 0;

    const tripleBlank = (text.match(/\n\s*\n\s*\n/g) || []).length;
    if (tripleBlank > 0) {
      issues.push(`${tripleBlank} triple-blank-line run(s)`);
      saved += tripleBlank * 2;
    }

    const trailingSpaces = (text.match(/[ \t]+\n/g) || []).length;
    if (trailingSpaces > 5) {
      issues.push(`${trailingSpaces} trailing-whitespace lines`);
      saved += Math.floor(trailingSpaces / 4);
    }

    // Lines indented with 8+ spaces that aren't code (no { } ; etc on the line)
    const lines = text.split('\n');
    let bigIndent = 0;
    for (const line of lines) {
      if (/^\s{8,}\S/.test(line) && !/[{};()]/.test(line)) bigIndent++;
    }
    if (bigIndent > 5) {
      issues.push(`${bigIndent} lines with 8+ space indent (non-code)`);
      saved += bigIndent;
    }

    if (issues.length === 0) return null;

    const compactSaved = Math.max(saved, estimateTokens(text) - estimateTokens(text.replace(/\n\s*\n\s*\n/g, '\n\n').replace(/[ \t]+\n/g, '\n')));

    return {
      ruleId: this.id,
      severity: this.severity,
      message: `excess whitespace in ${message.role || 'message'}: ${issues.join(', ')}; ~${compactSaved} tokens saveable`,
      hits: issues,
      tokensSaved: compactSaved,
    };
  },
};
