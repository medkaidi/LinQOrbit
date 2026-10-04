<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LinQOrbit — Frontend

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4. Recrutement platform : candidats, recruteurs, entreprises, offres, candidatures, matching.

## Stack

- **Next.js 16** App Router, `app/` à la racine (pas de `src/`), Turbopack
- **TypeScript** strict, alias `@/*` → racine du projet
- **Tailwind CSS v4** (`@import "tailwindcss"` dans `app/globals.css`, config via `@theme`)
- **Zustand** — état client global uniquement
- **TanStack Query** — état serveur (fetching, cache, mutations)
- **Axios** — instance dans `lib/api/axios.ts`
- **React Hook Form + Zod** (`@hookform/resolvers`) — formulaires et validation

Interdits : Redux ou autre state manager global, shadcn/ui (décision pas encore prise), bibliothèque de composants UI, styling autre que Tailwind.

## Architecture feature-oriented

```text
app/          routing et layouts Next.js UNIQUEMENT — route groups (public), (auth), (dashboard)
components/   composants réellement partagés entre domaines (layout/, navigation/, ui/)
features/     logique par domaine : auth, candidate, recruiter, company, job-offer, application, matching
lib/          infrastructure : api/ (axios), validations/ (schémas Zod transverses), utils/
hooks/        hooks génériques uniquement
stores/       Zustand — état client global uniquement
types/        types réellement globaux uniquement
config/       configuration
```

Règles :
- Une feature regroupe ses propres composants, pages, données et logique métier quand elle en a besoin : `features/job-offer/…`. Les hooks vont dans `hooks/`, les schémas Zod dans `lib/validations/`, les modules API dans `lib/api/` (voir « Placement des fichiers »). Ne rien mettre dans `components/` qui n'est pas réellement partagé.
- Ne pas créer de dossiers/sous-dossiers vides « pour la forme ». Créer un sous-dossier seulement quand du code le justifie.
- Pas de couches `services/`, `managers/`, `providers/` ni d'abstractions (factories, repositories) sans besoin réel.
- `app/` ne contient pas la logique métier : les pages appellent les composants et hooks des features.

## Placement des fichiers (obligatoire)

Un fichier créé hors de son dossier d'architecture est une erreur, même s'il compile.
Avant de créer un fichier, vérifier ce tableau — **en cas de doute, demander plutôt que de créer au mauvais endroit** :

| Dossier | Contenu |
|---|---|
| `app/` | routing et layouts Next.js UNIQUEMENT (route groups, pages) |
| `components/` | composants réellement partagés entre domaines (`ui/`, `layout/`, `navigation/`, `brand/`) |
| `features/<domaine>/` | composants, pages, données et logique métier du domaine (formulaires, `countries.ts`, …) |
| `hooks/` | **tous** les hooks personnalisés (`use-auth.ts`, …) — jamais dans `features/` |
| `lib/api/` | instance axios + **tous** les modules API par domaine (`auth.api.ts`, `candidate.api.ts`, …) |
| `lib/validations/` | **tous** les schémas Zod (`*.schemas.ts`) |
| `lib/utils/`, `stores/`, `types/`, `config/` | utilitaires, Zustand, types globaux, configuration |
| `tests/` | **tous** les fichiers de test + `tests/helpers/` pour les cohortes partagées |

## Séparation des responsabilités (state)

```text
TanStack Query   état serveur : données API, cache, fetch, mutations, sync backend
Zustand          état client : UI, préférences, état global vraiment nécessaire
React Hook Form  état de formulaire
Zod              validation / schémas
```

Ne jamais mettre de données serveur dans Zustand « parce que Zustand est dispo ».

## Formulaires (React Hook Form + Zod)

- **Jamais de `z.preprocess` ni de `transform` dans un schéma branché à `zodResolver`** : dès que `z.input ≠ z.output`, `zodResolver(schema)` n'est plus assignable à `useForm<Values>()` (erreur TS). Les champs facultatifs sont donc **toujours du `string`** : `""` = vide, et la couche API (`lib/api/*.api.ts`) convertit `""` → `null` (et une saisie numérique en `string` → `number | null` avant l'envoi).
- Ce que la conversion API fait pour le profil candidat : dates/pays/bio/issuer `""` → `null`, `yearsExperience` `"7"` → `7`, `issuer`/`issuedAt` conservés seulement si `linkType === "certification"`.
- Réflexe : une règle métier qui dépend d'un **autre champ** (fin de carrière postérieure au début, doublon dans la liste) vit dans un `.superRefine` du schéma ; une règle qui **masque un champ** ne peut pas y vivre (l'erreur serait inatteignable) → on vide/masque dans la couche API.
- Listes d'objets = `useFieldArray` + un schéma `z.object({ items: z.array(rowSchema) })` ; selects = `Controller` via `features/candidate/select-field.tsx` (ou `components/ui/select`), `parse` quand la valeur formulaire n'est pas une `string`.

