package com.linqorbit.matching.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.matching.entity.MatchingJob;
import com.linqorbit.matching.entity.MatchingJobStatus;

/**
 * Transitions des jobs de matching, miroir de {@code NormalizationJobRepository} :
 * toutes en CAS {@code WHERE status = :expected} (sûr multi-instances).
 */
public interface MatchingJobRepository extends JpaRepository<MatchingJob, UUID> {

    /** Claim atomique PENDING → RUNNING ; 0 = déjà réclamé ou terminal. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update MatchingJob j
            set j.status = :target, j.startedAt = :now
            where j.id = :jobId and j.status = :expected""")
    int casStatus(UUID jobId, MatchingJobStatus expected, MatchingJobStatus target, LocalDateTime now);

    /**
     * Statut relu en base (requête scalaire : jamais l'entité déjà chargée dans le
     * contexte de persistance) — abonnement SSE, D60.
     */
    @Query("select j.status from MatchingJob j where j.id = :jobId")
    Optional<MatchingJobStatus> findStatusById(UUID jobId);

    /** Tous les jobs d'un statut (recovery au démarrage). */
    List<MatchingJob> findByStatus(MatchingJobStatus status);

    /** Jobs RUNNING dont le worker est probablement mort. */
    @Query("""
            select j from MatchingJob j
            where j.status = :status and j.startedAt <= :threshold""")
    List<MatchingJob> findByStatusAndStartedAtLessThanEqual(MatchingJobStatus status, LocalDateTime threshold);

    /** RUNNING → DONE : résultat écrit dans la même tx. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update MatchingJob j
            set j.status = :target, j.completedAt = :now, j.error = null
            where j.id = :jobId and j.status = :expected""")
    int casDone(UUID jobId, MatchingJobStatus expected, MatchingJobStatus target, LocalDateTime now);

    /** RUNNING → PENDING : nouvel essai planifié, erreur conservée. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update MatchingJob j
            set j.status = :target, j.attempts = :attempts, j.nextAttemptAt = :nextAttemptAt, j.error = :error
            where j.id = :jobId and j.status = :expected""")
    int casRetry(UUID jobId, MatchingJobStatus expected, MatchingJobStatus target,
            int attempts, LocalDateTime nextAttemptAt, String error);

    /** RUNNING → FAILED : plus d'essai, le candidat peut relancer (nouvelle version). */
    @Modifying(clearAutomatically = true)
    @Query("""
            update MatchingJob j
            set j.status = :target, j.attempts = :attempts, j.completedAt = :now, j.error = :error
            where j.id = :jobId and j.status = :expected""")
    int casFail(UUID jobId, MatchingJobStatus expected, MatchingJobStatus target,
            int attempts, LocalDateTime now, String error);

    /**
     * Analyses de matching définitivement épuisées (tableau de bord admin) : un job FAILED compte
     * seulement s'il porte la dernière version de son matching — une relance crée une version
     * suivante, qui remplace l'échec.
     */
    @Query(value = """
            select count(*) from matching_job j
            join matching_result r on r.id = j.job_id
            where j.status = :failed
              and r.version = (select max(r2.version) from matching_result r2
                               where r2.matching_id = r.matching_id)""", nativeQuery = true)
    long countFailedLatest(short failed);
}
