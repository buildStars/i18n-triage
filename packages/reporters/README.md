# @i18n-triage/reporters

Report formatters of [i18n-triage](../../README.md): `TriageResult[]` → text, JSON or SARIF. No IO — writing files is the CLI's job.

```ts
import { buildScanReport, formatJson, formatSarif, formatText } from '@i18n-triage/reporters'

const report = buildScanReport(fileScans, errors, skipped)
formatText(report, { only: ['A_UI_TEXT', 'C_DICT'], color: true })
formatJson(report)
formatSarif(report, { toolVersion: '0.1.0' }) // SARIF 2.1.0 for GitHub Code Scanning
```

`buildScanReport` computes the summary (regex-style baseline, A/B/C/D counts, unsure count, i18n exclusions, noise ratio) and sorts results by file and offset.
