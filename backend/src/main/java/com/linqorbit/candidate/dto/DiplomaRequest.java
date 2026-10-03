package com.linqorbit.candidate.dto;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DiplomaRequest(
        @NotBlank @Size(max = 255) String title,
        @NotNull LocalDate startDate,
        LocalDate endDate,
        @NotBlank @Size(max = 255) String institution,
        @Size(max = 2) String institutionCountry,
        UUID degreeId,
        UUID studyFieldId) {
}
