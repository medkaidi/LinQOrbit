package com.linqorbit.joboffer.service;

import java.time.LocalDate;
import java.util.Locale;

import com.linqorbit.joboffer.entity.Seniority;
import com.linqorbit.joboffer.exception.InvalidJobOfferFilterException;

/**
 * Analyse des filtres d'offres reçus en texte (séniorité, échéance), partagée
 * par la liste recruteur, le job board et la liste admin : absent ou blanc =
 * pas de filtre ; trim et casse ignorés ; valeur inconnue =
 * {@link InvalidJobOfferFilterException} (400).
 */
public final class OfferFilterParser {

    /** Délai (en jours) du filtre « échéance proche ». */
    public static final int EXPIRING_SOON_DAYS = 30;

    private OfferFilterParser() {
    }

    /** Fenêtre d'échéance d'un filtre : bornes incluses, {@code null} = non borné. */
    public record ExpiryRange(LocalDate from, LocalDate until) {
    }

    public static Seniority parseSeniority(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Seniority.fromApiValue(value.trim().toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new InvalidJobOfferFilterException("seniority", value);
        }
    }

    public static ExpiryRange parseExpiry(String value, LocalDate today) {
        if (value == null || value.isBlank()) {
            return new ExpiryRange(null, null);
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "expired" -> new ExpiryRange(null, today.minusDays(1));
            case "expiringsoon" -> new ExpiryRange(today, today.plusDays(EXPIRING_SOON_DAYS));
            default -> throw new InvalidJobOfferFilterException("expiry", value);
        };
    }
}
