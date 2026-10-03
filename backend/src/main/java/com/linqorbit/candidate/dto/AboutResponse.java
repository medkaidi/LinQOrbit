package com.linqorbit.candidate.dto;

public record AboutResponse(
        String title,
        String bio,
        Integer yearsOfExperience,
        String searchStatus) {
}
