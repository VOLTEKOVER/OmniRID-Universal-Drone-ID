# App (PWA) Backlog

Findings from the repo scan on 2026-11-01 (`OmniRID-app`).

## 🔴 Blocking

- [x] **`pnpm typecheck` passes (0 errors).**
  - `app/types/leaflet.d.ts` now has structural Leaflet/plugin types; `DroneMap.vue` was
    refactored with named handlers and null guards. `app/pages/index.vue` parsing/types fixed.
- [x] **`pnpm lint` passes (0 problems).**
  - Replaced explicit `any` with typed/`unknown` values, fixed empty `catch` blocks (with
    explanatory comments), split multi-statement lines, and removed dead OTA upload code from
    `app/pages/firmware.vue`.
- [x] **Audit the 6 `v-html` uses** (`vue/no-v-html`). All six now render through
  `app/components/docs/GuideRichText.vue`, a whitelist renderer (`code`, `b`, `i`, `a`, `img`,
  `br` + safe URL schemes) fed by the static `app/config/guide.ts` content. The `innerHTML`
  table-cell renderer in `GuideDataTable.vue` was replaced too.

## 🟡 Pending features / process

- [x] CI job for the PWA (lint + typecheck + build). `.github/workflows/pr-checks.yml` now uses
  pnpm (matching `packageManager`/`pnpm-lock.yaml`) instead of the non-existent npm lockfile.
- [ ] OTA UI flow (firmware page is presentational; firmware `POST /ota` validation is now
  implemented server-side, but the app upload UI is not wired up).
- [ ] TypeScript 7 migration (after strict mode is clean).

## 🔍 Deep review (pending)

Review results for the proxy/SSRF, service worker caching, auth middleware, polling leaks and
firmware↔app field/limit mismatches will be added below when the review completes.
