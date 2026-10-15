# LinQOrbit — Tâches en cours

> Tableau de tâches vivant, tous domaines confondus (backend / frontend /
> ai-service). Règle : une tâche livrée passe en « Livré » le jour même ;
> les dettes liées sont bouclées dans `TECH_DEBT.md` (date + commit).
> Les décisions produit vivent dans `SPEC_PRODUIT.md` (§14).
>
> Ce fichier remplace l'ancien `plan-admin-console.md` (plan D33 figé —
> conservé dans l'historique git).

## En cours / à faire

> **Chantier « redesign fiches normalisées » (2026-10-14)**, inspiré de
> `frontend/template/normalized_profile.html` — **maquette = inspiration
> visuelle uniquement** : couper chrome dashboard et widgets sans donnée
> réelle (confiance, checksum, entropie, O*NET/ESCO, compensation,
> affinité matching, viewer JSON, toggle candidat/offre). Une **page
> dédiée** par fiche (pas modal, pas inline) porte le bandeau
> d'identité + actions (Copy/Download JSON) + historique des versions.
> L'admin voit aussi le profil professionnel du candidat (mode lecture,
> identique à sa vue) et l'offre source au look « fiche » (remplace
> `PublicJobArticle`). Livraison P1→P7, chaque phase = suite verte.
> Décisions : D37/D38 à écrire en SPEC §14 en P7.

| ID | Zone | Tâche | Dette | État |
|---|---|---|---|---|
| T-20 | frontend | **P1 — Fondations redesign + vue candidat** : `normalized-shared.ts` (`sheetStats(content)` = declared/inferred + couverture sections, `SpecGrid` cellules label mono + valeur, `SectionBlock` point coloré + titre lettré) ; `normalized-profile-section.tsx` → bandeau d'identité réel (`profileId` tronqué mono, `v{version}`, `schema`, `validatedAt`, statut job) + actions Copy JSON (libellé « Copied » 2 s) / Download JSON (Blob `normalized-profile-v{n}.json`) / History (slot) ; refactor `normalized-candidate-view.tsx` en grille `xl:grid-cols-12` (gauche 8 : A identity spec-grid + summary, B tableau skills : name/category, level n/5, years, evidence, origin ; C timeline fusionnée expériences+projets+diplômes triée date desc avec chips période + badge type ; D langues, E certifications, F links) ; rail droite 4 : widget Provenance (barre declared/inferred) + widget Sections (couverture réelle) ; tests vues + section | — | Livré |
| T-21 | frontend | **P2 — Vue offre redesign** : même grille 8/4 ; A SpecGrid (domain, contract, work time, seniority, work mode, location, salary) + summary + company + description ; B tableau skills unique colonnes Skill/Requirement (Required/Preferred)/Weight/Level/Min years/Evidence/Origin ; C responsibilities (cartes + weight + importance) ; D Requirements (required experience + education, sous-labels conservés) ; E Languages ; F Certifications ; G Benefits ; rail (`offerSheetStats`) ; **tolérance fiches v1** (champs absents → « — », aucun badge origin fabriqué) ; tests | — | Livré |
| T-22 | backend | **P3 — Historique des versions** : `GET /api/v1/admin/users/{userId}/normalized-profile/versions` + `GET /api/v1/admin/job-offers/{offerId}/normalized-profile/versions` → `List<AdminNormalizedProfileResponse>` triée version desc (réutilise les queries existantes avec `Pageable.unpaged()`), 404 miroirs des endpoints courants, contrat dans `AdminApi`, tests `AdminControllerTest` + `AdminServiceTest` (+ `OpenApiDocsTest` si nécessaire) | — | Livré |
| T-23 | frontend | **P4 — Pages dédiées + historique UI** : routes `(admin)/admin/users/[userId]/sheet/page.tsx` + `admin/offers/[offerId]/sheet/page.tsx` (fil d'Ariane retour, bandeau + 3 actions, panneau History lazy `admin.normalizedVersions(id)` : liste `v · schema · validatedAt · status`, sélection = affichage de cette version avec badge « Viewing v2 — current is v3 » + « Back to current », JSON = contenu de la version affichée) ; sur les pages détail : la section inline est remplacée par une **carte CTA** (badge statut + « Open sheet » → page dédiée ; jamais validé → message) ; `admin.api.ts` + `query-keys.ts` ; tests | T-20→T-22 | Livré |
| T-24 | backend+frontend | **P5 — Profil professionnel du candidat côté admin** : `GET /api/v1/admin/users/{userId}/profile` (même shape que `CandidateProfileResponse`, 404 si pas de candidat) + affichage sur la page détail compte **en mode lecture identique à la vue du candidat** (réutiliser les composants/sections de lecture — extraire les props nécessaires plutôt que dupliquer) ; tests BE (controller/service) + FE | — | Livré |
| T-25 | frontend | **P6 — Détail offre : vue source style « fiche »** : remplacer `PublicJobArticle` (`toPublicJobArticleModel`) par un composant admin qui rend l'offre **stockée** (labels résolus, HTML sanitisé) avec le look de l'ancienne `normalized-offer-view` (header bits + summary + description + skills avec weight/years/requirementType BD + langues + degrees/study fields + salary ; pas de responsibilities/benefits — non stockés) ; tests | — | Livré |
| T-26 | docs | **P7 — SPEC** : D37 (redesign vues + pages dédiées + historique), D38 (profil candidat admin + offre source, remplace PublicJobArticle) en §14 ; tâches Livré ; `frontend/AGENTS.md` phrase console admin (actions JSON + historique + page dédiée) | T-20→T-25 | Livré |

> **Chantier « drawer de comparaison » (2026-10-14)**, décision produit D39 :
> la fiche normalisée s'ouvre dans un **drawer latéral droit non-modal** depuis
> les deux pages détail (compte + offre) — le source reste visible ET
> interactif derrière (comparaison des deux volets) ; largeur 50 % viewport
> bornée [560px, 840px], plein écran sous `lg`. **Remplacement total** des
> pages dédiées `/sheet` (supprimées, une seule façon de faire) ; deep-link
> `?sheet=open` ; toutes les opérations de l'ancienne page (Copy/Download
> JSON, History, sélection de version, badge Viewing + Back to current)
> sont conservées dans le drawer. CTA « Open sheet » = `CtaButton`
> `tone="secondary"` (bleu), plus un `NavPill`. Source compacté en
> 2 colonnes pour la comparaison. T-30 : sidenav admin repliable (rail
> icônes) pour libérer la largeur.

