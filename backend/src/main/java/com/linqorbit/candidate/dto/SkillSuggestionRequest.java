package com.linqorbit.candidate.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SkillSuggestionRequest(
        @NotNull @Size(max = 50) List<@NotBlank @Size(max = 100) String> names) {
}
