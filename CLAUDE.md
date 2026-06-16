# Goose Commerce Desktop — project notes for Claude

Electron + React (Vite) desktop app for the Goose Commerce WordPress plugin.
Renderer code is in `src/renderer`; shared types/constants in `src/shared`; the
plugin it talks to lives in a **separate repo** (do not edit it from here).

## Releasing — STANDING ORDER (do not re-plan this each time)

This process is settled. When the user says "release it" / "cut a release" / "get
it ready to release" (or similar), execute the standard flow below **directly** —
do not re-investigate, re-design, or ask whether to proceed. The only decision that
ever needs confirming is the **version number** if it hasn't already been bumped.

**Default action on a release request:**
1. Ensure `package.json` `version` is bumped (higher than the last released tag) and
   committed + pushed to `master`. If not bumped, bump it (patch for fixes, minor for
   features), commit, push.
2. `git tag vX.Y.Z && git push origin vX.Y.Z` (tag must match `package.json`).
3. Watch the **Release** Actions run to green, then tell the user the draft is ready.
4. **Stop there.** Publishing the draft as "latest" is the user's manual click — never
   publish on their behalf unless they explicitly say "publish it".

Full runbook: [RELEASING.md](RELEASING.md). Key rules so the auto-updater keeps working:

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
