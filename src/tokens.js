// Lightweight token estimator. We deliberately don't ship the full
// tiktoken WASM (adds ~3MB to the install) because for most audit
// purposes a fast heuristic is fine - we're estimating savings on
// the order of "ballpark this is X hundred tokens", not pricing
// every request to the dollar.
//
// The heuristic uses the well-documented ~4-char-per-token average
// for English text, with a small adjustment for code-heavy content
// (more punctuation = more tokens) and JSON (very token-dense due
// to braces and quotes).

const NEWLINE_RE = /\n/g;
const PUNCT_RE = /[{}\[\]<>(),;:."'`/\\|+=*&^%$#@!?~-]/g;
const WS_RE = /\s+/g;

function estimateTokens(text) {
  if (!text) return 0;
  if (typeof text !== 'string') text = String(text);

  const len = text.length;
  if (len === 0) return 0;

  // Count signal characters
  const newlines = (text.match(NEWLINE_RE) || []).length;
  const punct = (text.match(PUNCT_RE) || []).length;
  const wsRuns = (text.match(WS_RE) || []).length;

  // Base estimate: 4 chars per token
  let est = Math.ceil(len / 4);

  // JSON / code: punctuation density boost
  // English averages about 1 punctuation per 20 chars; code/JSON
  // can be 1 per 4 chars. Each extra punctuation costs roughly half
  // a token versus the same chars as letters.
  const punctRatio = punct / len;
  if (punctRatio > 0.1) {
    est = Math.ceil(est * (1 + (punctRatio - 0.1) * 0.6));
  }

  // Newlines almost always tokenize as their own token
  est += Math.max(0, newlines - Math.floor(len / 80));

  return est;
}

function tokensToCostUSD(tokens, model = 'gpt-4o') {
  // Rough mid-2025 pricing per 1M tokens (input). Used only for
  // ballpark "$0.0X per request" estimates in CLI output.
  const PRICING = {
    'gpt-4o': 2.50,
    'gpt-4o-mini': 0.15,
    'gpt-4-turbo': 10.00,
    'claude-sonnet': 3.00,
    'claude-opus': 15.00,
    'claude-haiku': 0.25,
    'gemini-pro': 1.25,
    'gemini-flash': 0.075,
  };
  const rate = PRICING[model] ?? PRICING['gpt-4o'];
  return (tokens / 1_000_000) * rate;
}

module.exports = { estimateTokens, tokensToCostUSD };