## API

- Instance Axios unique : `lib/api/axios.ts`, `baseURL = NEXT_PUBLIC_API_URL` (`.env.local`, défaut `http://localhost:9080`).
- Le backend est **Spring Boot** (REST). Un service IA Python/FastAPI est appelé par le backend, jamais directement par le frontend.
- Les modules API par domaine (`auth.api.ts`, `candidate.api.ts`, …) vivent **uniquement** dans `lib/api/`, et ne sont créés que lorsqu'ils sont utilisés. Aucune fonction API fictive.

## Zone authentifiée

- **Session** = Zustand persisté (`stores/auth-store.ts`, clé `linqorbit.auth`) : `{ token, user, setAuth, clearAuth }`. Jamais de `localStorage` brut ; l'ancienne clé `linqorbit.token` est abandonnée (reconnexion une fois nécessaire).
- **Axios** (`lib/api/axios.ts`) : interceptor request → `Authorization: Bearer` depuis le store ; interceptor response **401 → `clearAuth()`** (la garde se charge de la redirection, jamais de `router` dans axios).
- **Redirections** : login/signup → `/dashboard` (`hooks/use-auth.ts`) ; `logout()` → `clearAuth` + `/login` ; `features/auth/auth-gate.tsx` enveloppe le groupe `app/(dashboard)/` (sans token → `replace("/login")`, rendu null côté serveur via `useMounted`) ; `features/auth/redirect-if-authenticated.tsx` enveloppe `app/(auth)/` (token → `replace("/dashboard")`).
- **Shell** : `components/layout/dashboard-sidebar.tsx` (nav, items futurs en `type="button"` **sans `href`** — hover actifs avec `cursor-pointer`, aucun lien mort, l'état actif suit la route courante et ne se distingue que par ses couleurs (pas de badge) ; l'item Profile reste actif sur `/profile/edit` via `startsWith("/profile")`), `components/layout/dashboard-header.tsx` (CTA « New Job » et capsule « New campaign » — `components/ui/new-campaign-button.tsx`, wrapper de la primitive partagée `components/ui/nav-pill.tsx`, aussi utilisée pour « Edit profile » — activés en prévisualisation sans handler, contrôles sans backend réel — search, Sourcing IA, segments, notifications — restant en `disabled` + `aria-disabled`, jamais de faux boutons actifs), menu utilisateur `components/navigation/user-menu.tsx`.
- **Routes du compte** : `/profile` = affichage du profil **professionnel** (`features/candidate/profile-view.tsx`, lecture seule + squelette « Goals & criteria » sans données) — **un `section` carte par bloc, même découpage que l'édition** (titres `font-headline-md`, en-tête `p-6` + corps `px-6 pb-6`, compteur en texte muet à droite, éléments de liste dans des wrappers `rounded-2xl border border-slate-border bg-item-surface/50` (token `item-surface` = slate-50 #f8fafc dosé à 50% via `color-mix`, la valeur exacte de la maquette) ; en-tête des deux pages séparé du contenu par un **filet** `border-b border-slate-border` **écarté des bords** (en-tête `mx-6 pt-4 pb-4`, corps `px-6 pt-5 pb-6` : marge haute = marge basse du titre) les items Expérience/Éducation de **l'affichage seul** portent une **pastille numérotée** `ItemIndex` (`w-7 h-7` fond **blanc**, bordure grise `slate-border`, chiffre `blue-deep` `font-semibold`, sans `leading-none` — la baseline se centre toute seule avec `items-center`, alignée sur le bloc titre/sous-titre) et une **pastille de période** `PeriodBadge` (`rounded-full px-2.5 py-1` 11px semibold : blanc + `border-slate-border` + `text-text-secondary`, ou `bg-success-surface` + `border-success-border` + `text-success-text` quand `endDate` est nulle — token `success-border` #a7f3d0 ajouté à ce motif ; les **expériences** seules y ajoutent la durée en parenthèses via `withDuration` — « Sep 2020 — Mar 2023 (2 yrs 6 mos) », `durationLabel` arrondie au mois complet, fin = aujourd'hui si `endDate` est nulle) — l'édition garde son libellé « Experience 1 » et des dates en champs de formulaire), `/profile/edit` = édition des **6 sections** (`features/candidate/profile-edit.tsx`), `/account` = « My account » (identité, email, mot de passe, `features/auth/account.tsx`). Les titres de section n'ont **pas de sous-titre** : juste la pastille d'icône partagée (`SECTION_ICONS` + `SectionIcon` dans `features/candidate/profile-shared.tsx`, cercle `w-8 h-8` `bg-blue-surface` bordé `blue-border`, glyphe `blue-deep` **16px/300** via la règle scoped `.section-icon` de `globals.css` — la feuille Google impose 24px/400 et gagne à spécificité égale), consommée par l'affichage *et* les 6 sections d'édition. La complétion (`CompletenessCard`, commune aux deux pages) s'affiche en **jauge ronde** façon maquette : SVG 64px (piste `slate-surface`, arc `primary-container` en `dashoffset`, `linecap round`), `%` + label `Score` au centre, titre et sous-titre **à droite** de la roue ; `role="progressbar"` + `aria-valuenow` restent sur le conteneur. L'ancien contenu de `/profile` a été déplacé en `/account` ; le user-menu pointe `/account`, l'item « Profile » de la sidebar pointe `/profile`.
- **CTA** : le style de bouton standard de la plateforme est la variante `cta` de `components/ui/button.tsx` (pill orange + badge circulaire qui s'inverse au survol, style « New Job ») ; la pilule de navigation (badge circulaire + libellé + flèche, lien ou bouton) est `components/ui/nav-pill.tsx`. Aucun des deux ne cumule de classes conflictuelles avec le `className` appelant (`cn()` n'est pas un tailwind-merge).
- **Visuel** : les pages de la zone authentifiée s'inspirent de `template/general_dashboard.html` (shell complet), traduites en anglais et exprimées avec les tokens `globals.css` — pas de valeurs Tailwind brutes du template. **Couleurs** : l'orange reste la couleur primaire (CTA, nav active) ; le **bleu** (`blue-deep` + `blue-surface`/`blue-border`) est l'**accent secondaire** (icônes de section, stat cards) ; le **vert** est **sémantique** — `success-*` pour les badges/alerts et `emerald-deep` pour la bande stat « Velocity », jamais pour du décoratif.

## Tests

- **Vitest** + **React Testing Library** + `@testing-library/jest-dom` (environnement `jsdom`). Pas de Jest, pas de Playwright/Cypress pour l'instant.
- Commandes : `npm run test` (watch), `npm run test:run` (CI, non interactif).
- Config : `vitest.config.mts` + `vitest.setup.ts` (matchers jest-dom). Alias `@/` identique au tsconfig.
- **Localisation** : **tous** les tests vivent dans `tests/`, en **miroir de l'arborescence source** (`tests/features/auth/login-form.test.tsx` pour `features/auth/login-form.tsx`), avec `tests/helpers/` pour les cohortes partagées (`test-utils.tsx`). `tests/mocks/` et `tests/fixtures/` : créer uniquement au premier besoin, jamais de dossiers vides pour la forme.
- Ce qu'on teste : logique pure, schemas Zod, stores Zustand avec logique, hooks significatifs, comportements de composants (interaction, rendu conditionnel, formulaires, callbacks). On teste le **comportement**, pas l'existence d'un HTML.
- Interdits : tests bidons « ça existe », faux tests métier sur des fonctionnalités inexistantes, course au 100 % de couverture.
- Une fonctionnalité n'est pas terminée parce qu'elle compile : elle doit venir avec ses tests.

## Conventions

- Langue : **l'UI est en anglais** (`lang="en"` dans `app/layout.tsx`, textes et metadata en anglais). Les échanges de l'équipe sont en français, pas le code de l'application.
- Styles : classes Tailwind uniquement ; pas de fichiers CSS par composant, pas de styles inline sauf nécessité.
- **`cn()` est un simple `join` (pas de tailwind-merge)** : cumuler deux classes conflictuelles (`bg-*` + `bg-*`, `w-full` + `w-44`, `h-11` + `h-12`) donne un ordre de surcharge non déterministe. Résoudre par une **variante** (`Badge` avec `tone`, `Button` avec `variant`) ou un wrapper (`<div className="w-44">` autour d'un bouton `w-full`), jamais en empilant.
- Ne pas développer : RBAC, tests e2e, Kafka — hors scope tant que ce n'est pas demandé.
- Vérifier avant de conclure : `npm run lint` puis `npm run build`.
