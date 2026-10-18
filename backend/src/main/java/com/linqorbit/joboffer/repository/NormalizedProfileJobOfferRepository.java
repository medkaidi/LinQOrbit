package com.linqorbit.joboffer.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.joboffer.entity.NormalizedProfileJobOffer;
import com.linqorbit.joboffer.entity.NormalizedProfileJobOfferId;

/**
 * Navigation offre → profils normalisés et jobs associés : pendant côté
 * offre de {@code NormalizedProfileRepository} côté candidat. Toutes les
 * requêtes de la normalisation d'offre vivent ici — le domaine candidat
 * reste intact.
 */
public interface NormalizedProfileJobOfferRepository
        extends JpaRepository<NormalizedProfileJobOffer, NormalizedProfileJobOfferId> {

    /** Offre propriétaire d'une version de profil (job_id ≡ normalized_profile_id). */
    @Query("""
            select npo.jobOfferId
            from NormalizedProfileJobOffer npo
            where npo.normalizedProfileId = :profileId""")
    Optional<UUID> findOfferIdByNormalizedProfileId(UUID profileId);

    @Query("""
            select max(np.version)
            from NormalizedProfile np, NormalizedProfileJobOffer npo
            where npo.normalizedProfileId = np.id and npo.jobOfferId = :offerId""")
    Integer findMaxVersionByOfferId(UUID offerId);

    @Query("""
            select max(np.validatedAt)
            from NormalizedProfile np, NormalizedProfileJobOffer npo
            where npo.normalizedProfileId = np.id and npo.jobOfferId = :offerId""")
    LocalDateTime findMaxValidatedAtByOfferId(UUID offerId);

    /** Dernière version de l'offre (order by version desc, limitée par pageable). */
    @Query("""
            select np
            from NormalizedProfile np, NormalizedProfileJobOffer npo
            where npo.normalizedProfileId = np.id and npo.jobOfferId = :offerId
            order by np.version desc""")
    List<NormalizedProfile> findLatestByOfferId(UUID offerId, Pageable pageable);

    /**
     * Fiche courante de l'offre : la dernière version AVEC contenu (référence
     * du matching, D58 — une analyse en cours ne la remplace pas).
     */
    @Query("""
            select np
            from NormalizedProfile np, NormalizedProfileJobOffer npo
            where npo.normalizedProfileId = np.id and npo.jobOfferId = :offerId
              and np.content is not null
            order by np.version desc""")
    List<NormalizedProfile> findLatestWithContentByOfferId(UUID offerId, Pageable pageable);

    /**
     * Supersede des jobs en attente d'une offre (validation postérieure) :
     * jamais exécutés, zéro coût LLM.
     */
    @Modifying(clearAutomatically = true)
    @Query("""
            update NormalizationJob j
            set j.status = :target
            where j.status = :expected
              and j.id in (select npo.normalizedProfileId
                           from NormalizedProfileJobOffer npo
                           where npo.jobOfferId = :offerId)""")
    int supersedeForOffer(UUID offerId, NormalizationJobStatus expected, NormalizationJobStatus target);

    /**
     * Statut du job de la dernière version de chaque offre (une seule
     * requête pour une liste — pas de N+1 sur les signaux d'affichage).
     * Ligne = [jobOfferId, status].
     */
    @Query("""
            select npo.jobOfferId, j.status
            from NormalizationJob j, NormalizedProfileJobOffer npo, NormalizedProfile np
            where j.id = npo.normalizedProfileId
              and np.id = npo.normalizedProfileId
              and np.version = (select max(np2.version)
                               from NormalizedProfile np2, NormalizedProfileJobOffer npo2
                               where npo2.normalizedProfileId = np2.id
                                 and npo2.jobOfferId = npo.jobOfferId)
              and npo.jobOfferId in :offerIds""")
    List<Object[]> findLatestJobStatuses(List<UUID> offerIds);
}
