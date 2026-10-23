# Golden-set reports — retention

`matching_golden_set.py` writes one dated JSON report per run in this directory
and never overwrites an earlier one. The directory is a **manual audit trail**,
not a CI artifact: it must stay small enough to review, while keeping the last
evidence of both a green and a red run for every fixture.

## Policy

After a run is reviewed, keep at most **two reports per fixture**:

1. the latest `PASS` — the last known-good replay of the fixture;
2. the latest `FAIL` — the last known regression of that fixture.

Everything older is redundant and should be deleted in the same change that
commits the new report. A new `PASS` replaces the previous `PASS`; a new
`FAIL` replaces the previous `FAIL`. Do not delete the only remaining `FAIL`
just because a later `PASS` exists: the pair is the evidence of what changed.

`ERROR` reports are diagnostics for an aborted run (provider, schema,
timeout). They are not a quality verdict and are pruned once the cause is
understood; if the failure is reproducible, rerun to obtain a real `FAIL`
report before pruning the `ERROR`.

Reports written before the `fixture` field existed (the first six skills
runs, 2026-10-18/19) are obsolete and were removed: their filename does not
identify a fixture and the current script always stamps it.

## Naming and content

`matching-golden-<fixture>-<UTC timestamp, microseconds>Z.json`

A report records date, fixture, model, temperature, policy version, analysis
policy versions, expected/obtained score and evidence per case, and the
verdict (`PASS`, `FAIL` or `ERROR`). Reports are immutable — a rerun creates a
new file, it never edits an old one.

## Running

From `ai-service/` (real model; needs `GOOGLE_API_KEY` in `.env`):

```bash
uv run python scripts/matching_golden_set.py skills
uv run python scripts/matching_golden_set.py education
uv run python scripts/matching_golden_set.py certifications
```

Without `uv` (Windows virtualenv):

```bash
.venv/Scripts/python scripts/matching_golden_set.py education
```

These reports are outside pytest and outside CI by design (TD-058, D67, D68).
When a report is added, apply the policy above and mention the retained pair
in the task/commit notes.
