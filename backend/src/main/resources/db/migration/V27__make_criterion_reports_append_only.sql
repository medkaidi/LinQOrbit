-- Append-only au niveau base pour les signalements et leurs revues (T-98,
-- P2-6). Les services n'exposent ni update ni delete ; ces triggers ferment
-- la porte aux requêtes SQL directes, aux outils d'administration et à un
-- futur code qui contournerait le service.
--
-- L'historique qualité est immuable : une correction passe par une nouvelle
-- ligne (jamais par une réécriture). Les triggers couvrent UPDATE, DELETE et
-- TRUNCATE ; un TRUNCATE est une suppression de masse, pas une opération de
-- maintenance applicative.
CREATE OR REPLACE FUNCTION reject_append_only_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only : % is forbidden', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_criterion_report_append_only
    BEFORE UPDATE OR DELETE ON matching_criterion_report
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER trg_criterion_report_no_truncate
    BEFORE TRUNCATE ON matching_criterion_report
    FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER trg_criterion_report_review_append_only
    BEFORE UPDATE OR DELETE ON matching_criterion_report_review
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER trg_criterion_report_review_no_truncate
    BEFORE TRUNCATE ON matching_criterion_report_review
    FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_mutation();
