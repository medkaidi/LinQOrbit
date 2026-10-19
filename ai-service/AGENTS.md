# LinQOrbit — AI Service (Python / FastAPI)

Service indépendant spécialisé IA pour LinQOrbit. **Spring Boot reste le backend principal** : ce service ne possède aucune donnée métier.

## Rôle

Reçoit des données structurées de Spring Boot (HTTP/JSON) → analyse via LangGraph/agents/LLM → renvoie un résultat structuré. Existant : `POST /cv/parse` (import de CV), `POST /profile/normalize` (normalisation de profil, appelée par le worker Spring Boot), `POST /job-offer/normalize` (normalisation d'offre, même worker unique côté Spring), `POST /matching/analyze` (T-61, D58 — score 0-100 par critère de la fiche offre, contexte complet à chaque appel ; fiches au schéma courant exigées (candidat v3, offre v2 → 422) ; une passe de réparation si la couverture des clés ou les index de preuve sont faux (preuve hors de la fiche candidat) **ou si la sortie est rejetée par le schéma** (`StructuredOutputError` : p. ex. score > 0 sans preuve, plusieurs sorties structurées — la réparation repart de la requête avec les erreurs exactes, sans rejouer le message invalide ; toujours rejetée → 502 `no_output`, jamais 500 ; toute autre exception reste un 500, TD-056), score 0 sans preuve, score > 0 avec au moins une preuve ; dès la réévaluation (T-62) le contexte porte `previousAssessments` et `clarifications` (ordre d'ajout), une preuve `clarification` doit viser une réponse `answered` existante ; appelé par le worker de matching) et `POST /matching/clarify` (T-62, D52–D53 — une question de l'agent « recruteur chevronné » + son rationale destiné au candidat, ou `{"question": null}` ; budget `remainingQuestions` 0 → aucun appel au modèle ; couverture exacte des évaluations exigée ; appelé par le worker de matching). Même convention de chemin, sans préfixe `/ai` (D51 fait foi).

## Stack

- **Python ≥ 3.12**, **FastAPI**, **Pydantic** (contrats d'API, pas d'ORM), **langchain** (`create_agent`), **langchain-google-genai** (`ChatGoogleGenerativeAI` → modèle Gemini), **LangGraph**, **pypdf** (extraction texte PDF), **python-dotenv** (export du `.env` dans `os.environ` pour LangChain/LangSmith), **pytest** + httpx
- Gestion : **uv** — `pyproject.toml` + `uv.lock` (jamais de `requirements.txt`)
- Port **9082** — lancement : `uv run uvicorn app.main:app --reload --port 9082`
- Tests : `uv run pytest` — sans `uv` (venv Windows) : `.venv/Scripts/python -m pytest -q`

## Architecture

```text
app/
├── main.py          # app FastAPI + routers
├── api/routes/       # HTTP uniquement (health.py, cv.py, normalize.py, job_offer.py, matching.py)
├── schemas/          # contrats Pydantic API (cv.py, normalize.py, job_offer.py, matching.py) — JAMAIS d'ORM
├── agents/           # logique des agents
├── graphs/           # orchestration LangGraph (workflow des agents)
├── llm/              # config et appels LLM centralisés (jamais dispersés dans les routes)
└── core/             # config.py : Settings, variables d'environnement
tests/                # pytest, colocated tests de config/schemas/health
```

Règles :
- **agents/** = logique des agents ; **graphs/** = orchestration. Ne pas mélanger.
- Sous-dossiers (`agents/matching/…`) uniquement quand le code le justifie.
- Routes : logique minimale, délègue aux agents/graphs. Aucun appel LLM direct dans une route.

## Interdits (V0)

Pas de PostgreSQL/SQLAlchemy/Alembic/ORM (Spring Boot est propriétaire des données), pas de Celery/Redis/Kafka/queues, pas de authentification métier, pas de dépendance concurrente à FastAPI. Aucune clé API réelle dans le repo (`.env` gitignoré, `.env.example` = noms seuls).

## Sans état (D58)

**Politique de comparaison du matching** : isolée dans `app/graphs/matching_policy.py` (`POLICY_VERSION` + `POLICY_RULES`) — politique **`skills-3`** (D61 : bandes déterministes niveau/années pour les compétences, minimum des deux, voisinage 40–50 jamais 0 quand la voisine est prouvée par l'usage, un niveau déclaré est une mesure connue même sans preuve d'usage, une clarification répondue prouve l'usage (60) jamais un niveau, règles génériques pour langues/expérience/formation) ; bumper la version à chaque changement (chaque résultat la stocke). Les textes de `matching_policy.py`, `matching_agent.py` (`PROMPT_RULES`, `PROMPT_EXAMPLE`) et `matching_clarify_agent.py` (`CLARIFY_PROMPT_RULES`, `CLARIFY_EXAMPLE`) sont **fixés à l'identique** par la décision produit — une modification passe par une nouvelle décision. La `rationale` d'évaluation est interne (recruteur, QA), jamais candidat ; la `rationale` d'une question de clarification est candidat-facing. Les règles de contrat (une évaluation par critère, absent = 0, expérience **pertinente** jamais `yearsOfExperience` tel quel, preuves, jamais de recommandation) vivent dans `matching_agent.py` et survivent au changement de politique. **Température** : `MATCHING_TEMPERATURE = 0.0` (`matching_agent.py`) pour le seul agent de matching, via `get_model(temperature=0.0)` ; les agents CV, normalisation et clarification appellent `get_model()` sans température (défaut du fournisseur) — le cache `lru_cache` de `get_model` est clé par température, les deux instances ne se mélangent jamais.

Le service ne garde **aucun contexte entre deux appels** : pas de checkpointer LangGraph, pas de `thread_id` persistant, aucun stockage. Pour un échange en plusieurs tours (matching, clarifications), le backend renvoie **tout** le contexte à chaque appel depuis sa base (fiches normalisées, critères, résultat précédent, questions/réponses). Le LLM n'a pas de mémoire : un historique serveur ne réduirait pas les tokens envoyés, il dupliquerait des données métier hors de la base et divergerait après un échec ou un retry du worker Spring. L'identifiant de conversation fourni par le backend (`matchingId`) est passé **uniquement en métadonnée LangSmith** (`thread_id`) pour regrouper les traces.

## Asynchrone

Concevoir en `async/await` quand pertinent (FastAPI, clients LLM) ; pas de broker pour l'instant — l'asynchrone inter-services viendra via Spring Boot/Kafka plus tard.

## Tests

- **Jeu d'essai du barème (hors CI, TD-058)** : `uv run python scripts/matching_golden_set.py` (sans `uv` : `PYTHONIOENCODING=utf-8 .venv/Scripts/python scripts/matching_golden_set.py`) — 9 cas de `scripts/golden/matching_skills_cases.json` rejoués contre le **vrai modèle** (`analyze_matching` → `build_matching_agent` + `get_model(temperature=0.0)`), rapport daté (modèle, température, version de politique) écrit dans `scripts/golden/results/` à **chaque** passage — un passage interrompu écrit `verdict: ERROR`, `stage`, `error {type, code, message}` et les cas déjà scorés ; nom à la microseconde, jamais écrasé ; non collecté par pytest (`testpaths = ["tests"]`). À rejouer à chaque changement de politique ou de prompt ; la fixture porte la `policyVersion` qu'elle vise.

- `uv run pytest` — priorité aux tests unitaires : schemas Pydantic, transformations, logique agents, nodes LangGraph, parsing, routes.
- **Aucun appel LLM réel dans les tests** : mocker (le health-check actuel est le seul test de vérification d'environnement).
- Une fonctionnalité n'est pas terminée parce qu'elle compile : elle doit venir avec ses tests.

## Logging

Miroir de la politique du backend (Spring Boot, `backend/AGENTS.md` § Logging) :

- **Configuration unique** : `app/core/logging.py` — `configure_logging(settings.log_level)` appelé au démarrage de `app/main.py` (format console : date, level, `[correlationId]`, logger, message — même forme que le pattern `%d … %-5level [%X{correlationId:-}] %logger{40} - %msg%n` ; niveau via `LOG_LEVEL`, défaut `INFO`, idempotent : sous pytest il ne reconfigure rien).
- **Corrélation requête** : middleware dans `main.py` — lit l'en-tête `X-Request-Id` (sinon `uuid4`), le porte dans un contextvar (`correlationId`, défaut `-`), logue `HTTP <méthode> <chemin>` à l'entrée puis statut + durée à la sortie (**INFO < 400, WARNING ≥ 400, ERROR ≥ 500**, exactement comme le backend), ré-émet l'en-tête sur la réponse. Jamais de query string, de header ni de corps.
- **Étapes métier** : `routes/cv.py`, `routes/normalize.py`, `routes/job_offer.py` et `routes/matching.py` loguent la réception (compteurs/métadonnées seulement), chaque refus (WARNING : code/statut — **jamais le contenu**) et le succès (compteurs) ; `agents/cv_parse.py`, `agents/profile_normalize.py`, `agents/job_offer_normalize.py`, `agents/matching_analyze.py` et `agents/matching_clarify.py` signalent la passe de réparation (WARNING) puis sa réussite (INFO) ; `llm/client.py` logue l'init du modèle une fois (INFO, **jamais la clé**).
- **Interdit dans les logs** : texte de CV, prompts, corps de requête/réponse, en-têtes autres que `X-Request-Id`, clés API (`GOOGLE_API_KEY`).
- Pas de tests de plumbing sur le formatage ; `tests/test_logging.py` vérifie les **comportements** (seuils de niveau, écho de `X-Request-Id`, forme de la ligne).

## Configuration

`app/core/config.py` : `load_dotenv()` exporte le `.env` dans `os.environ` (LangChain/LangSmith lisent `os.environ`), puis pydantic-settings le reparse en `settings` typé — `GOOGLE_API_KEY`, `LLM_MODEL` (+ `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGCHAIN_PROJECT` consommés nativement par LangChain). Aucune config dure, aucune clé réelle dans le repo.

## Conventions

- Identifiants, docstrings, réponses API et messages : **anglais** (langue de l'application).
- Vérifier avant de conclure : `uv run pytest`, puis démarrage (`/health` et `/docs` en 200).
