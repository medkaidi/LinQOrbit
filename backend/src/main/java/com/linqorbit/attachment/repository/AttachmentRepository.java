package com.linqorbit.attachment.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.attachment.entity.Attachment;

public interface AttachmentRepository extends JpaRepository<Attachment, UUID> {

    /** Historique du candidat : CV les plus récents d'abord, ordre stable. */
    List<Attachment> findByCandidateIdOrderByCreatedAtDescIdDesc(UUID candidateId);

    /** Contrôle propriétaire : l'identifiant d'un autre candidat est introuvable. */
    Optional<Attachment> findByIdAndCandidateId(UUID id, UUID candidateId);

    boolean existsByIdAndCandidateId(UUID id, UUID candidateId);
}
