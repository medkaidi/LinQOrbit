-- Signalement interne d'une évaluation IA par critère (T-86, D66).
--
-- Une ligne par signalement : motif (1–5), commentaire facultatif, auteur et
-- rattachement au `matching_result_id` exact. Un signalement est un retour
-- qualité interne : il ne modifie JAMAIS le résultat, ne déclenche aucune
-- réévaluation et n'est jamais visible du candidat.
--
-- Immuable par construction : pas de `updated_at`, pas d'édition. L'unicité
-- (résultat, critère, auteur) rend un second signalement du même auteur sur le
-- même critère impossible — un doublon est refusé par la base, pas seulement
-- par le service.
--
-- La clé du critère est celle du résultat épinglé (`<type>:<slug>`, cf.
-- MatchingCriteriaBuilder) : elle n'est unique que dans un résultat donné, la
-- table ne duplique donc pas le référentiel des critères.
CREATE TABLE matching_criterion_report (
    id                 UUID         NOT NULL,
    matching_id        UUID         NOT NULL,
    matching_result_id UUID         NOT NULL,
    criterion_key      VARCHAR(200) NOT NULL,
    author_user_id     UUID         NOT NULL,
    reason             SMALLINT     NOT NULL,
    comment            VARCHAR(2000),
    created_at         TIMESTAMP    NOT NULL,
    CONSTRAINT pk_matching_criterion_report PRIMARY KEY (id),
    CONSTRAINT uq_criterion_report_item        UNIQUE (matching_result_id, criterion_key, author_user_id),
    CONSTRAINT ck_criterion_report_reason      CHECK (reason BETWEEN 1 AND 5),
    -- « Other » (5) ne dit rien par lui-même : un commentaire est obligatoire.
    CONSTRAINT ck_criterion_report_comment     CHECK (reason <> 5 OR (comment IS NOT NULL AND btrim(comment) <> '')),
    CONSTRAINT ck_criterion_report_key         CHECK (length(btrim(criterion_key)) > 0),
    CONSTRAINT fk_criterion_report_result      FOREIGN KEY (matching_id, matching_result_id)
                                                     REFERENCES matching_result (matching_id, id),
    CONSTRAINT fk_criterion_report_author      FOREIGN KEY (author_user_id) REFERENCES users (id)
);

-- Lecture du détail recruteur : les signalements d'un résultat.
CREATE INDEX ix_criterion_report_result ON matching_criterion_report (matching_result_id, criterion_key);

-- Lecture de l'auteur (son propre signalement) et lecture admin (par date).
CREATE INDEX ix_criterion_report_author ON matching_criterion_report (author_user_id, created_at DESC);
CREATE INDEX ix_criterion_report_created ON matching_criterion_report (created_at DESC, id DESC);
