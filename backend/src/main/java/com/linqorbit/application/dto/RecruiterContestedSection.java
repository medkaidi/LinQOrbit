package com.linqorbit.application.dto;

/**
 * Section du matching contenant au moins un critère contesté par le candidat,
 * avec le nombre de critères contestés ({@code count >= 1}). {@code section}
 * est la clé API recruteur (comme {@link RecruiterSectionScore#section()}).
 */
public record RecruiterContestedSection(
        String section,
        int count) {
}
