# LinQOrbit — Frontend

Application Next.js 16 (App Router) + TypeScript strict + Tailwind CSS v4 de la
plateforme de recrutement LinQOrbit : espace candidat, recruteur, console admin,
offres publiques, candidatures et matching.

## Démarrage

```bash
npm install
npm run dev
```

L'API attendue est le backend Spring Boot (`backend/`), par défaut sur
`http://localhost:9080` — surchargeable via `NEXT_PUBLIC_API_URL` (`.env.local`).
Le service IA est appelé par le backend, jamais directement par le frontend.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement (Turbopack) |
| `npm run build` | build de production |
| `npm run lint` | ESLint |
| `npm run test` | tests Vitest (watch) |
| `npm run test:run` | tests Vitest (CI, non interactif) |

## Conventions

Tout est cadré dans `AGENTS.md` (architecture feature-oriented, placement des
fichiers, formulaires, design system maison, tests miroirs dans `tests/`).
