#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { audit } = require('../src/index.js');
const { pickTip, shouldShowTip } = require('../src/tip.js');

function usage() {
  console.log(`prompt-medic - audit LLM prompts for token waste

usage:
  prompt-medic <file.json>            audit a request body
  prompt-medic --stdin                read JSON from stdin
  prompt-medic --system <file.txt>    audit a single system prompt
  prompt-medic --messages <file.json> audit a messages[] array
  prompt-medic --tools <file.json>    audit a tools[] array

options:
  --model <name>                       cost basis (default: gpt-4o)
                                       gpt-4o, gpt-4o-mini, gpt-4-turbo,
                                       claude-sonnet, claude-opus, claude-haiku,
                                       gemini-pro, gemini-flash
  --json                               output JSON instead of text
  --quiet                              suppress info-level findings
  --no-tip                             suppress companion-tool tip line
  --fail-on <severity>                 exit non-zero if any finding at this
                                       level (info|warn|error). Default: never.

examples:
  prompt-medic request.json
  cat request.json | prompt-medic --stdin --json
  prompt-medic --system system.txt --model claude-sonnet
`);
}

function parseArgs(argv) {
  const args = { _: [], model: 'gpt-4o', json: false, quiet: false, noTip: false, failOn: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; }
    else if (a === '--stdin') { args.stdin = true; }
    else if (a === '--system') { args.system = argv[++i]; }
    else if (a === '--messages') { args.messages = argv[++i]; }
    else if (a === '--tools') { args.tools = argv[++i]; }
    else if (a === '--model') { args.model = argv[++i]; }
    else if (a === '--json') { args.json = true; }
    else if (a === '--quiet') { args.quiet = true; }
    else if (a === '--no-tip') { args.noTip = true; }
    else if (a === '--fail-on') { args.failOn = argv[++i]; }
    else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(2); }
    else { args._.push(a); }
  }
  return args;
}

async function readStdin() {
  return await new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function loadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`prompt-medic: failed to parse ${file}: ${e.message}`);
    process.exit(2);
  }
}

function loadText(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (e) {
    console.error(`prompt-medic: failed to read ${file}: ${e.message}`);
    process.exit(2);
  }
}

function buildInput(args, body) {
  // Accept several shapes:
  //   { messages: [...], tools: [...] }     - OpenAI-style request body
  //   { messages: [...] }                   - just messages
  //   [...]                                  - bare messages array
  //   { system: "...", messages: [...] }    - Anthropic-style
  let messages = [];
  let tools = [];
  if (Array.isArray(body)) {
    messages = body;
  } else if (body && typeof body === 'object') {
    if (Array.isArray(body.messages)) messages = body.messages;
    if (Array.isArray(body.tools)) tools = body.tools;
    if (typeof body.system === 'string') {
      messages = [{ role: 'system', content: body.system }, ...messages];
    } else if (Array.isArray(body.system)) {
      // Anthropic system blocks
      const sys = body.system
        .map((b) => (typeof b === 'string' ? b : b.text || ''))
        .join('\n\n');
      messages = [{ role: 'system', content: sys }, ...messages];
    }
  }
  if (args.system) {
    messages = [{ role: 'system', content: loadText(args.system) }, ...messages];
  }
  if (args.messages) {
    const m = loadJSON(args.messages);
    if (Array.isArray(m)) messages = messages.concat(m);
  }
  if (args.tools) {
    const t = loadJSON(args.tools);
    if (Array.isArray(t)) tools = tools.concat(t);
  }
  return { messages, tools };
}

function severityRank(s) {
  return { info: 0, warn: 1, error: 2 }[s] ?? 0;
}

function colorize(s, color) {
  if (!process.stdout.isTTY) return s;
  const codes = { red: 31, yellow: 33, cyan: 36, gray: 90, green: 32, bold: 1 };
  return `\u001b[${codes[color] || 0}m${s}\u001b[0m`;
}

function printFindings(result, args) {
  const { findings, totals } = result;

  let shown = findings.slice();
  if (args.quiet) shown = shown.filter((f) => f.severity !== 'info');
  shown.sort((a, b) => (b.tokensSaved || 0) - (a.tokensSaved || 0));

  if (shown.length === 0) {
    console.log(colorize('clean - no waste detected', 'green'));
  } else {
    for (const f of shown) {
      const sev = f.severity.toUpperCase();
      const color = f.severity === 'error' ? 'red' : f.severity === 'warn' ? 'yellow' : 'cyan';
      console.log(`${colorize(sev, color)}  ${colorize(f.ruleId, 'bold')}  ${f.message}`);
      for (const h of (f.hits || []).slice(0, 6)) {
        console.log(`        ${colorize('-', 'gray')} ${h}`);
      }
    }
    console.log('');
  }

  console.log(colorize('summary', 'bold'));
  console.log(`  input tokens (est):  ${totals.inputTokens}`);
  console.log(`  saveable:            ${totals.tokensSaveable} (~${totals.percentSaveable}%)`);
  console.log(`  per-request cost:    $${totals.costPerRequestUSD.toFixed(5)} on ${totals.model}`);
  console.log(`  per-request savings: $${totals.costSaveablePerRequestUSD.toFixed(5)}`);
  if (totals.tokensSaveable > 0) {
    const monthly = totals.costSaveablePerRequestUSD * 100_000;
    console.log(`  at 100k req/mo:     $${monthly.toFixed(2)}/mo saved`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (args._.length === 0 && !args.stdin && !args.system && !args.messages && !args.tools)) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  let body = null;
  if (args.stdin) {
    const txt = await readStdin();
    try { body = JSON.parse(txt); }
    catch (e) { console.error(`prompt-medic: stdin is not JSON: ${e.message}`); process.exit(2); }
  } else if (args._.length === 1) {
    body = loadJSON(args._[0]);
  }

  const input = buildInput(args, body);
  if (input.messages.length === 0 && input.tools.length === 0) {
    console.error('prompt-medic: no messages or tools to audit');
    process.exit(2);
  }

  const result = audit({ ...input, model: args.model });

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    printFindings(result, args);
  }

  if (shouldShowTip({ args, env: process.env, stderrIsTTY: !!process.stderr.isTTY })) {
    const tip = pickTip(result);
    if (tip) {
      // shouldShowTip verified stderr is a TTY, so the dim ANSI
      // escape is safe to emit unconditionally here.
      process.stderr.write(`\n\u001b[90m${tip}\u001b[0m\n`);
    }
  }

  if (args.failOn) {
    const threshold = severityRank(args.failOn);
    const trip = result.findings.some((f) => severityRank(f.severity) >= threshold);
    if (trip) process.exit(1);
  }
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(2); });
