-- Le texte de consentement passe en version 2 (T-102, D86) : il annonce désormais que l'e-mail et le
-- téléphone sont visibles des recruteurs, ce que la version 1 excluait explicitement. Un consentement
-- donné sous la version 1 ne couvre donc pas ce périmètre : il est annulé (les deux colonnes ensemble,
-- CHECK V30) et le candidat est invité à consentir de nouveau au nouveau texte.
UPDATE candidates
SET recruiter_visibility_consent_at = NULL,
    recruiter_visibility_consent_version = NULL
WHERE recruiter_visibility_consent_version < 2;
