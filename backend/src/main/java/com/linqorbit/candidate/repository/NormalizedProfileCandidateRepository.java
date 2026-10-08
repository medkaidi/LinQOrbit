package com.linqorbit.candidate.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.candidate.entity.NormalizedProfileCandidate;
import com.linqorbit.candidate.entity.NormalizedProfileCandidateId;

public interface NormalizedProfileCandidateRepository
        extends JpaRepository<NormalizedProfileCandidate, NormalizedProfileCandidateId> {

    /** Candidat propriétaire d'une version de profil (job_id ≡ normalized_profile_id). */
    @Query("""
            select npc.candidateId
            from NormalizedProfileCandidate npc
            where npc.normalizedProfileId = :profileId""")
    Optional<UUID> findCandidateIdByNormalizedProfileId(UUID profileId);
}
