package com.linqorbit.matching.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * Provenance du résultat (D79) : le nom du modèle est relu tel quel, jamais
 * complété pour un ancien résultat (schéma 1), un champ nul ou une valeur
 * illisible.
 */
class MatchingResultReaderTest {

    private final ObjectMapper objectMapper = JsonMapper.builder().build();
    private final MatchingResultReader reader = new MatchingResultReader(objectMapper);

    @Test
    void litLeNomDuModeleDuResultat() throws Exception {
        JsonNode root = objectMapper.readTree("""
                {"schemaVersion": "2", "policyVersion": "generic-1",
                 "modelName": "gemini-3.1-flash-lite", "sections": []}""");

        assertThat(reader.modelName(root)).isEqualTo("gemini-3.1-flash-lite");
    }

    @Test
    void absenceNulOuValeurVideNeProduitAucunNom() throws Exception {
        // Ancien résultat (schéma 1) : le champ n'existe pas.
        assertThat(reader.modelName(objectMapper.readTree(
                "{\"schemaVersion\": \"1\", \"sections\": []}"))).isNull();
        // Analyse 100 % déterministe : le champ existe et vaut null.
        assertThat(reader.modelName(objectMapper.readTree(
                "{\"schemaVersion\": \"2\", \"modelName\": null, \"sections\": []}"))).isNull();
        assertThat(reader.modelName(objectMapper.readTree(
                "{\"schemaVersion\": \"2\", \"modelName\": \"   \", \"sections\": []}"))).isNull();
        assertThat(reader.modelName(null)).isNull();
    }

    @Test
    void uneValeurNonTextuelleNeProduitAucunNom() throws Exception {
        assertThat(reader.modelName(objectMapper.readTree(
                "{\"schemaVersion\": \"2\", \"modelName\": 42, \"sections\": []}"))).isNull();
    }
}
