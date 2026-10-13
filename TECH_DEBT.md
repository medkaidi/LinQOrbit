# LinQOrbit — Dettes techniques

> Inventaire central des dettes techniques (code et infrastructure).
> Les écarts produit/fonctionnels vivent dans `SPEC_PRODUIT.md` (§16-17), pas ici.
>
> **Règle pour les agents (toutes sessions Opencode) :** toute dette technique
> repérée au fil d'une session = nouvelle entrée en « Ouvertes » dans ce
> fichier. On ne supprime jamais une entrée : une dette traitée passe en
> « Résolues » avec sa date de résolution et le hash du commit. Les
> corrections ne se font que sur demande explicite de l'utilisateur.
>
> **Format d'une entrée :** ID incrémental (`TD-00x`), date de repérage,
> zone (`frontend` / `backend` / `ai-service` / `infra`), description
> factuelle, sévérité (`Basse` / `Moyenne` / `Haute`).

---

## Ouvertes

| ID | Date | Zone | Dette | Sévérité |
|---|---|---|---|---|
| TD-001 | 2026-10-12 | frontend / backend | ~13 fichiers `.gitkeep` morts dans des dossiers qui contiennent déjà du code (ex. `frontend/features/candidate/`, `frontend/hooks/`, `frontend/lib/api/`, `backend/.../db/migration/`). Les dossiers encore vides gardent le leur. | Basse |
| TD-002 | 2026-10-12 | frontend | `frontend/README.md` = boilerplate create-next-app (yarn/pnpm/bun, `app/page.tsx`, `:3000`). À réécrire en un README court et exact. | Basse |
| TD-003 | 2026-10-12 | infra | Pas de `.gitattributes` racine → avertissements LF/CRLF à chaque commit Windows. Ajouter `* text=auto eol=lf`. | Basse |
| TD-004 | 2026-10-12 | frontend | `frontend/AGENTS.md` L25 : « shadcn/ui (décision pas encore prise) » alors qu'un design system maison existe déjà (`components/ui/*` avec tokens, Button, Badge, …). Mettre la règle à jour. | Basse |
| TD-005 | 2026-10-12 | ai-service | `ai-service/AGENTS.md` § Tests : parenthèse obsolète « le health-check actuel est le seul test de vérification d'environnement » alors que la suite compte 13+ fichiers de tests. | Basse |
| TD-006 | 2026-10-12 | frontend | Icônes Material Symbols : la feuille Google (`.material-symbols-outlined { font-size: 24px }`, non-layered) écrase les utilitaires Tailwind `text-*` (en `@layer utilities`) → les ~51 call sites qui déclarent une taille (13/14/17/18/20/22/26/48 px…) rendent tous en 24 px. Sidebar contournée via `text-[16px]!` (important, 5 sites). Fix propre : auto-héberger la fonte (`public/fonts/` + `@font-face` + règle en `@layer components`, retirer le `<link>` Google) → utilitaires redeviennent maîtres, −1 requête externe. | Moyenne |
| TD-007 | 2026-10-12 | frontend | Aucun test ne couvre les régressions de style de la sidebar (parité géométrique actif/inactif, absence du badge « Active ») — seuls les tests de comportement existants (états actifs, href) font foi. | Basse |
| TD-008 | 2026-10-12 | frontend | `frontend/features/auth/brand-header.tsx` : composant mort, jamais importé (re-vérifié par grep). Dette antérieure jamais enregistrée ici. À supprimer ou brancher. | Basse |
| TD-009 | 2026-10-12 | backend | Piège Spring 7 non documenté : les interfaces client HTTP (`ClientHttpRequest`, `ClientHttpRequestExecution`, `ClientHttpResponse`) résident dans `org.springframework.http.client` (ex-`org.springframework.http` en Spring 6) et `ClientHttpRequestInterceptor.intercept(...)` prend un `org.springframework.http.HttpRequest`. Coût réel : 2 itérations de compilation à l'ajout de `CorrelationIdInterceptor` (session X-Request-Id, 2026-10-07). Correction ajoutée à `backend/AGENTS.md` § Conventions le 2026-10-12 — **résolue en partie**, entrée conservée pour traçabilité. | Basse |
| TD-010 | 2026-10-12 | backend | Pas de `ON DELETE` sur `normalized_profile_candidate` / `normalization_job` (migration V9) : la suppression d'un candidat (quand elle existera) provoquera une violation FK. | Haute |
| TD-011 | 2026-10-12 | backend | Double heartbeat `updated_at` sur `Candidate` : `touchUpdatedAt()` (CandidateService) **et** `@UpdateTimestamp` (entity) écrivent la même colonne. Le dirty-flag fonctionne, mais le mécanisme est redondant — choisir l'un des deux. | Basse |
| TD-012 | 2026-10-12 | backend | Enums sans `CHECK` en BD (`normalization_job.status`, `link_type`, …) : les types Java protègent côté app, rien ne protège côté SQL. `normalization_job.status` est passé en SMALLINT 1–5 (V17/D29) — la remarque tient toujours (pas de CHECK sur les codes). | Basse |
| TD-014 | 2026-10-12 | ai-service | Dépendance `langchain-openai` dans `pyproject.toml` sans aucun import dans `app/` (seul `langchain-google-genai` est utilisé) — dépendance morte à retirer. | Basse |
| TD-015 | 2026-10-12 | backend | `skills.category` = VARCHAR libre dans le catalogue : pas de table de référence FK, une faute de frappe duplique silencieusement une catégorie. | Basse |
| TD-016 | 2026-10-13 | backend | Exclusivité « profil = candidat XOR offre » commentée en tête de V16 mais **non contrainte en base** : rien n'empêche un `normalized_profile_id` d'être présent dans les deux tables d'association, ni de lier un job `source_type` à l'association opposée — la garantie est purement applicative (`NormalizationService` vs `JobOfferNormalizationService`). | Basse |
| TD-017 | 2026-10-13 | backend | Index V9 `ix_normalization_job_claim (status, next_attempt_at)` redondant avec le préfixe de `ix_normalization_job_source_claim (status, source_type, next_attempt_at)` (V16) — jamais retiré. | Basse |
| TD-018 | 2026-10-13 | backend | Dirty-flag de l'offre : deux définitions distinctes — validate-time = `updatedAt` vs `max(normalized_profile.validated_at)` (`JobOfferNormalizationService`), GET = `updatedAt` vs `job_offer.validatedAt` (`JobOfferService`, gate statuts éditables). Coïncident dans le cas nominal depuis le fix d'édition-pendant-analyse, mais divergent si `validatedAt` est bumpé par un no-op de validation. Unifier sur `max(validated_at)` batché. | Basse |
| TD-019 | 2026-10-13 | ai-service | `evidence.index` (offre **et** candidat) borné par `ge=0` seul : un index hors bornes du tableau des sections passe la validation et crée une preuve orpheline. Un `model_validator` sur les deux schémas couvrirait les deux côtés. | Basse |

## Résolues

| ID | Date de résolution | Commit | Note |
|---|---|---|---|
| (vide) | | | |
