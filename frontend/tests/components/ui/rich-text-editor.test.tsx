import { beforeAll, describe, expect, it, vi } from "vitest";
import { type ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { RichTextEditor } from "@/components/ui/rich-text-editor";

// jsdom n'implémente pas la géométrie de Range dont ProseMirror a besoin.
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  Range.prototype.getClientRects = () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: [][Symbol.iterator],
    }) as unknown as DOMRectList;
});

function renderEditor(props: Partial<ComponentProps<typeof RichTextEditor>> = {}) {
  const onValueChange = vi.fn();
  render(
    <RichTextEditor
      label="Description"
      value=""
      onValueChange={onValueChange}
      placeholder="What will this person build?"
      {...props}
    />,
  );
  return { onValueChange };
}

describe("RichTextEditor", () => {
  it("exposes the label, a toolbar and the editable region", () => {
    renderEditor();

    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Text formatting" })).toBeInTheDocument();
    const textbox = screen.getByRole("textbox", { name: "Description" });
    expect(textbox).toBeInTheDocument();
    // Padding miroir Textarea : sans lui, le texte colle au bord et la
    // dernière ligne entre dans la courbure des coins (rounded + overflow-hidden).
    expect(textbox.className).toContain("px-4");
    expect(textbox.className).toContain("py-3");
  });

  it("shows every formatting control", () => {
    renderEditor();

    for (const name of [
      "Bold",
      "Italic",
      "Underline",
      "Heading 2",
      "Heading 3",
      "Bulleted list",
      "Numbered list",
      "Link",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("renders an existing HTML value", () => {
    renderEditor({ value: "<h2>Role</h2><p>Ship weekly.</p>" });

    expect(screen.getByText("Role", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByText("Ship weekly.", { selector: "p" })).toBeInTheDocument();
  });

  it("reports content changes as HTML", async () => {
    const { onValueChange } = renderEditor();
    const textbox = screen.getByRole("textbox", { name: "Description" });

    await act(async () => {
      textbox.appendChild(document.createTextNode("Ship weekly"));
      fireEvent.input(textbox, { bubbles: true });
    });

    expect(onValueChange).toHaveBeenCalled();
    expect(onValueChange.mock.calls.at(-1)?.[0]).toContain("Ship weekly");
  });

  it("surfaces an error message", () => {
    renderEditor({ error: "Must be at most 20000 characters" });

    expect(
      screen.getByText("Must be at most 20000 characters"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Description" }).closest("[aria-invalid]")).toHaveAttribute(
      "aria-invalid",
    );
  });

  it("disables every control when disabled", () => {
    renderEditor({ disabled: true });

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
