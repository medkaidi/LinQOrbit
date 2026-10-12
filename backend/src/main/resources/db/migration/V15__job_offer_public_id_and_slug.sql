-- URL publique d'offre (V15) : chaque offre porte un identifiant public
-- court, immuable (public_id), et un slug dérivé du titre (cosmétique/SEO,
-- mutable avec le titre). Le lookup public = public_id seul ; le slug dans
-- l'URL est ignoré (segment unique /jobs/{publicId}-{slug}).
--
-- Backfill des offres existantes : public_id = 12 premiers caractères hex de
-- l'id sans tirets (déterministe, sans collision — l'id est la PK) ; slug =
-- approximation SQL du titre (minuscules, séquences non alphanumériques en
-- tirets). Aucun index additionnel : le UNIQUE fournit l'index de lookup du
-- endpoint public, l'index (status, published_at) viendra avec la future
-- liste publique.

ALTER TABLE job_offer
    ADD COLUMN public_id VARCHAR(12),
    ADD COLUMN slug      VARCHAR(120);

UPDATE job_offer
SET public_id = left(replace(id::text, '-', ''), 12),
    slug      = left(lower(regexp_replace(btrim(title), '[^a-zA-Z0-9]+', '-', 'g')), 120);

ALTER TABLE job_offer
    ALTER COLUMN public_id SET NOT NULL,
    ALTER COLUMN slug SET NOT NULL,
    ADD CONSTRAINT job_offer_public_id_unique UNIQUE (public_id);
