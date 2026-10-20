package com.linqorbit.candidate.service;

import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.linqorbit.candidate.dto.NormalizationStatusEvent;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizationSourceType;

import lombok.extern.slf4j.Slf4j;

/**
 * Push SSE du statut de normalisation (D64, extension de D60) : le frontend
 * s'abonne à <b>une ressource</b> — le profil du candidat ou une offre — et
 * reçoit un <b>signal</b> {@code {status}} : le statut du dernier job de cette
 * ressource. Le GET du profil ou de l'offre reste la seule source de vérité.
 *
 * <p>À l'abonnement, l'emitter est <b>inscrit avant</b> la lecture du statut
 * courant, qui est envoyé aussitôt : une transition publiée pendant
 * l'abonnement arrive soit par la publication, soit par cette lecture (au pire
 * en double, jamais perdue). Tout statut hors {@code pending}/{@code running}
 * est terminal ({@code done}, {@code failed}, {@code none} sans validation) et
 * ferme le flux. Timeout {@value #TIMEOUT_MS} ms : le flux est clos proprement
 * (aucune erreur levée) et le client se reconnecte tant que l'analyse est en
 * cours.</p>
 *
 * <p>Limite assumée (même que D60) : le registre vit <b>en mémoire</b> de
 * l'instance — correct en mono-instance ; un événement perdu (redémarrage,
 * autre instance) est rattrapé par la reconnexion du client.</p>
 */
@Slf4j
@Component
public class NormalizationStatusBroadcaster {

    static final long TIMEOUT_MS = 120_000L;
    static final String EVENT_NAME = "status";
    /** Statut envoyé quand la ressource n'a jamais été validée. */
    static final String NONE = "none";

    /** Ressource suivie : le profil d'un candidat ou une offre. */
    public record Stream(NormalizationSourceType sourceType, UUID resourceId) {

        public static Stream candidate(UUID candidateId) {
            return new Stream(NormalizationSourceType.CANDIDATE, candidateId);
        }

        public static Stream offer(UUID offerId) {
            return new Stream(NormalizationSourceType.OFFER, offerId);
        }
    }

    private final Map<Stream, Set<SseEmitter>> emittersByStream = new ConcurrentHashMap<>();

    /**
     * Ouvre un flux pour cette ressource : inscription d'abord, puis lecture et
     * envoi du statut courant ({@code currentStatus} relit la base — jamais une
     * valeur lue avant l'inscription ; {@code null} = aucune validation).
     */
    public SseEmitter subscribe(Stream stream, Supplier<NormalizationJobStatus> currentStatus) {
        SseEmitter emitter = newEmitter();
        emittersByStream.computeIfAbsent(stream, key -> ConcurrentHashMap.newKeySet()).add(emitter);
        Runnable remove = () -> unregister(stream, emitter);
        emitter.onCompletion(remove);
        // Fin normale d'un flux long : clore sans erreur (sinon Spring lève AsyncRequestTimeoutException).
        emitter.onTimeout(() -> {
            remove.run();
            emitter.complete();
        });
        emitter.onError(error -> remove.run());

        NormalizationJobStatus status;
        try {
            status = currentStatus.get();
        } catch (RuntimeException ex) {
            unregister(stream, emitter);
            throw ex;
        }
        if (!send(emitter, stream, status)) {
            return emitter;
        }
        if (isTerminal(status)) {
            unregister(stream, emitter);
            emitter.complete();
            return emitter;
        }
        log.info("Normalization status stream opened : source={}, resourceId={}, status={}, listeners={}",
                stream.sourceType(), stream.resourceId(), apiValue(status), listenerCount(stream));
        return emitter;
    }

    /** Transmet le statut à tous les abonnés de la ressource ; un statut terminal ferme leurs flux. */
    public void publish(Stream stream, NormalizationJobStatus status) {
        Set<SseEmitter> emitters = emittersByStream.get(stream);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : Set.copyOf(emitters)) {
            if (send(emitter, stream, status) && isTerminal(status)) {
                // Désinscription ciblée : un abonné arrivé après la copie n'est jamais éjecté sans réponse.
                unregister(stream, emitter);
                emitter.complete();
            }
        }
        log.info("Normalization status published : source={}, resourceId={}, status={}, listeners={}",
                stream.sourceType(), stream.resourceId(), apiValue(status), emitters.size());
    }

    /** Vrai si au moins un client écoute la ressource (évite toute lecture inutile au publish). */
    public boolean hasListeners(Stream stream) {
        return listenerCount(stream) > 0;
    }

    /** Nombre d'abonnés actifs d'une ressource (observabilité et tests). */
    int listenerCount(Stream stream) {
        Set<SseEmitter> emitters = emittersByStream.get(stream);
        return emitters == null ? 0 : emitters.size();
    }

    /** Point d'extension des tests : l'emitter réel en production. */
    SseEmitter newEmitter() {
        return new SseEmitter(TIMEOUT_MS);
    }

    /** Valeur exposée : nom du statut en minuscules, {@code none} sans validation. */
    static String apiValue(NormalizationJobStatus status) {
        return status == null ? NONE : status.name().toLowerCase(Locale.ROOT);
    }

    /** Seuls PENDING et RUNNING gardent le flux ouvert : rien d'autre ne progressera. */
    static boolean isTerminal(NormalizationJobStatus status) {
        return status != NormalizationJobStatus.PENDING && status != NormalizationJobStatus.RUNNING;
    }

    private boolean send(SseEmitter emitter, Stream stream, NormalizationJobStatus status) {
        try {
            emitter.send(SseEmitter.event()
                    .name(EVENT_NAME)
                    .data(new NormalizationStatusEvent(apiValue(status)), MediaType.APPLICATION_JSON));
            return true;
        } catch (IOException | IllegalStateException ex) {
            // Client parti (onglet fermé, réseau) : on oublie l'emitter, sans bruit.
            log.debug("Normalization status stream dropped : source={}, resourceId={}",
                    stream.sourceType(), stream.resourceId());
            unregister(stream, emitter);
            emitter.completeWithError(ex);
            return false;
        }
    }

    private void unregister(Stream stream, SseEmitter emitter) {
        emittersByStream.computeIfPresent(stream, (key, emitters) -> {
            emitters.remove(emitter);
            return emitters.isEmpty() ? null : emitters;
        });
    }
}
