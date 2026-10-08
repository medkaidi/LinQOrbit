-- Roles de capacité (RBAC) : ce qu'un compte PEUT faire (ADMIN aujourd'hui,
-- valeurs futures sans migration). Un compte peut cumuler plusieurs rôles.
-- L'identité (candidat / recruteur) vit dans les tables candidates / recruiters
-- (cumul natif, ancre des données de profil) — jamais dupliquée ici.
CREATE TABLE user_roles (
    user_id UUID     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role    SMALLINT NOT NULL,
    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role)
);
