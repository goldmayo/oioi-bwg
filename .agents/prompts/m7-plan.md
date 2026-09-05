---
description: Plan one M7 foundation finding and persist the approved plan evidence
---

Use the `m7-foundation-fix` skill.

Finding: $ARGUMENTS

Execute only the PLAN phase for the requested M7-DATA finding.

Do not modify application code, schema, migrations, tests, or architecture/domain documents.

Read only the evidence needed for this finding:

1. M7-DATA-LAYER-ANALYSIS.md
2. M7-POSTGRES-VERIFICATION.md
3. relevant current source/test files
4. relevant active architecture sections
5. DOMAIN_SPECIFICATION.md only when the finding requires a domain/product policy decision

Do not re-analyze the whole repository.

## Model reporting

Do not claim or infer the actual runtime model.

Record only the model/effort recommendation defined by the `m7-foundation-fix` skill registry.

Example:

Registry recommendation: Sol High

## Mandatory evidence write

The PLAN must not exist only in chat.

Persist it to:

docs/migration/m7-foundation-fixes/$ARGUMENTS.md

If the file does not exist, create it.

Use this structure:

# M7-$ARGUMENTS

## Status

PLANNED

## PLAN

<full PLAN>

## IMPLEMENTATION

pending

## VERIFICATION

pending

## REVIEW

pending

If an existing evidence file contains prior implementation/review history, do not overwrite it silently.
Stop and report the conflict unless the existing file is clearly an unimplemented PLAN draft for the same finding.

The evidence file is the canonical handoff for IMPLEMENT.

## PLAN content

The PLAN must include:

- Registry recommendation
- Confirmed evidence
- Root cause
- Invariants to preserve
- Options considered
- Recommended minimal change
- Expected files to change
- Files explicitly not to change, when relevant
- Tests required
- PostgreSQL verification required
- Risks / unknowns
- Escalation conditions

Do not produce a long standalone Implementation Prompt.

Instead use this short handoff:

Implementation handoff:
Run `/m7-implement $ARGUMENTS`.
Canonical plan: `docs/migration/m7-foundation-fixes/$ARGUMENTS.md`

## Completion condition

Do not report PLAN complete unless the evidence file was successfully created or updated.

Return:

- Evidence file path
- Evidence write result
- Registry recommendation
- PLAN summary
- Escalation required, if any
- Implementation handoff

Do not implement the fix.