package com.linqorbit.embedding.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.linqorbit.embedding.entity.EmbeddingJob;
import com.linqorbit.embedding.repository.EmbeddingJobRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Création des jobs d'embedding et soumission au {@link EmbeddingWorker}.
 *
 * <p>Deux entrées : la fin d'une normalisation ({@link #enqueueAndDispatch},
 * appelée par {@code NormalizationWorker} après la tx {@code content + DONE})
 * et le backfill des fiches courantes qui n'ont pas de job pour le couple
 * actif ({@link #backfillMissingJobs}, SPEC §8.4.10 : profils déjà validés,
 * changement de modèle ou de stratégie). La création est idempotente
 * ({@code ON CONFLICT DO NOTHING} sur fiche × modèle × stratégie).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmbeddingService {

    private final EmbeddingJobRepository embeddingJobRepository;
    private final EmbeddingSettings settings;
    private final EmbeddingWorker embeddingWorker;
    private final TransactionTemplate transactionTemplate;
    @Value("${app.embedding.backfill-batch-size}")
    private final int backfillBatchSize;
    @Value("${app.embedding.backfill-on-boot}")
    private final boolean backfillOnBoot;

    /**
     * Seul « filet » du système, comme {@code NormalizationWorker.recoverOrphanJobs} :
     * reprise des jobs orphelins, puis — seulement si
     * {@code app.embedding.backfill-on-boot} est vrai — création des jobs
     * manquants. Aucun scan en fonctionnement.
     */
    @EventListener(ApplicationReadyEvent.class)
    void onStartup() {
        try {
            embeddingWorker.recoverOrphanJobs();
            if (backfillOnBoot) {
                backfillMissingJobs();
            }
        } catch (Exception ex) {
            log.error("Embedding boot recovery failed", ex);
        }
    }

    /**
     * Crée (si absent) puis soumet le job de la fiche qui vient d'être
     * normalisée. <b>Ne propage jamais d'erreur</b> : une panne d'embedding ne
     * doit ni faire échouer ni rejouer une normalisation valide ; le
     * backfill au démarrage recrée tout job manquant.
     */
    public void enqueueAndDispatch(UUID profileId) {
        try {
            UUID jobId = enqueue(profileId);
            if (jobId != null) {
                embeddingWorker.dispatch(jobId);
            }
        } catch (Exception ex) {
            log.error("Embedding job enqueue failed : profileId={} — the boot backfill will recreate it",
                    profileId, ex);
        }
    }

    /**
     * Backfill : un job PENDING pour chaque fiche courante (candidats et
     * offres) sans job pour le couple actif, par lots, puis soumission.
     * Retourne le nombre de jobs créés. Les lots suivent la requête « sans
     * job » : elle se vide d'elle-même, la boucle s'arrête quand plus rien ne
     * manque (ou si aucun job n'a pu être créé, p. ex. course perdue).
     */
    public int backfillMissingJobs() {
        int created = 0;
        while (true) {
            List<UUID> missing = embeddingJobRepository.findCurrentProfileIdsWithoutJob(
                    settings.getModelName(), settings.getModelVersion(), settings.getStrategyVersion(),
                    backfillBatchSize);
            int createdInBatch = 0;
            for (UUID profileId : missing) {
                UUID jobId = enqueue(profileId);
                if (jobId != null) {
                    createdInBatch++;
                    embeddingWorker.dispatch(jobId);
                }
            }
            created += createdInBatch;
            if (missing.isEmpty() || createdInBatch == 0) {
                break;
            }
        }
        if (created > 0) {
            log.info("Embedding backfill : {} job(s) created", created);
        }
        return created;
    }

    /** Insère le job PENDING du couple actif et renvoie son id (existant ou nouveau). */
    private UUID enqueue(UUID profileId) {
        return transactionTemplate.execute(status -> {
            embeddingJobRepository.insertPendingIfAbsent(UUID.randomUUID(), profileId,
                    settings.getModelName(), settings.getModelVersion(), settings.getStrategyVersion(),
                    LocalDateTime.now());
            return embeddingJobRepository
                    .findByNormalizedProfileIdAndModelNameAndModelVersionAndStrategyVersion(profileId,
                            settings.getModelName(), settings.getModelVersion(), settings.getStrategyVersion())
                    .map(EmbeddingJob::getId)
                    .orElse(null);
        });
    }
}
