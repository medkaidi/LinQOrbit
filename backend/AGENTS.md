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
│   ├── dto/           5 DTOs de l'API auth
│   └── exception/     4 exceptions métier
├── user/              domaine utilisateur (implémenté)
├── candidate/         profil candidat (implémenté) : CandidateApi, CandidateController,
│   ├── dto/           18 DTOs de l'API profil (About/Experience/Diploma/Skill/Language/Link …)
│   ├── entity/        entités du profil (ProfessionalExperience, Diploma, CandidateSkill …)
│   ├── repository/    repositories (Diploma, Skill, Language, StudyField …)
│   ├── mapper/        CandidateMapper (MapStruct)
│   └── exception/     InvalidProfileSectionException, ReferenceNotFoundException
├── application/ attachment/ company/ joboffer/ matching/ recruiter/
│                      domaines roadmap — pré-créés (exception), vides jusqu'à leur 1re classe
```

- Chaque domaine est **autonome** : ses classes **à plat dans son package** (`Candidate.java`, `CandidateController.java`, `CandidateService.java`, `CandidateRepository.java`). Interdits : packages globaux `controllers/`, `services/`, `repositories/`, `entities/`, `dtos/`.
- **Regroupement seulement quand la croissance le justifie** — « structure simple d'abord, groupement quand c'est motivé » :
  - plusieurs classes d'une même responsabilité → sous-package correspondant (`dto/`, `exception/`, `mapper/`… ) ;
  - un fichier unique → reste à plat (un seul DTO dans `candidate/` → `candidate/CandidateResponse.java`, pas de `dto/` ; même règle pour exception/mapper/validator) ;
  - ne **jamais** créer ces packages par anticipation.
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

- **Flyway est le seul responsable du schéma** : `src/main/resources/db/migration/` avec `V1__…sql` … `V4__…sql` (`V3` profil candidat, `V4` listes de référence).
- Une migration exécutée est **immuable** ; toute modification du schéma = nouvelle migration.
- `spring.jpa.hibernate.ddl-auto: validate` — Hibernate ne crée ni ne modifie jamais le schéma, et **compare les types JDBC, pas le SQL** : `INTEGER` ≠ `SMALLINT` (int2), `VARCHAR` ≠ `TEXT`. Chaque colonne doit être déclarée avec le type exact du type Java (`Integer` → `INTEGER`, `String` → `VARCHAR(n)`, `Long` → `BIGINT`) sous peine d'échouer au démarrage du contexte.
- SQL PostgreSQL strict, pas de dépendance à des dialectes spécifiques dans les migrations.

## Sécurité

- `config/SecurityConfig` : stateless, CSRF off, `permitAll` (infrastructure seule).
- Pas de `USER.type`, pas de tables ROLE/USER_ROLE/PERMISSION en V0 : `CANDIDATE` et `RECRUITER` sont des entités métier distinctes du compte `USER` (un utilisateur peut être les deux).

## Communication

- **Frontend Next.js** appelle l'API REST : préfixe `/api/v1/{auth,candidates,recruiters,companies,job-offers,applications,matchings}` — `auth` et `candidates` existent (`/api/v1/candidates/me/profile` + `/{about,experiences,diplomas,skills,languages,links}` et `/reference/{skills,languages,degrees,study-fields}`), les autres sont à venir.
- **Service IA Python (FastAPI)** : appelé par ce backend en HTTP (`/ai/...`), jamais par le frontend. Client HTTP à créer quand les endpoints IA existeront — pas de fake AI, pas de client avant le besoin.

## Erreurs

`common/exception/GlobalExceptionHandler` (`@RestControllerAdvice`) : format ProblemDetail (RFC 7807). Étendre progressivement, sans système d'exceptions surdimensionné.

Deux pièges déjà rencontrés :
- un corps `List<…>` validé par méthode (`@Valid @RequestBody List<…>`) est traité par Spring 7 via `HandlerMethodValidationException`, pas par `MethodArgumentNotValidException` → handler dédié sinon 500 ;
- la validation d'un champ `String` vide (`""`) par Bean Validation n'atteint pas toujours le même handler : vérifier le flux complet d'un 400.

## Logging (SLF4J)

- **Point d'entrée standard : `@Slf4j`** (Lombok) — le champ `log` remplace toute déclaration manuelle (`log.info` / `log.warn` / `log.error`, pas de niveau `alert` en SLF4J) ; SLF4J/Logback reste le moteur (fourni par Spring Boot) — jamais de `System.out`, aucune librairie concurrente.
- **Corrélation requête** : `common/logging/RequestLoggingFilter` crée un `X-Request-Id` (MDC `correlationId`, affiché par le pattern console) et logue chaque requête — méthode + URI à l'entrée, statut + durée à la sortie (WARN si ≥ 400, ERROR si ≥ 500).
- **Étapes métier** : chaque service logue ses étapes clés — INFO pour la réception et le succès (identifiants, statut), WARN pour chaque refus (motif + email/id concerné).
- **Interdit dans les logs** : mots de passe, hash, jetons JWT, corps de requête. Les données utiles (email, userId, statut) sont loggées champ par champ, jamais le payload brut.
- Configuration : `application.yml` (`logging.pattern.console`, `logging.level`). Pas de tests de plumbing sur le logging.

## Tests

- Infrastructure standard Spring Boot uniquement : JUnit Jupiter, Mockito, AssertJ, `spring-test`, `spring-security-test` (déjà dans le `pom.xml` via les starters `*-test`). Aucun framework concurrent, pas de Testcontainers tant que le besoin réel n'apparaît pas.
- **Unit tests** (priorité) : la logique métier des Services, avec Mockito pour Repository / API externes / dépendances. Rapides et isolés — aucun PostgreSQL requis.
- **Tests d'intégration** : `@WebMvcTest` / `@DataJpaTest` / `@SpringBootTest` au cas par cas quand les fonctionnalités existent (nécessitent PostgreSQL, voir `.env.example`).
- `@SpringBootTest` contexte = requis PostgreSQL actif (`docker start linqorbit-pg`).
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
