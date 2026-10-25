package com.linqorbit.joboffer.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.linqorbit.screening.dto.ScreeningSignal;

/**
 * Chiffres du tableau de bord recruteur : offres de toutes ses sociétés,
 * agrégées côté serveur. Chaque compteur a la définition de la liste dont il
 * est le total (voir {@code RecruiterDashboardService}) — jamais une moyenne,
 * un délai d'embauche ni une tendance, que la base ne porte pas.
 *
 * @param offers       offres par statut (une offre publiée expirée reste « published »)
 * @param liveOffers   offres publiées non expirées (le périmètre du job board)
 * @param closingSoon  offres publiées dont l'échéance tombe dans les 30 jours
 * @param applications candidatures visibles (brouillons et retraits exclus)
 * @param candidates   candidats suggérés par la recherche automatique
 * @param attention    offres qui demandent une action, les plus urgentes d'abord
 */
public record RecruiterDashboardResponse(
        OfferCounts offers,
        long liveOffers,
        ClosingSoon closingSoon,
        ReviewCounts applications,
        CandidateCounts candidates,
        List<AttentionOffer> attention) {

    public record OfferCounts(long draft, long validated, long published, long closed) {
    }

    /** {@code nextExpiry} : la plus proche échéance de la fenêtre, {@code null} si aucune. */
    public record ClosingSoon(long count, LocalDate nextExpiry) {
    }

    /** {@code toReview} = transmises, en attente de décision ; {@code accepted}/{@code rejected} = décidées. */
    public record ReviewCounts(long toReview, long accepted, long rejected) {
    }

    /**
     * Sur les offres ouvertes, parmi les candidats ayant consenti : {@code toInvite} = suggérés, pas encore
     * invités ni candidats ; {@code invited} = invités ; {@code searchesFailed} = offres dont la dernière
     * recherche de candidats a échoué.
     */
    public record CandidateCounts(long toInvite, long invited, long searchesFailed) {
    }

    public record AttentionOffer(
            UUID id,
            String title,
            String status,
            LocalDate expiresAt,
            long toReview,
            ScreeningSignal screening) {
    }
}
