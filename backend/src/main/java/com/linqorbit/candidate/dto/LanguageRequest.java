package com.linqorbit.candidate.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record LanguageRequest(
        @NotNull UUID languageId,
        @NotBlank @Pattern(regexp = "A1|A2|B1|B2|C1|C2", message = "must be one of A1, A2, B1, B2, C1, C2") String level) {
}
