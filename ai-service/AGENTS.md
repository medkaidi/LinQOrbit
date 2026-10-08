# LinQOrbit — AI Service (Python / FastAPI)

Service indépendant spécialisé IA pour LinQOrbit. **Spring Boot reste le backend principal** : ce service ne possède aucune donnée métier.

## Rôle

Reçoit des données structurées de Spring Boot (HTTP/JSON) → analyse via LangGraph/agents/LLM → renvoie un résultat structuré. Existant : `POST /cv/parse` (import de CV), `POST /profile/normalize` (normalisation de profil, appelée par le worker Spring Boot). À terme : normalisation d'offre, `POST /ai/matching/analyze`, `POST /ai/matching/clarify`.

## Stack

- **Python ≥ 3.12**, **FastAPI**, **Pydantic** (contrats d'API, pas d'ORM), **langchain** (`create_agent`), **langchain-google-genai** (`ChatGoogleGenerativeAI` → modèle Gemini), **LangGraph**, **pypdf** (extraction texte PDF), **python-dotenv** (export du `.env` dans `os.environ` pour LangChain/LangSmith), **pytest** + httpx
- Gestion : **uv** — `pyproject.toml` + `uv.lock` (jamais de `requirements.txt`)
- Port **9082** — lancement : `uv run uvicorn app.main:app --reload --port 9082`
- Tests : `uv run pytest`

## Architecture

```text
app/
├── main.py          # app FastAPI + routers
├── api/routes/       # HTTP uniquement (health.py, cv.py, normalize.py ; plus tard matching.py)
├── schemas/          # contrats Pydantic API (cv.py, normalize.py ; plus tard job_offer, matching…) — JAMAIS d'ORM
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

## Asynchrone

Concevoir en `async/await` quand pertinent (FastAPI, clients LLM) ; pas de broker pour l'instant — l'asynchrone inter-services viendra via Spring Boot/Kafka plus tard.

## Tests

- `uv run pytest` — priorité aux tests unitaires : schemas Pydantic, transformations, logique agents, nodes LangGraph, parsing, routes.
- **Aucun appel LLM réel dans les tests** : mocker (le health-check actuel est le seul test de vérification d'environnement).
- Une fonctionnalité n'est pas terminée parce qu'elle compile : elle doit venir avec ses tests.

## Logging

Miroir de la politique du backend (Spring Boot, `backend/AGENTS.md` § Logging) :

- **Configuration unique** : `app/core/logging.py` — `configure_logging(settings.log_level)` appelé au démarrage de `app/main.py` (format console : date, level, `[correlationId]`, logger, message — même forme que le pattern `%d … %-5level [%X{correlationId:-}] %logger{40} - %msg%n` ; niveau via `LOG_LEVEL`, défaut `INFO`, idempotent : sous pytest il ne reconfigure rien).
- **Corrélation requête** : middleware dans `main.py` — lit l'en-tête `X-Request-Id` (sinon `uuid4`), le porte dans un contextvar (`correlationId`, défaut `-`), logue `HTTP <méthode> <chemin>` à l'entrée puis statut + durée à la sortie (**INFO < 400, WARNING ≥ 400, ERROR ≥ 500**, exactement comme le backend), ré-émet l'en-tête sur la réponse. Jamais de query string, de header ni de corps.
- **Étapes métier** : `routes/cv.py` et `routes/normalize.py` loguent la réception (compteurs/métadonnées seulement), chaque refus (WARNING : code/statut — **jamais le contenu**) et le succès (compteurs) ; `agents/cv_parse.py` et `agents/profile_normalize.py` signalent la passe de réparation (WARNING) puis sa réussite (INFO) ; `llm/client.py` logue l'init du modèle une fois (INFO, **jamais la clé**).
- **Interdit dans les logs** : texte de CV, prompts, corps de requête/réponse, en-têtes autres que `X-Request-Id`, clés API (`GOOGLE_API_KEY`).
- Pas de tests de plumbing sur le formatage ; `tests/test_logging.py` vérifie les **comportements** (seuils de niveau, écho de `X-Request-Id`, forme de la ligne).

## Configuration

`app/core/config.py` : `load_dotenv()` exporte le `.env` dans `os.environ` (LangChain/LangSmith lisent `os.environ`), puis pydantic-settings le reparse en `settings` typé — `GOOGLE_API_KEY`, `LLM_MODEL` (+ `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGCHAIN_PROJECT` consommés nativement par LangChain). Aucune config dure, aucune clé réelle dans le repo.

## Conventions

- Identifiants, docstrings, réponses API et messages : **anglais** (langue de l'application).
- Vérifier avant de conclure : `uv run pytest`, puis démarrage (`/health` et `/docs` en 200).
