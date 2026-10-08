package com.linqorbit.candidate.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.candidate.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizationJob;

public interface NormalizationJobRepository extends JpaRepository<NormalizationJob, UUID> {

    /**
     * Claim atomique : ne passe en RUNNING que si le job est encore PENDING
     * (sûr même avec plusieurs instances du worker). Retourne le nombre de
     * lignes mises à jour (0 = quelqu'un d'autre l'a réclamé).
     */
    @Modifying(clearAutomatically = true)
    @Query("""
            update NormalizationJob j
            set j.status = :target, j.startedAt = :now
            where j.id = :jobId and j.status = :expected""")
    int casStatus(UUID jobId, NormalizationJobStatus expected, NormalizationJobStatus target, LocalDateTime now);

    /**
     * Supersede des jobs en attente d'un candidat (validation postérieure) :
     * jamais exécutés, zéro coût LLM. Le job porte la liaison au profil, qui
     * porte l'association vers le candidat — pas de FK directe nécessaire.
     */
    @Modifying(clearAutomatically = true)
    @Query("""
            update NormalizationJob j
            set j.status = :target
            where j.status = :expected
              and j.id in (select npc.normalizedProfileId
                           from NormalizedProfileCandidate npc
                           where npc.candidateId = :candidateId)""")
    int supersedeForCandidate(UUID candidateId, NormalizationJobStatus expected, NormalizationJobStatus target);

    @Query("""
            select j from NormalizationJob j
            where j.status = :status and j.nextAttemptAt <= :now
            order by j.createdAt""")
    List<NormalizationJob> findByStatusAndNextAttemptAtLessThanEqual(NormalizationJobStatus status,
            LocalDateTime now, Pageable pageable);

    /** Jobs RUNNING dont le worker est probablement mort (redémarrage pendant l'appel IA). */
    @Query("""
            select j from NormalizationJob j
            where j.status = :status and j.startedAt <= :threshold""")
    List<NormalizationJob> findByStatusAndStartedAtLessThanEqual(NormalizationJobStatus status,
            LocalDateTime threshold);

    /** RUNNING → DONE : succès de l'analise IA (contenu écrit dans la même tx). */
    @Modifying(clearAutomatically = true)
    @Query("""
            update NormalizationJob j
            set j.status = :target, j.completedAt = :now, j.error = null
            where j.id = :jobId and j.status = :expected""")
    int casDone(UUID jobId, NormalizationJobStatus expected, NormalizationJobStatus target, LocalDateTime now);

    /** RUNNING → PENDING : nouvelle tentative planifiée (backoff), erreur conservée. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update NormalizationJob j
            set j.status = :target, j.attempts = :attempts, j.nextAttemptAt = :nextAttemptAt, j.error = :error
            where j.id = :jobId and j.status = :expected""")
    int casRetry(UUID jobId, NormalizationJobStatus expected, NormalizationJobStatus target,
            int attempts, LocalDateTime nextAttemptAt, String error);

    /** RUNNING → FAILED : plus de tentative, le candidat peut relancer manuellement. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update NormalizationJob j
            set j.status = :target, j.attempts = :attempts, j.completedAt = :now, j.error = :error
            where j.id = :jobId and j.status = :expected""")
    int casFail(UUID jobId, NormalizationJobStatus expected, NormalizationJobStatus target,
            int attempts, LocalDateTime now, String error);
}
