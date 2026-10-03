package com.linqorbit.candidate.dto;

import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SkillRequest(
        @NotNull UUID skillId,
        @NotNull @Min(1) @Max(5) Integer level,
        @Min(0) Integer yearsExperience) {
}
