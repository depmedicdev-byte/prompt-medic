# Changelog

## 0.2.0 - companion-tool tip line

- Adds a one-line tip after the audit summary suggesting the
  companion CLI most likely to help with the findings:
  - `prompt-trim` for duplicate / whitespace / few-shot bloat
  - `prompt-cache-key` for verbose stable system prompts
  - both when both apply
- The tip is opt-out friendly. It is **not** shown when:
  - `--no-tip` is passed
  - `--json` is passed (JSON output stays clean for piping)
  - `--quiet` is passed
  - `CI=true` or `CI=1` is set
  - `PROMPT_MEDIC_NO_TIP=1` is set
  - stderr is not a TTY (so redirects, files, and pipes are clean)
- Tip is written to **stderr**, never stdout, so existing pipelines
  reading `prompt-medic` output are unaffected.

## 0.1.0 - initial release

- audit() public API + CLI
- 7 rules: verbose-system-prompt, restated-instructions,
  bloated-tool-defs, duplicate-context, few-shot-bloat,
  whitespace-bloat, verbose-output-spec
- token estimator (heuristic, no tiktoken WASM dependency)
- cost calculator across 8 model price points
- supports OpenAI, Anthropic, and bare-message input shapes
- `--fail-on` for CI usage
