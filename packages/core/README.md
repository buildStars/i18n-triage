# @i18n-triage/core

Parse + classify engine of [i18n-triage](../../README.md). Pure functions, zero IO: parsers take source strings, rules take `StringNode`s.

```ts
import { createDefaultRules, excludeI18nCalls, parseSource, triage } from '@i18n-triage/core'

const ctx = { relativePath: 'src/views/Order.vue' }
const nodes = parseSource(source, ctx) // StringNode[] with kind / calleeName / attrName / loc
const kept = excludeI18nCalls(nodes) // drop t('...') / $t('...') arguments
const results = triage(kept, ctx, createDefaultRules()) // TriageResult[] with category A/B/C/D + matchedBy
```

- `parseSource` dispatches by extension: `.vue` → template + script blocks, everything else → ts-morph.
- Rules are `(node, ctx) => Category | null`; the default chain is `[B, D, C, A]`, first match wins, fallback `A_UI_TEXT` / `matchedBy: 'fallback'`.
- Every whitelist lives in `DEFAULT_*` constants and can be overridden through `createDefaultRules(config)`.

See the repository README for the rule table and the validation report.
