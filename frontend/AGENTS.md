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
- Une feature regroupe ses propres composants, hooks, API, validations, types quand elle en a besoin : `features/job-offer/…`. Ne pas les mettre dans `components/`, `hooks/`, `types/` génériques.
- Ne pas créer de dossiers/sous-dossiers vides « pour la forme ». Créer un sous-dossier seulement quand du code le justifie.
- Pas de couches `services/`, `managers/`, `providers/` ni d'abstractions (factories, repositories) sans besoin réel.
- `app/` ne contient pas la logique métier : les pages appellent les composants et hooks des features.

## Séparation des responsabilités (state)

```text
TanStack Query   état serveur : données API, cache, fetch, mutations, sync backend
Zustand          état client : UI, préférences, état global vraiment nécessaire
React Hook Form  état de formulaire
Zod              validation / schémas
```

Ne jamais mettre de données serveur dans Zustand « parce que Zustand est dispo ».

## API

- Instance Axios unique : `lib/api/axios.ts`, `baseURL = NEXT_PUBLIC_API_URL` (`.env.local`, défaut `http://localhost:8080`).
- Le backend est **Spring Boot** (REST). Un service IA Python/FastAPI est appelé par le backend, jamais directement par le frontend.
- Les modules API par domaine (`auth.api.ts`, `candidate.api.ts`, …) vivent dans `lib/api/` ou dans la feature concernée, et ne sont créés que lorsqu'ils sont utilisés. Aucune fonction API fictive.

## Tests

- **Vitest** + **React Testing Library** + `@testing-library/jest-dom` (environnement `jsdom`). Pas de Jest, pas de Playwright/Cypress pour l'instant.
- Commandes : `npm run test` (watch), `npm run test:run` (CI, non interactif).
- Config : `vitest.config.mts` + `vitest.setup.ts` (matchers jest-dom). Alias `@/` identique au tsconfig.
- **Localisation** : fichier de test à côté du code testé (`Feature.test.tsx` auprès de `Feature.tsx`, `util.test.ts` auprès de `util.ts`). Pas de dossier `tests/` géant.
- Ce qu'on teste : logique pure, schemas Zod, stores Zustand avec logique, hooks significatifs, comportements de composants (interaction, rendu conditionnel, formulaires, callbacks). On teste le **comportement**, pas l'existence d'un HTML.
- Interdits : tests bidons « ça existe », faux tests métier sur des fonctionnalités inexistantes, course au 100 % de couverture.
- Une fonctionnalité n'est pas terminée parce qu'elle compile : elle doit venir avec ses tests.

## Conventions

- Langue : **l'UI est en anglais** (`lang="en"` dans `app/layout.tsx`, textes et metadata en anglais). Les échanges de l'équipe sont en français, pas le code de l'application.
- Styles : classes Tailwind uniquement ; pas de fichiers CSS par composant, pas de styles inline sauf nécessité.
- Ne pas développer : auth, dashboards, pages métier, RBAC, tests e2e, Kafka — hors scope tant que ce n'est pas demandé.
- Vérifier avant de conclure : `npm run lint` puis `npm run build`.
