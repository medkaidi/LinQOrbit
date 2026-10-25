package com.linqorbit.embedding.dto;

import java.util.List;

/**
 * Réponse de {@code POST /embed} : modèle réellement appelé, dimension et un
 * vecteur par texte, dans l'ordre de la requête.
 */
public record EmbedResponse(String model, int dimensions, List<float[]> embeddings) {
}
