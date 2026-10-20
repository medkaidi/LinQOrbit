package com.linqorbit.candidate.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.linqorbit.candidate.dto.NormalizationStatusEvent;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.service.NormalizationStatusBroadcaster.Stream;

/**
 * Push SSE de normalisation (D64) : statut courant à l'abonnement, diffusion
 * à tous les abonnés d'une ressource, fermeture sur tout statut hors
 * pending/running, isolation candidat/offre, client parti ignoré, échéance
 * propre. Les emitters sont des doublures qui enregistrent les envois.
 */
class NormalizationStatusBroadcasterTest {

    /** Emitter qui consigne ce qu'il reçoit au lieu d'écrire sur une socket. */
    private static final class RecordingEmitter extends SseEmitter {

        /** Nom d'événement + statut de chaque envoi (« event:status … |pending »). */
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
                if (part.getData() instanceof NormalizationStatusEvent event) {
                    text.append("|").append(event.status());
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

    private final NormalizationStatusBroadcaster broadcaster = new NormalizationStatusBroadcaster() {
        @Override
        SseEmitter newEmitter() {
            return nextEmitters.isEmpty() ? new RecordingEmitter() : nextEmitters.pop();
        }
    };

    private RecordingEmitter subscribe(Stream stream, NormalizationJobStatus status) {
        return (RecordingEmitter) broadcaster.subscribe(stream, () -> status);
    }

    @Test
    void lAbonnementEnvoieAussitotLeStatutCourantEtResteOuvertPendantLAnalyse() {
        Stream stream = Stream.candidate(UUID.randomUUID());

        RecordingEmitter emitter = subscribe(stream, NormalizationJobStatus.RUNNING);

        assertThat(emitter.sent).singleElement().satisfies(event -> {
            assertThat(event).contains("event:status");
            assertThat(event).contains("|running");
        });
        assertThat(emitter.completed).isFalse();
        assertThat(broadcaster.hasListeners(stream)).isTrue();
    }

    @Test
    void toutStatutHorsPendingEtRunningEstEnvoyePuisFermeSansInscription() {
        Stream stream = Stream.offer(UUID.randomUUID());
        for (NormalizationJobStatus terminal : Arrays.asList(NormalizationJobStatus.DONE,
                NormalizationJobStatus.FAILED, NormalizationJobStatus.SUPERSEDED, null)) {
            RecordingEmitter emitter = subscribe(stream, terminal);

            assertThat(emitter.sent).singleElement().asString()
                    .contains("|" + NormalizationStatusBroadcaster.apiValue(terminal));
            assertThat(emitter.completed).isTrue();
        }
        assertThat(broadcaster.hasListeners(stream)).isFalse();
    }

    @Test
    void sansAucuneValidationLeStatutEstNone() {
        RecordingEmitter emitter = subscribe(Stream.candidate(UUID.randomUUID()), null);

        assertThat(emitter.sent).singleElement().asString().contains("|none");
        assertThat(emitter.completed).isTrue();
    }

    @Test
    void chaqueTransitionVaATousLesAbonnesEtLeTerminalFermeEtNettoie() {
        Stream stream = Stream.candidate(UUID.randomUUID());
        RecordingEmitter first = subscribe(stream, NormalizationJobStatus.PENDING);
        RecordingEmitter second = subscribe(stream, NormalizationJobStatus.PENDING);

        broadcaster.publish(stream, NormalizationJobStatus.RUNNING);
        assertThat(first.sent).hasSize(2);
        assertThat(second.sent.get(1)).contains("|running");
        assertThat(first.completed).isFalse();

        broadcaster.publish(stream, NormalizationJobStatus.DONE);
        assertThat(first.sent.get(2)).contains("|done");
        assertThat(first.completed).isTrue();
        assertThat(second.completed).isTrue();
        assertThat(broadcaster.hasListeners(stream)).isFalse();
    }

    @Test
    void unRetryRepasseEnAttenteSansFermerLeFlux() {
        Stream stream = Stream.offer(UUID.randomUUID());
        RecordingEmitter emitter = subscribe(stream, NormalizationJobStatus.RUNNING);

        broadcaster.publish(stream, NormalizationJobStatus.PENDING);

        assertThat(emitter.sent.get(1)).contains("|pending");
        assertThat(emitter.completed).isFalse();
    }

    @Test
    void leProfilDUnCandidatEtUneOffreDeMemeIdentifiantSontDesFluxDistincts() {
        UUID sameId = UUID.randomUUID();
        RecordingEmitter candidate = subscribe(Stream.candidate(sameId), NormalizationJobStatus.PENDING);
        RecordingEmitter offer = subscribe(Stream.offer(sameId), NormalizationJobStatus.PENDING);
        RecordingEmitter otherCandidate = subscribe(Stream.candidate(UUID.randomUUID()),
                NormalizationJobStatus.PENDING);

        broadcaster.publish(Stream.offer(sameId), NormalizationJobStatus.DONE);

        assertThat(offer.sent.get(1)).contains("|done");
        assertThat(offer.completed).isTrue();
        assertThat(candidate.sent).hasSize(1);
        assertThat(candidate.completed).isFalse();
        assertThat(otherCandidate.sent).hasSize(1);
    }

    @Test
    void unClientPartiEstOublieSansGenerLesAutres() {
        Stream stream = Stream.candidate(UUID.randomUUID());
        RecordingEmitter gone = subscribe(stream, NormalizationJobStatus.PENDING);
        RecordingEmitter alive = subscribe(stream, NormalizationJobStatus.PENDING);
        gone.failing = true;

        broadcaster.publish(stream, NormalizationJobStatus.RUNNING);

        assertThat(alive.sent.get(1)).contains("|running");
        assertThat(broadcaster.listenerCount(stream)).isEqualTo(1);
    }

    @Test
    void publierSansAbonneNeFaitRien() {
        Stream stream = Stream.offer(UUID.randomUUID());

        broadcaster.publish(stream, NormalizationJobStatus.DONE);

        assertThat(broadcaster.hasListeners(stream)).isFalse();
    }

    @Test
    void lEcheanceDuFluxLeClotProprementEtDesinscritLAbonne() {
        Stream stream = Stream.candidate(UUID.randomUUID());
        RecordingEmitter emitter = subscribe(stream, NormalizationJobStatus.RUNNING);

        emitter.timeOut();

        assertThat(emitter.completed).isTrue();
        assertThat(broadcaster.hasListeners(stream)).isFalse();
    }

    @Test
    void uneTransitionPublieePendantLAbonnementNEstJamaisPerdue() {
        Stream stream = Stream.candidate(UUID.randomUUID());
        // La transition arrive entre l'inscription et la lecture du statut courant.
        RecordingEmitter emitter = (RecordingEmitter) broadcaster.subscribe(stream, () -> {
            broadcaster.publish(stream, NormalizationJobStatus.RUNNING);
            return NormalizationJobStatus.RUNNING;
        });

        assertThat(emitter.sent).hasSize(2).allSatisfy(event -> assertThat(event).contains("|running"));
    }

    @Test
    void uneLectureDuStatutEnEchecNeLaissePasDAbonneFantome() {
        Stream stream = Stream.offer(UUID.randomUUID());

        assertThatThrownBy(() -> broadcaster.subscribe(stream, () -> {
            throw new IllegalStateException("database down");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(broadcaster.hasListeners(stream)).isFalse();
    }
}
