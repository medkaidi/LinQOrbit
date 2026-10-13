-- Normalisation : statut des jobs en SMALLINT (alignement de convention).
--
-- normalization_job.status passe de VARCHAR(12) à SMALLINT : 1 = PENDING,
-- 2 = RUNNING, 3 = DONE, 4 = FAILED, 5 = SUPERSEDED (mêmes codes que
-- l'enum Java NormalizationJobStatus). Les index portant sur status sont
-- conservés (réécrits par PostgreSQL lors du changement de type).
ALTER TABLE normalization_job ALTER COLUMN status TYPE SMALLINT USING (
    CASE status
        WHEN 'PENDING' THEN 1
        WHEN 'RUNNING' THEN 2
        WHEN 'DONE' THEN 3
        WHEN 'FAILED' THEN 4
        WHEN 'SUPERSEDED' THEN 5
    END
);
ALTER TABLE normalization_job ALTER COLUMN status SET NOT NULL;
