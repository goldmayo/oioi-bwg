# M7 Foundation Fix Workflows

## PLAN

Confirm the finding against the analysis registry and PostgreSQL verification, then inspect only the related source, tests, and architecture or domain rules. Separate observed cause from assumptions. Compare the smallest viable options and identify any unresolved policy decision.

Do not modify code, tests, configuration, migrations, or documentation during this phase.

Return exactly these sections:

```text
Finding
Selected Model / Effort
Confirmed Cause
Invariant to Preserve
Options
Recommended Minimal Change
Files Expected to Change
Tests Required
Actual PostgreSQL Verification
Risks / Unknowns
Implementation Prompt
```

Make `Implementation Prompt` self-contained enough for another worker. Include the exact finding, approved invariant, chosen option, allowed file scope, required tests and commands, PostgreSQL procedure when applicable, and escalation conditions. Do not describe the plan as approved until the user approves it.

For DATA-005, produce a policy decision proposal or ADR only. Do not plan a code change before the user chooses the slug policy.

## IMPLEMENT

Require the approved `/m7-plan` result as input. Verify that its baseline still matches the relevant source and evidence. Implement the smallest diff authorized by that plan, add focused regression coverage, and run the repository gates required by `AGENTS.md`.

For database findings, use an isolated local Docker Compose PostgreSQL database and record the commands and observed results. Do not touch production or claim database verification from mocks. For DATA-008, add coverage incrementally with the high-risk fix it protects rather than creating a broad test suite in one change.

If implementation requires a policy, architecture, contract, migration, or file-scope decision that the plan did not approve, stop before making that decision. Report `ESCALATION`, the new evidence, why the plan is insufficient, and the exact choice required.

Return exactly these sections:

```text
Changed Files
Implemented Decision
Tests Added
Commands Run
Results
Remaining Unknowns
Diff Review Packet
```

Limit `Diff Review Packet` to:

```text
finding
plan 핵심
changed files
git diff summary
test results
known risks
```

Report only commands actually run and their actual results.

## REVIEW

Review these inputs only:

```text
finding
approved plan
changed diff
test result
PostgreSQL verification result
directly related changed files
```

Do not restart a repository-wide analysis. Check whether the original invariant is fixed, then inspect regression risk, authorization bypass, transaction correctness, concurrency, sensitive data exposure, API contract consistency, cache ownership, overengineering, and architecture violations.

Choose exactly one verdict:

```text
APPROVE
APPROVE WITH MINOR FIX
REWORK
ESCALATE
```

List findings in descending severity with file and line references when available. Explain the concrete failure mode and required correction. If there are no findings, state that clearly and note any residual verification gap.
