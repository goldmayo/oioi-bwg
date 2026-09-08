# Reverse Engineering and Comparison

Reverse engineering describes AS-IS behavior at a source ref. It is not design approval, migration planning, or a gap-fixing checklist.

## Evidence order

Use the strongest evidence available for the claim:

1. executed runtime or database observation when the claim is inherently runtime-dependent
2. route, component, service, repository, and other executable source
3. schema, migration, generated metadata, config, and workflow files
4. focused tests, interpreted as evidence of asserted behavior rather than proof that production behaves identically
5. Git history and PRs for origin or change chronology
6. existing descriptive documents as navigation and prior analysis

Architecture may explain rationale or show the intended target, but it cannot prove AS-IS behavior. Mark observations `confirmed`, `inferred`, or `unknown`, and cite decisive source paths or commands.

## Snapshot modes

### Frozen historical snapshot

- Pin repository, branch/tag, and exact commit.
- Describe only that tree and its applicable runtime evidence.
- Do not refresh it with later implementation facts.
- Correct inaccuracies against the same fixed ref and preserve a change record.
- Do not call it stale merely because the project advanced.

`legacy-main` currently intends this role; verify its index and pinned ref before relying on it.

### Moving current snapshot

- Name the tracked branch and pin the exact commit observed on every substantive refresh.
- Compare the previous source commit to the new one and inspect relevant changed paths.
- Set freshness from evidence, not from `updated_at` alone.
- Keep unknowns where runtime or external state was not observed.

`migrated-current` currently intends this role, but its provenance must be rechecked rather than assumed.

## Updating a snapshot

1. Read the snapshot's complete scope/index and current provenance.
2. Resolve the intended source ref to an exact commit and inspect working-tree state.
3. Determine relevant changes since the prior ref with scoped history/diffs.
4. Verify affected claims against source and runtime evidence where required.
5. Update facts, confidence, unknowns, provenance, and cross-references together.
6. Report unverified sections; never imply a full refresh from a partial review.

Do not use the architecture target to fill missing AS-IS sections. Do not alter a frozen snapshot to match a moving branch.

## Comparison

A comparison relates two independently valid AS-IS snapshots:

```text
pinned left observation
  -> observed difference
pinned right observation
```

Require exact commits on both sides for a reproducible historical comparison. State unknown when one side lacks adequate evidence. Use neutral change types such as added, removed, moved, split, merged, restructured, behavior-preserved, behavior-changed, partial, or unknown.

Do not convert difference into quality, compliance, or completion merely because the right side resembles architecture. If useful, link a separate architecture constraint as rationale and label that link normative; keep the observed difference source-backed.

## Reverse engineering versus migration evidence

Promote a finding to reusable reverse engineering when it:

- describes current implementation rather than a phase execution
- remains useful beyond the phase that discovered it
- is likely to support multiple future plans, audits, or consumers
- can be maintained against a named source snapshot

Keep it as migration evidence when it primarily records:

- a phase-specific inventory, preflight, investigation, or audit question
- command output or environment state for a particular execution
- verification against one plan's Definition of Done
- a temporary blocker, checkpoint, or review packet

When promoted, move canonical ownership only within authorized scope. Replace duplicated detail with a link from the phase evidence and preserve the historical record.

## Duplicate snapshot checks

For suspected duplicates, compare hashes or byte content, then inspect history and inbound links. Identical content in differently named snapshot locations is not proof that both should remain canonical. Determine whether one is an accidental copy, compatibility path, or missing index before recommending consolidation.

Known root-versus-`migrated-current` duplicate candidates must always be revalidated at the current ref. Detection alone does not authorize edits, moves, or deletion.
