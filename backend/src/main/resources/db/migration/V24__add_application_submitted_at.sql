-- Vue recruteur T-66 (D65) : date de transmission distincte de la création du
-- brouillon. submitted_at est posé uniquement au passage DRAFT → SUBMITTED,
-- puis immuable : created_at reste la création du brouillon, updated_at bouge
-- encore aux décisions/retraits, aucun des deux ne trie la liste recruteur.
--
-- Backfill : les lignes non-brouillon existantes n'ont pas de trace de leur
-- transmission. created_at est la seule borne basse disponible et reste
-- stable (updated_at a pu être modifié par une décision ou un retrait).
ALTER TABLE application ADD COLUMN submitted_at TIMESTAMP;

UPDATE application
SET submitted_at = created_at
WHERE status <> 1;

-- Cohérence du cycle : un brouillon n'a jamais de date de transmission, une
-- candidature non-brouillon en a toujours une. Le trigger ci-dessous complète
-- le CHECK, qui ne peut pas comparer OLD et NEW.
ALTER TABLE application ADD CONSTRAINT ck_application_submitted_at
    CHECK ((status = 1) = (submitted_at IS NULL));

-- Liste recruteur : filtre par offre + statut, tri par date de transmission.
CREATE INDEX ix_application_offer_status_submitted
    ON application (job_offer_id, status, submitted_at, id);

-- Immuabilité : la première écriture (NULL → valeur) est autorisée ; toute
-- modification ultérieure est refusée, y compris une remise à NULL. Le
-- trigger ne se déclenche que sur un UPDATE qui mentionne la colonne, et
-- laisse passer une écriture de la même valeur (Hibernate met à jour toutes
-- les colonnes d'une entité modifiée).
CREATE OR REPLACE FUNCTION application_submitted_at_is_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.submitted_at IS NOT NULL
       AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'application.submitted_at is immutable (application %)', OLD.id
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_application_submitted_at_immutable
    BEFORE UPDATE OF submitted_at ON application
    FOR EACH ROW
    EXECUTE FUNCTION application_submitted_at_is_immutable();
