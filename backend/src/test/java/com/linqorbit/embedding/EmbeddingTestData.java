package com.linqorbit.embedding;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Données de test des tests d'intégration embedding/screening sur PostgreSQL
 * réel (base de dev partagée) : candidats, offres, fiches normalisées et
 * vecteurs créés par SQL, <b>tous tracés</b> pour que le nettoyage ne supprime
 * que ce que le test a créé. Les modèles de test sont étiquetés à part
 * ({@link #TEST_MODEL}) : un vecteur ou un job de test ne peut jamais être
 * pris pour une donnée réelle.
 */
public final class EmbeddingTestData {

    /** Modèle actif des ITs (propriété {@code app.embedding.model-name} du contexte de test). */
    public static final String TEST_MODEL = "embedding-it-model";
    public static final String MODEL_VERSION = "1";
    public static final String STRATEGY = "text-1";
    public static final int NOT_LOOKING = 3;

    private final JdbcTemplate jdbc;
    private final List<UUID> userIds = new ArrayList<>();
    private final List<UUID> companyIds = new ArrayList<>();
    private final List<UUID> offerIds = new ArrayList<>();
    private final List<UUID> profileIds = new ArrayList<>();

    public EmbeddingTestData(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Candidat ayant consenti à la visibilité recruteur (T-102, D86) ;
     * {@code searchStatus} null = statut jamais renseigné.
     */
    public UUID candidate(Integer searchStatus) {
        return candidate(searchStatus, true);
    }

    /** Candidat sans consentement : jamais proposé, jamais listé. */
    public UUID candidateWithoutConsent(Integer searchStatus) {
        return candidate(searchStatus, false);
    }

    private UUID candidate(Integer searchStatus, boolean consented) {
        UUID id = user("candidate");
        jdbc.update("""
                INSERT INTO candidates (id, created_at, updated_at, search_status,
                                        recruiter_visibility_consent_at, recruiter_visibility_consent_version)
                VALUES (?, now(), now(), ?, CASE WHEN ? THEN now() END, CASE WHEN ? THEN 3 END)""",
                id, searchStatus, consented, consented);
        return id;
    }

    /** Pose ou retire le consentement d'un candidat (retrait après calcul d'une liste). */
    public void setConsent(UUID candidateId, boolean consented) {
        jdbc.update("""
                UPDATE candidates SET recruiter_visibility_consent_at = CASE WHEN ? THEN now() END,
                    recruiter_visibility_consent_version = CASE WHEN ? THEN 3 END
                WHERE id = ?""", consented, consented, candidateId);
    }

    public UUID offer() {
        return offer(DRAFT, null).offerId();
    }

    /** Offre, sa company et son créateur (membre non owner de la company). */
    public record OfferFixture(UUID offerId, UUID companyId, UUID creatorId) {
    }

    public static final int DRAFT = 1;
    public static final int PUBLISHED = 3;
    public static final int CLOSED = 4;

    /** Offre publiée et non expirée, avec company et créateur membre non owner. */
    public OfferFixture publishedOffer() {
        return offer(PUBLISHED, null);
    }

    /** Offre au statut donné ({@code expiresAt} null = sans échéance) ; le créateur est membre non owner. */
    public OfferFixture offer(int status, LocalDate expiresAt) {
        UUID recruiterId = user("recruiter");
        jdbc.update("INSERT INTO recruiters (id, created_at, updated_at) VALUES (?, now(), now())", recruiterId);
        UUID companyId = UUID.randomUUID();
        companyIds.add(companyId);
        jdbc.update("INSERT INTO companies (id, name, created_at, updated_at) VALUES (?, ?, now(), now())",
                companyId, "Embedding IT " + companyId);
        jdbc.update("INSERT INTO company_members (company_id, recruiter_id, is_owner) VALUES (?, ?, false)",
                companyId, recruiterId);
        UUID offerId = UUID.randomUUID();
        offerIds.add(offerId);
        jdbc.update("""
                INSERT INTO job_offer (id, company_id, recruiter_id, status, title, public_id, slug,
                                       expires_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'Embedding IT offer', ?, 'embedding-it-offer', ?, now(), now())""",
                offerId, companyId, recruiterId, status, offerId.toString().replace("-", "").substring(0, 12),
                expiresAt);
        return new OfferFixture(offerId, companyId, recruiterId);
    }

    /** Autre recruteur de la company (membre ; {@code owner} = owner de la company). */
    public UUID recruiterIn(UUID companyId, boolean owner) {
        UUID recruiterId = user("recruiter");
        jdbc.update("INSERT INTO recruiters (id, created_at, updated_at) VALUES (?, now(), now())", recruiterId);
        jdbc.update("INSERT INTO company_members (company_id, recruiter_id, is_owner) VALUES (?, ?, ?)",
                companyId, recruiterId, owner);
        return recruiterId;
    }

    /** Recruteur sans aucune company. */
    public UUID loneRecruiter() {
        UUID recruiterId = user("recruiter");
        jdbc.update("INSERT INTO recruiters (id, created_at, updated_at) VALUES (?, now(), now())", recruiterId);
        return recruiterId;
    }

    /**
     * Candidature (toute statut) du candidat à l'offre : 1 brouillon, 2 transmise… ; le CV épinglé
     * est une pièce jointe de test (nettoyée avec le candidat).
     */
    public void application(UUID candidateId, UUID offerId, int status) {
        UUID attachmentId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO attachment (id, candidate_id, original_name, mime_type, size_bytes, sha256,
                                        storage_path, created_at)
                VALUES (?, ?, 'cv.pdf', 'application/pdf', 1, 'x', 'embedding-it/none', now())""",
                attachmentId, candidateId);
        jdbc.update("""
                INSERT INTO application (id, candidate_id, job_offer_id, cv_attachment_id, status,
                                         created_at, updated_at, submitted_at)
                VALUES (?, ?, ?, ?, ?, now(), now(), CASE WHEN ? = 1 THEN NULL ELSE now() END)""",
                UUID.randomUUID(), candidateId, offerId, attachmentId, status, status);
    }

    /** Offre au statut donné, après coup (clôture, expiration…). */
    public void setOfferStatus(UUID offerId, int status, LocalDate expiresAt) {
        jdbc.update("UPDATE job_offer SET status = ?, expires_at = ? WHERE id = ?", status, expiresAt, offerId);
    }

    /** Fiche candidat ; {@code content} null = analyse en cours ou échouée. */
    public UUID candidateFiche(UUID candidateId, int version, String content) {
        UUID profileId = fiche(version, "3", content);
        jdbc.update("INSERT INTO normalized_profile_candidate (normalized_profile_id, candidate_id) VALUES (?, ?)",
                profileId, candidateId);
        return profileId;
    }

    public UUID offerFiche(UUID offerId, int version, String content) {
        UUID profileId = fiche(version, "2", content);
        jdbc.update("INSERT INTO normalized_profile_job_offer (normalized_profile_id, job_offer_id) VALUES (?, ?)",
                profileId, offerId);
        return profileId;
    }

    /** Vecteur du couple donné, écrit tel quel (hors du worker). */
    public void embedding(UUID profileId, String model, String strategy, float... leading) {
        jdbc.update("""
                INSERT INTO profile_embedding
                    (id, normalized_profile_id, embedding, model_name, model_version, strategy_version, created_at)
                VALUES (?, ?, CAST(? AS vector), ?, ?, ?, now())""",
                UUID.randomUUID(), profileId, vectorLiteral(leading), model, MODEL_VERSION, strategy);
    }

    /** Vecteur du couple actif des ITs. */
    public void embedding(UUID profileId, float... leading) {
        embedding(profileId, TEST_MODEL, STRATEGY, leading);
    }

    /** Vecteur de 1536 valeurs : les premières sont celles données, le reste est nul. */
    public static String vectorLiteral(float... leading) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < 1536; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(i < leading.length ? leading[i] : 0f);
        }
        return sb.append(']').toString();
    }

    /** Vecteur de 1536 valeurs (float[]), pour les réponses simulées du service IA. */
    public static float[] vector(float... leading) {
        float[] values = new float[1536];
        System.arraycopy(leading, 0, values, 0, leading.length);
        return values;
    }

    /** Supprime uniquement ce que ce jeu de données a créé (et tout job/vecteur du modèle de test). */
    public void cleanup() {
        cleanupTestModelRows();
        // Candidatures, suggestions et jobs de recherche d'abord : ils référencent offres, candidats et fiches.
        for (UUID offerId : offerIds) {
            jdbc.update("DELETE FROM application WHERE job_offer_id = ?", offerId);
            jdbc.update("DELETE FROM offer_candidate WHERE job_offer_id = ?", offerId);
            jdbc.update("DELETE FROM screening_job WHERE job_offer_id = ?", offerId);
        }
        for (UUID userId : userIds) {
            jdbc.update("DELETE FROM application WHERE candidate_id = ?", userId);
            jdbc.update("DELETE FROM offer_candidate WHERE candidate_id = ?", userId);
        }
        for (UUID profileId : profileIds) {
            jdbc.update("DELETE FROM offer_candidate WHERE candidate_normalized_profile_id = ?", profileId);
            jdbc.update("DELETE FROM screening_job WHERE offer_normalized_profile_id = ?", profileId);
            jdbc.update("DELETE FROM profile_embedding WHERE normalized_profile_id = ?", profileId);
            jdbc.update("DELETE FROM embedding_job WHERE normalized_profile_id = ?", profileId);
            jdbc.update("DELETE FROM normalized_profile_candidate WHERE normalized_profile_id = ?", profileId);
            jdbc.update("DELETE FROM normalized_profile_job_offer WHERE normalized_profile_id = ?", profileId);
            jdbc.update("DELETE FROM normalized_profile WHERE normalized_profile_id = ?", profileId);
        }
        for (UUID offerId : offerIds) {
            jdbc.update("DELETE FROM job_offer WHERE id = ?", offerId);
        }
        for (UUID companyId : companyIds) {
            jdbc.update("DELETE FROM company_members WHERE company_id = ?", companyId);
            jdbc.update("DELETE FROM companies WHERE id = ?", companyId);
        }
        for (UUID userId : userIds) {
            jdbc.update("DELETE FROM recruiters WHERE id = ?", userId);
            jdbc.update("DELETE FROM candidates WHERE id = ?", userId);
            jdbc.update("DELETE FROM users WHERE id = ?", userId);
        }
        profileIds.clear();
        offerIds.clear();
        companyIds.clear();
        userIds.clear();
    }

    /**
     * Le backfill crée des jobs pour toutes les fiches courantes de la base
     * (seeds compris) sous le modèle de test : on ne balaie que ce modèle,
     * propre aux ITs, jamais un job ou un vecteur réel.
     */
    public void cleanupTestModelRows() {
        jdbc.update("DELETE FROM profile_embedding WHERE model_name = ?", TEST_MODEL);
        jdbc.update("DELETE FROM embedding_job WHERE model_name = ?", TEST_MODEL);
    }

    private UUID user(String kind) {
        UUID id = UUID.randomUUID();
        userIds.add(id);
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, first_name, last_name, status, created_at, updated_at)
                VALUES (?, ?, 'x', 'Embedding', 'IT', 1, now(), now())""",
                id, "embedding-it-" + kind + "-" + id + "@example.com");
        return id;
    }

    private UUID fiche(int version, String schemaVersion, String content) {
        UUID profileId = UUID.randomUUID();
        profileIds.add(profileId);
        jdbc.update("""
                INSERT INTO normalized_profile
                    (normalized_profile_id, version, schema_version, content, validated_at, created_at, updated_at)
                VALUES (?, ?, ?, CAST(? AS jsonb), now(), now(), now())""",
                profileId, version, schemaVersion, content);
        return profileId;
    }
}
