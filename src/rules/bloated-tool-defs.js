const { estimateTokens } = require('../tokens');

// Tool / function definitions are often the heaviest part of an LLM
// call - 5-30k tokens each is common. This rule flags definitions
// that look bloated by common patterns:
// - description over 200 chars (LLMs do fine with terse ones)
// - nested object schemas more than 3 levels deep
// - unused enum cases (we can't always tell, but very long enums
//   are suspicious)
// - duplicated language across multiple tool descriptions
// - examples embedded in description (rarely needed; the spec
//   already takes example values)

const LONG_DESC_THRESHOLD = 200;
const DEEP_NEST_THRESHOLD = 3;
const LONG_ENUM_THRESHOLD = 12;

function depth(obj, current = 0) {
  if (!obj || typeof obj !== 'object') return current;
  let max = current;
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      max = Math.max(max, depth(v, current + 1));
    }
  }
  return max;
}

function jsonSize(obj) {
  return estimateTokens(JSON.stringify(obj));
}

module.exports = {
  id: 'bloated-tool-defs',
  severity: 'warn',
  category: 'cost',
  description: 'Tool / function definitions have patterns that bloat them with little benefit.',
  checkTools(tools) {
    if (!Array.isArray(tools) || tools.length === 0) return [];
    const findings = [];

    // Total budget warning
    const totalTokens = jsonSize(tools);
    if (totalTokens > 5000) {
      findings.push({
        ruleId: this.id,
        severity: totalTokens > 15000 ? 'error' : 'warn',
        message: `tool definitions total ~${totalTokens} tokens (sent on every request); consider trimming or splitting into per-task tool sets`,
        hits: [`${tools.length} tool(s)`],
        tokensSaved: Math.round(totalTokens * 0.3),
      });
    }

    for (let i = 0; i < tools.length; i++) {
      const t = tools[i];
      const fn = t.function || t;
      const name = fn.name || `tool[${i}]`;
      const desc = String(fn.description || '');

      if (desc.length > LONG_DESC_THRESHOLD) {
        const savedTokens = estimateTokens(desc) - estimateTokens(desc.slice(0, LONG_DESC_THRESHOLD));
        findings.push({
          ruleId: this.id,
          severity: 'warn',
          message: `tool "${name}" description is ${desc.length} chars (try <${LONG_DESC_THRESHOLD}); models do fine with terse descriptions`,
          hits: [`${name}.description: ${desc.length} chars`],
          tokensSaved: savedTokens,
        });
      }

      // Embedded examples in description ("For example: {...}")
      if (/\bfor example[,:]/i.test(desc) || /\be\.g\.,?\s*[{\[]/i.test(desc)) {
        findings.push({
          ruleId: this.id,
          severity: 'info',
          message: `tool "${name}" embeds an example in its description; the parameter schema's example field is cheaper`,
          hits: [`${name}.description`],
          tokensSaved: 30,
        });
      }

      const params = fn.parameters || fn.input_schema;
      if (params) {
        const d = depth(params);
        if (d > DEEP_NEST_THRESHOLD) {
          findings.push({
            ruleId: this.id,
            severity: 'info',
            message: `tool "${name}" parameter schema is nested ${d} levels deep; consider flattening`,
            hits: [`${name}.parameters depth=${d}`],
            tokensSaved: 50,
          });
        }
        // Walk for long enums
        const stack = [params];
        while (stack.length) {
          const node = stack.pop();
          if (!node || typeof node !== 'object') continue;
          if (Array.isArray(node.enum) && node.enum.length > LONG_ENUM_THRESHOLD) {
            findings.push({
              ruleId: this.id,
              severity: 'info',
              message: `tool "${name}" has an enum with ${node.enum.length} cases; consider grouping or omitting and validating server-side`,
              hits: [`${name}: enum length=${node.enum.length}`],
              tokensSaved: estimateTokens(node.enum.join(',')),
            });
          }
          for (const v of Object.values(node)) {
            if (v && typeof v === 'object') stack.push(v);
          }
        }
      }
    }

    return findings;
  },
};
