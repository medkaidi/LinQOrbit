# LinQOrbit — Backend (Spring Boot)

Backend principal de la plateforme de recrutement LinQOrbit. Il possède **toute** la logique métier et orchestre le service IA Python (jamais l'inverse).

## Stack

- **Java 17** (LTS), **Spring Boot 4.1.1**, **Maven** (Wrapper : `./mvnw`)
- Spring Web (REST), Spring Security, Spring Data JPA / Hibernate, Bean Validation
- **PostgreSQL** + **Flyway** (migrations SQL), **MapStruct** (mapping Entity ↔ DTO)
- **Lombok** — version gérée par le parent Boot ; annotation processing configuré dans le `pom.xml` (avant MapStruct)
- **springdoc-openapi 3.x** (Swagger UI : `/swagger-ui.html`, spec : `/v3/api-docs`)
- Port **9080** — configuration via `application.yml` + variables d'environnement (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, voir `.env.example`)

Interdits pour la V0 : Kafka, Redis, architecture hexagonale, CQRS, event sourcing, microservices, generic repositories/services, interfaces sans implémentation multiple — **à l'exception des contrats d'API** (`XxxApi`, voir « Contrat d'API »), qui sont implémentés par leur contrôleur unique.

## Organisation : architecture par domaine

```text
com.linqorbit/
├── LinQOrbitApplication.java
├── config/            configuration technique (SecurityConfig, OpenApiConfig, …)
├── common/            partagé entre domaines (exception/, logging/) — jamais une décharge
├── auth/              domaine auth : AuthApi, AuthController, AuthService, UserMapper
│   ├── dto/           6 DTOs de l'API auth
│   └── exception/     4 exceptions métier
├── user/              domaine utilisateur (implémenté) : User, UserStatus, UserSex (+ converters),
│                      UserRepository, Role, UserRole, UserRoleRepository (rôles de capacité)
├── admin/             administration (rôle ADMIN) : AdminApi, AdminController, AdminService,
│   ├── dto/           AdminUserResponse, UpdateUserStatusRequest, AdminSkillSuggestionResponse,
│   │                  ApproveSkillSuggestionRequest, LinkSkillSuggestionRequest
│   └── exception/     InvalidUserStatusException, SelfStatusChangeException, UserNotFoundException,
│                      SuggestionNotFoundException, InvalidSkillCategoryException, InvalidSkillTypeException
│                      + AdminBootstrap (garant du rôle ADMIN au démarrage)
│                      Revue des suggestions : approbation (crée au catalogue + insère au profil des
│                      auteurs), lien vers un skill existant, rejet — la décision frappe le groupe
│                      homonyme (`findAllByNameIgnoreCase`), insertion profil = niveau 1, aucun V9
├── candidate/         profil candidat (implémenté), classes groupées par nature :
│   ├── controller/    CandidateApi (contrat OpenAPI), CandidateController
│   ├── service/       CandidateService, NormalizationService, NormalizationWorker,
│   │                  CvParseService
│   ├── client/        appels HTTP du service IA : CvParseClient, ProfileNormalizeClient,
│   │                  ReferenceContextBuilder, AiClientErrors
│   ├── entity/        Candidate, entités du profil (ProfessionalExperience, Diploma,
│   │                  CandidateSkill …) + enums/converters (LinkType, SearchStatus,
│   │                  SkillType, NormalizationJobStatus) + NormalizedProfile(Candidate),
│   │                  NormalizationJob
│   ├── repository/    CandidateRepository, repositories (Diploma, Skill, Language,
│   │                  StudyField …) + NormalizedProfile(Candidate), NormalizationJob
│   │                  (claim CAS, supersede)
│   ├── dto/           21 DTOs de l'API profil (About/Experience/Diploma/Skill/Language/Link/
│   │                  TargetPosition, CandidateProfileResponse, NormalizeRequest …)
│   ├── mapper/        CandidateMapper (MapStruct)
│   └── exception/     InvalidProfileSectionException, ReferenceNotFoundException,
│                      EmptyProfileException, AiServiceException
├── application/ attachment/ company/ joboffer/ matching/ recruiter/
│                      domaines roadmap — pré-créés (exception), vides jusqu'à leur 1re classe
```

- Chaque domaine est **autonome** : interdits les packages globaux `controllers/`, `services/`, `repositories/`, `entities/`, `dtos/` partagés entre domaines — les sous-packages sont **internes à leur domaine**.
- **Regroupement par nature dans le domaine** (décision d'équipe, appliquée à `candidate/`) : chaque classe va dans le sous-package de sa nature — `controller/` (Api + contrôleur), `service/`, `client/` (appels HTTP du service IA), `entity/` (+ enums et converters), `repository/`, `dto/`, `mapper/`, `exception/` — et **les tests suivent le même miroir** (`src/test/…/candidate/{controller,service,client}/`). `user/` et `admin/` (déjà en place) restent en l'état. Ne **jamais** créer un sous-package par anticipation : il naît avec son premier fichier ; un seul fichier de cette nature n'empêche pas le sous-package dès qu'il appartient à un domaine structuré ainsi.
- **Exception roadmap (décision explicite de l'équipe)** : les 7 domaines à venir — `application/`, `attachment/`, `candidate/`, `company/`, `joboffer/`, `matching/`, `recruiter/` — sont **pré-créés volontairement** avec leur `.gitkeep` pour matérialiser le périmètre du projet. Seule exception : **toute autre** naît avec sa première classe, jamais en avance (pas de nouveaux dossiers vides ni de `.gitkeep`).
- `common/` : uniquement ce qui est **réellement partagé** (traitement d'erreurs HTTP, pagination, utilitaires transverses). Une classe utilisée par plusieurs domaines mais appartenant à l'un d'eux reste dans son domaine.
- Ne **jamais** créer de classes vides ou de packages pour respecter une architecture théorique.
- Ne jamais utiliser le default package.

## Couches

```text
HTTP → Controller (validation entrée, appelle le service, DTO de sortie)
     → Service (logique métier, transactions)
     → Repository (accès données, Spring Data JPA)
     → PostgreSQL
```

Règle fondamentale : **les Entity JPA ne sortent jamais en JSON**. Flux : `Request DTO → Controller → Service → Entity → Repository` et inversement `Entity → Service → Response DTO → Controller → JSON`. MapStruct pour les mappings dès qu'il y a plusieurs champs.

## Contrat d'API (springdoc / Swagger)

- Chaque domaine expose sa surface via une **interface de contrat** `XxxApi` posée dans son package (`auth/AuthApi.java`), implémentée par son contrôleur (`AuthController implements AuthApi`).
- L'interface porte **les endpoints** (`@PostMapping`, …) **et** le contrat OpenAPI (`@Tag`, `@Operation`, `@ApiResponses`) ; le contrôleur ne porte que `@RestController`, le préfixe de chemin de classe et le corps des méthodes.
- **springdoc-openapi** génère la doc depuis ces annotations : `/v3/api-docs` (spec JSON) et `/swagger-ui.html` (UI). Métadonnées globales (titre, version, scheme Bearer) : `config/OpenApiConfig`.
- Nouvel endpoint = passage obligatoire par l'interface `XxxApi` : le contrat et le code avancent ensemble.
- Couvert par `OpenApiDocsTest` (présence des paths dans `/v3/api-docs`).

## Base de données

- **Flyway est le seul responsable du schéma** : `src/main/resources/db/migration/` avec `V1__…sql` … `V9__…sql` (`V3` profil candidat, `V4` listes de référence, `V5` poste recherché, `V6` contexte CV, `V7` suggestions de compétences, `V8` rôles `user_roles`, `V9` profil normalisé + jobs de normalisation).
- Une migration exécutée est **immuable** ; toute modification du schéma = nouvelle migration.
- `spring.jpa.hibernate.ddl-auto: validate` — Hibernate ne crée ni ne modifie jamais le schéma, et **compare les types JDBC, pas le SQL** : `INTEGER` ≠ `SMALLINT` (int2), `VARCHAR` ≠ `TEXT`. Chaque colonne doit être déclarée avec le type exact du type Java (`Integer` → `INTEGER`, `String` → `VARCHAR(n)`, `Long` → `BIGINT`) sous peine d'échouer au démarrage du contexte.
- SQL PostgreSQL strict, pas de dépendance à des dialectes spécifiques dans les migrations.

## Sécurité

- `config/SecurityConfig` : stateless, CSRF off, `permitAll` (infrastructure seule), `/api/v1/admin/**` = `hasRole("ADMIN")`.
- **Modèle en deux couches (décision d'équipe)** : les rôles (`user_roles`, colonne `role` SMALLINT = capacité : `ADMIN(1)` via enum `Role`) disent ce qu'un compte **peut faire** ; l'identité reste dans `candidates`/`recruiters` (cumul natif, un utilisateur peut être les deux). **Jamais** dupliquer un membership en rôle, jamais de `USER.type`, pas de PERMISSIONS.
- JWT : claim **`roles`** = codes SMALLINT (`AuthService.roleCodes`) ; `config/JwtRoleAuthoritiesConverter` les transforme en autorités `ROLE_*` (code inconnu ignoré).
- `admin/AdminBootstrap` (`CommandLineRunner`) garantit au moins un compte ADMIN à chaque démarrage (idempotent, `app.admin.*` / env `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- Piège JPA : **pas d'`AttributeConverter` sur un champ `@Id`** (interdit) — `UserRole.role` porte donc le code `Short` brut, conversion vers `Role` aux bords (`UserRole.of` / `roleEnum`).

## Communication

- **Frontend Next.js** appelle l'API REST : préfixe `/api/v1/{auth,candidates,admin,recruiters,companies,job-offers,applications,matchings}` — `auth`, `candidates` et `admin` existent (`/api/v1/candidates/me/profile` + `/{about,about/target-position,experiences,projects,diplomas,skills,languages,links}` et `/reference/{skills,languages,degrees,study-fields}` ; `POST /api/v1/candidates/me/profile/validate` déclenche la normalisation — voir « Normalisation du profil » ; `/api/v1/admin/{users,users/{userId}/status,skill-suggestions,skill-suggestions/{id}/{approve,link,reject}}` sous rôle ADMIN), les autres sont à venir. `PUT …/about` n'écrit jamais `targetPosition` (poste recherché isolé sur `PUT …/about/target-position`, conservé mais non consommé par l'UI actuelle) ; `GET …/profile` renvoie bien `about.targetPosition` et le signal `hasUnvalidatedChanges`.
- **Service IA Python (FastAPI)** : appelé par ce backend en HTTP, jamais par le frontend. Deux clients dans `candidate/client/` : `CvParseClient` (`POST /cv/parse`, import de CV) et `ProfileNormalizeClient` (`POST /profile/normalize`, normalisation de profil — appelé par le worker) — pas de fake AI.

## Normalisation du profil

Profil candidat → objet canonique JSON, en **async durable** (11 décisions actées ; format et pipeline modifiables ensuite) :

- **Déclencheur = validation explicite** : `POST …/me/profile/validate` — les 8 écritures de section ne déclenchent rien. Même tx, sous lock pessimiste de la ligne candidat (`CandidateRepository.findByIdForUpdate`) : dirty-check → version = max+1 → jobs `PENDING` du candidat → `SUPERSEDED` → INSERT `normalized_profile` (content NULL) + association + job `PENDING`. No-op si rien n'a changé (sauf relance d'un job `FAILED`) ; 409 `EmptyProfileException` s'il n'y a pas de ligne candidat.
- **Dirty-flag** : `hasUnvalidatedChanges` sur `GET …/profile` = `candidates.updated_at` (heartbeat : les 6 sections filles appellent `touchUpdatedAt`) vs `max(normalized_profile.validated_at)` ; `false` tant qu'aucune validation. Pas de colonne `is_current` : dérivé à la volée.
- **Tables (V9)** : `normalized_profile` (PK dédiée, version, schema_version, content JSONB nullable, validated_at), `normalized_profile_candidate` (liaison candidat — table des offres plus tard), `normalization_job` (shared PK `job_id ≡ normalized_profile_id`, la PK porte la FK ; statuts `PENDING|RUNNING|DONE|FAILED|SUPERSEDED`, `attempts` = échecs cumulés, `next_attempt_at`, `started_at`, `completed_at`, `error` VARCHAR(500)). Version courante = dernière version avec `content IS NOT NULL`, dérivée. Pas de `UNIQUE(candidate_id, version)` ni trigger (décision : le lock pessimiste suffit).
- **Déclenchement push (décision d'équipe, aucun polling)** : `NormalizationService.validate` publie `ProfileValidatedEvent(jobId)` **après commit** ; `NormalizationWorker.onProfileValidated` (`@TransactionalEventListener` `AFTER_COMMIT`) le soumet au pool dédié `normalizationExecutor` (`NormalizationExecutorConfig`, taille `app.normalization.threads`, queue bornée 256, préfixe `normalization-`). Rejet de soumission (queue saturée) → re-soumission one-shot à `+app.normalization.retry-delay-seconds` ; dernier filet = recovery au boot. Le seul scan du système est `recoverOrphanJobs` sur `ApplicationReadyEvent`.
- **Worker** (`NormalizationWorker`) : claim CAS `PENDING→RUNNING` en tx courte via `TransactionTemplate` (jamais d'auto-invoque `@Transactional`), snapshot `CandidateService.getProfile` + contexte `ReferenceContextBuilder`, appel `ProfileNormalizeClient`, écriture `content` + `DONE` en une tx. Échec → `attempts+1` et replanification one-shot sur `normalizationTaskScheduler` (scheduler dédié, pool 1, préfixe `normalization-retry-`) tant que le total reste sous **3 exécutions** (initiale + 2 retries) ; au-delà → `FAILED` (terminal, relance uniquement par une nouvelle validation qui crée un nouveau job). MDC `correlationId` = id du job pendant l'exécution.
- **Recovery au boot** (`recoverOrphanJobs`, seule « filet » du système) : RUNNING > 10 min (worker mort) → replanifié ; PENDING dû → exécuté immédiatement ; PENDING dont le retry n'est pas échu → planifié à son échéance. `SUPERSEDED` structurellement inéxécutable (le claim exige `PENDING`).
- **Timeouts IA** (`app.ai.connect-timeout-ms` 5000 / `app.ai.read-timeout-ms` 120000) : le read timeout libère le thread de l'exécution mais **n'annule pas** le calcul côté FastAPI/LLM (réponse tardive perdue sur la socket fermée, corrélation `X-Request-Id` = jobId). Un RUNNING légitime ne dépasse donc jamais ~2 min, très loin du seuil de stale de 10 minutes.
- **Signal d'affichage** : `normalizationInProgress` sur `GET …/profile` = le job le plus récent du candidat est `PENDING` ou `RUNNING` ; le bandeau frontend affiche « Analyzing… » (4ᵉ état, GET-driven, survit à la navigation) tant que ce signal est vrai, avec priorité succès flash 4 s > analyzing > failed > dirty.
- **Format canonique v2** : JSON camelCase validé par le service IA (`app/schemas/normalize.py` : schemaVersion `2`, dates `YYYY-MM`, CEFR, niveaux 1–5, rien inventé, jamais d'UUID dans le contenu ; les `evidence` des skills référencent les sections par index 0-based). Contient notamment `seniority`, `location`, `certifications[]`, `projects[]`, `links[].linkType`, et les index capacités des skills (`category`, `levelSource`, `origin`, `yearsExperience`, `evidence`).

## Erreurs

`common/exception/GlobalExceptionHandler` (`@RestControllerAdvice`) : format ProblemDetail (RFC 7807). **Invariant : le frontend affiche `detail` tel quel (`getApiErrorMessage`) — donc `detail` ne contient jamais de message brut de framework ni de code interne.**

**Règle A — erreur métier** : classe dans `*/exception/` + lancement **explicite** par le code applicatif (`throw new XxxException(…)` ou `orElseThrow`) + handler dédié dans `GlobalExceptionHandler` dont nous construisons le `detail` (affiché tel quel). Étendre progressivement, sans système d'exceptions surdimensionné.

**Règle B — tout le reste** : framework sans handler, `IllegalArgumentException`, inattendu → catch-all `handleUnexpected` : `detail` **générique** (5xx = « An unexpected error occurred. It has been logged for our team. », 4xx = « The request could not be processed. ») + classe + message + stack en logs (`log.error`). **Jamais `ex.getMessage()` dans une réponse.**

Autorisations :
- exceptions framework avec handler uniquement si on **réécrit** un message sûr (validation « champ : message », `MaxUploadSizeExceededException` hardcodé) ;
- **jamais** de handler pour `NoResourceFoundException` (route morte → corps `/error` Boot sans message, `server.error.include-message` = défaut `never`) ;
- **401/403** : `config/ProblemSecurityHandler` (entry point + access denied, branchés dans `SecurityConfig`) écrit le corps ProblemDetail directement (pas de `sendError` → pas de dispatch `/error`), détail sûr constant ; déclaré en `@Bean` dans `SecurityConfig` (les slices `@WebMvcTest` ne scannent pas les `@Component`) avec l'`ObjectMapper` **Jackson 3** (`tools.jackson`) — le bean `com.fasterxml` n'existe pas sous Boot 4 ;
- exception assumée : `AiClientErrors.extractDetail` (partagé par `CvParseClient` et `ProfileNormalizeClient`) relit le `detail` des 4xx du service IA (nos propres messages) ; les 5xx IA sont déjà mappées en génériques.

Trois pièges déjà rencontrés :
- un corps `List<…>` validé par méthode (`@Valid @RequestBody List<…>`) est traité par Spring 7 via `HandlerMethodValidationException`, pas par `MethodArgumentNotValidException` → handler dédié sinon 500 ;
- la validation d'un champ `String` vide (`""`) par Bean Validation n'atteint pas toujours le même handler : vérifier le flux complet d'un 400 ;
- `assertThat(generic.getClaim(...))` sur une méthode à retour générique (`<T> T`) rend l'overload AssertJ ambigu : typer en `Object` dans une variable locale avant l'assertion.

## Logging (SLF4J)

- **Point d'entrée standard : `@Slf4j`** (Lombok) — le champ `log` remplace toute déclaration manuelle (`log.info` / `log.warn` / `log.error`, pas de niveau `alert` en SLF4J) ; SLF4J/Logback reste le moteur (fourni par Spring Boot) — jamais de `System.out`, aucune librairie concurrente.
- **Corrélation requête** : `common/logging/RequestLoggingFilter` crée un `X-Request-Id` (MDC `correlationId`, affiché par le pattern console) et logue chaque requête — méthode + URI à l'entrée, statut + durée à la sortie (WARN si ≥ 400, ERROR si ≥ 500).
- **Propagation sortante** : `common/logging/CorrelationIdInterceptor` renvoie ce `X-Request-Id` en en-tête sur chaque appel `RestClient` sortant (branché sur `aiRestClient` dans `config/AiClientConfig`) — les logs du service IA portent alors le même identifiant que la requête qui l'a déclenché. Sans MDC (hors requête) : aucun en-tête. Fonctionne car l'appel IA est **synchrone sur le thread de la requête** ; le thread planifié du worker (`NormalizationWorker`) pose lui-même le MDC `correlationId` = id du job avant l'appel et le retire en finally (`RequestLoggingFilter.CORRELATION_ID` est public pour ça). Le service IA lit et ré-émet déjà l'en-tête (`ai-service/AGENTS.md` § Corrélation) ; tout **nouveau client sortant** devra porter le même interceptor (comportement : `CorrelationIdInterceptorTest`, wiring : `AiClientConfigTest`).
- **Étapes métier** : chaque service logue ses étapes clés — INFO pour la réception et le succès (identifiants, statut), WARN pour chaque refus (motif + email/id concerné).
- **Interdit dans les logs** : mots de passe, hash, jetons JWT, corps de requête. Les données utiles (email, userId, statut) sont loggées champ par champ, jamais le payload brut.
- Configuration : `application.yml` (`logging.pattern.console`, `logging.level`). Pas de tests de plumbing sur le logging du filtre lui-même.

## Tests

- Infrastructure standard Spring Boot uniquement : JUnit Jupiter, Mockito, AssertJ, `spring-test`, `spring-security-test` (déjà dans le `pom.xml` via les starters `*-test`). Aucun framework concurrent, pas de Testcontainers tant que le besoin réel n'apparaît pas.
- **Unit tests** (priorité) : la logique métier des Services, avec Mockito pour Repository / API externes / dépendances. Rapides et isolés — aucun PostgreSQL requis.
- **Tests d'intégration** : `@WebMvcTest` / `@DataJpaTest` / `@SpringBootTest` au cas par cas quand les fonctionnalités existent (nécessitent PostgreSQL, voir `.env.example`).
- `@SpringBootTest` contexte = requis PostgreSQL actif (`docker start linqorbit-pg`).
- Si le contexte échoue avec `No qualifying bean of type 'long'` (ou un `@Value` ignoré côté `AuthService`) : compilation incrémentale ayant sauté l'annotation processing Lombok → `./mvnw clean test`.
- Sécurité : `spring-security-test` est prêt (MockMvc + `SecurityMockMvcRequestPostProcessors`) — l'utiliser dès que l'auth arrivera, sans créer de faux système d'auth pour un test. Tout endpoint sous `.authenticated()` doit recevoir `jwt()` dans ses tests : sans jeton, le test échoue en 403 et non par la validation métier attendue.
- MapStruct : ne tester que les mappings avec logique/transformations réelles, jamais les getters/setters générés.
- Philosophie : couverture des comportements importants (règles métier, validations, transformations, erreurs, cas limites), pas 100 % à tout prix, pas de tests de plumbing.
- Une fonctionnalité n'est pas terminée parce qu'elle compile : elle doit venir avec ses tests.

## Conventions

- Configuration : `application.yml` uniquement, aucun secret hardcodé (variables d'env avec défauts locaux).
- **Lombok** :
  - `@RequiredArgsConstructor` pour l'injection par constructeur (champs `final`) — jamais de constructeur manuel quand Lombok peut le générer ;
  - `@Getter` / `@Setter` / `@NoArgsConstructor` sur les entités JPA, `@Getter` sur les enums — plus d'accesseur manuel ;
  - **DTOs = `record`** (constructeur + accesseurs natifs, pas de Lombok) ;
  - `@Value` / `@Qualifier` vont sur le **champ** (`lombok.config` les copie vers le constructeur généré) ;
  - `@Slf4j` donne le champ `log` (`log.info/warn/error`) — **jamais** de `LoggerFactory.getLogger(...)` manuel ;
  - **Construction d'entités = builder** : `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor(access = AccessLevel.PACKAGE)` sur l'entité (recette JPA obligatoire, **jamais `@Builder` seul** — cela casserait Hibernate qui a besoin du no-args), usage `User.builder().email(…)….build()` — **jamais** `new Entity()` + cascade de setters à la création ; les setters restent réservés aux **mises à jour** d'entités existantes ;
  - les annotations JPA restent sur les **champs** (source de vérité), jamais sur les méthodes générées.
- Pas de profil Spring (`@Profile`, `application-dev.yml`) tant que le besoin ne se présente pas.
- Asynchrone local acceptable ; **Kafka interdit** pour la V0 (l'architecture doit rester compatible avec son ajout futur, sans abstraction fictive).
- Vérifier avant de conclure : `./mvnw clean`, `./mvnw test`, `./mvnw verify` (PostgreSQL requis : voir `.env.example`).
