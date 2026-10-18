-- Moteur de matching (D50–D51, D58) et candidature en brouillon (D59).
--
-- matching : identité = le couple (candidat, offre) + la version de fiche
-- normalisée du candidat. Fiche inchangée → le matching est repris ; fiche
-- régénérée → aucune ligne pour la nouvelle identité → matching recréé de
-- zéro (l'ancien reste, tracé). uq_matching_candidate_offer_id est la cible
-- de la FK composite de application.matching_id. assessment_finished_at :
-- fin d'évaluation (clarifications T-62, contestation T-63).
CREATE TABLE matching (
    id                              UUID      NOT NULL,
    candidate_id                    UUID      NOT NULL,
    job_offer_id                    UUID      NOT NULL,
    candidate_normalized_profile_id UUID      NOT NULL,
    assessment_finished_at          TIMESTAMP,
    created_at                      TIMESTAMP NOT NULL,
    updated_at                      TIMESTAMP NOT NULL,
    CONSTRAINT pk_matching                      PRIMARY KEY (id),
    CONSTRAINT uq_matching_identity             UNIQUE (candidate_id, job_offer_id, candidate_normalized_profile_id),
    CONSTRAINT uq_matching_candidate_offer_id   UNIQUE (candidate_id, job_offer_id, id),
    CONSTRAINT fk_matching_candidate            FOREIGN KEY (candidate_id) REFERENCES candidates (id),
    CONSTRAINT fk_matching_job_offer            FOREIGN KEY (job_offer_id) REFERENCES job_offer (id),
    CONSTRAINT fk_matching_candidate_profile    FOREIGN KEY (candidate_normalized_profile_id)
                                                    REFERENCES normalized_profile (normalized_profile_id)
);

CREATE INDEX ix_matching_job_offer ON matching (job_offer_id);

-- matching_result : résultats versionnés (version = max + 1 sous verrou
-- pessimiste de la ligne matching ; created_at ne trie pas des inserts
-- même-seconde). result NULL = analyse en cours ou en échec ; schema_version
-- = contrat du JSON (D51). Chaque résultat enregistre la fiche offre utilisée.
-- clarification_id : colonne SEULE ici — la table clarification naît en V22,
-- qui posera la FK composite (même écart d'ordre que matching_id en V20).
CREATE TABLE matching_result (
    id                              UUID       NOT NULL,
    matching_id                     UUID       NOT NULL,
    version                         INTEGER    NOT NULL,
    schema_version                  VARCHAR(8) NOT NULL DEFAULT '1',
    result                          JSONB,
    job_offer_normalized_profile_id UUID       NOT NULL,
    clarification_id                UUID,
    created_at                      TIMESTAMP  NOT NULL,
    CONSTRAINT pk_matching_result               PRIMARY KEY (id),
    CONSTRAINT uq_matching_result_version       UNIQUE (matching_id, version),
    CONSTRAINT uq_matching_result_matching_id   UNIQUE (matching_id, id),
    CONSTRAINT uq_matching_result_clarification UNIQUE (clarification_id),
    CONSTRAINT ck_matching_result_version       CHECK (version >= 1),
    CONSTRAINT fk_matching_result_matching      FOREIGN KEY (matching_id) REFERENCES matching (id),
    CONSTRAINT fk_matching_result_offer_profile FOREIGN KEY (job_offer_normalized_profile_id)
                                                    REFERENCES normalized_profile (normalized_profile_id)
);

-- matching_job : analyse asynchrone, miroir exact de normalization_job
-- (shared PK job_id ≡ matching_result_id, la PK porte la FK). Statuts SMALLINT
-- via converter : 1 PENDING, 2 RUNNING, 3 DONE, 4 FAILED (pas de SUPERSEDED :
-- une relance n'est permise qu'après un échec, jamais pendant une analyse).
CREATE TABLE matching_job (
    job_id          UUID         NOT NULL,
    status          SMALLINT     NOT NULL,
    attempts        INTEGER      NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP    NOT NULL,
    error           VARCHAR(500),
    created_at      TIMESTAMP    NOT NULL,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    CONSTRAINT pk_matching_job        PRIMARY KEY (job_id),
    CONSTRAINT fk_matching_job_result FOREIGN KEY (job_id) REFERENCES matching_result (id),
    CONSTRAINT ck_matching_job_status CHECK (status BETWEEN 1 AND 4)
);

CREATE INDEX ix_matching_job_claim ON matching_job (status, next_attempt_at);

-- application (D59) : statuts renumérotés DRAFT(1), SUBMITTED(2),
-- WITHDRAWN(3), ACCEPTED(4), REJECTED(5). Les anciens codes 1–4 deviennent
-- exactement 2–5 : le décalage de +1 est donc sûr sur toute base (table vide
-- en développement au 2026-10-17). Le CHECK est remplacé avant/après le
-- décalage pour que les valeurs intermédiaires ne soient jamais refusées.
ALTER TABLE application DROP CONSTRAINT ck_application_status;
UPDATE application SET status = status + 1;
ALTER TABLE application ADD CONSTRAINT ck_application_status CHECK (status BETWEEN 1 AND 5);

-- CV : renseigné dès la création du brouillon quand le candidat en a un,
-- modifiable en DRAFT, figé à la transmission. Seul un brouillon peut ne pas
-- en avoir encore ; la FK composite (MATCH SIMPLE) ignore la valeur NULL.
ALTER TABLE application ALTER COLUMN cv_attachment_id DROP NOT NULL;
ALTER TABLE application ADD CONSTRAINT ck_application_cv_unless_draft
    CHECK (status = 1 OR cv_attachment_id IS NOT NULL);

-- matching_id (D49) : FK composite annoncée en V20 — le matching référencé
-- appartient par construction au même couple (candidat, offre). NO ACTION,
-- MATCH SIMPLE (NULL = candidature directe, sans évaluation).
ALTER TABLE application ADD CONSTRAINT fk_application_matching
    FOREIGN KEY (candidate_id, job_offer_id, matching_id) REFERENCES matching (candidate_id, job_offer_id, id);
