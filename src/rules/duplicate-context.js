const { estimateTokens } = require('../tokens');

// Detects when the same chunk of text appears verbatim in multiple
// messages. Most common cause: RAG retrieval that doesn't dedupe,
// or a developer pasting the same documentation snippet into both
// system and user.

const MIN_CHUNK_CHARS = 80;

function findDuplicates(messages) {
  // Slide windows of paragraphs across messages and track
  // verbatim repeats >= MIN_CHUNK_CHARS.
  const seen = new Map(); // text -> [{messageIndex, role}]
  for (let i = 0; i < messages.length; i++) {
    const text = String(messages[i].content || '');
    if (!text) continue;
    const paragraphs = text.split(/\n\s*\n/);
    for (const p of paragraphs) {
      const key = p.trim();
      if (key.length < MIN_CHUNK_CHARS) continue;
      const arr = seen.get(key) || [];
      arr.push({ index: i, role: messages[i].role });
      seen.set(key, arr);
    }
  }
  const dupes = [];
  for (const [key, locs] of seen) {
    if (locs.length > 1) dupes.push({ text: key, locs });
  }
  return dupes;
}

module.exports = {
  id: 'duplicate-context',
  severity: 'warn',
  category: 'cost',
  description: 'The same paragraph appears in multiple messages - duplicates are pure waste.',
  checkAll(messages) {
    const dupes = findDuplicates(messages);
    return dupes.map((d) => {
      const wasted = (d.locs.length - 1) * estimateTokens(d.text);
      return {
        ruleId: this.id,
        severity: this.severity,
        message: `paragraph (${d.text.length} chars) appears ${d.locs.length} times; ~${wasted} tokens wasted per request`,
        hits: d.locs.map((l) => `messages[${l.index}] (${l.role})`),
        tokensSaved: wasted,
      };
    });
  },
};
