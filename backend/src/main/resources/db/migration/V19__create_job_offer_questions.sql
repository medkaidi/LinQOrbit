-- Questions de présélection recruteur (D47) : la banque de questions propre à
-- une offre, servie à la candidature (T-60). Cinq types au MVP, stockés en
-- SMALLINT via converter : 1 TEXTE, 2 CHOIX_UNIQUE, 3 CHOIX_MULTIPLE,
-- 4 OUI_NON, 5 NOMBRE — les autres types du §10.1 sont documentés comme
-- mappés (expérience → NOMBRE, langue → CHOIX_UNIQUE) ou reportés (date,
-- localisation, autre), et le « critère associé » est reporté (D47).
--
-- cycle de vie : les questions appartiennent au contenu de l'offre — elles
-- sont remplacées intégralement à l'édition (miroir des listes), figées dès
-- PUBLISHED/CLOSED (même garde que le contenu, 409), copiées à la
-- duplication (nouvelles lignes, nouveaux ids) et emportées par la cascade
-- quand l'offre (DRAFT) est supprimée. Les questions ne sont PAS incluses
-- dans le snapshot de la fiche normalisée d'offre.
--
-- uq_joq_job_offer_id est la cible de la FK composite (job_offer_id, id) des
-- réponses de candidature (V20) ; uq_joqo_question_id celle de
-- (question_id, id) — la chaîne option ∈ question ∈ offre sera inviolable en
-- base (D48).
CREATE TABLE job_offer_question (
    id            UUID         NOT NULL,
    job_offer_id  UUID         NOT NULL,
    label         VARCHAR(500) NOT NULL,
    question_type SMALLINT     NOT NULL,
    is_required   BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order    INTEGER      NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL,
    updated_at    TIMESTAMP    NOT NULL,
    CONSTRAINT pk_job_offer_question      PRIMARY KEY (id),
    CONSTRAINT uq_joq_job_offer_id        UNIQUE (job_offer_id, id),
    CONSTRAINT fk_joq_job_offer           FOREIGN KEY (job_offer_id) REFERENCES job_offer (id) ON DELETE CASCADE,
    CONSTRAINT ck_joq_question_type       CHECK (question_type BETWEEN 1 AND 5),
    CONSTRAINT ck_joq_sort_order          CHECK (sort_order >= 0)
);

CREATE TABLE job_offer_question_option (
    id          UUID         NOT NULL,
    question_id UUID         NOT NULL,
    label       VARCHAR(500) NOT NULL,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    preferred   BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_job_offer_question_option PRIMARY KEY (id),
    CONSTRAINT uq_joqo_question_id          UNIQUE (question_id, id),
    CONSTRAINT fk_joqo_question             FOREIGN KEY (question_id) REFERENCES job_offer_question (id) ON DELETE CASCADE,
    CONSTRAINT ck_joqo_sort_order           CHECK (sort_order >= 0)
);
