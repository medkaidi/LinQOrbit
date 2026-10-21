package com.linqorbit.application.dto;

import java.util.UUID;

/** CV épinglé à la transmission, téléchargeable par un membre de la company. */
public record RecruiterCvSummary(
        UUID attachmentId,
        String originalName,
        Long sizeBytes) {
}
