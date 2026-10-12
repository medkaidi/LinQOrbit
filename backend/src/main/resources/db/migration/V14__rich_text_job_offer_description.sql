-- Description d'offre en texte riche (D19) : le HTML sanitisé (Tiptap) gonfle
-- de ~20-30% vs le texte brut — TEXT, la limite métier vit dans @Size(20000).
ALTER TABLE job_offer
    ALTER COLUMN description TYPE TEXT;
