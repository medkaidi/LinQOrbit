-- Offres d'emploi (D12–D14) : l'offre appartient à une company et est gérée
-- par un recruteur (recruiter_id), le statut porte le cycle de vie
-- DRAFT(1) → VALIDATED(2) → PUBLISHED(3) → CLOSED(4) (D13) — validate ≠
-- publish : validated_at est posée par la validation (déclencheur de la
-- normalisation), published_at par la publication explicite.
--
-- Localisation = city + country (ISO alpha-2), miroir users — pas de table geo
-- (D14). Les trois vocabulaires fermés sont des FK vers les tables seedées en
-- V12, nullable : un brouillon peut être incomplet.
-- salary_type (brut/net) volontairement absent (D14 supprimé).
--
-- Associations : job_offer_skill porte les critères de compétences
-- (mandatory/preferred, weight, years_experience — le germe des offer_criteria
-- de §15.3), job_offer_language le niveau CECR + is_required, les deux
-- tables de mentions (degrees / study_fields) sont de simples liaisons gérées
-- en tags depuis l'autocomplete (D14). Les FK offres portent ON DELETE
-- CASCADE : supprimer une offre (DRAFT seulement, endpoint dédié) nettoie
-- ses associations.

CREATE TABLE job_offer (
    id                 UUID         NOT NULL,
    company_id         UUID         NOT NULL,
    recruiter_id       UUID         NOT NULL,
    status             SMALLINT     NOT NULL DEFAULT 1,
    title              VARCHAR(255) NOT NULL,
    description        VARCHAR(8000),
    seniority          SMALLINT,
    required_exp_year  INTEGER,
    city               VARCHAR(255),
    country            VARCHAR(2),
    contract_type_id   UUID,
    employment_type_id UUID,
    work_mode_id       UUID,
    validated_at       TIMESTAMP,
    published_at       TIMESTAMP,
    expires_at         DATE,
    salary_min         NUMERIC(12, 2),
    salary_max         NUMERIC(12, 2),
    salary_currency    VARCHAR(3),
    salary_period      SMALLINT,
    created_at         TIMESTAMP    NOT NULL,
    updated_at         TIMESTAMP    NOT NULL,
    CONSTRAINT pk_job_offer PRIMARY KEY (id),
    CONSTRAINT fk_jo_company         FOREIGN KEY (company_id)         REFERENCES companies (id),
    CONSTRAINT fk_jo_recruiter       FOREIGN KEY (recruiter_id)       REFERENCES recruiters (id),
    CONSTRAINT fk_jo_contract_type   FOREIGN KEY (contract_type_id)   REFERENCES contract_type (id),
    CONSTRAINT fk_jo_employment_type FOREIGN KEY (employment_type_id) REFERENCES employment_type (id),
    CONSTRAINT fk_jo_work_mode       FOREIGN KEY (work_mode_id)       REFERENCES work_mode (id)
);

CREATE INDEX ix_job_offer_company_id   ON job_offer (company_id);
CREATE INDEX ix_job_offer_recruiter_id ON job_offer (recruiter_id);

CREATE TABLE job_offer_skill (
    job_offer_id     UUID     NOT NULL,
    skill_id         UUID     NOT NULL,
    requirement_type SMALLINT NOT NULL,
    weight           INTEGER  NOT NULL DEFAULT 1,
    years_experience INTEGER,
    CONSTRAINT pk_job_offer_skill PRIMARY KEY (job_offer_id, skill_id),
    CONSTRAINT fk_jos_job_offer FOREIGN KEY (job_offer_id) REFERENCES job_offer (id) ON DELETE CASCADE,
    CONSTRAINT fk_jos_skill     FOREIGN KEY (skill_id)     REFERENCES skills (id)
);

CREATE TABLE job_offer_language (
    job_offer_id UUID       NOT NULL,
    language_id  UUID       NOT NULL,
    level        VARCHAR(3) NOT NULL,
    is_required  BOOLEAN    NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_job_offer_language PRIMARY KEY (job_offer_id, language_id),
    CONSTRAINT fk_jol_job_offer FOREIGN KEY (job_offer_id) REFERENCES job_offer (id) ON DELETE CASCADE,
    CONSTRAINT fk_jol_language  FOREIGN KEY (language_id)  REFERENCES languages (id)
);

CREATE TABLE job_offer_degree (
    job_offer_id UUID NOT NULL,
    degree_id    UUID NOT NULL,
    CONSTRAINT pk_job_offer_degree PRIMARY KEY (job_offer_id, degree_id),
    CONSTRAINT fk_jod_job_offer FOREIGN KEY (job_offer_id) REFERENCES job_offer (id) ON DELETE CASCADE,
    CONSTRAINT fk_jod_degree    FOREIGN KEY (degree_id)    REFERENCES degrees (id)
);

CREATE TABLE job_offer_study_field (
    job_offer_id   UUID NOT NULL,
    study_field_id UUID NOT NULL,
    CONSTRAINT pk_job_offer_study_field PRIMARY KEY (job_offer_id, study_field_id),
    CONSTRAINT fk_josf_job_offer   FOREIGN KEY (job_offer_id)   REFERENCES job_offer (id) ON DELETE CASCADE,
    CONSTRAINT fk_josf_study_field FOREIGN KEY (study_field_id) REFERENCES study_fields (id)
);
