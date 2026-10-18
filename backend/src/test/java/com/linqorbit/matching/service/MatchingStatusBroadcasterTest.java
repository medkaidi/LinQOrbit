package com.linqorbit.matching.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.linqorbit.matching.dto.MatchingStatusEvent;
import com.linqorbit.matching.entity.MatchingJobStatus;

/**
 * Push SSE (D60) : statut courant à l'abonnement, diffusion à tous les
 * abonnés, fermeture sur statut terminal, client parti ignoré, nettoyage du
 * registre. Les emitters sont des doublures qui enregistrent les envois.
 */
class MatchingStatusBroadcasterTest {

    /** Emitter qui consigne ce qu'il reçoit au lieu d'écrire sur une socket. */
    private static final class RecordingEmitter extends SseEmitter {

        /** Nom d'événement + statut de chaque envoi (« status:pending »…). */
        final List<String> sent = new ArrayList<>();
        boolean completed;
        boolean failing;
        private final List<Runnable> completionCallbacks = new ArrayList<>();

        @Override
        public void send(SseEventBuilder builder) throws IOException {
            if (failing) {
                throw new IOException("client gone");
            }
            StringBuilder text = new StringBuilder();
            builder.build().forEach(part -> {
                if (part.getData() instanceof MatchingStatusEvent event) {
                    text.append(event.matchingId()).append("|").append(event.status());
                } else {
                    text.append(part.getData());
                }
            });
            sent.add(text.toString());
        }

        @Override
        public synchronized void complete() {
            completed = true;
            completionCallbacks.forEach(Runnable::run);
        }

        @Override
        public synchronized void completeWithError(Throwable ex) {
            completed = true;
        }

        @Override
        public synchronized void onCompletion(Runnable callback) {
            completionCallbacks.add(callback);
        }
    }

    private final Deque<RecordingEmitter> nextEmitters = new ArrayDeque<>();

    private final MatchingStatusBroadcaster broadcaster = new MatchingStatusBroadcaster() {
        @Override
        SseEmitter newEmitter() {
            return nextEmitters.isEmpty() ? new RecordingEmitter() : nextEmitters.pop();
        }
    };

    private RecordingEmitter subscribe(UUID matchingId, MatchingJobStatus status) {
        return (RecordingEmitter) broadcaster.subscribe(matchingId, status);
    }

    @Test
    void lAbonnementEnvoieAussitotLeStatutCourantEtResteOuvertPendantLAnalyse() {
        UUID matchingId = UUID.randomUUID();

        RecordingEmitter emitter = subscribe(matchingId, MatchingJobStatus.PENDING);

        assertThat(emitter.sent).singleElement().satisfies(event -> {
            assertThat(event).contains("event:status");
            assertThat(event).contains("|pending");
            assertThat(event).contains(matchingId.toString());
        });
        assertThat(emitter.completed).isFalse();
        assertThat(broadcaster.listenerCount(matchingId)).isEqualTo(1);
    }

    @Test
    void unStatutDejaTermineEstEnvoyePuisLeFluxSeFermeSansInscription() {
        UUID matchingId = UUID.randomUUID();
        for (MatchingJobStatus terminal : Set.of(MatchingJobStatus.DONE, MatchingJobStatus.FAILED)) {
            RecordingEmitter emitter = subscribe(matchingId, terminal);

            assertThat(emitter.sent).singleElement().asString().contains(terminal.getApiValue());
            assertThat(emitter.completed).isTrue();
        }
        assertThat(broadcaster.listenerCount(matchingId)).isZero();
    }

    @Test
    void chaqueTransitionVaATousLesAbonnesEtLeTerminalFermeEtNettoie() {
        UUID matchingId = UUID.randomUUID();
        RecordingEmitter first = subscribe(matchingId, MatchingJobStatus.PENDING);
        RecordingEmitter second = subscribe(matchingId, MatchingJobStatus.PENDING);

        broadcaster.publish(matchingId, MatchingJobStatus.RUNNING);
        assertThat(first.sent).hasSize(2);
        assertThat(second.sent.get(1)).contains("|running");
        assertThat(first.completed).isFalse();

        broadcaster.publish(matchingId, MatchingJobStatus.DONE);
        assertThat(first.sent.get(2)).contains("|done");
        assertThat(first.completed).isTrue();
        assertThat(second.completed).isTrue();
        assertThat(broadcaster.listenerCount(matchingId)).isZero();
    }

    @Test
    void unRetryRepasseEnAttenteSansFermerLeFlux() {
        UUID matchingId = UUID.randomUUID();
        RecordingEmitter emitter = subscribe(matchingId, MatchingJobStatus.RUNNING);

        broadcaster.publish(matchingId, MatchingJobStatus.PENDING);

        assertThat(emitter.sent.get(1)).contains("|pending");
        assertThat(emitter.completed).isFalse();
        assertThat(broadcaster.listenerCount(matchingId)).isEqualTo(1);
    }

    @Test
    void unClientPartiEstOublieSansGenerLesAutres() {
        UUID matchingId = UUID.randomUUID();
        RecordingEmitter gone = subscribe(matchingId, MatchingJobStatus.PENDING);
        RecordingEmitter alive = subscribe(matchingId, MatchingJobStatus.PENDING);
        gone.failing = true;

        broadcaster.publish(matchingId, MatchingJobStatus.RUNNING);

        assertThat(alive.sent).hasSize(2);
        assertThat(broadcaster.listenerCount(matchingId)).isEqualTo(1);
    }

    @Test
    void unClientPartiDesLAbonnementNEstJamaisInscrit() {
        UUID matchingId = UUID.randomUUID();
        RecordingEmitter gone = new RecordingEmitter();
        gone.failing = true;
        nextEmitters.push(gone);

        broadcaster.subscribe(matchingId, MatchingJobStatus.PENDING);

        assertThat(gone.completed).isTrue();
        assertThat(broadcaster.listenerCount(matchingId)).isZero();
    }

    @Test
    void publierSansAbonneOuPourUnAutreMatchingNeFaitRien() {
        UUID matchingId = UUID.randomUUID();
        RecordingEmitter emitter = subscribe(matchingId, MatchingJobStatus.PENDING);

        broadcaster.publish(UUID.randomUUID(), MatchingJobStatus.DONE);

        assertThat(emitter.sent).hasSize(1);
        assertThat(emitter.completed).isFalse();
    }

    @Test
    void laFinDuFluxCoteServeurDesinscritLAbonne() {
        UUID matchingId = UUID.randomUUID();
        RecordingEmitter emitter = subscribe(matchingId, MatchingJobStatus.PENDING);

        emitter.complete();

        assertThat(broadcaster.listenerCount(matchingId)).isZero();
    }
}
