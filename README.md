# prompt-doctor

Audit LLM prompts and system messages for token waste. Rule-based,
fast, no API calls, no telemetry.

```bash
npx prompt-doctor request.json
```

```
WARN  verbose-system-prompt  system prompt has 8 filler patterns; ~43 tokens/req
WARN  bloated-tool-defs      tool "lookup_account" description is 332 chars
WARN  restated-instructions  "respond in JSON" appears in system + user; ~4 tokens/req
INFO  whitespace-bloat       1 triple-blank-line run(s)

summary
  input tokens (est):  330
  saveable:            146 (~44%)
  per-request cost:    $0.00082 on gpt-4o
  at 100k req/mo:     $36.50/mo saved
```

## What it checks

| rule | what it catches | why it matters |
|------|------------------|-----------------|
| `verbose-system-prompt` | "You are a helpful assistant", "As an AI language model,", "Please make sure to" | Modern instruct models don't need ceremony. Each phrase costs 5-10 tokens per request, every request. |
| `restated-instructions` | "respond in JSON" appearing in both system and user | Pure duplication; the model parses both. |
| `bloated-tool-defs` | tool definitions over 5k tokens total, descriptions over 200 chars, deeply nested params, long enums, examples in descriptions | Tool defs are sent on **every** request. Often the largest line item. |
| `duplicate-context` | same paragraph appearing in multiple messages | RAG dedup bug, or copy-paste between system and user. |
| `few-shot-bloat` | 4+ user messages with shared prefix before the actual query | Most modern instruct models do as well with 2 examples as 8. |
| `whitespace-bloat` | triple-blank-line runs, trailing spaces, extreme indent | Each newline is its own token. |
| `verbose-output-spec` | "Please format your output as follows:" + long example | A JSON schema reference is shorter and clearer. |

## Install

```bash
npm i -g prompt-doctor
# or
npx prompt-doctor <args>
```

No build step, zero dependencies.

## Usage

### Audit a request body

```bash
prompt-doctor request.json
```

Accepts:

- `{ messages: [...], tools: [...] }` (OpenAI chat-completions)
- `{ system: "...", messages: [...] }` (Anthropic)
- bare `[...]` messages array

### Read from stdin

```bash
cat request.json | prompt-doctor --stdin --json
```

### Audit a single system prompt

```bash
prompt-doctor --system system.txt
```

### Audit only tool definitions

```bash
prompt-doctor --tools tools.json
```

### Combine pieces

```bash
prompt-doctor --system system.txt --messages convo.json --tools tools.json
```

### Cost basis

Default model is `gpt-4o`. Other supported names:

```
gpt-4o, gpt-4o-mini, gpt-4-turbo,
claude-sonnet, claude-opus, claude-haiku,
gemini-pro, gemini-flash
```

```bash
prompt-doctor request.json --model claude-sonnet
```

### CI mode

```bash
prompt-doctor request.json --fail-on warn --quiet
```

Exits non-zero if any `warn` or `error` finding fires. Pair with a
captured production request body to catch regressions in PR.

## Programmatic API

```js
const { audit } = require('prompt-doctor');

const r = audit({
  messages: [
    { role: 'system', content: 'You are a helpful assistant. Respond in JSON.' },
    { role: 'user', content: 'Hello' },
  ],
  tools: [],
  model: 'gpt-4o',
});

console.log(r.totals);
//  {
//    inputTokens: 24,
//    tokensSaveable: 11,
//    percentSaveable: 45,
//    costPerRequestUSD: 0.00006,
//    costSaveablePerRequestUSD: 0.0000275,
//    model: 'gpt-4o',
//  }

for (const f of r.findings) console.log(f.ruleId, f.message);
```

## Companion tools

- [`prompt-trim`](https://www.npmjs.com/package/prompt-trim) - apply
  the obvious fixes automatically.
- [`prompt-cache-key`](https://www.npmjs.com/package/prompt-cache-key) -
  structure prompts so OpenAI / Anthropic prompt caching actually
  hits.

## License

MIT.
