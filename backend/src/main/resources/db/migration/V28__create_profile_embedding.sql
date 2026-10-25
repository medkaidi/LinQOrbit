-- Embeddings des fiches normalisées pour le screening sémantique (T-64, D55,
-- SPEC §8.4). Retrieval amont uniquement : le moteur de matching n'en dépend
-- jamais (§8.4.9).
--
-- Extension pgvector (image locale linqorbit-postgres:17-pgvector, D57).
CREATE EXTENSION IF NOT EXISTS vector;

-- profile_embedding : un vecteur par (fiche, modèle, version de modèle,
--   stratégie de rendu texte). Table séparée de normalized_profile (D32) :
--   régénérer un embedding ne modifie ni ne perd jamais la fiche.
--   Les anciens vecteurs sont CONSERVÉS (changement de modèle ou de stratégie =
--   nouvelle ligne) : c'est une règle de service, volontairement sans trigger
--   append-only — le nettoyage des tests et des seeds doit rester possible.
--   Au screening, seule la jointure « dernière fiche avec contenu + modèle et
--   stratégie actifs » est interrogée : un vecteur périmé n'est jamais
--   sélectionnable par construction.
--   vector(1536) : dimension du modèle actif (gemini-embedding-2, troncature
--   MRL) ; aucun index vectoriel tant que le volume ne le justifie pas (scan
--   séquentiel, §8.4.6).
CREATE TABLE profile_embedding (
    id                    UUID         NOT NULL,
    normalized_profile_id UUID         NOT NULL,
    embedding             vector(1536) NOT NULL,
    model_name            VARCHAR(100) NOT NULL,
    model_version         VARCHAR(50)  NOT NULL,
    strategy_version      VARCHAR(50)  NOT NULL,
    created_at            TIMESTAMP    NOT NULL,
    CONSTRAINT pk_profile_embedding PRIMARY KEY (id),
    CONSTRAINT fk_profile_embedding_profile FOREIGN KEY (normalized_profile_id)
        REFERENCES normalized_profile (normalized_profile_id),
    CONSTRAINT uq_profile_embedding_version
        UNIQUE (normalized_profile_id, model_name, model_version, strategy_version)
);

-- Jointure du screening : vecteurs d'un modèle/stratégie, rattachés à leur fiche.
CREATE INDEX ix_profile_embedding_version
    ON profile_embedding (model_name, model_version, strategy_version);

-- embedding_job : suivi durable de la génération, miroir de normalization_job
--   (statut SMALLINT 1=PENDING, 2=RUNNING, 3=DONE, 4=FAILED, 5=SUPERSEDED ;
--   claim par CAS, tentatives cumulées, échéance du prochain essai). Table
--   propre : normalization_job est en PK partagée (un job par fiche) et son
--   DONE pilote le bandeau « Analyzing… » et le SSE de normalisation, alors
--   qu'un embedding est un couple (fiche × modèle × stratégie) qui change
--   avec la configuration.
--   Un seul job par couple : la relance d'un job FAILED le remet en PENDING
--   (tentatives remises à zéro), jamais une seconde ligne.
CREATE TABLE embedding_job (
    job_id                UUID         NOT NULL,
    normalized_profile_id UUID         NOT NULL,
    model_name            VARCHAR(100) NOT NULL,
    model_version         VARCHAR(50)  NOT NULL,
    strategy_version      VARCHAR(50)  NOT NULL,
    status                SMALLINT     NOT NULL,
    attempts              INTEGER      NOT NULL DEFAULT 0,
    next_attempt_at       TIMESTAMP    NOT NULL,
    error                 VARCHAR(500),
    created_at            TIMESTAMP    NOT NULL,
    started_at            TIMESTAMP,
    completed_at          TIMESTAMP,
    CONSTRAINT pk_embedding_job PRIMARY KEY (job_id),
    CONSTRAINT fk_embedding_job_profile FOREIGN KEY (normalized_profile_id)
        REFERENCES normalized_profile (normalized_profile_id),
    CONSTRAINT uq_embedding_job_version
        UNIQUE (normalized_profile_id, model_name, model_version, strategy_version),
    CONSTRAINT ck_embedding_job_status CHECK (status BETWEEN 1 AND 5),
    CONSTRAINT ck_embedding_job_attempts CHECK (attempts >= 0)
);

-- Sélection des jobs à reprendre : status = PENDING AND next_attempt_at <= now.
CREATE INDEX ix_embedding_job_claim ON embedding_job (status, next_attempt_at);
