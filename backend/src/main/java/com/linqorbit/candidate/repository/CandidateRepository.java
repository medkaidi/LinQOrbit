package com.linqorbit.candidate.repository;

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
}
