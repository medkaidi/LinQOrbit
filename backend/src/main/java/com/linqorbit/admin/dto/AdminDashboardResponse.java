package com.linqorbit.admin.dto;

/**
 * Chiffres du tableau de bord de la console admin : comptes, offres, candidatures et files de
 * modération, agrégés côté serveur sur toute la plateforme. Chaque compteur a la définition de la
 * liste admin dont il est le total (voir {@code AdminDashboardService}) — jamais une moyenne ni une
 * tendance, que la base ne porte pas : seuls les « nouveaux sur 7 jours » existent.
 *
 * @param accounts     comptes par statut, identités et nouveaux comptes
 * @param offers       offres par statut (une offre publiée expirée reste « published »)
 * @param liveOffers   offres publiées non expirées (le périmètre du job board)
 * @param applications candidatures visibles (brouillons et retraits exclus)
 * @param moderation   files qui attendent un admin
 * @param processingFailures traitements IA définitivement en échec (lecture seule)
 */
public record AdminDashboardResponse(
        AccountCounts accounts,
        OfferCounts offers,
        long liveOffers,
        ApplicationCounts applications,
        ModerationCounts moderation,
        ProcessingFailures processingFailures) {

    /**
     * {@code candidates} / {@code recruiters} : comptes portant ce profil (cumulables, ne pas sommer) ;
     * {@code admins} : comptes portant le rôle ADMIN ; {@code newLast7Days} : comptes créés dans les 7 derniers jours.
     */
    public record AccountCounts(long active, long inactive, long suspended, long candidates, long recruiters,
            long admins, long newLast7Days) {
    }

    public record OfferCounts(long draft, long validated, long published, long closed) {
    }

    /**
     * {@code toReview} = transmises, en attente de décision ; {@code accepted}/{@code rejected} = décidées ;
     * {@code newLast7Days} = candidatures visibles transmises dans les 7 derniers jours.
     */
    public record ApplicationCounts(long toReview, long accepted, long rejected, long newLast7Days) {
    }

    /**
     * {@code skillSuggestions} = suggestions de compétences en attente (une fois traitée, la ligne disparaît) ;
     * {@code reportsAwaitingMyReview} = signalements IA que l'admin courant peut relire (ni auteur, ni déjà
     * relu) ; {@code reportsTotal} = tous les signalements.
     */
    public record ModerationCounts(long skillSuggestions, long reportsAwaitingMyReview, long reportsTotal) {
    }

    /**
     * Traitements IA <b>définitivement épuisés</b> (statut FAILED : les tentatives automatiques sont
     * finies) et <b>encore d'actualité</b> : un échec remplacé par une version postérieure (nouvelle
     * validation, nouvelle fiche, relance, autre modèle) n'est pas compté. Un compte par sujet
     * (candidat, offre, fiche, matching), jamais par tentative. Les jobs en attente, en cours ou
     * remplacés ne sont pas des échecs.
     *
     * @param candidateAnalyses analyses de fiche candidat dont la dernière version a échoué
     * @param offerAnalyses     analyses de fiche offre dont la dernière version a échoué
     * @param embeddings        vecteurs en échec (modèle actif, fiche courante)
     * @param screenings        screenings d'offre en échec (fiche d'offre courante)
     * @param matchings         analyses de matching dont la dernière version a échoué
     */
    public record ProcessingFailures(long candidateAnalyses, long offerAnalyses, long embeddings, long screenings,
            long matchings) {
    }
}
