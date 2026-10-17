import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SIDEBAR_ITEM_CLASS, SidebarLink } from "@/components/layout/sidebar-link";

/** Classes de géométrie (taille/forme/espacement) — elles ne doivent pas bouger entre états. */
const GEOMETRY = /^(w-|h-|p[xy]?-|gap-|rounded-|border$|flex$|items-|justify-|shrink-)/;

function geometryOf(element: Element) {
  return Array.from(element.classList)
    .filter((name) => GEOMETRY.test(name))
    .sort();
}

function renderLink(active: boolean, collapsed = false) {
  const view = render(
    <SidebarLink href="/profile" icon="person" label="Profile" active={active} collapsed={collapsed} />,
  );
  const link = within(view.container).getByRole("link");
  const iconBubble = link.firstElementChild!.firstElementChild!;
  return { link, iconBubble, unmount: view.unmount };
}

describe("SidebarLink — style regressions (TD-007)", () => {
  it("keeps the same geometry active and idle — only colours change", () => {
    const active = renderLink(true);
    const idle = renderLink(false);

    expect(geometryOf(idle.link)).toEqual(geometryOf(active.link));
    expect(geometryOf(idle.iconBubble)).toEqual(geometryOf(active.iconBubble));
    expect(geometryOf(active.iconBubble)).toEqual(
      expect.arrayContaining(["w-7", "h-7", "rounded-full"]),
    );
  });

  it("shares the item base class in both states (border reserved even when idle)", () => {
    const active = renderLink(true);
    const idle = renderLink(false);

    for (const name of SIDEBAR_ITEM_CLASS.split(" ")) {
      expect(active.link).toHaveClass(name);
      expect(idle.link).toHaveClass(name);
    }
    expect(idle.link).toHaveClass("border-transparent");
    expect(active.link).toHaveClass("border-orange-border");
  });

  it("marks the active route without any « Active » badge", () => {
    const { link } = renderLink(true);
    expect(link).toHaveAttribute("aria-current", "page");
    // Seuls l'icône (ligature Material) et le libellé : aucun badge en plus.
    expect(link.textContent).toBe("personProfile");
    expect(screen.queryByText(/active/i)).not.toBeInTheDocument();
  });

  it("leaves aria-current unset on an idle link", () => {
    expect(renderLink(false).link).not.toHaveAttribute("aria-current");
  });

  it("collapses to an icon rail with an accessible name and a tooltip", () => {
    const { link } = renderLink(false, true);
    expect(link).toHaveAccessibleName("Profile");
    expect(link).toHaveAttribute("title", "Profile");
    expect(link).toHaveClass("justify-center", "px-0");
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
  });

  it("shows the label without tooltip when expanded", () => {
    const { link } = renderLink(false);
    expect(link).not.toHaveAttribute("title");
    expect(link).toHaveClass("px-3");
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });
});
