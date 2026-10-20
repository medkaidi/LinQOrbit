package com.linqorbit.matching.dto;

import java.util.List;

/**
 * Exigence de formation telle qu'envoyée au service IA (D68) : présente sur le
 * seul critère {@code education:requirement}, absente ({@code null}) partout
 * ailleurs, certifications comprises.
 */
public record MatchingEducationPayload(
        List<String> degreeLevels,
        List<String> credentials,
        List<String> fields) {
}
