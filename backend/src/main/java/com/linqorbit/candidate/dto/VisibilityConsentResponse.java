package com.linqorbit.candidate.dto;

import java.time.LocalDateTime;

/**
 * État du consentement à la visibilité recruteur (T-102, D86).
 * {@code consentedAt} est {@code null} sans consentement.
 */
public record VisibilityConsentResponse(boolean consented, LocalDateTime consentedAt) {
}
