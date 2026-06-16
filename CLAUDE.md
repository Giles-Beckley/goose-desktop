# Goose Commerce Desktop — project notes for Claude

Electron + React (Vite) desktop app for the Goose Commerce WordPress plugin.
Renderer code is in `src/renderer`; shared types/constants in `src/shared`; the
plugin it talks to lives in a **separate repo** (do not edit it from here).

## Releasing — follow `RELEASING.md`

Full runbook: [RELEASING.md](RELEASING.md). The standard flow is **bump version →
commit → push master → tag `vX.Y.Z` → CI builds a draft → user publishes the draft
as latest**. Key rules so the auto-updater keeps working:

- **A version-tag push (`v*.*.*`) is the only thing that triggers a build.**
  Pushing `master` alone builds nothing. See `.github/workflows/release.yml`.
- **Always bump `package.json` `version` before tagging**, and match the tag
  (`1.2.3` → `v1.2.3`). The updater only offers an update when the published
  version is higher than installed.
- **Never pre-create the GitHub Release for a tag.** electron-builder uses
  `releaseType: draft` (`electron-builder.yml`); if a *published* release already
  exists for the tag, it won't upload assets — you get an empty release and the
  in-app updater 404s on `latest.yml`. Let CI create the draft.
- **Publishing the draft is the user's manual step.** Do not publish releases on
  their behalf unless explicitly asked.
- If a release ends up empty / the updater 404s, the fix is: delete the bad
  release, then delete + re-push the tag for a clean build (steps in `RELEASING.md`).

## Verifying changes

- Typecheck a single file fast (project `tsc -p` has stale-`dist` reference noise):
  `npx tsc --noEmit --jsx react-jsx --strict --skipLibCheck --moduleResolution bundler --module ESNext --target ES2020 --lib ES2020,DOM,DOM.Iterable --resolveJsonModule <file>`
- Full renderer build: `npx vite build`.

## Secrets

- `GitHub.txt` (a personal access token) and `.claude/settings.local.json` are
  **gitignored** — never commit them. CI uses the built-in `GITHUB_TOKEN`, not the
  file's token.
