-- Candidats suggérés et invitations (T-101, D85, SPEC §12.1).
--
-- screening_job : suivi durable du screening automatique d'une offre publiée,
--   miroir d'embedding_job (statut SMALLINT 1=PENDING, 2=RUNNING, 3=DONE,
--   4=FAILED, 5=SUPERSEDED ; claim par CAS, tentatives cumulées, échéance du
--   prochain essai). Un job par fiche d'offre : une fiche remplacée supersède
--   l'ancien job, la relance d'un job FAILED le remet en PENDING (tentatives
--   remises à zéro), jamais une seconde ligne. PENDING = en attente du vecteur
--   de la fiche courante de l'offre (ou de sa prochaine tentative).
--   candidate_count reste NULL tant que le job n'est pas DONE : « 0 candidat
--   trouvé » (DONE, 0) se distingue de « pas encore calculé » (NULL).
CREATE TABLE screening_job (
    job_id                     UUID         NOT NULL,
    job_offer_id               UUID         NOT NULL,
    offer_normalized_profile_id UUID        NOT NULL,
    status                     SMALLINT     NOT NULL,
    attempts                   INTEGER      NOT NULL DEFAULT 0,
    next_attempt_at            TIMESTAMP    NOT NULL,
    candidate_count            INTEGER,
    error                      VARCHAR(500),
    created_at                 TIMESTAMP    NOT NULL,
    started_at                 TIMESTAMP,
    completed_at               TIMESTAMP,
    CONSTRAINT pk_screening_job PRIMARY KEY (job_id),
    CONSTRAINT fk_screening_job_offer FOREIGN KEY (job_offer_id)
        REFERENCES job_offer (id) ON DELETE CASCADE,
    CONSTRAINT fk_screening_job_profile FOREIGN KEY (offer_normalized_profile_id)
        REFERENCES normalized_profile (normalized_profile_id),
    CONSTRAINT uq_screening_job_profile UNIQUE (offer_normalized_profile_id),
    CONSTRAINT ck_screening_job_status CHECK (status BETWEEN 1 AND 5),
    CONSTRAINT ck_screening_job_attempts CHECK (attempts >= 0),
    CONSTRAINT ck_screening_job_count CHECK (candidate_count IS NULL OR candidate_count >= 0)
);

-- Sélection des jobs à reprendre : status = PENDING AND next_attempt_at <= now.
CREATE INDEX ix_screening_job_claim ON screening_job (status, next_attempt_at);
-- Dernier job d'une offre (signal d'affichage, flux SSE).
CREATE INDEX ix_screening_job_offer ON screening_job (job_offer_id, created_at DESC);

-- offer_candidate : résultat figé du screening d'une offre (le Top N calculé à
--   la publication) et invitations. Table d'association séparée de
--   application : une invitation n'est pas une candidature (son UNIQUE
--   (candidat, offre) est celui de la candidature, et tout ce qui lit
--   application — liste recruteur, compteurs, brouillons — ignore les suggérés).
--   Statut stocké SMALLINT : 1=SUGGESTED, 2=INVITED ; « a candidaté » est
--   dérivé de application, jamais dupliqué ici.
--   La ligne porte candidate_id (ancre stable) et la fiche comparée
--   (candidate_normalized_profile_id, même idée que matching, D50). L'API
--   n'expose que l'id de la ligne, propre à l'offre : ni candidate_id ni l'id
--   de fiche (qui recouperaient une même personne anonyme d'une offre à l'autre).
--   invited_by_user_id / invited_at : NULL tant que SUGGESTED.
CREATE TABLE offer_candidate (
    id                             UUID             NOT NULL,
    job_offer_id                   UUID             NOT NULL,
    candidate_id                   UUID             NOT NULL,
    candidate_normalized_profile_id UUID            NOT NULL,
    screening_job_id               UUID             NOT NULL,
    rank                           INTEGER          NOT NULL,
    distance                       DOUBLE PRECISION NOT NULL,
    status                         SMALLINT         NOT NULL,
    invited_by_user_id             UUID,
    invited_at                     TIMESTAMP,
    created_at                     TIMESTAMP        NOT NULL,
    CONSTRAINT pk_offer_candidate PRIMARY KEY (id),
    CONSTRAINT fk_offer_candidate_offer FOREIGN KEY (job_offer_id)
        REFERENCES job_offer (id) ON DELETE CASCADE,
    CONSTRAINT fk_offer_candidate_candidate FOREIGN KEY (candidate_id)
        REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT fk_offer_candidate_profile FOREIGN KEY (candidate_normalized_profile_id)
        REFERENCES normalized_profile (normalized_profile_id),
    CONSTRAINT fk_offer_candidate_job FOREIGN KEY (screening_job_id)
        REFERENCES screening_job (job_id) ON DELETE CASCADE,
    CONSTRAINT fk_offer_candidate_inviter FOREIGN KEY (invited_by_user_id)
        REFERENCES recruiters (id),
    CONSTRAINT uq_offer_candidate UNIQUE (job_offer_id, candidate_id),
    CONSTRAINT ck_offer_candidate_status CHECK (status BETWEEN 1 AND 2),
    CONSTRAINT ck_offer_candidate_rank CHECK (rank >= 1),
    CONSTRAINT ck_offer_candidate_invited CHECK (
        (status = 1 AND invited_by_user_id IS NULL AND invited_at IS NULL)
        OR (status = 2 AND invited_by_user_id IS NOT NULL AND invited_at IS NOT NULL))
);

-- Liste des invitations d'un candidat, la plus récente d'abord.
CREATE INDEX ix_offer_candidate_candidate ON offer_candidate (candidate_id, created_at DESC);
-- Liste des suggérés d'une offre dans l'ordre du screening.
CREATE INDEX ix_offer_candidate_offer_rank ON offer_candidate (job_offer_id, rank);
