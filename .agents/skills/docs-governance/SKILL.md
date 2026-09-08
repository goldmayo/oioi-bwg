---
name: docs-governance
description: Govern oioi-bwg documentation placement and lifecycle when creating, updating, moving, auditing, or assessing staleness or metadata. Classify architecture, reverse-engineering and comparison, migration plan, evidence, result, and durable developer docs; protect authority, provenance, canonical ownership, and traceability. Do not use for ordinary code work, and defer exact M7 DATA finding workflows to the narrower M7 skills.
---

# Docs Governance

Manage repository documents by their semantic role, not by filename, directory, or existing front matter. Keep normative TO-BE decisions separate from descriptive AS-IS evidence, give each durable fact one canonical owner, and preserve traceability without expanding the user's requested cleanup scope.

## Classify the request

Identify both the operation and document class before editing:

- operation: create, update, move, consolidate, audit, freshness check, or metadata normalization
- class: architecture, domain specification, reverse-engineering snapshot, AS-IS comparison, migration plan, migration evidence, migration result, or durable developer documentation

Read [document-taxonomy.md](references/document-taxonomy.md) when placement, class, canonical ownership, or create-versus-update is at issue.

If the request is `/m7-plan`, `/m7-implement`, `/m7-review`, or otherwise targets one registered M7 DATA finding, use the corresponding narrower M7 skill. Use this skill for that artifact only when the user specifically asks for a documentation-governance audit or reorganization decision.

## Establish evidence

Before changing documentation:

1. Read the current repository `AGENTS.md` and the complete target document.
2. Inspect its index, declared dependencies, inbound references, same-class neighbors, and relevant Git history.
3. Read only the source material needed for the class:
   - architecture: `00-document-index.md`, `01-architecture-constitution.md`, the owning active architecture documents, and `DOMAIN_SPECIFICATION.md` when domain policy is involved
   - reverse engineering or comparison: the pinned source code, config, migrations, tests, and relevant existing snapshot documents
   - migration: the governing architecture, relevant AS-IS evidence, prior plan, implementation diff, verification artifacts, and result as applicable
   - developer documentation: current scripts, config, runtime behavior, and actual user workflow
4. Confirm the Git ref and working-tree state when a claim depends on code.

Do not load the entire documentation corpus by default. Follow direct dependencies and expand only when ownership, conflict, or provenance remains unresolved.

## Protect authority

Use [authority-and-lifecycle.md](references/authority-and-lifecycle.md) for conflicts, architecture changes, lifecycle state, or staleness decisions.

- Architecture answers what the system should be and constrains implementation.
- Source code plus source-backed reverse engineering answers what the system actually does.
- Reverse engineering and comparison are evidence, never TO-BE authority.
- Migration plans translate AS-IS toward approved architecture; they do not create architecture by implication.
- Results report what happened; they do not rewrite the plan or retroactively justify deviations.

When implementation conflicts with architecture, expose the mismatch. Do not silently change, weaken, or ignore architecture based on current code. Require an architecture revision or explicit escalation before implementation adopts an exception.

## Enforce one fact, one canonical home

Before creating a file or copying a claim:

1. Search by concept, identifiers, headings, filenames, and known aliases.
2. Inspect same-class documents and their history; do not rely on path or metadata alone.
3. Select the document whose declared responsibility and authority own the fact.
4. Update that document when it already owns the fact.
5. Use a concise cross-reference elsewhere instead of duplicating maintained content.

If canonical ownership is ambiguous, report the candidates and required decision rather than creating another owner. Do not move, delete, consolidate, or mark existing documents superseded unless the user requested that scope.

## Route detailed work

- For exact source refs, timestamps, moving or dirty worktrees, verification baselines, and recommended metadata, read [provenance.md](references/provenance.md).
- For frozen versus moving snapshots, confidence labels, AS-IS updates, comparisons, and promotion from phase evidence, read [reverse-engineering.md](references/reverse-engineering.md).
- For PLAN, evidence, RESULT, CHECKPOINT, HANDOFF, developer-document separation, and traceability, read [migration-documentation.md](references/migration-documentation.md).

Read multiple references only when the operation crosses those concerns.

## Write within scope

- Preserve user intent, existing history, and unrelated working-tree changes.
- Keep observation, inference, decision, proposal, execution, and verification visibly distinct.
- Record only commands and checks actually performed.
- Update links, index entries, lifecycle metadata, and provenance only when the requested change requires them.
- Treat metadata normalization and directory restructuring as migrations with explicit scope, not incidental cleanup.
- Never use this skill as permission to modify application code, architecture decisions, or documents outside the user's request.

## Complete the task

Report:

- classification and chosen canonical home
- evidence and pinned source refs used
- files created, updated, moved, or intentionally left unchanged
- authority, duplication, freshness, or traceability issues found
- validations actually run and their results
- unresolved decisions and explicitly deferred cleanup
