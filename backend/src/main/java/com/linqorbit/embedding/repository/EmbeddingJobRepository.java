package com.linqorbit.embedding.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.embedding.entity.EmbeddingJob;
import com.linqorbit.embedding.entity.EmbeddingJobStatus;

public interface EmbeddingJobRepository extends JpaRepository<EmbeddingJob, UUID> {

    Optional<EmbeddingJob> findByNormalizedProfileIdAndModelNameAndModelVersionAndStrategyVersion(
            UUID normalizedProfileId, String modelName, String modelVersion, String strategyVersion);

    /**
     * Création idempotente (SQL natif : {@code ON CONFLICT DO NOTHING} sur le
     * couple fiche × modèle × stratégie). Retourne 0 si le job existe déjà —
     * deux déclencheurs concurrents ne créent jamais deux jobs.
     */
    @Modifying(clearAutomatically = true)
    @Query(value = """
            insert into embedding_job
                (job_id, normalized_profile_id, model_name, model_version, strategy_version,
                 status, attempts, next_attempt_at, created_at)
            values (:jobId, :profileId, :modelName, :modelVersion, :strategyVersion, 1, 0, :now, :now)
            on conflict on constraint uq_embedding_job_version do nothing""", nativeQuery = true)
    int insertPendingIfAbsent(UUID jobId, UUID profileId, String modelName, String modelVersion,
            String strategyVersion, LocalDateTime now);

    /** Claim atomique PENDING → RUNNING : un seul vainqueur, même multi-instances. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update EmbeddingJob j
            set j.status = :target, j.startedAt = :now
            where j.id = :jobId and j.status = :expected""")
    int casStatus(UUID jobId, EmbeddingJobStatus expected, EmbeddingJobStatus target, LocalDateTime now);

    /** RUNNING → DONE : vecteur écrit dans la même transaction. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update EmbeddingJob j
            set j.status = :target, j.completedAt = :now, j.error = null
            where j.id = :jobId and j.status = :expected""")
    int casDone(UUID jobId, EmbeddingJobStatus expected, EmbeddingJobStatus target, LocalDateTime now);

    /** RUNNING → SUPERSEDED : fiche plus courante, aucun appel au fournisseur. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update EmbeddingJob j
            set j.status = :target, j.completedAt = :now
            where j.id = :jobId and j.status = :expected""")
    int casSupersede(UUID jobId, EmbeddingJobStatus expected, EmbeddingJobStatus target, LocalDateTime now);

    /** RUNNING → PENDING : nouvelle tentative planifiée, erreur conservée. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update EmbeddingJob j
            set j.status = :target, j.attempts = :attempts, j.nextAttemptAt = :nextAttemptAt, j.error = :error
            where j.id = :jobId and j.status = :expected""")
    int casRetry(UUID jobId, EmbeddingJobStatus expected, EmbeddingJobStatus target,
            int attempts, LocalDateTime nextAttemptAt, String error);

    /** RUNNING → FAILED : plus de tentative. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update EmbeddingJob j
            set j.status = :target, j.attempts = :attempts, j.completedAt = :now, j.error = :error
            where j.id = :jobId and j.status = :expected""")
    int casFail(UUID jobId, EmbeddingJobStatus expected, EmbeddingJobStatus target,
            int attempts, LocalDateTime now, String error);

    /**
     * FAILED → PENDING (relance au démarrage) ou SUPERSEDED → PENDING (backfill d'un couple redevenu actif) :
     * tentatives remises à zéro, jamais une 2ᵉ ligne.
     */
    @Modifying(clearAutomatically = true)
    @Query("""
            update EmbeddingJob j
            set j.status = :target, j.attempts = 0, j.nextAttemptAt = :now, j.error = null,
                j.startedAt = null, j.completedAt = null
            where j.id = :jobId and j.status = :expected""")
    int casRequeue(UUID jobId, EmbeddingJobStatus expected, EmbeddingJobStatus target, LocalDateTime now);

    List<EmbeddingJob> findByStatus(EmbeddingJobStatus status);

    /** Jobs RUNNING dont le worker est probablement mort (redémarrage pendant l'appel). */
    @Query("""
            select j from EmbeddingJob j
            where j.status = :status and j.startedAt <= :threshold""")
    List<EmbeddingJob> findByStatusAndStartedAtLessThanEqual(EmbeddingJobStatus status, LocalDateTime threshold);

    /**
     * La fiche est-elle la fiche courante de sa source (dernière version AVEC
     * contenu du candidat ou de l'offre) ? Même définition que
     * {@code NormalizedProfileRepository.findLatestWithContentByCandidateId} et
     * son pendant offre : un job dont la fiche ne l'est plus est écarté sans
     * appel au fournisseur.
     */
    @Query(value = """
            select exists (
                select 1 from normalized_profile np
                join normalized_profile_candidate l on l.normalized_profile_id = np.normalized_profile_id
                where np.normalized_profile_id = :profileId
                  and np.content is not null
                  and np.version = (select max(np2.version) from normalized_profile np2
                                    join normalized_profile_candidate l2
                                      on l2.normalized_profile_id = np2.normalized_profile_id
                                    where l2.candidate_id = l.candidate_id and np2.content is not null))
                or exists (
                select 1 from normalized_profile np
                join normalized_profile_job_offer o on o.normalized_profile_id = np.normalized_profile_id
                where np.normalized_profile_id = :profileId
                  and np.content is not null
                  and np.version = (select max(np2.version) from normalized_profile np2
                                    join normalized_profile_job_offer o2
                                      on o2.normalized_profile_id = np2.normalized_profile_id
                                    where o2.job_offer_id = o.job_offer_id and np2.content is not null))""",
            nativeQuery = true)
    boolean isCurrentProfile(UUID profileId);

