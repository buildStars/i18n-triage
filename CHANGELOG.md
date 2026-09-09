# Changelog

## 0.2.0 (unreleased)

- `--fix` (`--dry-run`, `--include-unsure`, `--locale-file`): rewrites rule-matched A strings into `$t()` / `t()` calls and writes them to a flat locale JSON (existing entries preserved, keys reused, second run is a no-op); adds `useI18n` to `<script setup>` when missing; skips concatenations, template-literal chunks, plain scripts and JSX with a reason; config block `fix` (`keyStyle` text | hash, `templateFn`, `scriptFn`, `fixPlainScripts`, `ensureUseI18n`, `includeUnsure`, `localeFile`)
- Parsers record `loc.endOffset` for every node
- Text report: fixed missing space before counts for long file paths

## 0.1.0 (2026-09-09)

First public version of the `i18n-triage` CLI (npm: `i18n-triage`, self-contained — it bundles `@i18n-triage/core` and `@i18n-triage/reporters`, which are published separately later).

- AST-based classification of hard-coded Chinese strings into A (UI text), B (debug logs), C (dictionaries), D (internal keys); comments, styles, import paths, regexes and string literal types never enter the pipeline
- `.vue` templates via `@vue/compiler-sfc`; `<script>` blocks and template expressions via `ts-morph`, all with whole-file positions
- `t()` / `$t()` arguments excluded before classification
- CLI: `i18n-triage [paths...]` with `--format text|json|sarif`, `--only`, `--config`, `--out`; config files in ts / js / mjs / cjs / json with `defineConfig`
- Default ignores for translation tables, mocks, tests and build artefacts; oversized / minified files are skipped and listed
- SARIF 2.1.0 output for GitHub Code Scanning and a composite GitHub Action (`action.yml`)
- Validated on vue-vben-admin, vue-element-plus-admin, yudao-ui-admin-vue3 and RuoYi-Vue3 (see `docs/validation.md`)