| ID | Zone | Tâche | Dette | État |
|---|---|---|---|---|
| T-27 | frontend | **Drawer + corps de fiche partagé** : `components/ui/drawer.tsx` (shell side **non-modal** : portail, `role="dialog"` sans `aria-modal` — la source derrière reste scrollable/cliquable, Esc ferme, focus au montage + retour au CTA, largeur `lg:w-[50vw]` min 560 max 840, plein écran sous `lg`, slide-in respectant `prefers-reduced-motion`) ; `normalized-sheet-body.tsx` extrait de `NormalizedSheetView` (hooks + `NormalizedProfileSection` + actions History/version + vues friendly — **rien n'est retiré**) ; `normalized-sheet-drawer.tsx` wraps `Drawer` + body (titre « Normalized sheet » + nom entité depuis le détail déjà chargé) ; CTA des 2 pages détail = **bouton** (`CtaButton tone="secondary"`) ouvrant le drawer, état `?sheet=open` (router, refresh/back restaurent) ; **suppression** des routes `…/sheet/page.tsx` + `normalized-sheet-view.tsx` ; tests (ouverture/Esc, sélection de version dans le drawer, 404/erreur inchangés) | T-20→T-26 | Livré |
| T-28 | frontend | **Source compacté 2 colonnes** : `ProfileSections` accepte `compact` (grille 2 colonnes au-dessus de `xl`, `items-start`) + `AboutSection` repli 1 colonne en compact (les placements `lg:col-start-*` cassent à mi-largeur) ; `AdminOfferSourceView` en 2 colonnes (description full-width, blocs restants en grille) ; `/profile` inchangé (défaut `compact=false`) ; tests | T-27 | Livré |
| T-29 | docs | **D39** en SPEC §14 (drawer non-modal de comparaison, remplace les pages dédiées, `?sheet=open`, CTA bleu, source 2 colonnes, D40 sidenav si livré) ; phrase console admin `frontend/AGENTS.md` ; tâches Livré | T-27→T-28 | Livré |
| T-30 | frontend | **Sidenav admin repliable** : bouton toggle dans `AdminSidebar` (rail icônes ~`w-20` replié avec `title`/`aria-label`, chevron d'ouverture), largeur layout `lg:pl-64` ↔ `lg:pl-20`, état persisté (Zustand `linqorbit.adminSidebar`), tests | T-27→T-28 | Livré |

> **Retours UI drawer/sidenav (2026-10-14, 7 remarques)** : le drawer
> recouvrait le bon tiers des pages détail (sections inaccessibles) — la
> source se réduit (`pr` calé sur la largeur du drawer) à l'ouverture et
> revient pleine largeur à la fermeture ; bandeau CTA remonté ; fiche
> compactée (arrondis `rounded-md` sur les blocs internes — calés/ajustés
> sur la maquette — textes qui repassent à la ligne, paddings réduits) ;
> sections numérotées (motif `ItemIndex`) au lieu de pastilles colorées ;
> toggle sidenav remonté en haut + logo/wordmark resserrés ; actions JSON
> unifiées sur `CtaButton` grise.

| ID | Zone | Tâche | Dette | État |
|---|---|---|---|---|
| T-31 | frontend | **Source réduite à l'ouverture du drawer** : racine des 2 pages détail `lg:pr-[clamp(560px,50vw,840px)]` quand `sheetOpen` (le contenu ne passe jamais sous le drawer) ; `compact={sheetOpen}` sur `ProfileSections` + prop `compact` sur `AdminOfferSourceView` ; seuil 2 colonnes en **container query** (`@container` + `@[40rem]:grid-cols-2`) ; fermé = affichage antérieur pleine largeur ; tests fermé/ouvert | T-27→T-30 | Livré |
| T-32 | frontend | **Bandeau CTA remonté** : candidat = entre l'en-tête « Professional profile » et « Personal Information » ; offre = entre le h1 et la ligne company (`AdminOfferSourceView`) ; tests d'ordre DOM | T-31 | Livré |
| T-33 | frontend | **Compacité fiche + arrondis + boutons JSON** : `SpecGrid` cellules `rounded-md px-3 py-2.5 gap-2`, `truncate` → wrap (`break-words`/`break-all`) ; `NORMALIZED_ITEM_CARD` → `rounded-md p-3.5` ; rail `p-4` + internes `rounded-md p-2.5` ; drawer/section paddings `mx-4/px-4 pt-4 pb-5` ; Copy/Download JSON → `CtaButton tone="neutral"` (unification CTA plateforme) ; tests | T-30 | Livré |
| T-34 | frontend | **Sections numérotées** : `SectionBlock` pastille numérotée motif `ItemIndex` (supprime `tone`/point coloré, `letter` → `index`, titre nu) ; call sites candidat (1–6) + offre (1–n) ; tests « A. X » → titres nus | T-33 | Livré |
| T-35 | frontend | **Sidenav : toggle en haut + logo resserré** : chevron déplacé en haut à droite du conteneur logo (bouton icône compact, plus de `w-full`) ; conteneur logo `rounded-xl px-2.5 py-2` sans bordure (différencié des nav links `rounded-full`) ; Logo + Wordmark `h-5` ; tests | T-30 | Livré |
| T-36 | docs | Micro-maj `frontend/AGENTS.md` (toggle haut, arrondis fiche) ; tâches Livré ; FE test+lint+build complets | T-31→T-35 | Livré |

## Retours UI v2 — contenu principal, wordmark, toggle dashboard (2026-10-15)

> Deuxième tour de retours sur la console admin et le shell. Contenu
> principal (hors fiche normalisée) aligné sur les arrondis de la vue
> candidat (`rounded-2xl`) ; une section par ligne toujours (suppression
> des grilles 2 colonnes compact) ; offre : chaque section dans sa propre
> carte blanche (motif `ViewSection`) ; wordmark affiné partout (composant
> unique) ; toggle de repli étendu au sidebar du dashboard candidat/
> recruteur.

| ID | Zone | Tâche | Dette | État |
|---|---|---|---|---|
| T-37 | frontend | **Une section par ligne (toujours)** : supprimer les grilles 2 colonnes compact (`@container` + `@2xl:grid-cols-2`) de `ProfileSections` et `AdminOfferSourceView` — les sections/blocs restent empilés pleine largeur, drawer ouvert ou fermé ; `compact` ne sert plus qu'au repli `AboutSection` 1 colonne interne ; tests fermé/ouvert | T-31 | Livré |
| T-38 | frontend | **Offre : cartes blanches par section + arrondis vue candidat** : chaque section de `AdminOfferSourceView` (Description, Required/Preferred skills, Languages, Education) dans sa propre carte `bg-canvas-white rounded-2xl shadow-sm` (motif `ViewSection`) ; items skills → `rounded-2xl p-4` (fin des tokens `NORMALIZED_ITEM_CARD` dans la source offre — la fiche normalisée du drawer est inchangée) ; chips langues/éducation restent `rounded-full` ; tests | T-37 | Livré |
| T-39 | frontend | **Wordmark affiné (composant unique → partout)** : `fontWeight` 500 → 400, trait des cercles 4.5 → 3.5 (`components/brand/wordmark.tsx` — dashboard, admin, auth, marketing impactés d'un coup) | — | Livré |
| T-40 | frontend | **Toggle repli du dashboard sidebar** : store `stores/dashboard-sidebar-store.ts` (clé `linqorbit.dashboardSidebar`, miroir admin) ; toggle en haut à droite du conteneur logo ; rail icônes `w-20` (labels + badge « 3 AI » + carte AI Telemetry masqués, API Help en icône seule, Wordmark masqué) ; `DashboardShell` client (miroir `AdminShell`) qui pilote padding `main` (`lg:pl-64`↔`lg:pl-20`) et `left` du header (`lg:left-64`↔`lg:left-20`) ; tests | T-35 | Livré |
| T-41 | docs | Micro-maj `frontend/AGENTS.md` (shell dashboard repliable, arrondis offre) ; tâches Livré ; FE test+lint+build complets | T-37→T-40 | Livré |
| T-42 | frontend | **Drawer normalisé : 50 % du contenu hors sidenav** (au lieu de `50vw` borné [560–840] — à 1440px le drawer prenait plus de la moitié du contenu) : var CSS `--sidenav-w` sur `<html>` posée par `AdminShell` (16rem dépliée / 5rem repliée = suit le repli de la sidenav, choix utilisateur : exactement 50 % même replié) ; constantes `SHEET_HALF_WIDTH`/`SHEET_HALF_PAD` dans `normalized-shared.ts` (plancher 560px, plafond supprimé) ; `ui/drawer` perd sa largeur en dur (injectée via `className` par `normalized-sheet-drawer`) ; 2 pages détail en `pr` miroir ; tests (var, classe panneau, 5 assertions migrées) | T-41 | Livré |
| T-43 | frontend | **Lockup logo/wordmark — centrage optique du wordmark** : son encre flottait 2 unités (2,9 %) au-dessus du centre de son viewBox, d’où l’impression d’alignement « sur la ligne haute » dans les `flex items-center` (viewBox y `567.75`→`565.75`, encre `574→626` centre 600 = centre de la fenêtre ; le logo était déjà parfaitement centré). **Tailles inchangées** (`Logo h-5` + `Wordmark h-5` sidebars, `h-6`/`h-6` header marketing) : deux passes de réduction du logo (`h-4`, puis `h-4.5`/`h-5.5`) testées puis annulées à la demande de l’utilisateur — seule la correction d’alignement est retenue | T-42 | Livré |

## Retours UI v3 — cartes partagées, comptes paginés, liste offres allégée (2026-10-15)

> Troisième tour de retours. Les cartes d'offres de la console admin étaient
> trop sobres → carte unique partagée avec la vue recruteur (action « View »
> seule, console en lecture seule). La liste des comptes admin n'était pas
> paginée et ses cartes trop sobres → infinite scroll (pattern D34) +
> cartes enrichies avec chips de capacités. La liste des offres du recruteur
> rapatriait la description et les listes enfants → payload léger, la
> description ne sort qu'au détail (`readyToPublish` calculé serveur).

| ID | Zone | Tâche | Dette | État |
|---|---|---|---|---|
| T-44 | full-stack | **Carte offre admin = carte recruteur (`JobOfferCard` partagée)** : extraction de la carte présentationnelle `features/job-offer/job-offer-card.tsx` (tuile, pill company, status pill à point, badges Expired/Analyzing…/Analysis failed/Unvalidated changes, « Created … », méta séniorité·lieu·contrat·salaire, slot `actions` ; `OFFER_LINK_PILL_CLASS` exportée) ; `AdminJobOfferListItem` enrichi (séniorité, ville/pays, vocabulaire, salaire, dirty-flag) ; section admin = carte + labels `useContractTypes`/`useWorkModes` + unique CTA « View » ; `normalizationJobStatus` → progress/failed ; tests BE (AdminServiceTest) + FE (admin-offers-section mineur/étendu) | T-43 | Livré |
| T-45 | full-stack | **Comptes admin — pagination + cartes enrichies** : `GET /api/v1/admin/users` renvoie l'enveloppe `{items,page,size,total}` (`AdminUserPageResponse`, `PageSizes`, tri nom existant conservé) + flags `hasCandidateProfile`/`hasRecruiterProfile` (2 requêtes batch `findByUserIdIn`, jamais N+1) ; front `useInfiniteAdminUsers` (même clé `admin.users`, invalidation conservée) + `InfiniteList` + cartes enrichies (avatar initiales, pastille statut à point, badges Admin + chips Candidate/Recruiter) — jamais la taille de page côté front, valeur effective lue dans l'enveloppe ; tests BE + FE | T-44 | Livré |
| T-46 | full-stack | **Liste offres recruteur allégée (description uniquement au détail)** : `GET /api/v1/job-offers/mine` sert `JobOfferListItem` (plus de description ni de listes enfants — plus de chargement des catalogues par page) ; `readyToPublish` calculé **serveur** (description/pays/employment type/≥1 skill) et `isOfferReadyToPublish` supprimée côté front ; `JobOfferListItem` / `JobOfferPage.items` en types FE ; tests BE (ServiceTest `never()` sur chargements enfants, ControllerTest payload) + FE | T-45 | Livré |
| T-47 | docs | Micro-maj `frontend/AGENTS.md` (D41–D43, cartes partagées, comptes), `SPEC_PRODUIT.md` §14.10, tâches ; FE test (69 fichiers / 519) + lint + build complets, backend `./mvnw test` complet (351) | T-44→T-46 | Livré |

## Retours UI v4 — console admin : recherche/filtres, cohérence statut, polish (2026-10-15)

> Quatrième tour de retours (revue UI des deux pages admin). Cinq groupes
> retenus par l'utilisateur. Décisions : dates laissées telles quelles (ISO
> admin déjà cohérent, « Created X ago » = motif recruteur de la carte
> partagée) ; en-tête offres = breadcrumb conservé + ligne h1 avec total
> global (`total` backend, déjà exposé) + filtre statut ; filtres comptes =
> recherche debouncée + statut + capacité, combinables.

| ID | Zone | Tâche | Dette | État |
|---|---|---|---|---|
| T-48 | full-stack | **Comptes admin — recherche + filtres (statut, capacité)** : `GET /api/v1/admin/users` accepte `q` (prénom/nom/email, LIKE insensible à la casse), `status` (ACTIVE/INACTIVE) et `capability` (CANDIDATE/RECRUITER — existence de profil, requête unique jamais N+1) ; front : toolbar dans `AccountsSection` (TextField recherche debouncé 300 ms + 2 `SegmentedControl`), clé TanStack `usersPage(filters)` (préfixe `admin.users` conservé pour l'invalidation des mutations), `placeholderData` sur changement de filtre ; tests BE + FE | T-47 | Livré (BE : AdminServiceTest 43 / AdminControllerTest 32 / AdminUsersIntegrationTest 5 — **fix régression** : le JPQL `CONCAT('%', :q, '%')` avec `q` null faisait résoudre le paramètre non typé en `bytea` par PostgreSQL (500 `lower(bytea)` sur l'appel sans filtre) → motif `%terme%` minuscule pré-calculé côté service + `LOWER(col) LIKE :pattern`, test `listeSansFiltres` ; FE : `use-debounced-value` + toolbar, admin-page 14 + debounce 2) |
| T-49 | frontend | **Offres admin — en-tête toolbar + pastille statut unique** : breadcrumb conservé, une ligne h1 « Job offers » avec nombre total d'enregistrements (`pages[0].total`) + `SegmentedControl` statut à droite (section = pure liste, fin du titre/filtre redondants) ; le détail (`admin-offer-view`) adopte la status pill partagée de `job-offer-card.tsx` (fin de `ADMIN_OFFER_STATUS_TONES` et du module `admin-offer-status.ts` si plus référencé) ; tests | T-48 | Livré (`OfferStatusPill` exportée de la carte, `admin-offer-status.ts` supprimé ; en-tête déplacé dans `AdminOffersSection` (la page n'est qu'un wrapper) + empty state sans filtre « No offers yet. » ; tests admin/job-offer 17 fichiers / 129 verts) |
| T-50 | frontend | **Polish admin** : busy ciblé par ligne (`statusMutation.variables?.userId` — fin du busy global), pays lisibles via `countryOptions` et `sex` labellisé au détail compte, « No company » muted dans `JobOfferCard`, vérification du spinner de chargement des offres (`InfiniteList` le porte déjà) ; tests | T-49 | Livré (`countryLabel` partagé dans `profile-shared.tsx` (map privée de `profile-view` supprimée) + `SEX_LABELS` au détail compte ; busy ciblé + spinner « Loading accounts… » ; « Loading offers… » aligné sur le motif recruteur (Spinner) ; « No company » ; tests admin/job-offer/candidate 26 fichiers / 216 verts) |
| T-51 | frontend | **Rejet de suggestion — confirmation** : `ConfirmDialog` avant rejet (motif `job-offers-section.tsx`) ; tests | T-50 | Livré (`ConfirmDialog` danger « Reject this suggestion? », busy pendant la mutation, fermeture sur settle ; busy globale retirée du bouton de ligne ; tests : confirmation, annulation, échec — admin-page 17) |
| T-52 | frontend | **Détail compte** : bascule Activate/Deactivate remontée dans l'en-tête (à côté des badges, fin du bouton orphelin), breadcrumb « Administration / Accounts / {nom} » (niveau intermédiaire manquant), champs restants formatés ; tests | T-51 | Livré (bascule dans la ligne badges, « Your account » pour la ligne courante ; breadcrumb 3 niveaux ; sex/pays déjà formatés en T-50) |
| T-53 | full-stack | **Règle de complétude des entrées facultatives** (règle racine actée dans `AGENTS.md` + spécialisations `backend/AGENTS.md` § Tests/§ Erreurs, `frontend/AGENTS.md` § Tests) : balayage des 3 endpoints à query params facultatifs (`/admin/users`, `/admin/job-offers`, `/job-offers/mine`) — appels nominaux sans aucun paramètre, vides ≡ absents (`?q=`, `?status=`, `?page=`, `?size=`), casse, bornes `PageSizes` au niveau HTTP, page hors plage, non-numériques ; **bug corrigé** : `MethodArgumentTypeMismatchException` (`?page=abc`) et `HttpMessageNotReadableException` (JSON malformé) n'implémentent pas `ErrorResponse` (Boot 4) → 500 par le catch-all, désormais `handleUnreadableClientInput` 400 générique ; alignement casse insensible de `parseOfferStatus` (offres admin) ; tests FE du param-building API (admin, job-offer) + recherche effacée + total filtré | T-52 | Livré (BE : AdminOffersIntegrationTest 2 (classe neuve), AdminUsersIntegrationTest 9, JobOfferIntegrationTest 7, AuthFlowIntegrationTest 9, GlobalExceptionHandlerTest 6, AdminServiceTest 44 — `./mvnw clean test` **372 verts** ; FE : admin.api.test.ts (5), listJobOffers +2, admin-page +1 → **536 verts** + lint + build) |
| T-54 | frontend | **Géométrie du lockup de marque des sidebars** : audit visuel (emblème + wordmark côte à côte, redondance de motif ; header replié hors colonne) — l'essai de rééquilibrage des tailles (Logo `h-[22px]` `strokeScale={1.8}` + Wordmark `h-6`) est écarté après retour utilisateur (« trop imposant »), retour aux `h-5` d'origine ; delta final = géométrie seule : bord de marque aligné sur la colonne d'icônes (`mx-3` + `px-3` = 24 px, contre 22,5 px avant) ; rail : emblème seul recentré sur la colonne (x=40, fin du décalage à x≈24) et toggle sorti du flux (absolu `w-6 h-6` en `-right-1.5`, gap ~3,5 px vérifié, fin de la sur-contrainte 65 px dans 64 px) ; variantes de taille du toggle en branches `cn()` (pas de classes conflictuelles) ; suppression de `features/auth/brand-header.tsx` (mort, aucun import ni test) ; `frontend/AGENTS.md` (D40/T-40) mis à jour | — | Livré (**536 verts** inchangés — aucune assertion ne référence les classes du header, toggle même parent ; lint + build verts) |

### Règles produit actées (validées 2026-10-14 — chantier fiche conforme, livré T-13→T-19)

- **Poids** : échelle unique 1-5 sur `requiredSkills`, `preferredSkills`,
  `responsibilities`. Déclaré (skill stocké) = verbatim, jamais recalculé.
  Inféré ou absent = le LLM comprend le poste et assigne un poids logique
  (5 = pivot nommé dans le titre / dossier d'une responsabilité mandatory ;
  1-2 = mention accessoire). `weight` toujours présent dans la fiche offre.
- **minYears** : déclaré jamais écrasé ; sur skill déclaré sans years ET sur
  skill inféré, déductible depuis un énoncé explicite → `minYearsSource:
  "inferred"`.
- **requiredYears/Degrees/StudyFields** : déclaré = pass-through ; inféré =
  miné depuis la description (énoncés clairs et totaux uniquement) ;
  provenance obligatoire. Règle matching : declared = filtre dur,
  inferred = advisory.
- **Certifications offre** : entrées `certifications[]` minées depuis la
  description quand le recruteur les nomme explicitement (pas d'invention).
- **Langues (candidat + offre)** : les deux catégories — saisies (declared)
  et extraites d'un texte (inferred) ; `required` + niveau CEFR ; pas de poids.
- **Credentials candidat** : diplôme/certification nommé dans un texte →
  entrée créée (`origin: inferred` + preuve) ; détail non dit jamais complété.
- **Evidence candidat** : `source` ∈ bio|experience|project|diploma|
  certification ; index 0-based (null uniquement pour `bio`).
- **Versionnement** : par fiche (`normalized_profile.schema_version` +
  `schemaVersion` dans le JSON) ; offres 1→2, candidats 2→3 ; constantes
  miroir Java bumpées ; vieilles fiches régénérées à la prochaine validation.

### Audit extraction — détail (T-12, demande produit 2026-10-14)

Demande : le LLM doit extraire **toute information utile cachée dans les textes**
(bio, expériences, projets, description d'offre) — years par skill, skills
absents des cases cochées, pondération déduite de l'importance dans le contexte.

**Candidat v2 — conforme (rien à faire) :**
- `skills[].yearsExperience` = somme des périodes non-chevauchantes des
  `evidence` items, calculée par le LLM, sinon null
  (`normalize_agent.py` PROMPT_RULES + `NormalizedSkill.yearsExperience`).
- Minage complet : bio → title/summary/seniority ; descriptions expériences
  et projets → `domain`/`responsibilities`/`technologies`/`achievements` ;
  skills inférés avec `evidence` index 0-based ; catégorie taxonomique ;
  discipline déclaré/inféré/null sur chaque valeur dérivée.
- Diplomas : `degreeLabel`/`studyFieldLabel` normalisés contre le référentiel
  DB (buildForProfile envoie degrees + studyFields).

**Candidat v2 — manque :**
- G1 : langues **non minées** — prompt interdit de créer `languages[]` hors
  section déclarée ; « fluent English » dans la bio/expérience est perdu.
  → T-16 (origin + evidence sur les langues).
- G2 : certifications/diplômes inférés depuis les textes = **non, assumé** :
  un credential est vérifiable, en inventer une est une fausse preuve ; la
  mention « AWS certified » va dans le skills index (evidence expérience).
- G3 : dernière utilisation d'une compétence (CDC §12) : **reportée au
  matching** — les dates des `evidence` permettent de la recalculer.

**Offre v1 — manques (vers v2) :**
- O1 : `weight` (colonne DB NOT NULL, saisi au formulaire 1-5) jamais reporté
  → déclaré = verbatim ; inféré = centralité dans les textes (pivot d'une
  responsabilité mandatory > mention accessoire), null sinon. → T-13/T-14.
- O2 : `requiredExpYear`/`degreeLabels`/`studyFieldLabels` jetés (T-10) →
  restaurés + inférables depuis la prose (`"must hold a Master's"`, `"at
  least 5 years of experience"`) **uniquement énoncés clairs et totaux** (pas
  « 5 years with Kubernetes »), avec `*Source`. Règle matcher : declared =
  filtre dur, inferred = advisory. Les labels déclarés viennent déjà du
  catalogue DB (`job-offer-preview.tsx` mappe `degreeIds` → labels) :
  verbatim = déjà canonique, **zéro changement backend / buildForOffer**.
- O3 : prompt/example/schemaVersion → T-14. `has_content` : rien à changer.

## Backlog (basse sévérité, sans date)

TD-024 (DTO liste sans description), TD-025 (index `job_offer(status, created_at)`),
TD-026 (helpers label dupliqués service/snapshot), TD-030 (mapping article +
`SENIORITY_LABELS` ×3), TD-031 (code mort frontend), TD-034 (prompt offre
redondant avec le schéma), TD-036 (validation schéma offre laxiste).

## Décisions

- **2026-10-14 — Duplication pipelines IA assumée** : la normalisation offre
  et candidat dans `ai-service` gardent chacune leurs fichiers, constantes et
  prompts — modification indépendante des deux fonctionnalités. Jamais de
  fusion en base commune (rejet de la recommandation d'extraction).
- **2026-10-14 — Pagination : infinite scroll (D34)** : `size` toujours
  décidé par le backend (défaut 20, clamp 50) ; le frontend n'envoie aucun
  paramètre de taille et lit l'enveloppe `{items,page,size,total}`.
  Offset (pas de cursor) tant que le volume ne l'exige pas.

## Livré

| Date | Contenu | Réf |
|---|---|---|
| 2026-10-14 | **Chantier « fiche conforme » T-13→T-19 (P1→P7)** : offre schema v1→v2 (`SCHEMA_VERSION="2"`) — poids 1-5 sur skills et responsibilities, `min_years_source`, `required_years`(+source), `required_degrees`/`required_study_fields` (`{label,source}`), `certifications[]`, `origin` langues, input restauré (weight/requiredExpYear/degreeLabels/studyFieldLabels) + null-coercion camelCase ; prompt + example v2 enrichis ; candidat schema v2→v3 (`SCHEMA_VERSION="3"`) — `NormalizedLanguage/Diploma/Certification` avec `origin`+`evidence`, preuve `source:"bio"` (index null), minage des credentials/langues nommés dans les textes (expériences/projets/links interdits) ; backend : `buildForOffer` + degrees/studyFields, constantes `SCHEMA_VERSION` 2/3 ; frontend : types miroirs enrichis, vues admin avec poids/provenance/exigences/certifications (badges Declared/Inferred) ; suites vertes : **331 backend / 125 ai-service / 469 frontend + lint + build** ; SPEC : D35/D36 (§14.7), §4.3 v3, §6.2, §16 | D35, D36 ; TD-033 résolue (b5645ee), TD-036 reformulée |
| 2026-10-14 | Optimisations offres T-01→T-11 : `listMine` paginée `@Transactional(readOnly=true)` + enveloppe `{items,page,size,total}` (défaut 20, clamp 50) côté backend **et** admin ; `<InfiniteList>` réutilisable (IntersectionObserver maison + fallback a11y) branché sur les listes admin et recruteur ; bulk delete `@Modifying` sur les 4 repos offre ; `countByIdIn` dans `validateVocabularies` (1 COUNT/groupe) ; badges statut offre et lignes normalisées dédupliqués (sources uniques) ; champs morts retirés du payload offre ai-service (`weight`, `requiredExpYear`, `degreeLabels`, `studyFieldLabels` — `has_content` + docstring ajustés, schema v1 inchangé) ; timeout/retries LLM explicites (`LLM_TIMEOUT_SECONDS` 120 s, `LLM_MAX_RETRIES` 2) | D34 ; TD-020→TD-023, TD-027→TD-029, TD-035 (code livré — statut réel dans TECH_DEBT.md ; TD-033 de ce chantier était en fait une dette créée ici, résolue en D35/b5645ee) |
| 2026-10-13 | Console admin D33 : chrome `(admin)` + `AdminSidebar`, fiche détail compte, liste globale offres (filtre + pagination), détail offre format public, fiches normalisées friendly | SPEC §14.5 (D33) |
