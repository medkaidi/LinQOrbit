package com.linqorbit.embedding.service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.linqorbit.candidate.entity.NormalizationSourceType;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.repository.NormalizedProfileCandidateRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.common.logging.RequestLoggingFilter;
import com.linqorbit.embedding.client.EmbedClient;
import com.linqorbit.embedding.dto.EmbedResponse;
import com.linqorbit.embedding.entity.EmbeddingJob;
import com.linqorbit.embedding.entity.EmbeddingJobStatus;
import com.linqorbit.embedding.exception.EmbeddingNotRenderableException;
import com.linqorbit.embedding.repository.EmbeddingJobRepository;
import com.linqorbit.embedding.repository.ProfileEmbeddingRepository;
import com.linqorbit.screening.service.ScreeningJobService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Exécution asynchrone des jobs d'embedding, miroir de
 * {@code NormalizationWorker} : poussée après la normalisation (aucun
 * polling), pool et scheduler dédiés, claim par CAS {@code PENDING→RUNNING}
 * (un job n'est exécuté qu'une fois), appel au service IA <b>hors
 * transaction</b>, écriture du vecteur et {@code DONE} en <b>une</b> tx.
 *
 * <p>Avant tout appel : un job dont la configuration (modèle, version,
 * stratégie) n'est plus la configuration active, ou dont la fiche n'est plus
 * la fiche courante de sa source, passe {@code SUPERSEDED} <b>sans appel au
 * fournisseur</b> (le quota du palier gratuit n'est jamais dépensé pour un
 * vecteur que le screening ne sélectionnerait pas).</p>
 *
 * <p>Échecs : {@code attempts} compte les échecs cumulés, 3 exécutions au
 * total puis {@code FAILED} ; un 429 de quota diffère le retry
 * ({@code quota-retry-delay-seconds}) ; une fiche non représentable échoue
 * tout de suite (déterministe). Un {@code FAILED} est relancé au prochain
 * démarrage ({@link #recoverOrphanJobs}) s'il est du couple actif et a épuisé ses
 * 3 exécutions — jamais un échec définitif de rendu. Le modèle déclaré par le service
 * IA doit être le modèle actif et la dimension celle de la colonne : sinon
 * échec, aucun vecteur mal étiqueté n'est écrit.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmbeddingWorker {

    /** Exécutions totales autorisées par job : initiale + 2 retries. */
    static final int MAX_ATTEMPTS = 3;
    /** Un RUNNING plus vieux que ce seuil est considéré orphelin (worker mort). */
    static final int STALE_RUNNING_MINUTES = 10;
    /** Taille max de la colonne embedding_job.error. */
    private static final int ERROR_MAX_LENGTH = 500;

    @Qualifier("embeddingExecutor")
    private final ThreadPoolTaskExecutor embeddingExecutor;
    @Qualifier("embeddingTaskScheduler")
    private final TaskScheduler embeddingTaskScheduler;
    private final TransactionTemplate transactionTemplate;
    private final EmbeddingJobRepository embeddingJobRepository;
    private final ProfileEmbeddingRepository profileEmbeddingRepository;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final NormalizedProfileCandidateRepository normalizedProfileCandidateRepository;
    private final ProfileTextRenderer profileTextRenderer;
    private final EmbedClient embedClient;
    private final EmbeddingSettings settings;
    private final ScreeningJobService screeningJobService;
    @Value("${app.embedding.retry-delay-seconds}")
    private final int retryDelaySeconds;
    @Value("${app.embedding.quota-retry-delay-seconds}")
    private final int quotaRetryDelaySeconds;
    @Value("${app.embedding.min-interval-ms}")
    private final long minIntervalMs;

    /**
     * Récupération au démarrage : RUNNING périmés → replanifiés ; PENDING dûs →
     * exécutés, non échus → planifiés à leur échéance ; FAILED du <b>couple actif</b> →
     * relancés (tentatives remises à zéro). Un FAILED d'un autre couple est
     * structurellement mort (il passerait SUPERSEDED à la première exécution) : jamais
     * relancé. Les DONE et SUPERSEDED ne sont jamais touchés.
     */
    void recoverOrphanJobs() {
        recover(job -> true, settings::isActive);
    }

    /**
     * Même récupération, bornée aux jobs d'un seul couple modèle / version / stratégie :
     * les tests d'intégration partagent la base de dev, ils ne doivent jamais modifier
     * une ligne qu'ils n'ont pas créée.
     */
    void recoverOrphanJobs(String modelName, String modelVersion, String strategyVersion) {
        Predicate<EmbeddingJob> pair = job -> modelName.equals(job.getModelName())
                && modelVersion.equals(job.getModelVersion())
                && strategyVersion.equals(job.getStrategyVersion());
        recover(pair, pair);
    }

    private void recover(Predicate<EmbeddingJob> inScope, Predicate<EmbeddingJob> failedInScope) {
        Set<UUID> handled = new HashSet<>();
        LocalDateTime now = LocalDateTime.now();
        List<EmbeddingJob> stale = embeddingJobRepository.findByStatusAndStartedAtLessThanEqual(
                EmbeddingJobStatus.RUNNING, now.minusMinutes(STALE_RUNNING_MINUTES)).stream()
                .filter(inScope).toList();
        for (EmbeddingJob job : stale) {
            log.warn("Recovering stale RUNNING embedding job : jobId={}, startedAt={}", job.getId(),
                    job.getStartedAt());
            retryOrFail(job, "Worker presumed dead before completion", false);
            handled.add(job.getId());
        }
        for (EmbeddingJob job : embeddingJobRepository.findByStatus(EmbeddingJobStatus.PENDING)) {
            if (handled.contains(job.getId()) || !inScope.test(job)) {
                continue;
            }
            if (job.getNextAttemptAt().isAfter(now)) {
                scheduleAt(job.getId(), job.getNextAttemptAt());
            } else {
                dispatch(job.getId());
            }
        }
        for (EmbeddingJob job : embeddingJobRepository.findByStatus(EmbeddingJobStatus.FAILED)) {
            if (!failedInScope.test(job) || !isRetryableFailure(job)) {
                continue;
            }
            int requeued = transactionTemplate.execute(status -> embeddingJobRepository.casRequeue(job.getId(),
                    EmbeddingJobStatus.FAILED, EmbeddingJobStatus.PENDING, LocalDateTime.now()));
            if (requeued == 1) {
                log.info("Requeued failed embedding job : jobId={}", job.getId());
                dispatch(job.getId());
            }
        }
    }

    /**
     * Un {@code FAILED} n'est relancé au démarrage que s'il vient d'un fournisseur
     * épuisé. Un échec de rendu est déterministe : rejouer ne change rien. Sous
     * {@link #MAX_ATTEMPTS} c'est donc un échec définitif ; au-delà, le compteur ne
     * distingue plus un fournisseur épuisé d'un rendu raté après des échecs
     * techniques, alors la fiche est rendue de nouveau (local, aucun appel au
     * fournisseur) : non représentable, le job reste {@code FAILED}.
     */
    private boolean isRetryableFailure(EmbeddingJob job) {
        if (job.getAttempts() < MAX_ATTEMPTS) {
            return false;
        }
        try {
            NormalizedProfile profile = normalizedProfileRepository.findById(job.getNormalizedProfileId())
                    .orElseThrow(() -> new IllegalStateException("Job without normalized profile"));
            profileTextRenderer.render(profile.getContent(), sourceOf(profile));
            return true;
        } catch (EmbeddingNotRenderableException ex) {
            log.info("Failed embedding job not requeued, its fiche is not renderable : jobId={}", job.getId());
            return false;
        } catch (RuntimeException ex) {
            log.error("Failed embedding job not requeued, its fiche could not be checked : jobId={}",
                    job.getId(), ex);
            return false;
        }
    }

    /**
     * Soumet l'exécution au pool ; si la soumission échoue (queue saturée),
     * planifie une re-soumission — le job reste PENDING, jamais invisible.
     */
    void dispatch(UUID jobId) {
        try {
            embeddingExecutor.execute(() -> executeJob(jobId));
        } catch (RuntimeException ex) {
            log.error("Embedding job submission failed, scheduling a re-submission : jobId={}", jobId, ex);
            scheduleAt(jobId, LocalDateTime.now().plusSeconds(retryDelaySeconds));
        }
    }

    /** One-shot à l'échéance : le scheduler ne fait que soumettre au pool dédié. */
    private void scheduleAt(UUID jobId, LocalDateTime at) {
        try {
            embeddingTaskScheduler.schedule(() -> dispatch(jobId), instantOf(at));
        } catch (RuntimeException ex) {
            log.error("Embedding scheduling failed : jobId={} — job stays PENDING, boot recovery will "
                    + "pick it up", jobId, ex);
        }
    }

    /** Claim CAS puis exécution : appel IA hors tx, fin de vie en txs courtes. */
    void executeJob(UUID jobId) {
        EmbeddingJob job;
        try {
            job = claim(jobId);
        } catch (RuntimeException ex) {
            // Panne avant un CAS abouti (base indisponible…) : le job reste PENDING, une re-soumission
            // one-shot le reprend sans attendre le prochain démarrage ; le CAS garde l'exclusivité.
            log.error("Embedding claim failed, scheduling a re-submission : jobId={}", jobId, ex);
            scheduleAt(jobId, LocalDateTime.now().plusSeconds(retryDelaySeconds));
            return;
        }
        if (job == null) {
            return;
        }
        AtomicBoolean providerCalled = new AtomicBoolean();
        try {
            MDC.put(RequestLoggingFilter.CORRELATION_ID, jobId.toString());
            try {
                run(job, providerCalled);
            } catch (EmbeddingNotRenderableException ex) {
                log.warn("Embedding job not renderable : jobId={}, detail={}", job.getId(), ex.getMessage());
                fail(job, ex.getMessage());
            } catch (AiServiceException ex) {
                log.warn("Embedding failed : jobId={}, status={}, detail={}", job.getId(), ex.getStatus(),
                        ex.getMessage());
                retryOrFail(job, ex.getMessage(), ex.getStatus() == HttpStatus.TOO_MANY_REQUESTS);
            } catch (Exception ex) {
                log.error("Embedding unexpected error : jobId={}", job.getId(), ex);
                retryOrFail(job, "Unexpected error during embedding", false);
            } finally {
                MDC.remove(RequestLoggingFilter.CORRELATION_ID);
            }
        } catch (Exception ex) {
            // La transition post-appel elle-même a échoué (base indisponible) : le job reste RUNNING, le
            // recovery des RUNNING périmés le reprendra ; rien ne sort de l'exécution.
            log.error("Embedding job execution failed unexpectedly : jobId={}", jobId, ex);
        } finally {
            // Dès que le fournisseur a été appelé, quelle que soit la suite (réponse refusée, écriture ou
            // transition de retry en échec…), le débit reste borné avant le job suivant ; jamais sans appel
            // (claim raté, rendu impossible, SUPERSEDED).
            if (providerCalled.get()) {
                pauseBeforeNextCall();
            }
        }
    }

    /** Tx courte : CAS PENDING→RUNNING, un seul vainqueur ; null si inéxécutable. */
    private EmbeddingJob claim(UUID jobId) {
        return transactionTemplate.execute(status -> {
            int claimed = embeddingJobRepository.casStatus(jobId, EmbeddingJobStatus.PENDING,
                    EmbeddingJobStatus.RUNNING, LocalDateTime.now());
            if (claimed != 1) {
                log.debug("Embedding job not claimable (done, failed, superseded or taken) : jobId={}", jobId);
                return null;
            }
            return embeddingJobRepository.findById(jobId).orElse(null);
        });
    }

    /** Lève {@code providerCalled} juste avant l'appel au fournisseur (le débit est alors temporisé). */
    private void run(EmbeddingJob job, AtomicBoolean providerCalled) {
        if (!settings.isActive(job)) {
            supersede(job, "configuration no longer active");
            return;
        }
        if (!embeddingJobRepository.isCurrentProfile(job.getNormalizedProfileId())) {
            supersede(job, "profile no longer current");
            return;
        }
        NormalizedProfile profile = normalizedProfileRepository.findById(job.getNormalizedProfileId())
                .orElseThrow(() -> new IllegalStateException("Job without normalized profile"));
        NormalizationSourceType source = sourceOf(profile);
        String text = profileTextRenderer.render(profile.getContent(), source);

        providerCalled.set(true);
        EmbedResponse response = embedClient.embed(List.of(text));
        String vector = toVectorLiteral(requireVector(response));

        LocalDateTime now = LocalDateTime.now();
        transactionTemplate.executeWithoutResult(status -> {
            profileEmbeddingRepository.insertIfAbsent(UUID.randomUUID(), job.getNormalizedProfileId(), vector,
                    job.getModelName(), job.getModelVersion(), job.getStrategyVersion(), now);
            int done = embeddingJobRepository.casDone(job.getId(), EmbeddingJobStatus.RUNNING,
                    EmbeddingJobStatus.DONE, now);
            if (done != 1) {
                log.warn("Embedding job finished but no longer RUNNING : jobId={}", job.getId());
            }
        });
        log.info("Embedding done : jobId={}, profileId={}, source={}", job.getId(),
                job.getNormalizedProfileId(), source);
        if (source == NormalizationSourceType.OFFER) {
            // T-101 : le vecteur de l'offre débloque (ou crée) sa recherche de candidats. N'échoue jamais.
            screeningJobService.onOfferEmbeddingDone(job.getNormalizedProfileId());
        }
    }

    /** Source de la fiche : liée à un candidat, sinon une offre. */
    private NormalizationSourceType sourceOf(NormalizedProfile profile) {
        return normalizedProfileCandidateRepository.findCandidateIdByNormalizedProfileId(profile.getId())
                .isPresent() ? NormalizationSourceType.CANDIDATE : NormalizationSourceType.OFFER;
    }

    /**
     * Le service IA doit avoir appelé le modèle actif, déclaré la dimension de la
     * colonne et renvoyé exactement un vecteur de cette longueur, sans valeur non
     * finie et de norme non nulle (métadonnée et longueur réelle sont vérifiées
     * toutes deux) : sinon
     * échec courant (retry puis {@code FAILED}), jamais un vecteur mal étiqueté.
     */
    private float[] requireVector(EmbedResponse response) {
        if (!settings.getModelName().equals(response.model())) {
            throw new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service embedded with model "
                    + response.model() + ", expected " + settings.getModelName() + ".");
        }
        if (response.dimensions() != EmbeddingSettings.DIMENSIONS) {
            throw new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service declared "
                    + response.dimensions() + " embedding dimensions, expected "
                    + EmbeddingSettings.DIMENSIONS + ".");
        }
        List<float[]> embeddings = response.embeddings();
        if (embeddings.size() != 1 || embeddings.get(0) == null
                || embeddings.get(0).length != EmbeddingSettings.DIMENSIONS) {
            throw new AiServiceException(HttpStatus.BAD_GATEWAY,
                    "The AI service returned an unexpected embedding shape.");
        }
        float[] vector = embeddings.get(0);
        double squares = 0;
        for (float value : vector) {
            if (!Float.isFinite(value)) {
                throw new AiServiceException(HttpStatus.BAD_GATEWAY,
                        "The AI service returned a non-finite embedding value.");
            }
            squares += (double) value * value;
        }
        // Un vecteur nul rend la distance cosinus NaN en pgvector et pollue le classement du screening.
        double norm = Math.sqrt(squares);
        if (norm == 0 || !Double.isFinite(norm)) {
            throw new AiServiceException(HttpStatus.BAD_GATEWAY,
                    "The AI service returned a null or non-normalizable embedding vector.");
        }
        return vector;
    }

    /** Littéral pgvector {@code [a,b,…]}. */
    static String toVectorLiteral(float[] vector) {
        StringBuilder sb = new StringBuilder(vector.length * 10).append('[');
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(vector[i]);
        }
        return sb.append(']').toString();
    }

    private void supersede(EmbeddingJob job, String reason) {
        transactionTemplate.executeWithoutResult(status -> embeddingJobRepository.casSupersede(job.getId(),
                EmbeddingJobStatus.RUNNING, EmbeddingJobStatus.SUPERSEDED, LocalDateTime.now()));
        log.info("Embedding job superseded without provider call : jobId={}, reason={}", job.getId(), reason);
    }

    /** Échec définitif (déterministe) : pas de retry. */
    private void fail(EmbeddingJob job, String message) {
        int attempts = job.getAttempts() + 1;
        transactionTemplate.executeWithoutResult(status -> embeddingJobRepository.casFail(job.getId(),
                EmbeddingJobStatus.RUNNING, EmbeddingJobStatus.FAILED, attempts, LocalDateTime.now(),
                truncate(message)));
    }

    /**
     * Échec courant : replanifie (one-shot, plus tard si c'est un quota) tant
     * que le total reste sous {@link #MAX_ATTEMPTS} exécutions, sinon
     * {@code FAILED}.
     */
    private void retryOrFail(EmbeddingJob job, String message, boolean quota) {
        String error = truncate(message);
        int attempts = job.getAttempts() + 1;
        LocalDateTime now = LocalDateTime.now();
        if (attempts >= MAX_ATTEMPTS) {
            transactionTemplate.executeWithoutResult(status -> embeddingJobRepository.casFail(job.getId(),
                    EmbeddingJobStatus.RUNNING, EmbeddingJobStatus.FAILED, attempts, now, error));
            log.warn("Embedding abandoned after {} attempts : jobId={}, error={}", attempts, job.getId(), error);
            return;
        }
        LocalDateTime nextAttemptAt = now.plusSeconds(quota ? quotaRetryDelaySeconds : retryDelaySeconds);
        transactionTemplate.executeWithoutResult(status -> embeddingJobRepository.casRetry(job.getId(),
                EmbeddingJobStatus.RUNNING, EmbeddingJobStatus.PENDING, attempts, nextAttemptAt, error));
        log.info("Embedding scheduled for retry : jobId={}, attempt={}, nextAttemptAt={}", job.getId(), attempts,
                nextAttemptAt);
        scheduleAt(job.getId(), nextAttemptAt);
    }

    /** Débit borné vers le fournisseur : le thread du pool attend avant le job suivant. */
    private void pauseBeforeNextCall() {
        if (minIntervalMs <= 0) {
            return;
        }
        try {
            Thread.sleep(minIntervalMs);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }

    private static Instant instantOf(LocalDateTime at) {
        return at.atZone(ZoneId.systemDefault()).toInstant();
    }

    private static String truncate(String message) {
        if (message == null) {
            return null;
        }
        return message.length() <= ERROR_MAX_LENGTH ? message : message.substring(0, ERROR_MAX_LENGTH);
    }
}
