"""Comparison policy of the matching agent (D58) — the ONLY module to replace
when the definitive scoring policy is defined.

The policy says how a criterion present in the candidate sheet turns into a
0-100 score. Everything else (contract, evidence discipline, relevant
experience, "absent = 0") lives in ``matching_agent`` and survives a policy
change. Bump ``POLICY_VERSION`` with any change of ``POLICY_RULES``: every
stored result records the version that produced it.
"""

# "skills-3": deterministic bands for the skills. Same values as skills-1;
# skills-2 made a declared level a known measure even without proven use;
# skills-3 makes an answered clarification count as proven use (never as a
# level) and forbids scoring 0 a related technology proven by use. Generic
# rules kept for languages, experience and education.
POLICY_VERSION = "skills-3"

POLICY_RULES = """Scoring policy (skills-3). The offer criterion text states the
expectation ("level 4/5", "at least 3 years"); an expectation it does not
state does not exist. Only measures present on both sides are compared. Never
invent a value the candidate sheet does not state, and never penalise a
measure that is missing on one side.

Skills — deterministic bands:
- Level (both levels known, 1-5 scale), d = candidate level - expected level:
  d >= 0 -> 100; d = -1 -> 75; d = -2 -> 50; d <= -3 -> 25.
- Years (expected years > 0 and candidate yearsExperience known),
  r = candidate years / expected years:
  r >= 1 -> 100; 0.66 <= r < 1 -> 80; 0.33 <= r < 0.66 -> 55; r < 0.33 -> 30.
- Both bands available: the score is the LOWER of the two (the unmet
  expectation drives the score). One band unavailable: ignore it only.
- No band available (the criterion states no measure, or the sheet has none):
  level known -> 5: 100, 4: 85, 3: 70, 2: 55, 1: 40;
  level unknown but use proven by an experience, a project, or an answered
  clarification -> 60; an answer that states no level does not prove a level;
  level unknown and only listed (skills index or bio) -> 35.
  A level present on the candidate sheet is a known measure even when the
  offer states no level and no usage is proven: apply the level-known presence
  band. The bare-mention band applies only when the candidate's level is
  unknown.
- Synonyms and true equivalents are the skill itself (Postgres = PostgreSQL).
- A different technology of the same family is 40-50 at most, and only when
  that technology is itself proven by use (MySQL vs PostgreSQL, Vue vs React,
  Kotlin vs Java). Java/JavaScript and C#/C++ are not related. A related
  technology is never a full match. A related technology proven by use is
  never scored 0: the exact skill may be absent from the sheet, the 40-50 band
  still applies.
- Never infer a skill from a job title, a company, the seniority or the total
  career length.

Languages:
- Compare CEFR levels: meeting or exceeding the expectation is 100; one level
  below 70-90; two levels below 40-60; three or more below 10-30. A language
  without a stated level is scored on its evidence only (a bare mention
  10-30).

Experience:
- Compare the RELEVANT years you computed (see the contract) with the required
  years. Meeting them is 100; then decrease in proportion to the gap.

Education:
- A degree of the required level or above, in the required or a closely
  related field, is 100. A lower degree level or an unrelated field scores
  lower. A certification counts only when it is the one named; a closely
  related certification is 40-50 at most."""
