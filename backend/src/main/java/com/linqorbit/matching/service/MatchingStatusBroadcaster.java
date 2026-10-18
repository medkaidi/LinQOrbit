package com.linqorbit.matching.service;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.extern.slf4j.Slf4j;

import com.linqorbit.matching.dto.MatchingStatusEvent;
import com.linqorbit.matching.entity.MatchingJobStatus;

/**
 * Push SSE du statut des analyses de matching (D60) : le frontend s'abonne au
 * matching qu'il attend, le worker publie chaque transition. L'événement n'est
 * qu'un <b>signal</b> {@code {matchingId, status}} — le résultat complet reste
 * servi par la lecture {@code GET /matchings/offer/{publicId}}, seule source
 * de vérité.
 *
 * <p>À l'abonnement, le statut courant est envoyé aussitôt (aucune course
 * entre la lecture et l'abonnement) ; un statut terminal ({@code done},
 * {@code failed}) ferme le flux. Timeout {@value #TIMEOUT_MS} ms, au-delà de
 * la durée maximale d'un job : le client se reconnecte tant que l'analyse est
 * en cours, et la reconnexion renvoie le statut courant.</p>
 *
 * <p>Limite assumée : le registre vit <b>en mémoire</b> de l'instance —
 * correct en mono-instance ; avec plusieurs instances il faudrait un broker
 * (Kafka/Redis interdits en V0). Un événement perdu (redémarrage, autre
 * instance) est rattrapé par la reconnexion du client.</p>
 */
@Slf4j
@Component
public class MatchingStatusBroadcaster {

    static final long TIMEOUT_MS = 120_000L;
    static final String EVENT_NAME = "status";

    private final Map<UUID, Set<SseEmitter>> emittersByMatching = new ConcurrentHashMap<>();

    /** Ouvre un flux pour ce matching et y envoie aussitôt le statut courant. */
    public SseEmitter subscribe(UUID matchingId, MatchingJobStatus currentStatus) {
        SseEmitter emitter = newEmitter();
        if (!send(emitter, matchingId, currentStatus)) {
            return emitter;
        }
        if (isTerminal(currentStatus)) {
            emitter.complete();
            return emitter;
        }
        Set<SseEmitter> emitters = emittersByMatching.computeIfAbsent(matchingId,
                key -> ConcurrentHashMap.newKeySet());
        emitters.add(emitter);
        Runnable remove = () -> unregister(matchingId, emitter);
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(error -> remove.run());
        log.info("Matching status stream opened : matchingId={}, status={}, listeners={}",
                matchingId, currentStatus.getApiValue(), emitters.size());
        return emitter;
    }

    /** Transmet une transition à tous les abonnés du matching ; un statut terminal ferme leurs flux. */
    public void publish(UUID matchingId, MatchingJobStatus status) {
        Set<SseEmitter> emitters = emittersByMatching.get(matchingId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : Set.copyOf(emitters)) {
            if (send(emitter, matchingId, status) && isTerminal(status)) {
                emitter.complete();
            }
        }
        if (isTerminal(status)) {
            emittersByMatching.remove(matchingId);
        }
        log.info("Matching status published : matchingId={}, status={}, listeners={}",
                matchingId, status.getApiValue(), emitters.size());
    }

    /** Nombre d'abonnés actifs d'un matching (observabilité et tests). */
    int listenerCount(UUID matchingId) {
        Set<SseEmitter> emitters = emittersByMatching.get(matchingId);
        return emitters == null ? 0 : emitters.size();
    }

    /** Point d'extension des tests : l'emitter réel en production. */
    SseEmitter newEmitter() {
        return new SseEmitter(TIMEOUT_MS);
    }

    private boolean send(SseEmitter emitter, UUID matchingId, MatchingJobStatus status) {
        try {
            emitter.send(SseEmitter.event()
                    .name(EVENT_NAME)
                    .data(new MatchingStatusEvent(matchingId.toString(), status.getApiValue()),
                            MediaType.APPLICATION_JSON));
            return true;
        } catch (IOException | IllegalStateException ex) {
            // Client parti (onglet fermé, réseau) : on oublie l'emitter, sans bruit.
            log.debug("Matching status stream dropped : matchingId={}", matchingId);
            unregister(matchingId, emitter);
            emitter.completeWithError(ex);
            return false;
        }
    }

    private void unregister(UUID matchingId, SseEmitter emitter) {
        emittersByMatching.computeIfPresent(matchingId, (key, emitters) -> {
            emitters.remove(emitter);
            return emitters.isEmpty() ? null : emitters;
        });
    }

    private static boolean isTerminal(MatchingJobStatus status) {
        return status == MatchingJobStatus.DONE || status == MatchingJobStatus.FAILED;
    }
}
