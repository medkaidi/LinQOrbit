# Rapports de rappel du screening (hors CI)

Produits par `ScreeningRecallReport` (backend, SPEC §8.4.8 / D83) :

```bash
PYTHONIOENCODING=utf-8 python scripts/seed/generate.py --truth > truth.json
cd backend && ./mvnw test -Dtest=ScreeningRecallReport -Dscreening.recall.truth=../truth.json
```

Prérequis : seeds chargés (`seed.sql`), alignés sur les schémas courants (`generate.py --upgrade`,
additif) et vectorisés (backend démarré avec `EMBEDDING_BACKFILL_ON_BOOT=true` et le service IA
lancé).

**Population mesurée** : les pertinents d'une offre sont les candidats de son archétype **qui sont éligibles au screening pour cette offre** (même `WHERE` que `ScreeningRepository.findTopCandidates` : consentement, hors `not_looking`, couple actif non nul, hors candidats déjà candidats ou déjà suggérés). Une offre sans pertinent éligible est **non mesurable** (comptée à part, jamais notée 0) ; `excludedByRules` indique combien de pertinents les règles écartent. Le rapport est en lecture seule sur la base.

**Lecture** : vérité terrain = *même archétype de poste* dans les seeds. C'est un **proxy de
proxy** — il mesure que la recherche vectorielle sépare des familles de postes, pas qu'elle retrouve
les candidats que le matching détaillé classerait en tête. Les seeds sont synthétiques et leurs
archétypes très contrastés : un bon score ici est nécessaire, **pas suffisant**. Le rappel contre
le matching réel reste à mesurer (lot de chaînage, cf. T-101/D85). Les offres « non alignées » (panier de compétences à
cheval sur deux archétypes) sont rapportées à part : leur vérité terrain est ambiguë.

**Rétention** : un rapport par changement de modèle, de stratégie de rendu (`strategy_version`) ou
de seeds — supprimer les rapports redondants dans le même changement (même politique que
`ai-service/scripts/golden/results/README.md`). Le rapport du 2026-10-24 (population non alignée sur
l'éligibilité du screening) a été remplacé par celui du 2026-10-26.
