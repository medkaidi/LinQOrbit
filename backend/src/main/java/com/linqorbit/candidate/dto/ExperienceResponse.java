package com.linqorbit.candidate.dto;

import java.time.LocalDate;
import java.util.UUID;

public record ExperienceResponse(
        UUID id,
        String positionTitle,
        String description,
        LocalDate startDate,
        LocalDate endDate,
        String companyName,
        String companyCountry) {
}
