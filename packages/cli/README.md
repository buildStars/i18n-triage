# @i18n-triage/cli

Command line for [i18n-triage](../../README.md): find the hard-coded Chinese strings in a Vue / TypeScript codebase that actually need translating.

```bash
npx --package @i18n-triage/cli i18n-triage src
npx --package @i18n-triage/cli i18n-triage src --only all
npx --package @i18n-triage/cli i18n-triage src --format sarif --out i18n-triage.sarif
```

```
i18n-triage [...paths]

  --format <text|json|sarif>   default text
  --only <letters>             e.g. A,C (default) or all
  --config <path>              default: i18n-triage.config.{ts,mts,js,mjs,cjs,json} in cwd, then in the scanned directory
  --out <path>                 write the report to a file
  --no-color
```

Configuration (`i18n-triage.config.ts`):

```ts
import { defineConfig } from '@i18n-triage/cli'

export default defineConfig({
  uiApis: ['myToast', '$tab.*'],
  displayAttrs: ['tip-text'],
  dictDirs: ['dictionaries'],
  ignore: ['**/legacy/**'],
})
```

Lists extend the built-in defaults; set `extendDefaults: false` to replace them. Full option reference and the four-bucket rule table are in the repository README.
