-- Retire les deux index trigramme ajoutés par V32 : aucun scan à ce volume (la base ne compte
-- que quelques centaines de lignes, un scan séquentiel est moins cher), ils pèsent plus que
-- leur table et alourdissent chaque écriture. Le job board et la console admin cherchent par
-- « titre OU société » (sous-requête), forme que PostgreSQL ne sait pas combiner avec un
-- index : leur usage réel est à mesurer (EXPLAIN sur jeu volumineux) avant de les recréer.
-- Les index B-tree de V32 et l'extension pg_trgm sont conservés.
DROP INDEX IF EXISTS ix_job_offer_title_trgm;
DROP INDEX IF EXISTS ix_companies_name_trgm;
