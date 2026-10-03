package com.linqorbit.candidate.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LinkRequest(
        @NotBlank @Size(max = 255) String label,
        @NotBlank @Size(max = 500) @Pattern(regexp = "https?://\\S+", message = "must be an http(s) URL") String url,
        @NotBlank String linkType,
        @Size(max = 255) String issuer,
        LocalDate issuedAt) {
}
