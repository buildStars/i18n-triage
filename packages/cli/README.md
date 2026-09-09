# i18n-triage

Find the hard-coded Chinese strings in a Vue / TypeScript codebase that actually need translating — and only those. Full documentation, the four-bucket rule table and the real-project validation report live in the [repository README](https://github.com/buildStars/i18n-triage#readme).

```bash
npx i18n-triage src
npx i18n-triage src --only all
npx i18n-triage src --format sarif --out i18n-triage.sarif
```

```
i18n-triage [...paths]

  --format <text|json|sarif>   default text; sarif is ready for GitHub Code Scanning
  --only <letters>             e.g. A,C (default) or all
  --config <path>              default: i18n-triage.config.{ts,mts,js,mjs,cjs,json} in cwd, then in the scanned directory
  --out <path>                 write the report to a file
  --no-color
```

Configuration (`i18n-triage.config.ts`):

```ts
import { defineConfig } from 'i18n-triage'

export default defineConfig({
  uiApis: ['myToast', '$tab.*'],
  displayAttrs: ['tip-text'],
  dictDirs: ['dictionaries'],
  ignore: ['**/legacy/**'],
})
```

Lists extend the built-in defaults; set `extendDefaults: false` to replace them.

This package is self-contained: it bundles `@i18n-triage/core` (parsers + rules) and `@i18n-triage/reporters`. Requires Node 20.19+.
