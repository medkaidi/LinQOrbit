package com.linqorbit.candidate.dto;

import java.time.LocalDate;
import java.util.UUID;

public record DiplomaResponse(
        UUID id,
        String title,
        LocalDate startDate,
        LocalDate endDate,
        String institution,
        String institutionCountry,
        UUID degreeId,
        String degreeLabel,
        UUID studyFieldId,
        String studyFieldLabel) {
}
