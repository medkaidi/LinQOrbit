package com.linqorbit.candidate.dto;

import java.util.UUID;

public record SkillResponse(
        UUID skillId,
        String name,
        String skillType,
        Integer level,
        Integer yearsExperience) {
}
