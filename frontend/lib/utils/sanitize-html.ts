import DOMPurify from "dompurify";

/**
 * Sanitise un HTML riche (éditeur Tiptap) avant tout stockage ou affichage —
 * seule porte d'entrée du HTML dans l'app (profil candidat, description
 * d'offre, …). Profile « html » : balises standard, aucune script, aucun
 * gestionnaire d'événement, URIs http(s) seulement.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
