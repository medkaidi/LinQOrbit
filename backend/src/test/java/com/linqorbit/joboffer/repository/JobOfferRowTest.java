package com.linqorbit.joboffer.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;

import org.junit.jupiter.api.Test;

/**
 * Garde de TD-024 : la ligne d'une liste ne porte jamais la description (TEXT,
 * jusqu'à 20 000 caractères) ni de liste enfant. Si une colonne lourde y
 * entre, la liste admin la relit pour chaque ligne de chaque page.
 */
class JobOfferRowTest {

    @Test
    void laLigneNePorteNiDescriptionNiListeEnfant() {
        String[] components = Arrays.stream(JobOfferRow.class.getRecordComponents())
                .map(RecordComponent::getName)
                .toArray(String[]::new);

        assertThat(components).doesNotContain("description", "skills", "languages", "degrees", "studyFields");
    }

    /** Toute colonne ajoutée doit être utilisée par la carte : le type d'emploi (un UUID) l'est (T-110). */
    @Test
    void lAjoutDuTypeDEmploiEstAssumeCarLaCarteLAffiche() {
        String[] components = Arrays.stream(JobOfferRow.class.getRecordComponents())
                .map(RecordComponent::getName)
                .toArray(String[]::new);

        assertThat(components).contains("employmentTypeId");
    }
}
