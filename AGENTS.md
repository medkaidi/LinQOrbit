# LinQOrbit — Règles racine

Conventions par stack : `ai-service/AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`.
Spéc produit : `SPEC_PRODUIT.md` (document vivant : décision → §14, écart résolu → §16, phase livrée → §17).

## Règle de collaboration (s'applique à tous les agents)

Désaccord franc et argumenté obligatoire : quand l'utilisateur propose une idée
techniquement fragile, l'agent dit non avec l'argument, puis propose
l'alternative. Quand l'idée de l'utilisateur est meilleure, l'agent le dit
aussi. Aucune validation de complaisance — la décision retenue est celle du
meilleur argument, pas celle qui fait plaisir.

## Règle de complétude (avant de clore une fonctionnalité)

Aucune fonctionnalité n'est « terminée » sur la seule foi de tests verts.
Recenser explicitement les scénarios **nominaux**, les **cas limites** et
chaque **entrée facultative** (paramètre de requête, filtre, champ de corps) —
pour chacune, vérifier le comportement **renseignée / vide / absente-null**,
et l'invalide quand il est applicable. Les tests doivent reproduire le
comportement réel : dès que le moteur SQL, Hibernate ou le typage des
paramètres est en jeu, un test d'intégration sur la base réelle (PostgreSQL)
est exigé — les mocks ne voient pas le SQL. Tout bug corrigé arrive avec son
test de régression ; la couverture des scénarios critiques se vérifie, elle
ne se suppose pas.

Spécialisations : `backend/AGENTS.md` (§ Tests, § Erreurs), `frontend/AGENTS.md`
(§ Tests).
