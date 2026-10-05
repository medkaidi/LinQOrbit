package com.linqorbit.candidate.dto;

public record AboutResponse(
        String title,
        String targetPosition,
        String bio,
        Integer yearsOfExperience,
        String searchStatus) {
}
