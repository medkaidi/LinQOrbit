package com.linqorbit.candidate.dto;

import java.util.UUID;

public record LanguageResponse(
        UUID languageId,
        String symbol,
        String name,
        String level) {
}
