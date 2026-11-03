import DOMPurify from "dompurify";

/**
 * Vocabulaire HTML de la plateforme — <b>miroir exact</b> de la safelist
 * jsoup côté serveur (`backend/…/joboffer/service/JobOfferDescriptionSanitizer`,
 * D108). Les deux portes doivent dire la même chose : une divergence ferait
 * perdre du contenu légitime à l'écriture (le serveur amputant ce que
 * l'éditeur produit).
 *
 * <p>La liste est alignée sur la sortie réelle de l'éditeur Tiptap
 * (`StarterKit` : paragraphe, gras, italique, souligné, barré, code, citation,
 * séparateur, titre H2/H3, listes, lien) — ni image, ni style, ni SVG/MathML,
 * ni attribut d'événement.
 */
export const ALLOWED_HTML_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "pre",
  "code",
  "blockquote",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "hr",
  "a",
] as const;

/** Attributs autorisés — `href`, `target` et `rel` du lien Tiptap. */
export const ALLOWED_HTML_ATTRIBUTES = ["href", "target", "rel"] as const;

/**
 * URI de lien : `http(s)` absolu uniquement — même contrat que l'éditeur
 * (`normalizeHref` force le protocole) et que la safelist serveur. Un lien
 * relatif perd son `href` (le texte reste) : identique côté serveur.
 */
const ALLOWED_URI_REGEXP = /^https?:/i;

/**
 * Configuration DOMPurify — <b>pas de `USE_PROFILES`</b> : ce dernier
 * <b>écrase</b> `ALLOWED_TAGS`/`ALLOWED_ATTR` (DOMPurify 3, `purify.cjs.js`
 * l. 1351-1357) et réautoriserait un vocabulaire large (div, span, table,
 * img, h1…). `ALLOW_ARIA_ATTR`/`ALLOW_DATA_ATTR` sont coupés : sans cela,
 * `aria-*` et `data-*` contourneraient `ALLOWED_ATTR`.
 *
 * <p>`ALLOWED_URI_REGEXP` s'applique à **tous** les attributs autorisés :
 * `target` et `rel` (qui ne sont pas des URI) doivent donc être déclarés
 * dans `ADD_URI_SAFE_ATTR`, sinon DOMPurify les écarte — le serveur (jsoup)
 * les conserve. `href` reste le seul attribut contrôlé par le protocole :
 * `http(s)` absolu, comme dans l'éditeur et dans la safelist serveur.
 */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [...ALLOWED_HTML_TAGS],
  ALLOWED_ATTR: [...ALLOWED_HTML_ATTRIBUTES],
  ALLOWED_URI_REGEXP,
  ADD_URI_SAFE_ATTR: ["target", "rel"],
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitise un HTML riche (éditeur Tiptap) — **écriture** comme **lecture**.
 * L'écriture est la porte d'entrée de l'app ; la lecture est une défense
 * supplémentaire (une ligne héritée ou un futur chemin d'écriture ne doit
 * jamais atteindre `dangerouslySetInnerHTML` en HTML cru).
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/**
 * Sanitise un HTML et normalise l'absence de contenu : `null`, `undefined`,
 * blanc ou document vide (`<p></p>`) → `null`. Utilisé à la lecture (champ
 * `description` d'une offre) comme à l'écriture (payload du formulaire).
 */
export function sanitizeHtmlOrNull(html: string | null | undefined): string | null {
  if (html === null || html === undefined) {
    return null;
  }
  const clean = sanitizeHtml(html).trim();
  return clean === "" || clean === "<p></p>" ? null : clean;
}
