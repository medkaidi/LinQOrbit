package com.linqorbit.joboffer.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import com.linqorbit.screening.dto.ScreeningSignal;

/**
 * Ligne de la liste des offres d'un recruteur (D34) : vue légère — la
 * description et les listes enfants (skills, langues, diplômes, domaines)
 * ne sont servies que par la fiche détail ({@link JobOfferResponse}).
 * {@code readyToPublish} porte le gate de complétude frontend (description,
 * pays, type d'emploi, au moins un skill) sans exposer la description.
 * {@code analysisOutdated} : fiche de référence sur une version de schéma
 * périmée (D63), même signal que la fiche détail.
 */
public record JobOfferListItem(
        UUID id,
        UUID companyId,
        String status,
        String title,
        String publicId,
        String slug,
        String seniority,
        String city,
        String country,
        UUID contractTypeId,
        UUID employmentTypeId,
        UUID workModeId,
        LocalDate expiresAt,
        BigDecimal salaryMin,
        BigDecimal salaryMax,
        String salaryCurrency,
        String salaryPeriod,
        boolean hasUnvalidatedChanges,
        boolean normalizationInProgress,
        boolean normalizationFailed,
        boolean analysisOutdated,
        /**
         * Recherche automatique de candidats (T-101) : statut du dernier job et
         * nombre de suggérés une fois terminée ; {@code null} tant qu'aucune
         * recherche n'a été lancée (offre non publiée).
         */
        ScreeningSignal screening,
        boolean readyToPublish,
        /**
         * Nombre de candidatures visibles de l'offre (transmises, acceptées,
         * rejetées — brouillons et retraits exclus), calculé par le serveur
         * comme le tri par contestations : jamais un COUNT par offre.
         */
        int applicationCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
