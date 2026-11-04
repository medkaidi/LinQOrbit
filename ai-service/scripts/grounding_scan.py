"""Scan of the stored sheets: what the grounding would remove (D109).

READ-ONLY. The script never touches the database: it reads a JSON export
produced by the two SELECT queries below and reports, for every stored
sheet, the mined facts the source texts do not support. Nothing is
rewritten, nothing is revalidated — the scan measures the risk already
taken, it does not repair it.

The ai-service has no PostgreSQL dependency (Spring Boot owns the data),
so the export is made from the outside:

    psql "$DATABASE_URL" -At -c "<query>" > export.json

with one query per side, wrapped in a JSON document:

    {"offers": [...], "candidates": [...]}

Each entry carries the identifier of the sheet, the stored sheet itself
and the source texts it was mined from.

Offer query:

    SELECT jsonb_build_object(
        'id', np.normalized_profile_id::text,
        'sheet', np.content,
        'source', jsonb_build_object(
            'title', jo.title,
            'description', jo.description,
            'companyDescription', c.description
        )
    )
    FROM normalized_profile np
    JOIN normalized_profile_job_offer npjo
      ON npjo.normalized_profile_id = np.normalized_profile_id
    JOIN job_offer jo ON jo.id = npjo.job_offer_id
    LEFT JOIN companies c ON c.id = jo.company_id
    WHERE np.content IS NOT NULL
    ORDER BY np.normalized_profile_id;

Candidate query:

    SELECT jsonb_build_object(
        'id', np.normalized_profile_id::text,
        'sheet', np.content,
        'source', jsonb_build_object(
            'bio', c.bio,
            'experiences', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'description', pe.description))
                FROM professional_experiences pe WHERE pe.candidate_id = c.id), '[]'::jsonb),
            'projects', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'description', cp.description))
                FROM candidate_projects cp WHERE cp.candidate_id = c.id), '[]'::jsonb),
            'diplomas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'title', d.title))
                FROM diplomas d WHERE d.candidate_id = c.id), '[]'::jsonb),
            'links', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'label', cl.label,
                'linkType', CASE WHEN cl.link_type = 10 THEN 'certification' ELSE 'other' END))
                FROM candidate_links cl WHERE cl.candidate_id = c.id), '[]'::jsonb)
        )
    )
    FROM normalized_profile np
    JOIN normalized_profile_candidate npc
      ON npc.normalized_profile_id = np.normalized_profile_id
    JOIN candidates c ON c.id = npc.candidate_id
    WHERE np.content IS NOT NULL
    ORDER BY np.normalized_profile_id;

Usage, from ``ai-service/``:

    PYTHONIOENCODING=utf-8 .venv/Scripts/python scripts/grounding_scan.py export.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agents.candidate_grounding import ground_candidate  # noqa: E402
from app.agents.offer_grounding import ground_offer  # noqa: E402
from app.schemas.job_offer import (  # noqa: E402
    SCHEMA_VERSION as OFFER_SCHEMA_VERSION,
    JobOfferSnapshot,
    NormalizedJobOffer,
)
from app.schemas.normalize import (  # noqa: E402
    SCHEMA_VERSION as PROFILE_SCHEMA_VERSION,
    CandidateProfile,
    NormalizedProfile,
)


def _offer_snapshot(source: dict) -> JobOfferSnapshot:
    """The offer texts of the export, as the snapshot the miner received."""
    company = source.get("companyDescription")
    return JobOfferSnapshot(
        title=source.get("title"),
        description=source.get("description"),
        company={"description": company} if company else None,
    )


def _candidate_profile(source: dict) -> CandidateProfile:
    """The candidate texts of the export, as the snapshot the miner received."""
    return CandidateProfile.model_validate(
        {
            "about": {"bio": source.get("bio")} if source.get("bio") else None,
            "experiences": [
                {"description": item.get("description")}
                for item in source.get("experiences") or []
            ],
            "projects": [
                {"description": item.get("description")} for item in source.get("projects") or []
            ],
            "diplomas": [{"title": item.get("title")} for item in source.get("diplomas") or []],
            "links": [
                {"label": item.get("label"), "link_type": item.get("linkType")}
                for item in source.get("links") or []
            ],
        }
    )


def _offer_fact_names(sheet: NormalizedJobOffer) -> list[str]:
    """Every mined name of an offer sheet, in order."""
    names = [skill.name for skill in sheet.required_skills]
    names += [skill.name for skill in sheet.preferred_skills]
    names += [language.name for language in sheet.languages]
    names += [entry.label for entry in sheet.required_degrees]
    names += [entry.label for entry in sheet.required_study_fields]
    names += [certification.name for certification in sheet.certifications]
    return names


def _candidate_fact_names(sheet: NormalizedProfile) -> list[str]:
    """Every mined name of a candidate sheet, in order."""
    names = [skill.name for skill in sheet.skills]
    names += [language.name for language in sheet.languages]
    names += [diploma.title for diploma in sheet.diplomas]
    names += [certification.name for certification in sheet.certifications]
    return names


def _removed(before: list[str], after: list[str]) -> list[str]:
    """The names that are not left after the grounding."""
    remaining = list(after)
    removed = []
    for name in before:
        if name in remaining:
            remaining.remove(name)
        else:
            removed.append(name)
    return removed


def scan_offers(entries: list[dict], with_names: bool) -> dict:
    """What the grounding would remove from the stored offer sheets."""
    findings = []
    total_dropped = 0
    total_nullified = 0
    skipped = 0
    for entry in entries:
        raw = entry.get("sheet") or {}
        if raw.get("schemaVersion") != OFFER_SCHEMA_VERSION:
            # A sheet of an older schema does not carry the fields the
            # grounding reads (origin, weight, certifications). The backend
            # already refuses those sheets for the matching.
            skipped += 1
            continue
        sheet = NormalizedJobOffer.model_validate(raw)
        before = _offer_fact_names(sheet)
        grounded, report = ground_offer(sheet, _offer_snapshot(entry.get("source") or {}))
        total_dropped += report.dropped
        total_nullified += report.nullified
        if not report.touched:
            continue
        finding = {
            "id": entry.get("id"),
            "dropped": report.dropped,
            "nullified": report.nullified,
        }
        if with_names:
            finding["removed"] = _removed(before, _offer_fact_names(grounded))
        findings.append(finding)
    return {
        "scanned": len(entries) - skipped,
        "skippedOldSchema": skipped,
        "withUngroundedFacts": len(findings),
        "dropped": total_dropped,
        "nullified": total_nullified,
        "findings": findings,
    }


def scan_candidates(entries: list[dict], with_names: bool) -> dict:
    """What the grounding would remove from the stored candidate sheets."""
    findings = []
    total_dropped = 0
    total_nullified = 0
    skipped = 0
    for entry in entries:
        raw = entry.get("sheet") or {}
        if raw.get("schemaVersion") != PROFILE_SCHEMA_VERSION:
            skipped += 1
            continue
        sheet = NormalizedProfile.model_validate(raw)
        before = _candidate_fact_names(sheet)
        grounded, report = ground_candidate(sheet, _candidate_profile(entry.get("source") or {}))
        total_dropped += report.dropped
        total_nullified += report.nullified
        if not report.touched:
            continue
        finding = {
            "id": entry.get("id"),
            "dropped": report.dropped,
            "nullified": report.nullified,
        }
        if with_names:
            finding["removed"] = _removed(before, _candidate_fact_names(grounded))
        findings.append(finding)
    return {
        "scanned": len(entries) - skipped,
        "skippedOldSchema": skipped,
        "withUngroundedFacts": len(findings),
        "dropped": total_dropped,
        "nullified": total_nullified,
        "findings": findings,
    }


def main() -> int:
    """Scan an export and print the report. Never writes anything."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", type=Path, help="the JSON export of the stored sheets")
    parser.add_argument(
        "--with-names",
        action="store_true",
        help="also list the names of the ungrounded facts (content of the sheets)",
    )
    parser.add_argument("--output", type=Path, default=None, help="write the report to this file")
    arguments = parser.parse_args()

    data = json.loads(arguments.export.read_text(encoding="utf-8"))
    report = {
        "readOnly": True,
        "offers": scan_offers(data.get("offers") or [], arguments.with_names),
        "candidates": scan_candidates(data.get("candidates") or [], arguments.with_names),
    }
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if arguments.output is not None:
        arguments.output.write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
