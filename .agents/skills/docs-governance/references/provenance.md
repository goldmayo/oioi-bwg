# Source Provenance

Provenance makes an observation reproducible. Use it for reverse engineering, comparisons, inventories, audits, checkpoints, verification evidence, and migration results that assert code or runtime facts.

## Required source identity

Prefer all of:

- repository identity
- human-meaningful branch or tag
- exact full commit SHA
- `observed_at` for analysis or `verified_at` for executed verification

Resolve labels to commits; `current`, `latest`, `HEAD`, a branch name alone, and a date alone are not durable source identities. A branch explains lineage but a commit fixes content.

Before recording a ref, inspect the actual repository and working tree. Useful read-only checks include `git remote get-url origin`, `git rev-parse <ref>^{commit}`, `git status --short`, `git log`, and a scoped `git diff`. Never include credentials embedded in a remote URL.

## Recommended reverse-engineering metadata

Use this only when creating a new artifact or when metadata normalization is explicitly in scope and no stronger local convention conflicts:

```yaml
kind: reverse-engineering
status: active
freshness: current
snapshot:
  name: migrated-current
  mode: moving
source:
  repository: goldmayo/oioi-bwg
  branch: migration_develop
  commit: <full commit SHA>
observed_at: <YYYY-MM-DD>
```

For historical evidence use `mode: frozen`; its freshness is normally `not-applicable` because validity is evaluated against the fixed commit, not today's branch tip. Correct errors about that fixed ref without importing facts from newer code.

Do not assign `authority: plan` to descriptive evidence. If a future repository-wide metadata schema introduces authority vocabulary for evidence, apply that explicit decision; otherwise omit the field rather than inventing a normative rank.

## Comparison metadata

Pin both sides independently:

```yaml
kind: comparison
status: active
sources:
  left:
    snapshot: legacy-main
    repository: goldmayo/oioi-bwg
    branch: main
    commit: <full commit SHA>
  right:
    snapshot: migrated-current
    repository: goldmayo/oioi-bwg
    branch: migration_develop
    commit: <full commit SHA>
observed_at: <YYYY-MM-DD>
```

If either commit is unknown, label conclusions that depend on it as non-reproducible or unknown. Do not compensate with architecture assumptions.

## Verification and result provenance

Record the baseline that was actually tested:

```yaml
verified_source:
  repository: goldmayo/oioi-bwg
  branch: <branch>
  commit: <full commit SHA>
verified_at: <timestamp with timezone or YYYY-MM-DD>
```

Also record relevant environment facts that materially affect the result: PostgreSQL/runtime version, local/staging scope, migration state, fixture or dump identity, and whether production credentials were excluded. Keep commands and observed outcomes separate from planned verification.

Link the exact PR and commits when available. A PR title or phase name alone does not identify the verified tree.

## Dirty or uncommitted sources

A commit SHA does not describe uncommitted changes. If relevant files are dirty:

- prefer a clean committed baseline for durable snapshots and comparisons
- otherwise record the base SHA, that the tree was dirty, and the affected paths or a durable patch/PR reference
- do not claim reproducibility from the base SHA alone

Do not copy secrets, local dump names containing sensitive data, raw credentials, or production connection details into provenance.

## Claim-level evidence

Metadata pins the overall source; important claims should still cite the decisive path, symbol, migration, test, command output, or runtime observation. Distinguish:

- `confirmed`: directly supported at the pinned source or observed runtime
- `inferred`: reasoned from multiple confirmed facts
- `unknown`: evidence is absent, inaccessible, or contradictory

Do not upgrade inferred or unknown claims because they align with the desired architecture.
