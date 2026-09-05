---
name: m7-plan
description: Analyze and persist the plan for one oioi-bwg M7-DATA foundation finding. Use for `/m7-plan DATA-001`; do not use to implement or review a finding.
---

# M7 Plan

Plan exactly one `DATA-001` through `DATA-009` finding. Accept `M7-DATA-001` as input, but normalize the evidence filename to `DATA-001`.

Use `$m7-foundation-fix` for the finding registry, evidence order, architecture constraints, and PLAN analysis. This skill's required evidence write is an explicit exception to that skill's no-document-change PLAN rule.

Read only the analysis registry, PostgreSQL verification record, directly related source and tests, relevant active architecture sections, and the Domain Specification when a policy decision is needed. Do not change application code, schema, migrations, tests, or architecture/domain documents.

Persist the result to `docs/migration/m7-foundation-fixes/DATA-001.md`. Create it when absent with this structure:

```md
# M7-DATA-001

## Status

PLANNED

## PLAN

<full plan>

## IMPLEMENTATION

pending

## VERIFICATION

pending

## REVIEW

pending
```

If an existing file has implementation or review history, do not overwrite it. Stop and report the conflict unless it is clearly an unimplemented plan draft for this exact finding.

The PLAN must contain the registry model/effort recommendation, confirmed evidence and root cause, invariants, options, minimal recommended change, expected and excluded files, tests, required PostgreSQL verification, risks, unknowns, and escalation conditions. Do not infer the actual runtime model.

Finish only after the evidence file is written. Report its path and write result, the registry recommendation, a concise plan summary, any escalation, and this handoff:

```text
Run `/m7-implement DATA-001`.
Canonical plan: docs/migration/m7-foundation-fixes/DATA-001.md
```
