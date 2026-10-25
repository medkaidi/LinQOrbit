package com.linqorbit.embedding.exception;

/**
 * La fiche normalisée ne contient rien de représentable en texte (JSON
 * illisible ou sans aucun champ utile). Échec <b>définitif</b> du job : le
 * rendu est déterministe, le rejouer donnerait le même résultat — aucun
 * retry, aucun appel au fournisseur.
 */
public class EmbeddingNotRenderableException extends RuntimeException {

    public EmbeddingNotRenderableException(String message) {
        super(message);
    }
}
