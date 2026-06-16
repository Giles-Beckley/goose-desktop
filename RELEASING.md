# Releasing Goose Commerce Desktop

This app ships as a Windows installer with auto-update. A push of a version tag
(`vX.Y.Z`) triggers GitHub Actions, which builds the installer and creates a
**draft** GitHub Release. You then **publish the draft manually** — publishing is
what makes existing installs auto-update.

## How auto-update works (why the steps matter)

- electron-builder uploads three assets to the release:
  `Goose-Commerce-Setup.exe`, `Goose-Commerce-Setup.exe.blockmap`, and
  `latest.yml`.
- The running app's updater reads **`latest.yml`** from the *latest published*
  release to decide whether an update exists.
- For the updater to offer an update, the published version **must be higher**
  than what's installed. So **always bump the version** before tagging.
- A release with **no `latest.yml`** makes the in-app "Check for updates" fail
  with a 404 (see Troubleshooting).

## Standard release steps

1. **Bump the version** in `package.json` (`"version"`). Use semver — patch for
   fixes/small features, minor for larger features. The tag must match:
   `package.json` `1.2.3` → tag `v1.2.3`.

2. **Commit** the bump (plus the changes being released) and **push to `master`**.
   Pushing `master` does **not** build anything — only a tag does.

   ```bash
   git add -A
   git commit -m "…"
   git push origin master
   ```

3. **Tag and push the tag** — this triggers the build:

   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. **Watch the build:** <https://github.com/Giles-Beckley/goose-desktop/actions>
   Wait for the **Release** workflow run for that tag to finish green.

5. **Open the draft release:**
   <https://github.com/Giles-Beckley/goose-desktop/releases>
   The new `vX.Y.Z` shows as **Draft** (drafts are visible only when logged in).
   Confirm it has **all three assets**: `Goose-Commerce-Setup.exe`,
   `…​.exe.blockmap`, and `latest.yml`. If any are missing, see Troubleshooting.

6. **Publish the draft.** Edit the draft → set "Set as the latest release" → click
   **Publish release**. Existing installs will now detect the update.

7. **(Optional) Verify** in the app via "Check for updates".

## Critical rules — do NOT break these

- **Never pre-create the GitHub Release for the tag.** electron-builder is
  configured with `releaseType: draft` (`electron-builder.yml`). If a *published*
  (non-draft) release already exists for the tag when the build runs,
  electron-builder will **not** upload its assets into it — the job still reports
  success, but you get an **empty published release** and the updater 404s. Let CI
  create the draft; you only ever click **Publish**.
- **Bump the version every release.** Re-tagging the same version, or publishing a
  version not higher than installed, won't trigger updates.
- **Don't push the tag before the commit is on `master`.** Tag the commit you've
  already pushed.

## Troubleshooting

### In-app update check fails: "Cannot find latest.yml … 404"
The latest published release has no `latest.yml`. Usual cause: a **published but
empty** release for that tag (the pre-create trap above). Fix:

1. Delete the empty release in the browser (Releases → the release → Delete). You
   can leave the tag; the next step recreates it.
2. Delete and re-push the tag so CI builds cleanly into a fresh draft:

   ```bash
   git push origin :refs/tags/v1.2.3   # delete remote tag
   git tag -d v1.2.3                    # delete local tag
   git tag v1.2.3                       # recreate
   git push origin v1.2.3               # re-trigger build
   ```

3. Wait for the build, confirm the **draft** has all three assets, then publish.

### Build went green but the release has no assets
Same root cause — a published release existed for the tag. Follow the steps above.

### Need a different version
If a tag is poisoned and you'd rather not delete it, bump to the next patch
(`1.2.4`), commit, and tag `v1.2.4` for a clean build. Delete the bad/empty
release afterwards so the updater never sees it.

## Reference

- CI workflow: `.github/workflows/release.yml` (triggers on `v*.*.*` tags; runs
  `npm run release:win`; uses GitHub's built-in `GITHUB_TOKEN` — no personal token
  needed).
- Build/publish config: `electron-builder.yml` (`publish.releaseType: draft`).
- Release script: `package.json` → `"release:win"`.
