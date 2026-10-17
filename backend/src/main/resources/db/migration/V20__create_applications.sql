-- Candidatures (D48–D49) : une candidature par couple (candidat, offre),
-- réponses normalisées (jamais de JSONB en stockage) et chaîne de FK
-- composites inviolable en base — une option soumise appartient par
-- construction à sa question, elle-même à l'offre de la candidature.
--
-- application : statuts SMALLINT via converter : 1 SUBMITTED, 2 WITHDRAWN
-- (retrait candidat, terminal au MVP — l'UNIQUE interdit la repostulation),
-- 3 ACCEPTED, 4 REJECTED (décisions recruteur). Pas d'applied_at — created_at
-- suffit (aucun brouillon). La cible des FK composites filles est
-- (job_offer_id, id) ; ix_application_job_offer_created sert la liste
-- recruteur (T-66).
--
-- cv_attachment_id est ÉPINGLÉ par FK composite (candidate_id,
-- cv_attachment_id) → attachment(candidate_id, id) NO ACTION : un CV d'un
-- autre candidat est impossible, et le CV soumis ne peut pas être supprimé
-- tant qu'une candidature le référence (D46/D56).
--
-- matching_id : colonne posée SEULE en V20. La FK composite (candidate_id,
-- job_offer_id, matching_id) → matching(candidate_id, job_offer_id, id)
-- (D49, NO ACTION, MATCH SIMPLE) est posée par ALTER TABLE en V21, quand la
-- table matching naît — écart d'ordre acté (SPEC §16) : migrations additives
-- uniquement, l'ordre des lots T-60 → T-61 est préservé. La colonne reste
-- NULL tant que le matching n'existe pas (T-60) ; « rempli serveur
-- uniquement » = le dernier matching du couple pour la fiche courante (T-61+).
CREATE TABLE application (
    id               UUID      NOT NULL,
    candidate_id     UUID      NOT NULL,
    job_offer_id     UUID      NOT NULL,
    cv_attachment_id UUID      NOT NULL,
    matching_id      UUID,
    status           SMALLINT  NOT NULL,
    created_at       TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP NOT NULL,
    CONSTRAINT pk_application                     PRIMARY KEY (id),
    CONSTRAINT uq_application_candidate_job_offer UNIQUE (candidate_id, job_offer_id),
    CONSTRAINT uq_application_job_offer_id        UNIQUE (job_offer_id, id),
    CONSTRAINT fk_application_candidate           FOREIGN KEY (candidate_id) REFERENCES candidates (id),
    CONSTRAINT fk_application_job_offer           FOREIGN KEY (job_offer_id) REFERENCES job_offer (id),
    CONSTRAINT fk_application_cv                  FOREIGN KEY (candidate_id, cv_attachment_id)
                                                      REFERENCES attachment (candidate_id, id),
    CONSTRAINT ck_application_status              CHECK (status BETWEEN 1 AND 4)
);

CREATE INDEX ix_application_job_offer_created ON application (job_offer_id, created_at);

-- application_answer : réponses IMMUABLES (pas d'updated_at — snapshot de
-- soumission). Les trois scalaires portent au plus une valeur (la base ne lit
-- pas question_type : la cardinalité QCS = 1 / QCM ≥ 1 est contrôlée en
-- service, D48). uq_application_answer_id_question_id est la cible de la FK
-- composite des sélections ; fk_aa_application (job_offer_id, application_id)
-- CASCADE — la suppression d'une candidature emporte ses réponses ;
-- fk_aa_question NO ACTION — une question référencée par une réponse ne peut
-- pas disparaître (les questions sont de toute façon figées dès PUBLISHED).
CREATE TABLE application_answer (
    id             UUID         NOT NULL,
    application_id UUID         NOT NULL,
    job_offer_id   UUID         NOT NULL,
    question_id    UUID         NOT NULL,
    answer_text    TEXT,
    answer_number  NUMERIC(12, 2),
    answer_boolean BOOLEAN,
    created_at     TIMESTAMP    NOT NULL,
    CONSTRAINT pk_application_answer            PRIMARY KEY (id),
    CONSTRAINT uq_application_answer_question   UNIQUE (application_id, question_id),
    CONSTRAINT uq_application_answer_id_question UNIQUE (id, question_id),
    CONSTRAINT ck_application_answer_single_value
        CHECK (num_nonnulls(answer_text, answer_number, answer_boolean) <= 1),
    CONSTRAINT fk_aa_application FOREIGN KEY (job_offer_id, application_id)
        REFERENCES application (job_offer_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_aa_question FOREIGN KEY (job_offer_id, question_id)
        REFERENCES job_offer_question (job_offer_id, id)
);

-- application_answer_option : sélections des questions à choix (QCS = une
-- ligne, QCM ≥ 1). Chaque FK composite verrouille un maillon de la chaîne :
-- (application_answer_id, question_id) → answer(id, question_id) CASCADE et
-- (question_id, option_id) → option(question_id, id) NO ACTION.
CREATE TABLE application_answer_option (
    application_answer_id UUID NOT NULL,
    question_id           UUID NOT NULL,
    option_id             UUID NOT NULL,
    CONSTRAINT pk_application_answer_option PRIMARY KEY (application_answer_id, option_id),
    CONSTRAINT fk_aao_answer FOREIGN KEY (application_answer_id, question_id)
        REFERENCES application_answer (id, question_id) ON DELETE CASCADE,
    CONSTRAINT fk_aao_option FOREIGN KEY (question_id, option_id)
        REFERENCES job_offer_question_option (question_id, id)
);
