package com.linqorbit.candidate.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /** Contenu de la fiche courante d'un candidat (lecture en lot). */
    interface CandidateSheet {
        UUID getCandidateId();

        String getContent();
    }

    /**
     * Fiche courante (dernière version AVEC contenu) de chacun de ces candidats,
     * en une seule requête ; un candidat sans fiche exploitable est absent.
     */
    @Query(value = """
            select distinct on (npc.candidate_id) npc.candidate_id as candidateId, cast(np.content as text) as content
            from normalized_profile np
            join normalized_profile_candidate npc on npc.normalized_profile_id = np.normalized_profile_id
            where npc.candidate_id in (:candidateIds) and np.content is not null
            order by npc.candidate_id, np.version desc, np.validated_at desc""", nativeQuery = true)
    List<CandidateSheet> findCurrentSheetsByCandidateIds(@Param("candidateIds") java.util.Collection<UUID> candidateIds);

    /** Écriture du contenu canonique par le worker (profil immuable sinon). */
    @Modifying(clearAutomatically = true)
    @Query("""
            update NormalizedProfile np
            set np.content = :content, np.updatedAt = :now
            where np.id = :id""")
    int setContent(UUID id, String content, LocalDateTime now);
}
