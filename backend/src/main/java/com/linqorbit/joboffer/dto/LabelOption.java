package com.linqorbit.joboffer.dto;

import java.util.UUID;

/**
 * Option de vocabulaire d'offre (contract_type / employment_type / work_mode,
 * D14) — même forme que {@code LabelReference} des listes candidat
 * (degrees/study-fields).
 */
public record LabelOption(
        UUID id,
        String label) {
}
