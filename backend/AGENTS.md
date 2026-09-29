# LinQOrbit — Backend (Spring Boot)

Backend principal de la plateforme de recrutement LinQOrbit. Il possède **toute** la logique métier et orchestre le service IA Python (jamais l'inverse).

## Stack

- **Java 17** (LTS), **Spring Boot 4.1.1**, **Maven** (Wrapper : `./mvnw`)
- Spring Web (REST), Spring Security, Spring Data JPA / Hibernate, Bean Validation
- **PostgreSQL** + **Flyway** (migrations SQL), **MapStruct** (mapping Entity ↔ DTO)
- Port **9080** — configuration via `application.yml` + variables d'environnement (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, voir `.env.example`)

Interdits pour la V0 : Kafka, Redis, Lombok (non installé), architecture hexagonale, CQRS, event sourcing, microservices, generic repositories/services, interfaces sans implémentation multiple.

## Organisation : architecture par domaine

```text
com.linqorbit/
├── LinQOrbitApplication.java
├── config/            configuration technique (SecurityConfig, …)
├── common/            utilitaires transverses (exception/ avec GlobalExceptionHandler)
├── auth/  user/  candidate/  recruiter/  company/
├── joboffer/  application/  matching/  attachment/
└── …
```

- Chaque domaine regroupe son code quand il existe : `Candidate.java`, `CandidateController.java`, `CandidateService.java`, `CandidateRepository.java` — **à plat dans le package du domaine**.
- Subdiviser en sous-packages (`controller/`, `service/`…) uniquement quand la complexité le justifie.
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

## Base de données

- **Flyway est le seul responsable du schéma** : `src/main/resources/db/migration/` avec `V1__…sql`, `V2__…sql`.
- Une migration exécutée est **immuable** ; toute modification du schéma = nouvelle migration.
- `spring.jpa.hibernate.ddl-auto: validate` — Hibernate ne crée ni ne modifie jamais le schéma.
- SQL PostgreSQL strict, pas de dépendance à des dialectes spécifiques dans les migrations.
- Aucune entité du MCD n'existe encore : elles viendront progressivement, chacune avec sa migration.

## Sécurité

- `config/SecurityConfig` : stateless, CSRF off, `permitAll` (infrastructure seule).
- Pas de `USER.type`, pas de tables ROLE/USER_ROLE/PERMISSION en V0 : `CANDIDATE` et `RECRUITER` sont des entités métier distinctes du compte `USER` (un utilisateur peut être les deux).

## Communication

- **Frontend Next.js** appelle l'API REST : préfixe futur `/api/v1/{auth,candidates,recruiters,companies,job-offers,applications,matchings}`.
- **Service IA Python (FastAPI)** : appelé par ce backend en HTTP (`/ai/...`), jamais par le frontend. Client HTTP à créer quand les endpoints IA existeront — pas de fake AI, pas de client avant le besoin.

## Erreurs

`common/exception/GlobalExceptionHandler` (`@RestControllerAdvice`) : format ProblemDetail (RFC 7807). Étendre progressivement, sans système d'exceptions surdimensionné.

## Tests

- Infrastructure standard Spring Boot uniquement : JUnit Jupiter, Mockito, AssertJ, `spring-test`, `spring-security-test` (déjà dans le `pom.xml` via les starters `*-test`). Aucun framework concurrent, pas de Testcontainers tant que le besoin réel n'apparaît pas.
- **Unit tests** (priorité) : la logique métier des Services, avec Mockito pour Repository / API externes / dépendances. Rapides et isolés — aucun PostgreSQL requis.
- **Tests d'intégration** : `@WebMvcTest` / `@DataJpaTest` / `@SpringBootTest` au cas par cas quand les fonctionnalités existent (nécessitent PostgreSQL, voir `.env.example`).
- `@SpringBootTest` contexte = requis PostgreSQL actif (`docker start linqorbit-pg`).
- Sécurité : `spring-security-test` est prêt (MockMvc + `SecurityMockMvcRequestPostProcessors`) — l'utiliser dès que l'auth arrivera, sans créer de faux système d'auth pour un test.
- MapStruct : ne tester que les mappings avec logique/transformations réelles, jamais les getters/setters générés.
- Philosophie : couverture des comportements importants (règles métier, validations, transformations, erreurs, cas limites), pas 100 % à tout prix, pas de tests de plumbing.
- Une fonctionnalité n'est pas terminée parce qu'elle compile : elle doit venir avec ses tests.

## Conventions

- Configuration : `application.yml` uniquement, aucun secret hardcodé (variables d'env avec défauts locaux).
- Pas de profil Spring (`@Profile`, `application-dev.yml`) tant que le besoin ne se présente pas.
- Asynchrone local acceptable ; **Kafka interdit** pour la V0 (l'architecture doit rester compatible avec son ajout futur, sans abstraction fictive).
- Vérifier avant de conclure : `./mvnw clean`, `./mvnw test`, `./mvnw verify` (PostgreSQL requis : voir `.env.example`).
