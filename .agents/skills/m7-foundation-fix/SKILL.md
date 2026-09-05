---
name: m7-foundation-fix
description: Plan, implement, or review exactly one oioi-bwg M7-DATA-001 through M7-DATA-009 foundation finding. Use for /m7-plan, /m7-implement, and /m7-review requests; do not use for unrelated migration work or future domain features.
---

# M7 Foundation Fix

Handle one registered M7 data-layer finding through `PLAN -> IMPLEMENT -> REVIEW` without redesigning the foundation.

Accept both `DATA-001` and `M7-DATA-001` as finding identifiers. Reject identifiers outside `DATA-001` through `DATA-009`.

## Route the request

- For `/m7-plan`, read the PLAN section in [workflows.md](references/workflows.md) and the selected entry in [finding-registry.md](references/finding-registry.md). Do not modify code or documentation.
- For `/m7-implement`, read the IMPLEMENT section and require an approved plan from the conversation or an explicitly supplied artifact. Stop and report the missing or contradictory decision if the plan is absent, stale, or conflicts with current evidence.
- For `/m7-review`, read the REVIEW section and review only the approved plan, changed diff, test results, PostgreSQL verification, and directly related files. Keep review read-only unless the user asks to apply a minor fix.

## Establish evidence

Read sources in this order:

1. `docs/migration/implementation/M7-DATA-LAYER-ANALYSIS.md`
2. The tracked `M7-POSTGRES-VERIFICATION.md`, or `.local/M7-POSTGRES-VERIFICATION.md` when that is the repository's actual verification artifact
3. Current source and tests directly related to the selected finding
4. Relevant active documents under `docs/migration/oioi-bwg-architecture-clean-v1/`
5. `docs/migration/DOMAIN_SPECIFICATION.md` only when a domain-policy decision is required

Treat architecture documents as constraints, not proof of current behavior. Use the current code and actual PostgreSQL results as implementation evidence. Follow the repository's `AGENTS.md` and its rule priority.

## Preserve established boundaries

Keep these verified flows unless the selected finding supplies evidence that requires a change:

```text
RSC -> Service -> Repository(DbExecutor) -> Drizzle
Client -> Query -> ky -> Route Handler -> Service -> Repository

Auth.js -> RequestContext -> requireUser / CASL

Zod contract -> Route Handler -> jsonResponse / toErrorResponse
```

Do not introduce a DI container, generic repository or CRUD framework, generic error framework, lock framework, event bus, custom ORM abstraction, or new cache abstraction.

Do not silently edit migration SQL that may already have been applied. Prefer a new migration when an approved schema change is required. Never use production credentials. A mock-only test cannot establish a real database constraint, transaction, concurrency, or security-boundary claim.

UI or layout access control does not replace service authorization. Never pass raw SQL, parameters, error causes, passwords, hashes, OTPs, tokens, cookies, sessions, authorization headers, or private PII to logs or Sentry.

Work on exactly one finding per invocation. During IMPLEMENT, make no policy or architecture decision beyond the approved plan. If new evidence requires one, stop implementation and return an escalation with the conflicting evidence and decision needed.

The model and effort values in the registry are recommendations. Report the model and effort actually selected; never claim a different model was used.

Complete a finding only when it has an approved plan, implementation diff, relevant automated tests, actual PostgreSQL verification when applicable, required repository gates, and a passing review.
