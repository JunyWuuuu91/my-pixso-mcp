# Pixso Advanced MCP v0.4.0 Release Notes

## Focus

v0.4.0 is the **Compact Agent Contract** release. It keeps the same local, read-only Pixso plugin + MCP architecture, but changes the default agent-facing output from raw/debug-heavy extraction to a compact implementation brief.

The product rule is now explicit:

- `get_coding_context` is the primary Pixso design-to-implementation scan.
- `get_css_context` is a secondary CSS-focused drill-down used only after `get_coding_context`, or when the user explicitly asks for CSS declarations.

## Added

- Internal shared snapshot layer through `buildFrameSnapshot`, used by both `get_coding_context` and `get_css_context`.
- Public quickstart and troubleshooting docs for open-source usage.
- Agent-friendly setup and prompt guidance for Codex-style workflows.
- `get_coding_context` v0.4 output contract:
  - `profile`: `compact`, `balanced`, `deep`, `verbose`;
  - compact `nodeIndex` aliases;
  - semantic `regions`;
  - grouped `patterns`;
  - `criticalDimensions`, `verificationTargets`, and `fidelityChecklist` for browser/DOM verification of panels, menus, buttons, rows, icons, typography, spacing, radius/shadow, overlay placement, and visible texts;
  - `productionGuidance` with risk flags for unsafe production CSS translation;
  - compact layout/computed spacing sections;
  - typography CSS model with raw Pixso evidence preserved;
  - color/design-system summaries;
  - asset slots, icon/image groups, export queue and ignored candidates;
  - `cssSummary` pointing to secondary CSS drill-down;
  - `budget` and truncation reporting;
  - `nextRecommendedCalls` with `get_css_context` as optional secondary follow-up.
- `get_css_context` compact contract:
  - `mode`: `compact`, `balanced`, `verbose`;
  - `scope`: `key` or `all`;
  - `guidanceProfile`: `faithful` or `agent`;
  - `groupDuplicates`;
  - `omitDefaults`;
  - `selectorStrategy`: `alias`, `name`, `nodeId`, `path`;
  - `ruleGroups` for duplicate CSS patterns;
  - `keyRules` for important nodes/patterns;
  - `implementationCssText` plus compact omitted-declaration summaries in agent guidance mode;
  - critical visual dimensions and production guidance are still returned alongside agent CSS when root/non-leaf width/height are omitted from copy-ready CSS;
  - `declarationMetadata` can be omitted for the compact agent default, or set to `compact`/`full` for audit detail;
  - `sourceConfidence` vs `implementationConfidence`;
  - omission stats for duplicate/default/non-key CSS rules.
- Agent-facing tool descriptions that mark `get_coding_context` as primary and `get_css_context` as secondary.
- Updated Codex skill and prompt examples for compact-first workflow.

## Changed

- The bridge now allows only one in-flight Pixso command. Overlapping scans fail fast instead of accumulating in the single-threaded plugin runtime.
- A timed-out command quarantines and closes the unresponsive plugin connection, so the UI no longer stays falsely green while Pixso commands are stuck.
- The plugin UI reports timeout recovery steps and rejects overlapping commands before they reach the Pixso main context.
- Bounded selection scans now stop traversing when `maxNodes` is reached; wide frames no longer keep reading every remaining child after the output limit.
- Unknown or expired Streamable HTTP session ids now return `404`, allowing MCP clients to reinitialize after a bridge restart instead of remaining stuck on a stale session.

- Package version is `0.4.0`.
- `get_coding_context` output is marked with `version: "0.4"`.
- `get_coding_context` defaults to `profile="compact"`.
- `get_coding_context` no longer includes the raw layout tree by default. Use `includeRawTree=true`, `get_node_tree`, or `inspect_node` when raw tree details are needed.
- `get_css_context` defaults to compact key-scope output instead of a per-node CSS dump.
- `get_coding_context` now recommends `get_css_context` with `guidanceProfile="agent"` so coding agents receive implementation-focused CSS and compact aggregate reason codes for omitted declarations.
- `get_css_context` agent mode now warns when `implementationCssText` omits root/non-leaf dimensions and points agents to `criticalDimensions`/`fidelityChecklist` for visual fidelity checks.
- CSS output now groups duplicate declaration sets and omits noisy defaults such as repeated `padding:0`, `gap:0`, `opacity:1` in compact mode.
- CSS selectors default to short aliases such as `.px-n1`; aliases are mapped back to Pixso node ids through `nodeIndex`.
- Asset classification is stricter: small text-dominant instances are not treated as icons, and large layout containers are ignored instead of exported.
- Export preview now includes native export health and complexity risk, so large or deeply nested container screenshots can be rejected before calling Pixso `exportAsync`.
- `get_screenshot` now follows Pixso's `contentsOnly=true` default and uses WIDTH constraints for raster exports when the target width is known.
- If Pixso `exportAsync` times out, the plugin opens an export circuit breaker and rejects later screenshot/export calls immediately until the Pixso plugin is reloaded.
- Existing v0.3 diagnostics remain available through balanced/deep/verbose profiles or targeted tools, but not as the default context sent to Codex.
- HTTP is now the recommended first-run transport in the public documentation.
- `dist/` is kept in the repository so a fresh clone can be used without a mandatory build before first use.
- The CLI now includes a safer onboarding layer: `quickstart`, improved `doctor`, and optional managed Codex config installation.

## Still intentionally out of scope

- UI-kit/component mapping.
- Pixso write/edit tools.
- Playwright visual comparison inside the MCP server.
- Remote Pixso/cloud auth.
- Automatic bulk asset export.
- Full code generation.

## Validation performed

- `node --check pixso-plugin/main.js`
- `npm run typecheck`
- `npm test` — 8 test files, 43 tests passed.
- `npm run build`
- `npm run check`

## Runtime note

The real Pixso Desktop runtime cannot be executed inside this environment. The plugin JavaScript was syntax-checked and the MCP server TypeScript/test suite was validated. Final runtime verification should be performed on your Mac by reloading `pixso-plugin/manifest.json`, connecting the plugin window, selecting a frame, then calling `health`, `get_selection_context`, `get_coding_context`, optional `get_css_context`, `find_related_frames`, and `get_screenshot` from Codex.
