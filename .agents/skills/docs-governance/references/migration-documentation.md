# Migration Documentation

Migration artifacts connect evidenced AS-IS to approved architecture and then record actual execution. Classify their contents even when existing filenames or directories do not.

## Choose the record before creating a file

Apply the creation and lifecycle policy in [AGENTS §9](../../../../AGENTS.md#9-문서-및-변경-원칙).
The sections below describe content responsibilities, not a requirement to create one file of
each kind. A single PR normally keeps its prospective plan and retrospective verification in
the PR body, visibly separated. Multi-PR work updates its existing concern plan and final result.
Repository plans, evidence files, and results are exceptions that must pass the creation gate.

## Migration plan

A plan should normally contain:

- purpose, scope, and non-goals
- governing architecture and domain references
- reverse-engineering evidence and pinned baseline
- strategy and affected boundaries
- risks, unknowns, and escalation conditions
- Definition of Done and verification strategy

The plan may choose implementation tactics allowed by architecture; it may not invent or silently override architecture or domain policy. Surface missing decisions before implementation.

Once execution starts, do not rewrite the plan to match the outcome. Correct a material error through a visible addendum, revision, or superseding plan that preserves the original intent and approval trail.

## Migration evidence

Inventory, audit, preflight, investigation, verification, and checkpoint are evidence labels, not permanent authority classes. State:

- question and phase scope
- pinned source or execution baseline
- method and evidence inspected
- confirmed findings, inferences, and unknowns
- implications for the plan or result without turning them into architecture

If a finding becomes a whole-codebase reusable AS-IS fact, apply the promotion test in `reverse-engineering.md`; do not maintain the same detailed fact in both places.

## Migration result

A result should normally contain:

- actual changes
- deviations from the approved plan and why they occurred
- relevant PR and commits
- verification actually performed and actual outcomes
- remaining gaps, risks, and next-phase prerequisites
- exact verified source ref

Do not rewrite a prospective plan as a retrospective result. Keep the original intent and actual
outcome distinct, whether they live in separate existing documents or labeled PR sections.
Historical specialized ledgers may contain separate immutable PLAN, IMPLEMENTATION,
VERIFICATION, and REVIEW sections; preserve those established workflows rather than
retroactively restructuring them.

Keep a final result for the independent phase or concern, not a new RESULT for every PR or
checkpoint. It summarizes final scope, significant failures and limitations, the verified ref, and
links to implementation and detailed evidence. Intermediate records are eligible for scoped
consolidation under AGENTS §9; preserve their unique facts, approval trail, and pinned originals.

Never claim a command passed unless it ran. Distinguish static inspection, mocked tests, real PostgreSQL/runtime verification, and production observation.

## CHECKPOINT and HANDOFF

Use these as temporary coordination artifacts only when a durable repository document is genuinely required. Current task coordination, TODOs, blockers, review notes, and ownership transfer usually fit a GitHub Issue or PR better.

- Preserve existing historical CHECKPOINT/HANDOFF evidence unless cleanup is explicitly requested.
- Move durable final facts into the phase result by reference or scoped consolidation when authorized.
- Do not create serial handoff files when updating an issue, PR, plan, or result would retain the information.
- A checkpoint records an intermediate baseline; it does not become the phase's permanent truth after final verification.

## Durable developer documentation

Setup, local environment, recurring commands, troubleshooting, and operational usage that outlive a migration phase are developer documentation even if first written during migration or stored under `implementation/`.

Before moving or creating such a document, inspect existing onboarding, operations, scripts, config, and inbound links. Placement changes require explicit scope. A migration result should link the durable guide and record that it was introduced; it should not duplicate the full procedure.

## Traceability

Maintain the links that exist for the concern:

```text
Reverse-engineering evidence
  -> Architecture constraint or approved decision
  -> Migration plan
  -> PR and commit
  -> Verification evidence
  -> Migration result
```

At minimum, a new or changed plan must cite its architecture and evidence inputs; a result must
cite its governing plan or PR intent, implementation refs, verification, and remaining gaps.
Traceability does not require a separate file at every edge. Architecture may link rationale or
downstream work, but do not rewrite it as an execution log.

When a link is unavailable, record the missing edge explicitly rather than fabricating it.

## Existing M7 exception

Registered `DATA-001` through `DATA-009` artifacts use narrower repository skills and a single evidence ledger with distinct PLAN, IMPLEMENTATION, VERIFICATION, and REVIEW sections. Those specialized skills take precedence for plan creation, implementation recording, and verdicts. This governance skill may audit their classification, provenance, duplication, or long-term placement only when requested; it must not replace or casually normalize their workflow.
