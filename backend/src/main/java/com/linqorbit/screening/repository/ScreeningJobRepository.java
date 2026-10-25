package com.linqorbit.screening.repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.screening.entity.ScreeningJob;
import com.linqorbit.screening.entity.ScreeningJobStatus;

public interface ScreeningJobRepository extends JpaRepository<ScreeningJob, UUID> {

    Optional<ScreeningJob> findByOfferNormalizedProfileId(UUID offerNormalizedProfileId);

    /**
     * Création idempotente (SQL natif : {@code ON CONFLICT DO NOTHING} sur la
     * fiche d'offre). Retourne 0 si le job existe déjà — deux déclencheurs
     * concurrents ne créent jamais deux jobs.
     */
    @Modifying(clearAutomatically = true)
    @Query(value = """
            insert into screening_job
                (job_id, job_offer_id, offer_normalized_profile_id, status, attempts, next_attempt_at, created_at)
            values (:jobId, :offerId, :profileId, 1, 0, :now, :now)
            on conflict on constraint uq_screening_job_profile do nothing""", nativeQuery = true)
    int insertPendingIfAbsent(UUID jobId, UUID offerId, UUID profileId, LocalDateTime now);

    /**
     * Dernier job de l'offre qui ne soit pas supersédé : celui dont l'état est
     * affiché (un job supersédé n'a plus d'existence côté produit).
     */
    @Query("""
            select j from ScreeningJob j
            where j.jobOfferId = :offerId and j.status <> :superseded
            order by j.createdAt desc, j.id desc
            limit 1""")
    Optional<ScreeningJob> findLatestVisible(UUID offerId, ScreeningJobStatus superseded);

    /** Dernier job non supersédé de chaque offre, en une requête (signaux de liste sans N+1). */
    @Query("""
            select j from ScreeningJob j
            where j.jobOfferId in :offerIds and j.status <> :superseded
              and j.createdAt = (select max(j2.createdAt) from ScreeningJob j2
                                 where j2.jobOfferId = j.jobOfferId and j2.status <> :superseded)""")
    List<ScreeningJob> findLatestVisibleByOfferIds(Collection<UUID> offerIds, ScreeningJobStatus superseded);

    /**
     * Tableau de bord recruteur : offres ouvertes de ces sociétés dont le dernier job visible (celui
     * du signal de la liste, {@link #findLatestVisibleByOfferIds}) est {@code failed}.
     */
    @Query("""
            select count(j) from ScreeningJob j, JobOffer o
            where j.jobOfferId = o.id
              and o.companyId in :companyIds
              and o.status = :published
              and (o.expiresAt is null or o.expiresAt >= :today)
              and j.status = :failed
              and j.createdAt = (select max(j2.createdAt) from ScreeningJob j2
                                 where j2.jobOfferId = j.jobOfferId and j2.status <> :superseded)""")
    long countLatestFailedOnOpenOffers(Collection<UUID> companyIds, JobOfferStatus published, LocalDate today,
            ScreeningJobStatus failed, ScreeningJobStatus superseded);

    boolean existsByJobOfferIdAndStatus(UUID jobOfferId, ScreeningJobStatus status);

