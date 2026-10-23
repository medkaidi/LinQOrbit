-- Revue interne multi-admin d'un signalement d'évaluation IA (T-96, D77/D78).
--
-- Un avis final par admin et par signalement. Table append-only : pas
-- d'`updated_at`, aucun update/delete applicatif. L'avis ne modifie jamais le
-- signalement, le résultat épinglé, le score ou la décision, et ne notifie
-- personne.
--
-- verdict : 1 = UPHELD (signalement valide, score IA à corriger),
--           2 = NOT_UPHELD (score IA maintenu).
-- Les corrections ne sont acceptées que pour un avis UPHELD et restent
-- facultatives séparément : la review est training-ready seulement quand les
-- deux champs sont renseignés. Aucune moyenne n'est calculée ici.
CREATE TABLE matching_criterion_report_review (
    id                  UUID         NOT NULL,
    report_id           UUID         NOT NULL,
    reviewer_user_id    UUID         NOT NULL,
    verdict             SMALLINT     NOT NULL,
    note                VARCHAR(2000),
    corrected_score     INTEGER,
    corrected_rationale VARCHAR(2000),
    created_at          TIMESTAMP    NOT NULL,
    CONSTRAINT pk_matching_criterion_report_review PRIMARY KEY (id),
    CONSTRAINT uq_criterion_report_review UNIQUE (report_id, reviewer_user_id),
    CONSTRAINT ck_criterion_report_review_verdict CHECK (verdict BETWEEN 1 AND 2),
    CONSTRAINT ck_criterion_report_review_score
        CHECK (corrected_score IS NULL OR corrected_score BETWEEN 0 AND 100),
    -- NOT_UPHELD = score IA maintenu : aucune correction ne peut y être attachée.
    CONSTRAINT ck_criterion_report_review_correction
        CHECK (verdict = 1 OR (corrected_score IS NULL AND corrected_rationale IS NULL)),
    CONSTRAINT fk_criterion_report_review_report
        FOREIGN KEY (report_id) REFERENCES matching_criterion_report (id) ON DELETE NO ACTION,
    CONSTRAINT fk_criterion_report_review_reviewer
        FOREIGN KEY (reviewer_user_id) REFERENCES users (id) ON DELETE NO ACTION
);

-- Lecture d'un avis par reviewer (dossier personnel, futur dataset).
CREATE INDEX ix_criterion_report_review_reviewer
    ON matching_criterion_report_review (reviewer_user_id, created_at DESC);
