package com.linqorbit.embedding.dto;

import java.util.List;

/** Corps de {@code POST /embed} du service IA : textes déjà rendus, un vecteur par texte. */
public record EmbedRequest(List<String> texts) {
}
