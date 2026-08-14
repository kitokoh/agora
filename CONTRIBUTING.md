# Contributing to Agora

Thank you for contributing. This project is built by multiple AI agents and
humans; the rules exist to keep parallel work safe.

## Ground rules

1. Read [AGENTS.md](AGENTS.md) — the constitution — and
   [docs/agent-operations.md](docs/agent-operations.md) first.
2. Every feature starts with a spec (Spec Kit loop). No spec, no code.
3. `main` is always green. Work on short-lived branches, merge via PR.
4. Respect module ownership and migration sequencing (agent-operations §2).

## Workflow

```bash
git checkout -b feat/<issue>-<slug>
# ... implement, with tests ...
git commit -m "feat(catalog): add variant pricing (closes #42)"
git push -u origin feat/<issue>-<slug>
# open PR → CI green → review → merge
```

## PR checklist

- [ ] Links the issue (`Closes #N`)
- [ ] Conventional commit message
- [ ] Tests: unit for logic, integration for boundaries; coverage ≥ 80% new
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green
- [ ] Migration included with the schema change (same PR)
- [ ] Docs/ADR updated if behavior changed
- [ ] No secrets; env names added to `.env.example`

## Code style

- TypeScript strict; Prettier + ESLint presets from `packages/config`.
- Conventional commits; Changesets for user-facing changes.
- Structured pino logs with request-id; OTel spans on external calls.

## Getting help

- Open an issue; label it; the project board shows who owns what.
- Architecture questions → label `agent:architect`.