    /** Claim atomique PENDING → RUNNING : un seul vainqueur, même multi-instances. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update ScreeningJob j
            set j.status = :target, j.startedAt = :now
            where j.id = :jobId and j.status = :expected""")
    int casStatus(UUID jobId, ScreeningJobStatus expected, ScreeningJobStatus target, LocalDateTime now);

    /** RUNNING → DONE : lignes offer_candidate écrites dans la même transaction. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update ScreeningJob j
            set j.status = :target, j.completedAt = :now, j.candidateCount = :candidateCount, j.error = null
            where j.id = :jobId and j.status = :expected""")
    int casDone(UUID jobId, ScreeningJobStatus expected, ScreeningJobStatus target, int candidateCount,
            LocalDateTime now);

    /** → SUPERSEDED : fiche plus courante ou offre plus publiée, aucun calcul. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update ScreeningJob j
            set j.status = :target, j.completedAt = :now
            where j.id = :jobId and j.status = :expected""")
    int casSupersede(UUID jobId, ScreeningJobStatus expected, ScreeningJobStatus target, LocalDateTime now);

    /** RUNNING → PENDING sans tentative consommée : le vecteur de l'offre n'existe pas encore. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update ScreeningJob j
            set j.status = :target
            where j.id = :jobId and j.status = :expected""")
    int casWait(UUID jobId, ScreeningJobStatus expected, ScreeningJobStatus target);

    /** RUNNING → PENDING : nouvelle tentative planifiée, erreur conservée. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update ScreeningJob j
            set j.status = :target, j.attempts = :attempts, j.nextAttemptAt = :nextAttemptAt, j.error = :error
            where j.id = :jobId and j.status = :expected""")
    int casRetry(UUID jobId, ScreeningJobStatus expected, ScreeningJobStatus target,
            int attempts, LocalDateTime nextAttemptAt, String error);

    /** RUNNING → FAILED : plus de tentative. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update ScreeningJob j
            set j.status = :target, j.attempts = :attempts, j.completedAt = :now, j.error = :error
            where j.id = :jobId and j.status = :expected""")
    int casFail(UUID jobId, ScreeningJobStatus expected, ScreeningJobStatus target,
            int attempts, LocalDateTime now, String error);

    /** FAILED → PENDING : relance explicite, tentatives remises à zéro (jamais une 2ᵉ ligne). */
    @Modifying(clearAutomatically = true)
    @Query("""
            update ScreeningJob j
            set j.status = :target, j.attempts = 0, j.nextAttemptAt = :now, j.error = null,
                j.startedAt = null, j.completedAt = null
            where j.id = :jobId and j.status = :expected""")
    int casRequeue(UUID jobId, ScreeningJobStatus expected, ScreeningJobStatus target, LocalDateTime now);

    /** Jobs encore en attente d'une offre, supersédés quand une autre fiche d'offre devient courante. */
    @Modifying(clearAutomatically = true)
    @Query("""
            update ScreeningJob j
            set j.status = :target, j.completedAt = :now
            where j.jobOfferId = :offerId and j.offerNormalizedProfileId <> :currentProfileId
              and j.status = :expected""")
    int supersedeOtherJobs(UUID offerId, UUID currentProfileId, ScreeningJobStatus expected,
            ScreeningJobStatus target, LocalDateTime now);

    List<ScreeningJob> findByStatus(ScreeningJobStatus status);

    /** Jobs RUNNING dont le worker est probablement mort (redémarrage pendant le calcul). */
    @Query("""
            select j from ScreeningJob j
            where j.status = :status and j.startedAt <= :threshold""")
    List<ScreeningJob> findByStatusAndStartedAtLessThanEqual(ScreeningJobStatus status, LocalDateTime threshold);

    /**
     * Screenings définitivement épuisés (tableau de bord admin) : job FAILED sur la fiche d'offre encore
     * courante (dernière version avec contenu). Un job sur une fiche remplacée n'est plus une panne.
     */
    @Query(value = """
            select count(*) from screening_job j
            where j.status = :failed
              and exists (
                    select 1 from normalized_profile np
                    join normalized_profile_job_offer o on o.normalized_profile_id = np.normalized_profile_id
                    where np.normalized_profile_id = j.offer_normalized_profile_id
                      and np.content is not null
                      and np.version = (select max(np2.version) from normalized_profile np2
                                        join normalized_profile_job_offer o2
                                          on o2.normalized_profile_id = np2.normalized_profile_id
                                        where o2.job_offer_id = o.job_offer_id and np2.content is not null))""",
            nativeQuery = true)
    long countFailedCurrent(short failed);
}
