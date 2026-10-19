-- Contestation candidat par critère (T-63, D54 révisée par D62).
--
-- Une ligne par item du dernier résultat (UNIQUE matching_result_id +
-- criterion_key) : le score propre du candidat (0–100, même échelle que les
-- scores) et un commentaire texte facultatif. Modifiable tant qu'aucune
-- candidature du couple n'est transmise (d'où updated_at), figée ensuite.
-- Aucun recalcul : cette table ne modifie jamais matching_result.
CREATE TABLE matching_criterion_feedback (
    id                 UUID          NOT NULL,
    matching_id        UUID          NOT NULL,
    matching_result_id UUID          NOT NULL,
    criterion_key      VARCHAR(200)  NOT NULL,
    self_value         INTEGER       NOT NULL,
    comment            VARCHAR(2000),
    created_at         TIMESTAMP     NOT NULL,
    updated_at         TIMESTAMP     NOT NULL,
    CONSTRAINT pk_matching_criterion_feedback PRIMARY KEY (id),
    CONSTRAINT ck_feedback_self_value         CHECK (self_value BETWEEN 0 AND 100),
    CONSTRAINT uq_feedback_item               UNIQUE (matching_result_id, criterion_key),
    CONSTRAINT fk_feedback_result             FOREIGN KEY (matching_id, matching_result_id)
                                                  REFERENCES matching_result (matching_id, id)
);

CREATE INDEX ix_feedback_matching ON matching_criterion_feedback (matching_id);
