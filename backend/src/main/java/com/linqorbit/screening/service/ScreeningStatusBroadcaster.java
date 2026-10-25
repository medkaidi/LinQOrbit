package com.linqorbit.screening.service;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.linqorbit.screening.dto.ScreeningSignal;

import lombok.extern.slf4j.Slf4j;

/**
 * Push SSE du statut de screening d'une offre (T-101, D85), même stratégie
 * que {@code NormalizationStatusBroadcaster} (D64) : le frontend s'abonne à
 * <b>une offre</b> et reçoit un <b>signal</b> {@code {status, candidateCount}}
 * — celui du dernier job de screening. Le GET de l'offre reste la seule
 * source de vérité.
 *
 * <p>À l'abonnement, l'emitter est <b>inscrit avant</b> la lecture du signal
 * courant, qui est envoyé aussitôt : une transition publiée pendant
 * l'abonnement arrive soit par la publication, soit par cette lecture (au pire
 * en double, jamais perdue). Tout statut hors {@code pending}/{@code running}
 * est terminal ({@code done}, {@code failed}, {@code none}) et ferme le flux.
 * Timeout {@value #TIMEOUT_MS} ms : le flux est clos proprement et le client
 * se reconnecte tant que la recherche est en cours.</p>
 *
 * <p>Limite assumée (même que D60/D64) : le registre vit <b>en mémoire</b> de
 * l'instance — correct en mono-instance ; un événement perdu est rattrapé par
 * la reconnexion du client.</p>
 */
@Slf4j
@Component
public class ScreeningStatusBroadcaster {

    static final long TIMEOUT_MS = 120_000L;
    static final String EVENT_NAME = "status";

    private final Map<UUID, Set<SseEmitter>> emittersByOffer = new ConcurrentHashMap<>();

    /**
     * Ouvre un flux pour cette offre : inscription d'abord, puis lecture et
     * envoi du signal courant ({@code currentSignal} relit la base — jamais une
     * valeur lue avant l'inscription).
     */
    public SseEmitter subscribe(UUID offerId, Supplier<ScreeningSignal> currentSignal) {
        SseEmitter emitter = newEmitter();
        emittersByOffer.computeIfAbsent(offerId, key -> ConcurrentHashMap.newKeySet()).add(emitter);
        Runnable remove = () -> unregister(offerId, emitter);
        emitter.onCompletion(remove);
        // Fin normale d'un flux long : clore sans erreur (sinon Spring lève AsyncRequestTimeoutException).
        emitter.onTimeout(() -> {
            remove.run();
            emitter.complete();
        });
        emitter.onError(error -> remove.run());

        ScreeningSignal signal;
        try {
            signal = currentSignal.get();
        } catch (RuntimeException ex) {
            unregister(offerId, emitter);
            throw ex;
        }
        if (!send(emitter, offerId, signal)) {
            return emitter;
        }
        if (isTerminal(signal)) {
            unregister(offerId, emitter);
            emitter.complete();
            return emitter;
        }
        log.info("Screening status stream opened : offerId={}, status={}, listeners={}", offerId,
                signal.status(), listenerCount(offerId));
        return emitter;
    }

    /** Transmet le signal à tous les abonnés de l'offre ; un statut terminal ferme leurs flux. */
    public void publish(UUID offerId, ScreeningSignal signal) {
        Set<SseEmitter> emitters = emittersByOffer.get(offerId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : Set.copyOf(emitters)) {
            if (send(emitter, offerId, signal) && isTerminal(signal)) {
                // Désinscription ciblée : un abonné arrivé après la copie n'est jamais éjecté sans réponse.
                unregister(offerId, emitter);
                emitter.complete();
            }
        }
        log.info("Screening status published : offerId={}, status={}, listeners={}", offerId, signal.status(),
                emitters.size());
    }

    /** Vrai si au moins un client écoute l'offre (évite toute lecture inutile au publish). */
    public boolean hasListeners(UUID offerId) {
        return listenerCount(offerId) > 0;
    }

    /** Nombre d'abonnés actifs d'une offre (observabilité et tests). */
    int listenerCount(UUID offerId) {
        Set<SseEmitter> emitters = emittersByOffer.get(offerId);
        return emitters == null ? 0 : emitters.size();
    }

    /** Point d'extension des tests : l'emitter réel en production. */
    SseEmitter newEmitter() {
        return new SseEmitter(TIMEOUT_MS);
    }

    /** Seuls pending et running gardent le flux ouvert : rien d'autre ne progressera. */
    static boolean isTerminal(ScreeningSignal signal) {
        return !"pending".equals(signal.status()) && !"running".equals(signal.status());
    }

    private boolean send(SseEmitter emitter, UUID offerId, ScreeningSignal signal) {
        try {
            emitter.send(SseEmitter.event()
                    .name(EVENT_NAME)
                    .data(signal, MediaType.APPLICATION_JSON));
            return true;
        } catch (IOException | IllegalStateException ex) {
            // Client parti (onglet fermé, réseau) : on oublie l'emitter, sans bruit.
            log.debug("Screening status stream dropped : offerId={}", offerId);
            unregister(offerId, emitter);
            emitter.completeWithError(ex);
            return false;
        }
    }

    private void unregister(UUID offerId, SseEmitter emitter) {
        emittersByOffer.computeIfPresent(offerId, (key, emitters) -> {
            emitters.remove(emitter);
            return emitters.isEmpty() ? null : emitters;
        });
    }
}
