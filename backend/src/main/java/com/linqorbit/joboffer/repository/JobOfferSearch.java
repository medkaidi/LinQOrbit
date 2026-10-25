package com.linqorbit.joboffer.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.UUID;

import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.entity.Seniority;

/**
 * Critères d'une recherche d'offres (T-70, T-77) : chaque composant {@code null}
 * est une clause <b>absente</b> de la requête — jamais un paramètre nul.
 *
 * @param companyIds     périmètre du recruteur ({@code null} = aucune restriction de société)
 * @param status         statut exact
 * @param publicToday    non nul : offres sans échéance ou non expirées à cette date (job board)
 * @param titlePattern   motif {@link com.linqorbit.joboffer.service.OfferSearchPattern} sur le titre
 * @param matchCompanyName le motif cherche aussi dans le nom de la société (job board)
 * @param expiresFrom    échéance minimale incluse (les offres sans échéance sont écartées)
 * @param expiresUntil   échéance maximale incluse (les offres sans échéance sont écartées)
 */
public record JobOfferSearch(
        Collection<UUID> companyIds,
        JobOfferStatus status,
        LocalDate publicToday,
        UUID workModeId,
        UUID contractTypeId,
        UUID employmentTypeId,
        Seniority seniority,
        String country,
        String titlePattern,
        boolean matchCompanyName,
        LocalDate expiresFrom,
        LocalDate expiresUntil,
        Order order) {

    /** Caractère d'échappement déclaré dans chaque {@code like … escape '!'} de la recherche. */
    public static final char LIKE_ESCAPE = '!';

    /** Tris disponibles — chaque ordre se termine par {@code id} (pagination stable). */
    public enum Order {
        /** Liste recruteur : création la plus récente d'abord. */
        CREATED_DESC("o.createdAt desc, o.id desc"),
        /** Job board : publication la plus récente d'abord. */
        PUBLISHED_DESC("o.publishedAt desc, o.id desc"),
        /** Job board : échéance la plus proche d'abord, sans échéance en dernier. */
        EXPIRING_SOON("o.expiresAt asc nulls last, o.publishedAt desc, o.id desc");

        private final String clause;

        Order(String clause) {
            this.clause = clause;
        }

        String clause() {
            return clause;
        }
    }
}
