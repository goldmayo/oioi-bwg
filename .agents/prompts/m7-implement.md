---
description: Implement an approved M7 foundation finding plan and persist implementation evidence
---

Use the `m7-foundation-fix` skill.

Finding: $ARGUMENTS

Execute only the IMPLEMENT phase.

Canonical evidence file:

docs/migration/m7-foundation-fixes/$ARGUMENTS.md

Before changing code:

1. Read the canonical evidence file.
2. Confirm its Status is `PLANNED`.
3. Read the complete approved PLAN from that file.
4. Confirm the current source still matches the PLAN assumptions closely enough to proceed.

Do not use a PLAN that exists only in chat history.

If the evidence file is missing, incomplete, conflicting, or not PLANNED, stop and return ESCALATE.

## Rules

- Implement only the approved decision.
- Prefer the smallest architecture-compatible diff.
- Do not introduce new product/domain policy decisions.
- Do not redesign already-correct foundation boundaries.
- Do not expand scope into another M7 finding unless the approved PLAN explicitly requires it.
- Add the regression tests required by the PLAN.
- If the finding involves DB constraints, transactions, or concurrency, use isolated PostgreSQL verification where specified.
- Never use production credentials.
- Do not modify the existing local application DB unless explicitly approved.
- Do not silently modify old migration history.
- Do not mix unrelated untracked/working-tree changes into this finding.

If implementation reveals a new unresolved policy, architecture decision, migration rewrite, production-data risk, or required change outside the approved scope:

STOP.

Do not guess.

Record the reason and return ESCALATE.

## Verification

Run only the verification required by the PLAN plus the repository's relevant standard gates.

Typical gates may include:

- pnpm type-check
- pnpm test:harness
- pnpm lint
- pnpm lint:fsd
- pnpm test:unit:run
- pnpm format:check
- pnpm build when runtime/storage boundaries changed

For DB/transaction/concurrency findings, perform the PLAN's isolated PostgreSQL verification.

A mock-only test does not replace required PostgreSQL evidence.

## Mandatory evidence update

After implementation and verification, update:

docs/migration/m7-foundation-fixes/$ARGUMENTS.md

Do not rewrite the approved PLAN.

Update:

## Status

IMPLEMENTED

or, if all required verification completed successfully:

VERIFIED

## IMPLEMENTATION

Record:

- changed files
- implemented decision
- deviations from PLAN
- tests added/changed

## VERIFICATION

Record:

- commands run
- results
- PostgreSQL verification details, when applicable
- failures or remaining unknowns

Leave:

## REVIEW

pending

If verification required by the PLAN fails, do not mark VERIFIED.

## Completion condition

Do not report implementation complete unless the evidence file was updated.

Return:

- Evidence file path
- Final status: IMPLEMENTED / VERIFIED / ESCALATE
- Changed files
- Implemented decision
- Tests added/changed
- Verification commands run
- Results
- Deviations from PLAN
- Remaining unknowns
- Review handoff:

Run `/m7-review $ARGUMENTS`.
Canonical evidence: `docs/migration/m7-foundation-fixes/$ARGUMENTS.md`