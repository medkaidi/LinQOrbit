-- Phase 1 (D10–D11) : identité recruteur enrichie + companies et appartenances.
--
-- recruiters : ancre de l'identité recruteur (PK partagée avec users, comme
--   candidates) — headline et bio optionnels. La ligne est créée par une action
--   explicite du compte (POST /api/v1/recruiters/me), jamais à la lecture et
--   jamais au signup ; aucun rôle RECRUITER n'est ajouté à user_roles (D10).
--
-- companies / company_members : une company est créée par un recruteur qui en
--   devient l'owner ; member/owner vit dans company_members (rôle coarse, D12),
--   plusieurs companies par recruteur possibles. Les deux FK membres portent
--   ON DELETE CASCADE : supprimer une company (ou une ligne recruteur) nettoie
--   les appartenances au lieu de violer l'intégrité référentielle.

ALTER TABLE recruiters
    ADD COLUMN headline VARCHAR(100),
    ADD COLUMN bio      VARCHAR(2000);

CREATE TABLE companies (
    id          UUID         NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description VARCHAR(2000),
    created_at  TIMESTAMP    NOT NULL,
    updated_at  TIMESTAMP    NOT NULL,
    CONSTRAINT pk_companies PRIMARY KEY (id)
);

CREATE TABLE company_members (
    company_id   UUID    NOT NULL,
    recruiter_id UUID    NOT NULL,
    is_owner     BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_company_members PRIMARY KEY (company_id, recruiter_id),
    CONSTRAINT fk_cm_company   FOREIGN KEY (company_id)   REFERENCES companies (id)   ON DELETE CASCADE,
    CONSTRAINT fk_cm_recruiter FOREIGN KEY (recruiter_id) REFERENCES recruiters (id) ON DELETE CASCADE
);

-- Navigation principale : depuis le recruteur vers ses companies.
CREATE INDEX ix_company_members_recruiter_id ON company_members (recruiter_id);
