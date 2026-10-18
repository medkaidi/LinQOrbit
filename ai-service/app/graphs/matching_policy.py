"""Comparison policy of the matching agent (D58) — the ONLY module to replace
when the definitive scoring policy is defined.

The policy says how a criterion present in the candidate sheet turns into a
0-100 score. Everything else (contract, evidence discipline, relevant
experience, "absent = 0") lives in ``matching_agent`` and survives a policy
change. Bump ``POLICY_VERSION`` with any change of ``POLICY_RULES``: every
stored result records the version that produced it.
"""

# "generic-1": provisional, generic guidance pending the product's own policy.
POLICY_VERSION = "generic-1"

POLICY_RULES = """Scoring scale (provisional generic policy):
- 100: the candidate sheet clearly meets or exceeds what the offer expects
  for this criterion (level, years, scope), backed by concrete evidence.
- 70-90: the criterion is met, but the evidence is thinner than expected
  or the level/years are slightly below the expectation.
- 40-60: only a closely related or equivalent capability is shown (e.g.
  the offer asks for PostgreSQL, the candidate shows MySQL in production),
  or the level/years are clearly below the expectation.
- 10-30: a weak signal only (a passing mention, a short or old use).
- 0: the candidate sheet does not show the criterion at all.

Per section:
- Skills: compare level (1-5) and years with the expectation; synonyms and
  true equivalents count as the skill itself (e.g. "Postgres" =
  "PostgreSQL"); a different technology of the same family is "related"
  (40-60), never a full match.
- Languages: compare CEFR levels; one level below the expectation is
  70-90, two levels below 40-60; a language without a stated level is
  scored on the evidence only.
- Experience: compare the RELEVANT years you computed with the required
  years; meeting them is 100, then decrease in proportion to the gap.
- Education: a degree of the required level or above in the required or a
  closely related field is 100; a lower degree level or an unrelated field
  scores lower; a certification counts only when it is the one named."""
