package com.linqorbit.screening.service;

import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.linqorbit.candidate.entity.SearchStatus;
import com.linqorbit.embedding.service.EmbeddingSettings;
import com.linqorbit.screening.dto.ScreenedCandidate;
import com.linqorbit.screening.repository.ScreeningRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Screening : le Top N de candidats sémantiquement proches d'une offre
 * (SPEC §8.4.7), en amont du matching — un <b>plug de retrieval</b>
 * interchangeable (§8.4.9) que le moteur de matching n'appelle pas : il ne
 * produit ni score ni classement final (D31), seulement l'ensemble à évaluer.
 *
 * <p>Non branché sur le matching (§8.4.8). Depuis T-101 (D85) il est appelé par
 * le worker de screening à la publication d'une offre : le Top N devient la
 * liste des candidats suggérés au recruteur, jamais une entrée du matching.</p>
 *
 * <p>Population : candidats dont la fiche courante a un vecteur du couple
 * modèle/stratégie actif, hors {@code not_looking} (décision produit). Offre
 * sans fiche ou sans vecteur → liste vide, jamais d'erreur.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScreeningService {

    /** Plafond du Top N : N reste une valeur expérimentale, jamais un « tout renvoyer ». */
    public static final int MAX_TOP_N = 500;

    private final ScreeningRepository screeningRepository;
    private final EmbeddingSettings settings;
    @Value("${app.screening.top-n}")
    private final int configuredTopN;

    /** La fiche courante de l'offre a-t-elle un vecteur du couple actif ? Sinon rien à comparer. */
    public boolean hasCurrentOfferVector(UUID offerId) {
        return screeningRepository.existsCurrentOfferVector(offerId, settings.getModelName(),
                settings.getModelVersion(), settings.getStrategyVersion());
    }

    /** Top N configuré ({@code app.screening.top-n}, borné à {@code [1, MAX_TOP_N]}). */
    public List<ScreenedCandidate> topCandidates(UUID offerId) {
        return topCandidates(offerId, Math.max(1, configuredTopN));
    }

    /**
     * Top {@code n} pour une offre ; {@code n = 0} → liste vide, {@code n} négatif →
     * {@link IllegalArgumentException} (erreur d'appelant), {@code n} au-delà de
     * {@link #MAX_TOP_N} ramené au plafond.
     */
    public List<ScreenedCandidate> topCandidates(UUID offerId, int n) {
        if (n < 0) {
            throw new IllegalArgumentException("Top N must not be negative");
        }
        int limit = Math.min(n, MAX_TOP_N);
        if (limit == 0) {
            return List.of();
        }
        List<ScreenedCandidate> top = screeningRepository.findTopCandidates(offerId, settings.getModelName(),
                settings.getModelVersion(), settings.getStrategyVersion(), SearchStatus.NOT_LOOKING.getCode(), limit)
                .stream()
                .map(row -> new ScreenedCandidate(row.getCandidateId(), row.getNormalizedProfileId(),
                        row.getDistance()))
                .toList();
        log.info("Screening done : offerId={}, requested={}, returned={}", offerId, limit, top.size());
        return top;
    }
}
