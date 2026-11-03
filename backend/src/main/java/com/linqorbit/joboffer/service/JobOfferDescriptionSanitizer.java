package com.linqorbit.joboffer.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Cleaner;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Component;

/**
 * Sanitisation de la description d'offre (HTML riche) — <b>la porte serveur</b>.
 *
 * <p>Avant D108, la seule sanitisation vivait dans le navigateur
 * ({@code frontend/lib/utils/sanitize-html.ts}) : le serveur stockait puis
 * relisait du HTML brut, et le frontend l'injectait via
 * {@code dangerouslySetInnerHTML} — sur la fiche publique, sans
 * authentification. Un appel direct à l'API suffisait à déposer une charge
 * utile. Le serveur ne doit jamais faire confiance au client : cette classe
 * est la source de vérité, la porte navigateur n'étant plus qu'une défense
 * supplémentaire.
 *
 * <p>Le vocabulaire autorisé est <b>strictement aligné sur ce que l'éditeur
 * Tiptap produit</b> ({@code StarterKit} v3 : paragraphes, gras, italique,
 * souligné, barré, titres H2/H3, listes, lien, code, citation, séparateur,
 * retour à la ligne) et sur son miroir frontend
 * ({@code ALLOWED_HTML_TAGS} de {@code sanitize-html.ts}) : ni image, ni
 * style, ni attribut d'événement, ni SVG/MathML, et des URI de lien limitées à
 * {@code http(s)}.
 */
@Component
public class JobOfferDescriptionSanitizer {

    /**
     * Vocabulaire HTML de la plateforme — miroir exact de
     * {@code frontend/lib/utils/sanitize-html.ts} ({@code ALLOWED_HTML_TAGS} /
     * {@code ALLOWED_HTML_ATTRIBUTES}). Toute divergence ferait perdre du
     * contenu à l'écriture : les deux portes doivent dire la même chose.
     */
    static final Safelist ALLOWED = Safelist.none()
            .addTags("p", "br", "strong", "em", "u", "s", "pre", "code", "blockquote",
                    "h2", "h3", "ul", "ol", "li", "hr", "a")
            .addAttributes("a", "href", "target", "rel")
            .addProtocols("a", "href", "http", "https");

    /**
     * Balises écartées <b>avec leur contenu</b> : un {@code script} ne doit
     * pas laisser de texte résiduel dans la description.
     */
    private static final String DROPPED_WITH_CONTENT = "script, style, noscript, template, iframe, object, embed, "
            + "svg, math, form, input, button, select, textarea, link, meta, base";

    /**
     * HTML → HTML sanitisé. {@code null} / vide → {@code null} (champ
     * facultatif). Le texte utile est conservé quand une balise est écartée ;
     * seule la balise disparaît.
     */
    public String sanitize(String html) {
        if (html == null) {
            return null;
        }
        String trimmed = html.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        Document dirty = Jsoup.parseBodyFragment(trimmed);
        dirty.outputSettings().prettyPrint(false);
        for (Element element : dirty.body().select(DROPPED_WITH_CONTENT)) {
            element.remove();
        }
        Document clean = new Cleaner(ALLOWED).clean(dirty);
        clean.outputSettings().prettyPrint(false);
        String sanitized = clean.body().html().trim();
        return sanitized.isEmpty() ? null : sanitized;
    }
}
