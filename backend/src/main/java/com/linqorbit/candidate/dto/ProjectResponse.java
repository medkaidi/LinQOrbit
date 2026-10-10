package com.linqorbit.candidate.dto;

import java.time.LocalDate;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        String name,
        String role,
        String description,
        LocalDate startDate,
        LocalDate endDate,
        String technologies) {
}
