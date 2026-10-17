-- Pièces jointes candidat (D46) : CV stockés sur disque local, tracés en base.
--
-- attachment : une ligne par fichier déposé, propriétaire candidate_id FK
-- CASCADE (la purge d'un compte emporte ses lignes). storage_path est relatif
-- à la racine de stockage — les fichiers existants gardent leur dossier même
-- si la racine change. uq_attachment_candidate_id est la cible de la FK
-- composite (candidate_id, id) posée en V20 : une candidature ne peut épingler
-- que le CV de SON candidat.
--
-- candidates.current_cv_attachment_id : pointeur vers le CV courant, FK simple
-- nullable ON DELETE SET NULL — supprimer un CV remet le pointeur à vide sans
-- bloquer la suppression ; les anciens CV restent stockés et téléchargeables.
CREATE TABLE attachment (
    id            UUID         NOT NULL,
    candidate_id  UUID         NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    sha256        VARCHAR(64)  NOT NULL,
    storage_path  VARCHAR(500) NOT NULL,
    created_at    TIMESTAMP    NOT NULL,
    CONSTRAINT pk_attachment              PRIMARY KEY (id),
    CONSTRAINT uq_attachment_candidate_id UNIQUE (candidate_id, id),
    CONSTRAINT fk_attachment_candidate    FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT ck_attachment_size_bytes   CHECK (size_bytes > 0)
);

ALTER TABLE candidates
    ADD COLUMN current_cv_attachment_id UUID;

ALTER TABLE candidates
    ADD CONSTRAINT fk_candidates_current_cv_attachment
        FOREIGN KEY (current_cv_attachment_id) REFERENCES attachment (id) ON DELETE SET NULL;
