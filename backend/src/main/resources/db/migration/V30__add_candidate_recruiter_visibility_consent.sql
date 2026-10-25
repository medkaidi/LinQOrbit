-- Consentement du candidat à la visibilité de son profil complet par les recruteurs (T-102, D86).
--
-- Opt-in explicite : sans consentement (colonnes NULL, défaut de tous les comptes existants),
-- un candidat n'est jamais proposé à un recruteur. Le consentement porte la date de l'acte et la
-- version du texte affiché au moment du clic (preuve de ce à quoi le candidat a consenti) ; le
-- retrait remet les deux colonnes à NULL. Posés par le serveur, jamais fournis par le client.
ALTER TABLE candidates
    ADD COLUMN recruiter_visibility_consent_at      TIMESTAMP,
    ADD COLUMN recruiter_visibility_consent_version SMALLINT,
    ADD CONSTRAINT ck_candidates_visibility_consent CHECK (
        (recruiter_visibility_consent_at IS NULL) = (recruiter_visibility_consent_version IS NULL)),
    ADD CONSTRAINT ck_candidates_visibility_consent_version CHECK (
        recruiter_visibility_consent_version IS NULL OR recruiter_visibility_consent_version >= 1);
