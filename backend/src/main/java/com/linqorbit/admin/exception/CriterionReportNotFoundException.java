package com.linqorbit.admin.exception;

import java.util.UUID;

public class CriterionReportNotFoundException extends RuntimeException {

    public CriterionReportNotFoundException(UUID reportId) {
        super("Signalement introuvable : " + reportId);
    }
}
