package com.linqorbit.embedding.repository;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.embedding.entity.ProfileEmbedding;

public interface ProfileEmbeddingRepository extends JpaRepository<ProfileEmbedding, UUID> {

    boolean existsByNormalizedProfileIdAndModelNameAndModelVersionAndStrategyVersion(
            UUID normalizedProfileId, String modelName, String modelVersion, String strategyVersion);

    /**
     * Écriture idempotente d'un vecteur (SQL natif : la colonne vector n'est
     * pas mappée). {@code vector} est le littéral pgvector {@code [a,b,…]}.
     * Retourne 0 si le couple existe déjà — l'ancien vecteur est conservé.
     */
    @Modifying(clearAutomatically = true)
    @Query(value = """
            insert into profile_embedding
                (id, normalized_profile_id, embedding, model_name, model_version, strategy_version, created_at)
            values (:id, :profileId, cast(:vector as vector), :modelName, :modelVersion, :strategyVersion, :now)
            on conflict on constraint uq_profile_embedding_version do nothing""", nativeQuery = true)
    int insertIfAbsent(UUID id, UUID profileId, String vector, String modelName, String modelVersion,
            String strategyVersion, LocalDateTime now);
}
