ALTER TABLE candidates
    ADD COLUMN title               VARCHAR(255),
    ADD COLUMN bio                 VARCHAR(2000),
    ADD COLUMN years_of_experience INTEGER,
    ADD COLUMN search_status       SMALLINT;

CREATE TABLE skills (
    id         UUID         NOT NULL,
    name       VARCHAR(100) NOT NULL,
    skill_type SMALLINT     NOT NULL,
    CONSTRAINT pk_skills      PRIMARY KEY (id),
    CONSTRAINT uq_skills_name UNIQUE (name)
);

CREATE TABLE job_positions (
    id    UUID         NOT NULL,
    label VARCHAR(255) NOT NULL,
    CONSTRAINT pk_job_positions       PRIMARY KEY (id),
    CONSTRAINT uq_job_positions_label UNIQUE (label)
);

CREATE TABLE degrees (
    id    UUID         NOT NULL,
    label VARCHAR(100) NOT NULL,
    CONSTRAINT pk_degrees      PRIMARY KEY (id),
    CONSTRAINT uq_degrees_label UNIQUE (label)
);

CREATE TABLE study_fields (
    id    UUID         NOT NULL,
    label VARCHAR(100) NOT NULL,
    CONSTRAINT pk_study_fields      PRIMARY KEY (id),
    CONSTRAINT uq_study_fields_label UNIQUE (label)
);

CREATE TABLE languages (
    id     UUID         NOT NULL,
    symbol VARCHAR(5)   NOT NULL,
    name   VARCHAR(100) NOT NULL,
    CONSTRAINT pk_languages       PRIMARY KEY (id),
    CONSTRAINT uq_languages_symbol UNIQUE (symbol)
);

CREATE TABLE candidate_skills (
    id               UUID        NOT NULL,
    candidate_id     UUID        NOT NULL,
    skill_id         UUID        NOT NULL,
    level            INTEGER    NOT NULL,
    years_experience INTEGER,
    CONSTRAINT pk_candidate_skills       PRIMARY KEY (id),
    CONSTRAINT uq_candidate_skills_pair  UNIQUE (candidate_id, skill_id),
    CONSTRAINT fk_candidate_skills_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT fk_candidate_skills_skill     FOREIGN KEY (skill_id)     REFERENCES skills (id),
    CONSTRAINT ck_candidate_skills_level  CHECK (level BETWEEN 1 AND 5),
    CONSTRAINT ck_candidate_skills_years  CHECK (years_experience IS NULL OR years_experience >= 0)
);

CREATE INDEX ix_candidate_skills_candidate ON candidate_skills (candidate_id);

CREATE TABLE candidate_languages (
    id           UUID     NOT NULL,
    candidate_id UUID     NOT NULL,
    language_id  UUID     NOT NULL,
    level        VARCHAR(3) NOT NULL,
    CONSTRAINT pk_candidate_languages        PRIMARY KEY (id),
    CONSTRAINT uq_candidate_languages_pair   UNIQUE (candidate_id, language_id),
    CONSTRAINT fk_candidate_languages_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT fk_candidate_languages_language  FOREIGN KEY (language_id)  REFERENCES languages (id),
    CONSTRAINT ck_candidate_languages_level CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
);

CREATE INDEX ix_candidate_languages_candidate ON candidate_languages (candidate_id);

CREATE TABLE professional_experiences (
    id               UUID         NOT NULL,
    candidate_id     UUID         NOT NULL,
    job_position_id  UUID,
    position_title   VARCHAR(255) NOT NULL,
    description      VARCHAR(2000),
    start_date       DATE         NOT NULL,
    end_date         DATE,
    company_name     VARCHAR(255) NOT NULL,
    company_country  VARCHAR(2),
    sort_order       INTEGER      NOT NULL,
    created_at       TIMESTAMP    NOT NULL,
    updated_at       TIMESTAMP    NOT NULL,
    CONSTRAINT pk_professional_experiences  PRIMARY KEY (id),
    CONSTRAINT fk_prof_exp_candidate     FOREIGN KEY (candidate_id)    REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT fk_prof_exp_job_position  FOREIGN KEY (job_position_id) REFERENCES job_positions (id),
    CONSTRAINT ck_prof_exp_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX ix_prof_exp_candidate ON professional_experiences (candidate_id);

CREATE TABLE diplomas (
    id                  UUID         NOT NULL,
    candidate_id        UUID         NOT NULL,
    title               VARCHAR(255) NOT NULL,
    start_date          DATE         NOT NULL,
    end_date            DATE,
    institution         VARCHAR(255) NOT NULL,
    institution_country VARCHAR(2),
    degree_id           UUID,
    study_field_id      UUID,
    sort_order          INTEGER      NOT NULL,
    created_at          TIMESTAMP    NOT NULL,
    updated_at          TIMESTAMP    NOT NULL,
    CONSTRAINT pk_diplomas     PRIMARY KEY (id),
    CONSTRAINT fk_diplomas_candidate     FOREIGN KEY (candidate_id)    REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT fk_diplomas_degree        FOREIGN KEY (degree_id)       REFERENCES degrees (id),
    CONSTRAINT fk_diplomas_study_field   FOREIGN KEY (study_field_id)  REFERENCES study_fields (id),
    CONSTRAINT ck_diplomas_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX ix_diplomas_candidate ON diplomas (candidate_id);

CREATE TABLE candidate_links (
    id           UUID         NOT NULL,
    candidate_id UUID         NOT NULL,
    label        VARCHAR(255) NOT NULL,
    url          VARCHAR(500) NOT NULL,
    link_type    SMALLINT     NOT NULL,
    issuer       VARCHAR(255),
    issued_at    DATE,
    sort_order   INTEGER      NOT NULL,
    created_at   TIMESTAMP    NOT NULL,
    updated_at   TIMESTAMP    NOT NULL,
    CONSTRAINT pk_candidate_links PRIMARY KEY (id),
    CONSTRAINT fk_candidate_links_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
);

CREATE INDEX ix_candidate_links_candidate ON candidate_links (candidate_id);
