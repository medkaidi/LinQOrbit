-- Section Projets du profil candidat (schema fiche v2, décision D3 levée).
-- Miroir de professional_experiences : remplacement intégral par PUT, sortOrder
-- = ordre fourni. end_date null = projet en cours. technologies = liste libre
-- (texte), la canonicalisation et l'extraction de compétences sont le travail
-- de la fiche normalisée (v2), pas de cette table.
CREATE TABLE candidate_projects (
    id            UUID         NOT NULL,
    candidate_id  UUID         NOT NULL,
    name          VARCHAR(255) NOT NULL,
    role          VARCHAR(255),
    description   VARCHAR(2000),
    start_date    DATE         NOT NULL,
    end_date      DATE,
    technologies  VARCHAR(1000),
    sort_order    INTEGER      NOT NULL,
    created_at    TIMESTAMP    NOT NULL,
    updated_at    TIMESTAMP    NOT NULL,
    CONSTRAINT pk_candidate_projects    PRIMARY KEY (id),
    CONSTRAINT fk_candidate_projects    FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT ck_candidate_proj_dates  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX ix_candidate_projects_candidate ON candidate_projects (candidate_id);
