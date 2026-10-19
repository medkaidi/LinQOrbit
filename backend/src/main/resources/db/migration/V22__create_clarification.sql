-- Clarifications IA du matching (T-62, D52–D53).
--
-- clarification : questions posées au candidat par l'agent « recruteur
-- chevronné », une à la fois. matching_result_id = le résultat qui a motivé
-- la question ; matching_result.clarification_id (V21) = la réponse qui a
-- déclenché la réévaluation — la FK composite est posée ici, la table
-- n'existant pas en V21. Statuts SMALLINT via converter : 1 OPEN,
-- 2 ANSWERED, 3 SKIPPED. Une seule OPEN par matching (index partiel) : le
-- verrou pessimiste de la ligne matching sérialise réponses et skips, l'index
-- est le filet de sécurité. rationale = pourquoi la question (affiché au
-- candidat) ; longueurs bornées au-dessus des limites du service IA
-- (question 400, rationale 600) et de la réponse candidat (3000).
CREATE TABLE clarification (
    id                 UUID          NOT NULL,
    matching_id        UUID          NOT NULL,
    matching_result_id UUID          NOT NULL,
    question           VARCHAR(500)  NOT NULL,
    answer             VARCHAR(3000),
    rationale          VARCHAR(700),
    status             SMALLINT      NOT NULL,
    answered_at        TIMESTAMP,
    created_at         TIMESTAMP     NOT NULL,
    CONSTRAINT pk_clarification             PRIMARY KEY (id),
    CONSTRAINT uq_clarification_matching_id UNIQUE (matching_id, id),
    CONSTRAINT ck_clarification_status      CHECK (status IN (1, 2, 3)),
    CONSTRAINT fk_clarification_result      FOREIGN KEY (matching_id, matching_result_id)
                                                REFERENCES matching_result (matching_id, id)
);

CREATE UNIQUE INDEX uq_clarification_one_open ON clarification (matching_id) WHERE status = 1;
CREATE INDEX ix_clarification_matching ON clarification (matching_id, created_at);

ALTER TABLE matching_result
    ADD CONSTRAINT fk_matching_result_clarification
    FOREIGN KEY (matching_id, clarification_id) REFERENCES clarification (matching_id, id);

-- Plafond de questions IA par matching (D52), réglé par le recruteur en
-- DRAFT/VALIDATED ; une question posée consomme un cran, skip compris.
ALTER TABLE job_offer ADD COLUMN max_clarification_questions INTEGER NOT NULL DEFAULT 3;
ALTER TABLE job_offer ADD CONSTRAINT ck_job_offer_max_clarification_questions
    CHECK (max_clarification_questions BETWEEN 0 AND 10);
