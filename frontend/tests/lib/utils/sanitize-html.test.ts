import { describe, expect, it } from "vitest";

import { sanitizeHtml } from "@/lib/utils/sanitize-html";

describe("sanitizeHtml", () => {
  it("keeps standard editorial HTML", () => {
    const html =
      '<h2>Role</h2><p>You will build <strong>APIs</strong> in <em>Java</em>.</p><ul><li>Ship weekly</li></ul><ol><li>Design</li></ol><p><a href="https://example.com">Docs</a></p>';

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

  it("passes empty strings through unchanged", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});
