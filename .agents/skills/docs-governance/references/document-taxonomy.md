# Document Taxonomy and Canonical Ownership

Classify a document from the question it answers and the evidence it contains. A filename, directory, `status`, or `authority` value is only a clue; existing metadata is inconsistent outside the active architecture corpus.

## Classes

| Class | Question answered | Character | Canonical-home rule | Must not become |
|---|---|---|---|---|
| Architecture | How must the system be built? | Normative, TO-BE, implementation constraint | The owning active document under `docs/migration/oioi-bwg-architecture-clean-v1/`; `00-document-index.md` owns the corpus map and status | Evidence of current behavior |
| Domain specification | What domain terms, permissions, transitions, invariants, and lifecycle rules must hold? | Normative domain contract and test oracle | `docs/migration/DOMAIN_SPECIFICATION.md` for the domain facts it explicitly owns | A technical implementation shortcut or AS-IS inventory |
| Reverse engineering | How does code at a particular source ref actually behave? | Descriptive, AS-IS, source-backed | The snapshot document whose declared scope owns the observed fact | Architecture authority or a desired design |
| Comparison | What differs between two pinned AS-IS snapshots? | Descriptive relation between reproducible observations | A comparison document with both sources pinned | A quality score, roadmap, or TO-BE design |
| Migration plan | How will the system move from evidenced AS-IS to approved TO-BE? | Prospective execution intent | The existing phase/concern plan, or the repository's current general migration-artifact location after a search | A rewritten account of what ultimately happened |
| Migration evidence | What was inspected or verified for this phase? | Phase-scoped observation or execution evidence | The relevant phase evidence artifact unless the fact deserves reusable RE ownership | A durable architecture rule |
| Migration result | What actually changed and what verification passed or failed? | Retrospective, immutable execution record | The result for the same phase or reviewable concern | A replacement for the plan or architecture |
| Developer documentation | How does a developer repeatedly set up, run, troubleshoot, or operate the repository independent of one migration phase? | Durable usage documentation | The established developer/operations documentation owner found by search; location is a governance decision when no owner exists | A phase result merely because it originated during migration |

`docs/migration/implementation/` is the current default candidate for general migration artifacts, not proof that every file inside is a migration artifact or that the layout is permanently canonical. `docs/migration/m7-foundation-fixes/` is governed by the narrower M7 workflow for registered findings.

## Classification tests

Apply these in order:

1. If changing the statement would change what implementations are allowed, it is normative architecture or domain policy.
2. If the statement can be falsified by inspecting a pinned code ref, it is reverse-engineering evidence.
3. If it relates two independently pinned source states, it is comparison.
4. If it chooses future steps under existing constraints, it is a migration plan.
5. If it records investigation or validation performed during a phase, it is migration evidence.
6. If it records actual changes, deviations, and completed verification, it is a migration result.
7. If it remains useful after the migration phase is forgotten, it is likely developer documentation.

A document with multiple answers should usually be split or reduced to a thin index that links to the owners. Do not split an existing historical artifact merely to satisfy this model unless reorganization is in scope.

## One fact, one canonical home

Search before creating:

- exact phrases, domain identifiers, architecture document IDs, phase IDs, routes, table names, and APIs
- titles and headings under `docs/`
- inbound links and `depends_on` references
- Git history for renamed or superseded owners

Choose ownership by semantic responsibility and authority, then by maintained lifecycle and provenance. Do not choose the newest file automatically. Keep summaries local only when they are clearly labeled summaries and link to the canonical source; copy neither detailed rules nor verification evidence that another file must maintain.

Create a new document only when all are true:

- no current owner has the requested responsibility
- extending an existing owner would mix document classes or unrelated concerns
- the new scope has a stable identity and expected lifecycle
- its upstream and downstream traceability can be named

Otherwise update the existing owner or add a cross-reference.

## Duplicate handling

When two documents appear to own the same facts:

1. Compare content, scope, provenance, lifecycle, link graph, and Git history.
2. Determine whether they are exact duplicates, snapshots of different refs, summaries, forks, or accidental copies.
3. Recommend one owner and a preservation strategy: cross-reference, explicit supersession, archival retention, or scoped consolidation.
4. Check and update inbound links if the user authorizes the structural change.

Detection does not authorize deletion or movement. Preserve historical evidence and report the cleanup separately when it is outside scope.
