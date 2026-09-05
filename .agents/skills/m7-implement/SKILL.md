---
name: m7-implement
description: Implement and record an approved plan for one oioi-bwg M7-DATA foundation finding. Use for `/m7-implement DATA-001`; do not create a new plan or review verdict.
---

# M7 Implement

Implement exactly one `DATA-001` through `DATA-009` finding. Accept `M7-DATA-001` as input, but normalize the evidence filename to `DATA-001`.

Use `$m7-foundation-fix` for the IMPLEMENT constraints and the selected finding's registry. The canonical plan is `docs/migration/m7-foundation-fixes/DATA-001.md`.

Before changing code, read that file, confirm it has `Status: PLANNED`, read its complete PLAN, and confirm current source still matches its assumptions. Do not implement a chat-only, missing, incomplete, conflicting, or non-PLANNED plan; return `ESCALATE` instead.

Implement only the approved decision and required regression coverage. Keep the smallest architecture-compatible diff. Do not introduce policy decisions, redesign established boundaries, expand into another finding, silently rewrite old migrations, use production credentials, modify the local application DB, or mix unrelated working-tree changes into this finding.

If new evidence requires a product/domain/architecture decision, migration rewrite, production-data decision, or a change outside the approved scope, stop before changing that area and return `ESCALATE` with the reason.

Run the verification required by the plan and relevant repository gates. A DB constraint, transaction, or concurrency finding requires the plan's isolated PostgreSQL verification; mocks do not replace it.

After implementation, update the same evidence file without rewriting the PLAN:

```text
Status: IMPLEMENTED
```

Use `VERIFIED` only when every required verification passed. Record changed files, implemented decision, plan deviations, tests added or changed, commands run, actual results, PostgreSQL evidence when applicable, failures, and remaining unknowns. Leave REVIEW as `pending`.

Finish only after updating the evidence file. Report its path, final status (`IMPLEMENTED`, `VERIFIED`, or `ESCALATE`), changed files, decision, tests, commands, results, deviations, remaining unknowns, and this handoff:

```text
Run `/m7-review DATA-001`.
Canonical evidence: docs/migration/m7-foundation-fixes/DATA-001.md
```
