---
name: m7-review
description: Review and record the verdict for one implemented oioi-bwg M7-DATA foundation finding. Use for `/m7-review DATA-001`; do not re-plan or implement the finding.
---

# M7 Review

Review exactly one `DATA-001` through `DATA-009` finding. Accept `M7-DATA-001` as input, but normalize the evidence filename to `DATA-001`.

Use `$m7-foundation-fix` for the REVIEW checklist and the selected finding's invariant. This skill's required evidence update is an explicit exception to that skill's read-only review rule. Read `docs/migration/m7-foundation-fixes/DATA-001.md` first. Confirm the original finding, approved plan, implementation and verification evidence exist; then inspect only the actual diff, changed tests, and PostgreSQL evidence required by the plan.

Do not redesign the feature, re-analyze the repository, or reopen settled architecture unless the implementation supplies new evidence that requires escalation.

Check that the root cause is fixed, approved invariants and plan are preserved, required tests and PostgreSQL verification passed, and no regression, authorization, transaction, concurrency, sensitive-data, API-contract, cache-ownership, abstraction, architecture, or unrelated-change issue remains.

Return exactly one verdict:

```text
APPROVE
APPROVE WITH MINOR FIX
REWORK
ESCALATE
```

Append the review to the evidence file without rewriting the plan or implementation history. Under REVIEW, record the verdict, findings by severity, blocking issues, minor issues, remaining risks, and reviewer recommendation. Set Status to `CLOSED`, `REVIEWED-MINOR`, `REWORK`, or `ESCALATED` respectively. Do not set `CLOSED` when required verification failed or is missing.

Finish only after the evidence file is updated. Report its path, verdict, updated status, severity-ordered findings, and required next action.
