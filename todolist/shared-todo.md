# Shared Backlog

Repo-wide items (scan of 2026-11-01). Firmware: [firmware-todo.md](firmware-todo.md) · App: [app-todo.md](app-todo.md)

- [x] **Dangling backlog links fixed by recreating `firmware-todo.md` / `app-todo.md`**. These links are
  in README, CONTRIBUTING, PR template, SECURITY.md, `OmniRID-app/app/config/app.ts`, `app/config/guide.ts`.
  Keep these files; don't delete them again.
- [x] **Committed build artifacts at the repo root**: `omnirid-app-pwa.tar.gz` and `omnirid-app-pwa.zip`
  removed from the tree; `*.tar.gz` / `*.zip` are now ignored. Publish them as release assets.
- [x] **Placeholder root `package.json` / `package-lock.json` / `pnpm-lock.yaml`** removed; the app has its own.
- [x] `TASKS.md` and `ROADMAP.md` updated: typecheck/lint/CI status refreshed and the firmware fmt failure documented.
- [x] Mixed Italian/English comments/UI strings standardized on English (`Cargo.toml` files, `ConfigAuthModal.vue`, app error strings, README "Ground Station" table).
