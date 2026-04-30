'use strict';

// Decide which companion-tool tip line (if any) to print after an
// audit. Pure function over the audit result so it can be unit-tested
// without spawning the CLI.
function pickTip(result) {
  if (!result || !Array.isArray(result.findings)) return null;
  const totals = result.totals || {};
  const hasVerboseSystem = result.findings.some(
    (f) => f.ruleId === 'verbose-system-prompt' || f.ruleId === 'restated-instructions'
  );
  const hasShrinkable = result.findings.some(
    (f) => f.ruleId === 'duplicate-context'
        || f.ruleId === 'whitespace-bloat'
        || f.ruleId === 'few-shot-bloat'
  );
  if ((totals.tokensSaveable || 0) === 0 && !hasShrinkable && !hasVerboseSystem) {
    return null;
  }
  if (hasVerboseSystem && hasShrinkable) {
    return 'tip: large stable prefix detected. consider `prompt-cache-key` (cache stable parts) and `prompt-trim` (strip duplicates losslessly).';
  }
  if (hasVerboseSystem) {
    return 'tip: stable system context detected. `prompt-cache-key` can mark it for provider-side cache reuse.';
  }
  if (hasShrinkable) {
    return 'tip: lossless shrink possible. try `prompt-trim` to remove duplicates / whitespace before sending.';
  }
  return null;
}

// Decide whether the tip should be shown given CLI args and the
// current process environment. Pure function so it can be tested.
function shouldShowTip({ args, env, stderrIsTTY }) {
  if (!args) return false;
  if (args.noTip) return false;
  if (args.json) return false;
  if (args.quiet) return false;
  const e = env || {};
  if (e.CI === 'true' || e.CI === '1') return false;
  if (e.PROMPT_MEDIC_NO_TIP === '1') return false;
  if (!stderrIsTTY) return false;
  return true;
}

module.exports = { pickTip, shouldShowTip };
