# Changesets

User-facing changes are tracked with [Changesets](https://github.com/changesets/changesets).

## Rules (AGENTS.md §3)

- Every PR with a **user-facing** change ships a changeset:
  ```bash
  pnpm changeset
  ```
  Pick the affected package(s), the bump type (patch/minor/major), and write
  a one-line summary. Commit the generated `.changeset/*.md` file in the same PR.
- Internal-only changes (CI, refactors with no behavior change, dev deps) do
  **not** need a changeset.
- Release automation consumes changesets on `main` (versions + publish).
