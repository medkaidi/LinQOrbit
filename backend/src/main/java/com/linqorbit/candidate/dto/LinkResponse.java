package com.linqorbit.candidate.dto;

import java.time.LocalDate;
import java.util.UUID;

public record LinkResponse(
        UUID id,
        String label,
        String url,
        String linkType,
        String issuer,
        LocalDate issuedAt) {
}
