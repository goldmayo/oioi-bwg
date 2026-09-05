---
description: Review one implemented M7 foundation finding and persist the final verdict
---

Use the `m7-foundation-fix` skill.

Finding: $ARGUMENTS

Execute only the REVIEW phase.

Canonical evidence file:

docs/migration/m7-foundation-fixes/$ARGUMENTS.md

Before reviewing:

1. Read the canonical evidence file.
2. Read the original finding and approved PLAN.
3. Confirm implementation and verification evidence exist.
4. Inspect the actual implementation diff and changed tests.
5. Inspect PostgreSQL evidence where the PLAN required it.

Do not redesign the feature.
Do not re-analyze the whole repository.
Do not reopen already-settled architecture unless the implementation provides new evidence that requires escalation.

## Review scope

Review only:

- original finding
- approved PLAN
- implementation diff
- changed tests
- verification results
- PostgreSQL evidence where applicable

Check:

- root cause actually fixed
- approved invariants preserved
- implementation matches PLAN
- regression risk
- authorization/security boundary
- transaction correctness
- concurrency correctness
- sensitive-data handling
- API/contract correctness
- cache ownership
- unnecessary abstraction
- architecture violations
- missing required tests
- required PostgreSQL verification actually passed
- unrelated changes accidentally included

## Verdict

Return exactly one of:

APPROVE
APPROVE WITH MINOR FIX
REWORK
ESCALATE

Interpretation:

APPROVE
- root cause fixed
- required verification passed
- no blocking issue remains

APPROVE WITH MINOR FIX
- no design change required
- only small cleanup/test/documentation correction remains

REWORK
- approved PLAN is still valid
- implementation or verification is insufficient/wrong

ESCALATE
- PLAN itself must change
- new product/domain/architecture/security/migration decision is required

## Mandatory evidence update

Update:

docs/migration/m7-foundation-fixes/$ARGUMENTS.md

Append the review; do not rewrite PLAN or implementation history.

Under:

## REVIEW

record:

- verdict
- findings by severity
- blocking issues
- minor issues
- remaining risks
- reviewer recommendation

Update Status as follows:

APPROVE
→ CLOSED

APPROVE WITH MINOR FIX
→ REVIEWED-MINOR

REWORK
→ REWORK

ESCALATE
→ ESCALATED

Do not mark CLOSED if required verification failed or was not performed.

## Completion condition

Do not report review complete unless the evidence file was updated.

Return:

- Evidence file path
- Verdict
- Updated status
- Findings by severity
- Required next action