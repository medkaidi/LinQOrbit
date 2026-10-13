-- Normalisation d'offre (D26/D27) : discriminator de source + association offre.
--
-- normalization_job.source_type (SMALLINT, 1 = CANDIDATE, 2 = OFFER) : dit quel
-- pipeline consomme le job (snapshot candidat ou snapshot offre, agent
-- dédié). Les lignes existantes sont toutes côté candidat (backfill = 1).
-- Le worker est unique et branche sur cette colonne après le claim : aucun
-- filtre au claim, aucune course entre workers.
--
-- normalized_profile_job_offer : table d'association source ↔ profil, miroir
-- de normalized_profile_candidate (exclusivité des sources : un profil
-- appartient à un candidat XOR à une offre). Le profil EST le porteur de la
-- liaison vers la source, le job ne fait que suivre (shared PK).
ALTER TABLE normalization_job ADD COLUMN source_type SMALLINT;
UPDATE normalization_job SET source_type = 1;
ALTER TABLE normalization_job ALTER COLUMN source_type SET NOT NULL;

-- Filtrage et observabilité par type : statut + type + échéance.
CREATE INDEX ix_normalization_job_source_claim ON normalization_job (status, source_type, next_attempt_at);

CREATE TABLE normalized_profile_job_offer (
    normalized_profile_id UUID NOT NULL,
    job_offer_id          UUID NOT NULL,
    CONSTRAINT pk_normalized_profile_job_offer PRIMARY KEY (normalized_profile_id, job_offer_id),
    CONSTRAINT fk_npjo_normalized_profile FOREIGN KEY (normalized_profile_id)
        REFERENCES normalized_profile (normalized_profile_id),
    CONSTRAINT fk_npjo_job_offer FOREIGN KEY (job_offer_id) REFERENCES job_offer (id)
);

-- Navigation principale : depuis l'offre vers ses profils.
CREATE INDEX ix_npjo_job_offer_id ON normalized_profile_job_offer (job_offer_id);
