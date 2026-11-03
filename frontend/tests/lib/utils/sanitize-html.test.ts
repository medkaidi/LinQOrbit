import { describe, expect, it } from "vitest";

import {
  ALLOWED_HTML_ATTRIBUTES,
  ALLOWED_HTML_TAGS,
  sanitizeHtml,
  sanitizeHtmlOrNull,
} from "@/lib/utils/sanitize-html";

/**
 * Sanitisation du HTML riche (D108).
 *
 * <p>La porte navigateur est une défense en profondeur — le serveur sanitise
 * déjà à l'écriture (`JobOfferDescriptionSanitizer`). Les deux implémentations
 * doivent dire la même chose : le vocabulaire ci-dessous est le miroir exact
 * de la safelist jsoup, alignée sur ce que l'éditeur Tiptap produit.
 */
describe("sanitizeHtml", () => {
  it("keeps standard editorial HTML", () => {
    const html =
      '<h2>Role</h2><p>You will build <strong>APIs</strong> in <em>Java</em>.</p><ul><li>Ship weekly</li></ul><ol><li>Design</li></ol><p><a href="https://example.com">Docs</a></p>';

    expect(sanitizeHtml(html)).toBe(html);
  });

  it("keeps the whole vocabulary produced by the editor", () => {
    const html =
      "<p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>strike</s></p>" +
      "<h2>Title</h2><h3>Subtitle</h3>" +
      "<ul><li><p>bullet</p></li></ul><ol><li><p>number</p></li></ol>" +
      "<blockquote><p>quote</p></blockquote><pre><code>code</code></pre><hr><p>line<br>break</p>";

    expect(sanitizeHtml(html)).toBe(html);
  });

  it("strips scripts, event handlers and javascript: URLs", () => {
    const dirty =
      '<p onclick="steal()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)">';

    const clean = sanitizeHtml(dirty);

    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("<p>Hi</p>");
    expect(clean).toContain("x");
  });

  it("removes the active tags with their content", () => {
    const dirty =
      "<p>ok</p><style>body{display:none}</style><iframe src=\"https://evil.test\"></iframe>" +
      "<svg><script>alert(1)</script></svg><object data=\"x\"></object><form><input name=\"a\"></form>";

    const clean = sanitizeHtml(dirty);

    expect(clean).toBe("<p>ok</p>");
    expect(clean).not.toContain("style");
    expect(clean).not.toContain("iframe");
    expect(clean).not.toContain("svg");
    expect(clean).not.toContain("object");
    expect(clean).not.toContain("form");
    expect(clean).not.toContain("input");
  });

  it("keeps the text of a tag outside the vocabulary, but not the tag", () => {
    expect(sanitizeHtml("<div>kept text</div>")).toBe("kept text");
    expect(sanitizeHtml("<h1>Title</h1><p>body</p>")).toBe("Title<p>body</p>");
    expect(sanitizeHtml("<table><tr><td>cell</td></tr></table>")).toBe("cell");
  });

  it("restricts the vocabulary to the editor output", () => {
    expect(ALLOWED_HTML_TAGS).toEqual([
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
    ]);
    expect(ALLOWED_HTML_ATTRIBUTES).toEqual(["href", "target", "rel"]);
  });

  it("keeps the link attributes of the editor (target and rel are not URIs)", () => {
    const html =
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">Docs</a>';

    // `target` et `rel` ne sont pas des URI : sans `ADD_URI_SAFE_ATTR`,
    // DOMPurify les écarte (ils ne passeraient pas ALLOWED_URI_REGEXP).
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("drops the href of any link that is not an absolute http(s) URL", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">bad</a>')).toBe("<a>bad</a>");
    expect(sanitizeHtml('<a href="/jobs/abc">relative</a>')).toBe("<a>relative</a>");
    expect(sanitizeHtml('<a href="mailto:a@b.test">mail</a>')).toBe("<a>mail</a>");
    expect(sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">data</a>')).toBe(
      "<a>data</a>",
    );
  });

  it("drops the aria and data attributes, which would bypass the allowed list", () => {
    const clean = sanitizeHtml('<p aria-label="x" data-role="y" class="z">Hi</p>');

    expect(clean).toBe("<p>Hi</p>");
  });

  it("passes empty strings through unchanged", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("is idempotent", () => {
    const dirty =
      '<p onclick="x()">Hello <strong>world</strong></p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>';
    const once = sanitizeHtml(dirty);

    expect(sanitizeHtml(once)).toBe(once);
  });
});

describe("sanitizeHtmlOrNull", () => {
  it("returns null when there is no content", () => {
    expect(sanitizeHtmlOrNull(null)).toBeNull();
    expect(sanitizeHtmlOrNull(undefined)).toBeNull();
    expect(sanitizeHtmlOrNull("")).toBeNull();
    expect(sanitizeHtmlOrNull("   \n ")).toBeNull();
    expect(sanitizeHtmlOrNull("<p></p>")).toBeNull();
  });

  it("returns null when the payload is entirely malicious", () => {
    expect(sanitizeHtmlOrNull("<img src=x onerror=alert(1)>")).toBeNull();
    expect(sanitizeHtmlOrNull("<script>alert(1)</script>")).toBeNull();
  });

  it("keeps a legitimate description unchanged", () => {
    const html = "<h2>Role</h2><p>Ship <strong>weekly</strong>.</p>";

    expect(sanitizeHtmlOrNull(html)).toBe(html);
  });

  it("returns the sanitized version of a hostile description", () => {
    expect(
      sanitizeHtmlOrNull('<p>Hi</p><script>alert(1)</script><img src=x onerror="steal()">'),
    ).toBe("<p>Hi</p>");
  });
});
