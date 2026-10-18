package com.linqorbit.candidate.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.candidate.entity.NormalizedProfile;

public interface NormalizedProfileRepository extends JpaRepository<NormalizedProfile, UUID> {

    @Query("""
            select max(np.version)
            from NormalizedProfile np, NormalizedProfileCandidate npc
            where npc.normalizedProfileId = np.id and npc.candidateId = :candidateId""")
    Integer findMaxVersionByCandidateId(UUID candidateId);

    @Query("""
            select max(np.validatedAt)
            from NormalizedProfile np, NormalizedProfileCandidate npc
            where npc.normalizedProfileId = np.id and npc.candidateId = :candidateId""")
    LocalDateTime findMaxValidatedAtByCandidateId(UUID candidateId);

    /** Dernière version du candidat (order by version desc, limitée par pageable). */
    @Query("""
            select np
            from NormalizedProfile np, NormalizedProfileCandidate npc
            where npc.normalizedProfileId = np.id and npc.candidateId = :candidateId
            order by np.version desc""")
    List<NormalizedProfile> findLatestByCandidateId(UUID candidateId, Pageable pageable);

    /**
     * Version courante du candidat (Q5) : la dernière version AVEC contenu —
     * une analyse en cours ou échouée ne remplace jamais la fiche de
     * référence (matching D50 : identité = cette version).
     */
    @Query("""
            select np
            from NormalizedProfile np, NormalizedProfileCandidate npc
            where npc.normalizedProfileId = np.id and npc.candidateId = :candidateId
              and np.content is not null
            order by np.version desc""")
    List<NormalizedProfile> findLatestWithContentByCandidateId(UUID candidateId, Pageable pageable);

    /** Écriture du contenu canonique par le worker (profil immuable sinon). */
    @Modifying(clearAutomatically = true)
    @Query("""
            update NormalizedProfile np
            set np.content = :content, np.updatedAt = :now
            where np.id = :id""")
    int setContent(UUID id, String content, LocalDateTime now);
}
