-- Vocabulaires fermés d'offre (D14) : tables de référence miroir degrees /
-- study_fields (shape id + label UNIQUE), alimentées par seed — aucune
-- endpoint d'écriture, enrichissement = migration ultérieure.
--
-- contract_type  : nature du contrat (Permanent, Fixed-term, Freelance…)
-- employment_type: temps de travail (Full-time, Part-time)
-- work_mode      : mode de travail (Remote, Hybrid, On-site)

CREATE TABLE contract_type (
    id    UUID         NOT NULL,
    label VARCHAR(100) NOT NULL,
    CONSTRAINT pk_contract_type PRIMARY KEY (id),
    CONSTRAINT uq_contract_type_label UNIQUE (label)
);

CREATE TABLE employment_type (
    id    UUID         NOT NULL,
    label VARCHAR(100) NOT NULL,
    CONSTRAINT pk_employment_type PRIMARY KEY (id),
    CONSTRAINT uq_employment_type_label UNIQUE (label)
);

CREATE TABLE work_mode (
    id    UUID         NOT NULL,
    label VARCHAR(100) NOT NULL,
    CONSTRAINT pk_work_mode PRIMARY KEY (id),
    CONSTRAINT uq_work_mode_label UNIQUE (label)
);

INSERT INTO contract_type (id, label) VALUES
    ('b0000000-0000-4000-8000-000000000001', 'Permanent'),
    ('b0000000-0000-4000-8000-000000000002', 'Fixed-term'),
    ('b0000000-0000-4000-8000-000000000003', 'Freelance'),
    ('b0000000-0000-4000-8000-000000000004', 'Internship'),
    ('b0000000-0000-4000-8000-000000000005', 'Apprenticeship'),
    ('b0000000-0000-4000-8000-000000000006', 'Volunteer');

INSERT INTO employment_type (id, label) VALUES
    ('b1000000-0000-4000-8000-000000000001', 'Full-time'),
    ('b1000000-0000-4000-8000-000000000002', 'Part-time');

INSERT INTO work_mode (id, label) VALUES
    ('b2000000-0000-4000-8000-000000000001', 'Remote'),
    ('b2000000-0000-4000-8000-000000000002', 'Hybrid'),
    ('b2000000-0000-4000-8000-000000000003', 'On-site');
