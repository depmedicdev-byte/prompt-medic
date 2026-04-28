# Changelog

## 0.1.0 - initial release

- audit() public API + CLI
- 7 rules: verbose-system-prompt, restated-instructions,
  bloated-tool-defs, duplicate-context, few-shot-bloat,
  whitespace-bloat, verbose-output-spec
- token estimator (heuristic, no tiktoken WASM dependency)
- cost calculator across 8 model price points
- supports OpenAI, Anthropic, and bare-message input shapes
- `--fail-on` for CI usage
