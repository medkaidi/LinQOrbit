package com.linqorbit.candidate.repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import com.linqorbit.candidate.entity.Candidate;

public interface CandidateRepository extends JpaRepository<Candidate, UUID> {

    /**
     * Lecture verrouillée (SELECT … FOR UPDATE) : sérialise les tx de
     * validation de normalisation d'un même candidat (numérotation des
     * versions, dirty-check, supersede) sans colonne de version optimiste.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Candidate c where c.id = :id")
    Optional<Candidate> findByIdForUpdate(UUID id);

    /**
     * Pointeur de CV courant — UPDATE bulk volontaire : passer par un save
     * d'entité bumperait updated_at (@UpdateTimestamp) et salirait le profil.
     * flushAutomatically : la pièce jointe créée dans la même tx existe avant
     * la FK ; clearAutomatically : l'entité en contexte ne porte pas l'ancienne
     * valeur. Retourne le nombre de lignes mises à jour (0 = ligne absente).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Candidate c set c.currentCvAttachmentId = :attachmentId where c.id = :candidateId")
    int updateCurrentCvAttachmentId(@Param("candidateId") UUID candidateId,
            @Param("attachmentId") UUID attachmentId);

    /**
     * Consentement à la visibilité recruteur (T-102, D86) — UPDATE bulk pour la
     * même raison que le CV courant : ne jamais bumper updated_at. Date et
     * version sont posées ensemble ou retirées ensemble (CHECK V30).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Candidate c
            set c.recruiterVisibilityConsentAt = :consentedAt, c.recruiterVisibilityConsentVersion = :version
            where c.id = :candidateId""")
    int updateRecruiterVisibilityConsent(@Param("candidateId") UUID candidateId,
            @Param("consentedAt") LocalDateTime consentedAt, @Param("version") Short version);

    /**
     * Parmi ces candidats, ceux qu'un recruteur a le droit de voir (T-101/T-102, D85/D86/D98) :
     * <b>consentement en cours ET recherche active</b> — le statut {@code excludedSearchStatus}
     * ({@code not_looking}) masque, un statut jamais renseigné ({@code NULL}) reste visible,
     * comme au screening. Règle unique relue à chaque lecture, jamais mise en cache : le Top N est
     * un instantané, la visibilité est le présent. Les ids sont non vides (l'appelant garde le cas).
     */
    @Query(value = """
            select c.id from candidates c
            where c.id in :ids
              and c.recruiter_visibility_consent_at is not null
              and c.search_status is distinct from :excludedSearchStatus""", nativeQuery = true)
    List<UUID> findIdsVisibleToRecruiters(@Param("ids") Collection<UUID> ids,
            @Param("excludedSearchStatus") int excludedSearchStatus);

    /** Même règle de visibilité que {@link #findIdsVisibleToRecruiters}, pour un seul candidat. */
    @Query(value = """
            select exists (select 1 from candidates c
                           where c.id = :id
                             and c.recruiter_visibility_consent_at is not null
                             and c.search_status is distinct from :excludedSearchStatus)""", nativeQuery = true)
    boolean existsVisibleToRecruiters(@Param("id") UUID id, @Param("excludedSearchStatus") int excludedSearchStatus);
}
