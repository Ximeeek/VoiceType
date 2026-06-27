# Project Rules

- Always write git commit messages in English when committing changes to GitHub or Git repositories.
- Write commit messages (both title and body/description) naturally like a human developer, avoiding generic AI buzzwords or artificial formatting.
- Ensure the commit description clearly explains what changed, how it works or was fixed, and provides practical, useful details so other developers can easily understand the technical changes.
- When requested to create a new release, follow the release workflow compatible with the auto-updater:
  1. Bump the version string in `src-tauri/tauri.conf.json` (e.g. from `0.1.0` to `0.1.1`).
  2. Create a Git commit explaining the version bump (e.g. `chore: bump version to 0.1.1`).
  3. Create a matching Git tag (e.g. `v0.1.1`).
  4. Push the commit and tags to GitHub (`git push origin master --tags`).
  5. GitHub Actions will handle packaging assets, publishing release artifacts, and updating `assets-manifest.json` automatically.


