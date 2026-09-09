# Changelog

## 0.1.0 (unreleased)

First public version of `@i18n-triage/core`, `@i18n-triage/reporters` and `@i18n-triage/cli`.

- AST-based classification of hard-coded Chinese strings into A (UI text), B (debug logs), C (dictionaries), D (internal keys); comments, styles, import paths, regexes and string literal types never enter the pipeline
- `.vue` templates via `@vue/compiler-sfc`; `<script>` blocks and template expressions via `ts-morph`, all with whole-file positions
- `t()` / `$t()` arguments excluded before classification
- CLI: `i18n-triage [paths...]` with `--format text|json|sarif`, `--only`, `--config`, `--out`; config files in ts / js / mjs / cjs / json with `defineConfig`
- Default ignores for translation tables, mocks, tests and build artefacts; oversized / minified files are skipped and listed
- SARIF 2.1.0 output for GitHub Code Scanning and a composite GitHub Action (`action.yml`)
- Validated on vue-vben-admin, vue-element-plus-admin, yudao-ui-admin-vue3 and RuoYi-Vue3 (see `docs/validation.md`)
