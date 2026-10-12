"use client";

import { useEffect, useId } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type RichTextEditorProps = {
  label: string;
  /** HTML sanitisé ("" = vide). */
  value: string;
  onValueChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
};

const TOOLBAR_BUTTON =
  "h-8 rounded-lg flex items-center justify-center gap-1 px-2 text-text-secondary hover:bg-slate-surface hover:text-text-primary transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep disabled:opacity-40 disabled:cursor-not-allowed";

function ToolbarButton({
  label,
  icon,
  text,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon?: string;
  text?: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(TOOLBAR_BUTTON, active && "bg-orange-subtle text-orange-deep")}
    >
      {icon ? <Icon name={icon} className="text-[18px]" /> : null}
      {text ? <span className="text-xs font-bold">{text}</span> : null}
    </button>
  );
}

function ToolbarSeparator() {
  return <span aria-hidden="true" className="w-px h-5 bg-slate-border mx-1" />;
}

/** URL de lien : http(s) uniquement, protocole complété si absent. */
function normalizeHref(raw: string): string | null {
  let href = raw.trim();
  if (!href) return null;
  if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

function isSameHtml(editor: Editor, value: string): boolean {
  return (editor.isEmpty ? "" : editor.getHTML()) === value;
}

/**
 * Éditeur riche (Tiptap) pour les contenus longs sanitisés (description
 * d'offre) — miroir visuel de `Textarea` avec une toolbar sobre. Le HTML
 * natif de l'éditeur est la seule forme échangée ; la chaîne API sanitisée
 * est le seul pont vers la base.
 */
export function RichTextEditor({
  label,
  value,
  onValueChange,
  onBlur,
  placeholder = "Start writing…",
  error,
  disabled = false,
}: RichTextEditorProps) {
  const titleId = useId();
  const errorId = `${titleId}-error`;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https"] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        // px-4 py-3 = miroir du Textarea : sans padding, le texte colle au
        // bord et la dernière ligne entre dans la zone de courbure des coins
        // (overflow-hidden + rounded-2xl la rogne).
        class: "job-offer-description min-h-28 px-4 py-3 font-body-md text-body-md text-text-primary focus:outline-none",
        "aria-labelledby": titleId,
      },
    },
    onUpdate: ({ editor: current }) => {
      onValueChange(current.isEmpty ? "" : current.getHTML());
    },
    onBlur: () => onBlur?.(),
  });

  // Resynchronisation sur reset externe (RHF) sans boucle : on ignore ce que
  // l'utilisateur est en train de saisir.
  useEffect(() => {
    if (!editor || editor.isFocused || isSameHtml(editor, value)) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setOptions({ editable: !disabled });
  }, [editor, disabled]);

  const toggleLink = () => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = normalizeHref(window.prompt("Link URL", "https://") ?? "");
    if (!href) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const run = (chain: (current: Editor) => { run: () => void }) => {
    if (!editor) return;
    chain(editor).run();
  };

  const controlsDisabled = !editor || disabled;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={titleId} className="font-label-md text-label-md text-text-secondary">
        {label}
      </span>
      <div
        className={cn(
          "rounded-2xl overflow-hidden transition-colors",
          error
            ? "bg-error-container ring-1 ring-error"
            : "bg-white border border-slate-border-strong focus-within:border-primary-container",
        )}
      >
        <div
          role="toolbar"
          aria-label="Text formatting"
          className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-border"
        >
          <ToolbarButton
            label="Bold"
            icon="format_bold"
            active={editor?.isActive("bold") ?? false}
            disabled={controlsDisabled}
            onClick={() => run((e) => e.chain().focus().toggleBold())}
          />
          <ToolbarButton
            label="Italic"
            icon="format_italic"
            active={editor?.isActive("italic") ?? false}
            disabled={controlsDisabled}
            onClick={() => run((e) => e.chain().focus().toggleItalic())}
          />
          <ToolbarButton
            label="Underline"
            icon="format_underlined"
            active={editor?.isActive("underline") ?? false}
            disabled={controlsDisabled}
            onClick={() => run((e) => e.chain().focus().toggleUnderline())}
          />
          <ToolbarSeparator />
          <ToolbarButton
            label="Heading 2"
            text="H2"
            active={editor?.isActive("heading", { level: 2 }) ?? false}
            disabled={controlsDisabled}
            onClick={() => run((e) => e.chain().focus().toggleHeading({ level: 2 }))}
          />
          <ToolbarButton
            label="Heading 3"
            text="H3"
            active={editor?.isActive("heading", { level: 3 }) ?? false}
            disabled={controlsDisabled}
            onClick={() => run((e) => e.chain().focus().toggleHeading({ level: 3 }))}
          />
          <ToolbarSeparator />
          <ToolbarButton
            label="Bulleted list"
            icon="format_list_bulleted"
            active={editor?.isActive("bulletList") ?? false}
            disabled={controlsDisabled}
            onClick={() => run((e) => e.chain().focus().toggleBulletList())}
          />
          <ToolbarButton
            label="Numbered list"
            icon="format_list_numbered"
            active={editor?.isActive("orderedList") ?? false}
            disabled={controlsDisabled}
            onClick={() => run((e) => e.chain().focus().toggleOrderedList())}
          />
          <ToolbarSeparator />
          <ToolbarButton
            label="Link"
            icon="link"
            active={editor?.isActive("link") ?? false}
            disabled={controlsDisabled}
            onClick={toggleLink}
          />
        </div>
        <div aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}>
          <EditorContent editor={editor} />
        </div>
      </div>
      {error ? (
        <p id={errorId} className="font-body-sm text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
