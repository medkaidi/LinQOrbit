-- Normalisation du profil candidat (objet canonique, async durable).
--
-- normalized_profile : une ligne par VALIDATION du profil par l'utilisateur.
--   content NULL = en cours / échec / jamais rempli ; rempli par le worker
--   à la fin de l'appel au service IA. validated_at = moment de la validation
--   (sert au dirty-flag : candidates.updated_at > max(validated_at)).
--   version numérotée par candidat, calculée sous lock pessimiste de la
--   ligne candidat côté application (pas de contrainte d'unicité : les
--   colonnes candidate_id et version sont de part et d'autre de la jointure).
--
-- normalized_profile_candidate : table d'association source ↔ profil
--   (exclusivité des sources : un profil appartient à un candidat XOR à une
--   offre ; l'association avec les futures job_offers viendra avec la table
--   des offres). Le profil EST le porteur de la liaison vers la source.
--
-- normalization_job : suivi d'exécution du profil, jamais l'inverse.
--   Shared PK : job_id ≡ normalized_profile_id, avec FK portée par la PK
--   (intégrité référentielle sans colonne redondante). Le worker traverse
--   job → profil → association → candidat.
CREATE TABLE normalized_profile (
    normalized_profile_id UUID        NOT NULL,
    version               INTEGER     NOT NULL,
    schema_version        VARCHAR(8)  NOT NULL DEFAULT '1',
    content               JSONB,
    validated_at          TIMESTAMP   NOT NULL,
    created_at            TIMESTAMP   NOT NULL,
    updated_at            TIMESTAMP   NOT NULL,
    CONSTRAINT pk_normalized_profile PRIMARY KEY (normalized_profile_id)
);

CREATE TABLE normalized_profile_candidate (
    normalized_profile_id UUID NOT NULL,
    candidate_id          UUID NOT NULL,
    CONSTRAINT pk_normalized_profile_candidate PRIMARY KEY (normalized_profile_id, candidate_id),
    CONSTRAINT fk_npc_normalized_profile FOREIGN KEY (normalized_profile_id)
        REFERENCES normalized_profile (normalized_profile_id),
    CONSTRAINT fk_npc_candidates FOREIGN KEY (candidate_id) REFERENCES candidates (id)
);

-- Navigation principale : depuis le candidat vers ses profils.
CREATE INDEX ix_npc_candidate_id ON normalized_profile_candidate (candidate_id);

CREATE TABLE normalization_job (
    job_id          UUID        NOT NULL,
    status          VARCHAR(12) NOT NULL,
    attempts        INTEGER     NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP   NOT NULL,
    error           VARCHAR(500),
    created_at      TIMESTAMP   NOT NULL,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    CONSTRAINT pk_normalization_job PRIMARY KEY (job_id),
    CONSTRAINT fk_normalization_job_profile FOREIGN KEY (job_id)
        REFERENCES normalized_profile (normalized_profile_id)
);

-- Sélection des jobs à réclamer : status = 'PENDING' AND next_attempt_at <= now.
CREATE INDEX ix_normalization_job_claim ON normalization_job (status, next_attempt_at);