    /**
     * Fiches courantes (candidats puis offres) à qui il manque un embedding pour le
     * couple modèle/version/stratégie actif — backfill des fiches déjà validées et
     * régénération après changement de modèle ou de stratégie (SPEC §8.4.10) :
     * <ul>
     *   <li>aucun job pour le couple ;</li>
     *   <li>ou un job {@code SUPERSEDED} (statut 5) <b>sans vecteur</b> pour le couple : il a été écarté
     *       quand la configuration (ou la fiche) n'était plus active, puis la configuration est
     *       redevenue active — l'unicité du couple interdit un second job, le backfill relance
     *       celui-là ({@code casRequeue}). Un vecteur déjà écrit exclut la fiche.</li>
     * </ul>
     * Jamais un job {@code PENDING}/{@code RUNNING}/{@code DONE}/{@code FAILED} : la reprise au
     * démarrage ou la relance explicite s'en charge.
     */
    @Query(value = """
            select id from (
                select np.normalized_profile_id as id, np.validated_at as validated_at
                from normalized_profile np
                join normalized_profile_candidate l on l.normalized_profile_id = np.normalized_profile_id
                where np.content is not null
                  and np.version = (select max(np2.version) from normalized_profile np2
                                    join normalized_profile_candidate l2
                                      on l2.normalized_profile_id = np2.normalized_profile_id
                                    where l2.candidate_id = l.candidate_id and np2.content is not null)
                union all
                select np.normalized_profile_id, np.validated_at
                from normalized_profile np
                join normalized_profile_job_offer o on o.normalized_profile_id = np.normalized_profile_id
                where np.content is not null
                  and np.version = (select max(np2.version) from normalized_profile np2
                                    join normalized_profile_job_offer o2
                                      on o2.normalized_profile_id = np2.normalized_profile_id
                                    where o2.job_offer_id = o.job_offer_id and np2.content is not null)
            ) current_profile
            where (not exists (select 1 from embedding_job j
                               where j.normalized_profile_id = current_profile.id
                                 and j.model_name = :modelName
                                 and j.model_version = :modelVersion
                                 and j.strategy_version = :strategyVersion)
                   or (exists (select 1 from embedding_job j
                               where j.normalized_profile_id = current_profile.id
                                 and j.model_name = :modelName
                                 and j.model_version = :modelVersion
                                 and j.strategy_version = :strategyVersion
                                 and j.status = 5)
                       and not exists (select 1 from profile_embedding pe
                                       where pe.normalized_profile_id = current_profile.id
                                         and pe.model_name = :modelName
                                         and pe.model_version = :modelVersion
                                         and pe.strategy_version = :strategyVersion)))
            order by validated_at, id
            limit :limit""", nativeQuery = true)
    List<UUID> findCurrentProfileIdsWithoutJob(String modelName, String modelVersion, String strategyVersion,
            int limit);

    /**
     * Embeddings définitivement épuisés (tableau de bord admin) : job FAILED du couple modèle / version /
     * stratégie <b>actif</b> sur une fiche encore courante (même définition que {@link #isCurrentProfile}).
     * Un échec d'un ancien modèle ou d'une fiche remplacée n'est plus une panne.
     */
    @Query(value = """
            select count(*) from embedding_job j
            where j.status = :failed
              and j.model_name = :modelName and j.model_version = :modelVersion
              and j.strategy_version = :strategyVersion
              and (exists (
                    select 1 from normalized_profile np
                    join normalized_profile_candidate l on l.normalized_profile_id = np.normalized_profile_id
                    where np.normalized_profile_id = j.normalized_profile_id
                      and np.content is not null
                      and np.version = (select max(np2.version) from normalized_profile np2
                                        join normalized_profile_candidate l2
                                          on l2.normalized_profile_id = np2.normalized_profile_id
                                        where l2.candidate_id = l.candidate_id and np2.content is not null))
                or exists (
                    select 1 from normalized_profile np
                    join normalized_profile_job_offer o on o.normalized_profile_id = np.normalized_profile_id
                    where np.normalized_profile_id = j.normalized_profile_id
                      and np.content is not null
                      and np.version = (select max(np2.version) from normalized_profile np2
                                        join normalized_profile_job_offer o2
                                          on o2.normalized_profile_id = np2.normalized_profile_id
                                        where o2.job_offer_id = o.job_offer_id and np2.content is not null)))""",
            nativeQuery = true)
    long countFailedCurrent(short failed, String modelName, String modelVersion, String strategyVersion);
}
