# Authority and Lifecycle

## Normative authority

Use the repository's current rule priority, not a generic documentation hierarchy:

```text
user / system instructions
  > 01 Architecture Constitution
  > owning active architecture documents and DOMAIN_SPECIFICATION.md for domain policy
  > migration implementation plan
  > current implementation
```

`00-document-index.md` is the canonical map for architecture-document status, responsibility, dependencies, and conflict handling. Within the active architecture corpus, the Constitution wins; an owning area document supplies detail; `12-deployment-migration-runbook.md` translates those constraints into migration and deployment sequence and cannot override its dependencies.

The Domain Specification is a domain-policy authority and test oracle where it defines terminology, permissions, state transitions, invariants, or data lifecycle. It is not a blanket owner of technical architecture.

Reverse-engineering snapshots, comparisons, audit evidence, verification records, results, PRs, and code do not enter this normative chain merely because they are newer. They can prove that reality differs from the approved target.

## Two questions, two sources

```text
What should the implementation be?
-> Constitution + owning active architecture/domain contract

What is the implementation actually doing?
-> pinned source/runtime evidence + reverse engineering
```

Never cite architecture as proof that the implementation already behaves that way. Never promote observed behavior into a requirement without an explicit architecture or domain decision.

## Conflict protocol

When implementation and architecture disagree:

1. Cite the normative statement and the contradictory source-backed observation.
2. Determine whether the task is to correct implementation or propose a changed architecture decision.
3. If architecture must change, revise the Constitution first when necessary, then all affected active documents in the same change unit; update their version and `updated_at` according to the architecture index.
4. Do not implement or document an exception as settled until the architecture change is approved. Escalate when that approval is outside scope.

Do not rewrite architecture to match accidental current code, and do not hide a mismatch by weakening language in a migration artifact.

## Lifecycle versus freshness

The architecture index defines `draft`, `active`, `superseded`, and `deprecated` for architecture lifecycle. Outside that corpus, first inspect the document's actual convention; an existing `status: active` or `authority: plan` may not accurately classify its role.

Treat these as separate questions:

- validity: Is the document an accepted, superseded, deprecated, or draft artifact for its declared purpose?
- freshness: Does its factual content still match the source ref or moving baseline it claims to describe?
- authority: Is it allowed to constrain implementation, and within what subject?

A frozen historical snapshot can remain valid indefinitely even though current code has moved. A moving snapshot can be active but stale. A plan can remain a valid historical plan after completion without describing actual results.

When the repository has no applicable metadata convention and the user requests new metadata or normalization, prefer explicit fields such as `kind`, lifecycle `status`, `freshness`, snapshot mode, and pinned `source`. Treat this as a recommendation requiring scoped adoption; do not retrofit the corpus incidentally.

Useful freshness values are:

- `current`: checked against the declared moving source at the recorded ref
- `stale`: known source changes invalidate one or more claims
- `unknown`: no adequate comparison has been performed
- `not-applicable`: facts are bound to a frozen ref or the document is normative rather than a moving observation

## Staleness assessment

Check:

- whether the declared source branch now resolves beyond the recorded commit
- whether commits since that ref touch evidence paths relevant to the document
- whether sampled claims still match source, config, migrations, tests, or runtime evidence
- whether links, owners, dependencies, and successors still exist
- whether a result's “remaining” items were later completed elsewhere
- whether prose says `current`, `latest`, `HEAD`, uncommitted, or pending without an exact durable baseline

Return `current`, `partially stale`, `stale`, or `unknown` with evidence and affected sections. Staleness is not deletion authority.

## Initial repository audit cues

These were observations at commit `8625ef6400e57a222c9fcf3c6fb04583e6568aa7` on 2026-09-07, not permanent truths. Re-verify before acting:

- root `docs/reverse-engineering/01~08` and `migrated-current/01~08` were byte-identical pairs
- migrated-current lacked exact source branch/commit provenance and used `authority: plan`
- legacy-main pinned an exact commit but used `status: draft` and `authority: plan`
- the gap map had unknown migrated provenance and a front-matter/changelog version mismatch
- migration artifacts mixed missing metadata with `authority` values such as plan, evidence, result, handoff, and implementation
- `LOCAL-DEVELOPMENT-ENVIRONMENT.md` sat under implementation artifacts despite durable developer-document semantics
- historical CHECKPOINT and HANDOFF files remained alongside results

Use these as search prompts only. Do not automatically normalize, move, supersede, or delete them.
