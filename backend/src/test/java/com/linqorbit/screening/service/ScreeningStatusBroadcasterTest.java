package com.linqorbit.screening.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.linqorbit.screening.dto.ScreeningSignal;

/**
 * Push SSE du screening (T-101) : signal courant à l'abonnement, diffusion à
 * tous les abonnés d'une offre, fermeture sur tout statut hors
 * pending/running, isolation entre offres, client parti ignoré, échéance
 * propre. Les emitters sont des doublures qui enregistrent les envois.
 */
class ScreeningStatusBroadcasterTest {

    /** Emitter qui consigne ce qu'il reçoit au lieu d'écrire sur une socket. */
    private static final class RecordingEmitter extends SseEmitter {

        /** Nom d'événement + signal de chaque envoi (« event:status … |done|3 »). */
        final List<String> sent = new ArrayList<>();
        boolean completed;
        boolean failing;
        private final List<Runnable> completionCallbacks = new ArrayList<>();
        private final List<Runnable> timeoutCallbacks = new ArrayList<>();

        @Override
        public void send(SseEventBuilder builder) throws IOException {
            if (failing) {
                throw new IOException("client gone");
            }
            if (completed) {
                throw new IllegalStateException("already completed");
            }
            StringBuilder text = new StringBuilder();
            builder.build().forEach(part -> {
                if (part.getData() instanceof ScreeningSignal signal) {
                    text.append("|").append(signal.status()).append("|").append(signal.candidateCount());
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

        @Override
        public synchronized void onTimeout(Runnable callback) {
            timeoutCallbacks.add(callback);
        }

        void timeOut() {
            timeoutCallbacks.forEach(Runnable::run);
        }
    }

    private final Deque<RecordingEmitter> nextEmitters = new ArrayDeque<>();

    private final ScreeningStatusBroadcaster broadcaster = new ScreeningStatusBroadcaster() {
        @Override
        SseEmitter newEmitter() {
            return nextEmitters.isEmpty() ? new RecordingEmitter() : nextEmitters.pop();
        }
    };

    private RecordingEmitter subscribe(UUID offerId, ScreeningSignal signal) {
        return (RecordingEmitter) broadcaster.subscribe(offerId, () -> signal);
    }

    private static ScreeningSignal signal(String status, Integer count) {
        return new ScreeningSignal(status, count);
    }

    @Test
    void lAbonnementEnvoieAussitotLeSignalCourantEtResteOuvertPendantLaRecherche() {
        UUID offerId = UUID.randomUUID();

        RecordingEmitter emitter = subscribe(offerId, signal("running", null));

        assertThat(emitter.sent).singleElement().satisfies(event -> {
            assertThat(event).contains("event:status");
            assertThat(event).contains("|running|null");
        });
        assertThat(emitter.completed).isFalse();
        assertThat(broadcaster.hasListeners(offerId)).isTrue();
    }

    @Test
    void toutStatutHorsPendingEtRunningEstEnvoyePuisFermeSansInscription() {
        UUID offerId = UUID.randomUUID();
        for (ScreeningSignal terminal : List.of(signal("done", 7), signal("done", 0), signal("failed", null),
                ScreeningSignal.none())) {
            RecordingEmitter emitter = subscribe(offerId, terminal);

            assertThat(emitter.sent).singleElement().asString()
                    .contains("|" + terminal.status() + "|" + terminal.candidateCount());
            assertThat(emitter.completed).isTrue();
        }
        assertThat(broadcaster.hasListeners(offerId)).isFalse();
    }

    @Test
    void sansRechercheLeStatutEstNone() {
        RecordingEmitter emitter = subscribe(UUID.randomUUID(), ScreeningSignal.none());

        assertThat(emitter.sent).singleElement().asString().contains("|none|null");
        assertThat(emitter.completed).isTrue();
    }

    @Test
    void chaqueTransitionVaATousLesAbonnesEtLeTerminalFermeEtNettoie() {
        UUID offerId = UUID.randomUUID();
        RecordingEmitter first = subscribe(offerId, signal("pending", null));
        RecordingEmitter second = subscribe(offerId, signal("pending", null));

        broadcaster.publish(offerId, signal("running", null));
        assertThat(first.sent).hasSize(2);
        assertThat(second.sent).hasSize(2);
        assertThat(first.completed).isFalse();

        broadcaster.publish(offerId, signal("done", 4));
        assertThat(first.sent.get(2)).contains("|done|4");
        assertThat(second.sent.get(2)).contains("|done|4");
        assertThat(first.completed).isTrue();
        assertThat(second.completed).isTrue();
        assertThat(broadcaster.hasListeners(offerId)).isFalse();
    }

    @Test
    void uneOffreNeRecoitJamaisLesSignauxDUneAutre() {
        UUID mine = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        RecordingEmitter emitter = subscribe(mine, signal("pending", null));

        broadcaster.publish(other, signal("done", 9));

        assertThat(emitter.sent).hasSize(1);
        assertThat(broadcaster.hasListeners(other)).isFalse();
    }

    @Test
    void unClientPartiEstOublieSansFaireEchouerLaPublication() {
        UUID offerId = UUID.randomUUID();
        RecordingEmitter gone = subscribe(offerId, signal("pending", null));
        RecordingEmitter alive = subscribe(offerId, signal("pending", null));
        gone.failing = true;

        broadcaster.publish(offerId, signal("running", null));

        assertThat(alive.sent).hasSize(2);
        assertThat(broadcaster.listenerCount(offerId)).isEqualTo(1);
    }

    @Test
    void lEcheanceClotLeFluxSansErreurEtLeDesinscrit() {
        UUID offerId = UUID.randomUUID();
        RecordingEmitter emitter = subscribe(offerId, signal("running", null));

        emitter.timeOut();

        assertThat(emitter.completed).isTrue();
        assertThat(broadcaster.hasListeners(offerId)).isFalse();
    }

    @Test
    void uneLectureEnEchecALAbonnementNeLaisseAucunAbonneOrphelin() {
        UUID offerId = UUID.randomUUID();

        assertThatThrownBy(() -> broadcaster.subscribe(offerId, () -> {
            throw new IllegalStateException("db down");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(broadcaster.hasListeners(offerId)).isFalse();
    }

    @Test
    void publierSansAbonneNeFaitRien() {
        broadcaster.publish(UUID.randomUUID(), signal("done", 1));
    }
}
