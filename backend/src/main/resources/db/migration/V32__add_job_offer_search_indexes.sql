-- T-70 / T-77 : index de la recherche d'offres (liste recruteur et job board).
-- Migration additive : aucun index existant n'est modifié (ix_job_offer_company_id
-- devient redondant avec le préfixe du premier ci-dessous, il est laissé en place).

-- Recherche texte « contient » (lower(col) LIKE '%…%' ESCAPE '!') : sans trigrammes,
-- un LIKE à joker initial est un scan séquentiel. pg_trgm est une extension de contrib.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Liste recruteur : offres des sociétés du recruteur, création la plus récente d'abord.
CREATE INDEX ix_job_offer_company_created
    ON job_offer (company_id, created_at DESC, id DESC);

-- Job board : statut puis publication la plus récente d'abord (couvre aussi le
-- filtre par statut de la console admin).
CREATE INDEX ix_job_offer_status_published
    ON job_offer (status, published_at DESC, id DESC);

CREATE INDEX ix_job_offer_title_trgm
    ON job_offer USING gin (lower(title) gin_trgm_ops);

CREATE INDEX ix_companies_name_trgm
    ON companies USING gin (lower(name) gin_trgm_ops);
