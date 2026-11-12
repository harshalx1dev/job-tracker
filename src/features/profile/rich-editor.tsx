"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading, Italic, Link as LinkIcon } from "lucide-react";
import {
  docToLines,
  docToMarkup,
  highlightsToDoc,
  markupToDoc,
  type DocNode,
} from "@/lib/rich-doc";
import { normalizeHref, safeHref, toggleHeadingLine } from "@/lib/rich-text";
import { ToolButton } from "./fields";

/**
 * A small rich text editor for resume text. It shows only what the resume can
 * store (bold, italic, links, and for lists: bullets and sub-headings) and
 * saves it in the same plain strings as before, so nothing else changes.
 *
 * - "inline": one paragraph (summary, project description); Enter does nothing.
 * - "bullets": sub-headings and bullets (experience and project highlights).
 *
 * The text is read once when the editor mounts; the parent re-keys it to load
 * different text (the profile and resume pages already do).
 */
type Props =
  | { mode: "inline"; value: string; onChange: (v: string) => void }
  | { mode: "bullets"; value: string[]; onChange: (v: string[]) => void };

const toJson = (editor: Editor) => editor.getJSON() as DocNode;

export function RichEditor(props: Props) {
  const { mode } = props;
  const [initial] = useState(() =>
    props.mode === "inline"
      ? markupToDoc(props.value)
      : highlightsToDoc(props.value),
  );
  // The last value handed to the parent: changes that don't alter it aren't reported.
  const last = useRef(JSON.stringify(props.value));
  const onChange = useRef(props.onChange);
  useEffect(() => {
    onChange.current = props.onChange;
  });

  const editor = useEditor({
    immediatelyRender: false, // the page is server-rendered
    content: initial,
    extensions: [
      Document.extend({
        content: mode === "inline" ? "paragraph" : "(heading | bulletList)+",
      }),
      StarterKit.configure({
        document: false,
        // Only what the stored text can hold.
        blockquote: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        hardBreak: false,
        horizontalRule: false,
        orderedList: false,
        strike: false,
        trailingNode: false,
        underline: false,
        heading: mode === "bullets" ? { levels: [3] } : false,
        bulletList: mode === "bullets" ? {} : false,
        listItem: mode === "bullets" ? {} : false,
        listKeymap: mode === "bullets" ? {} : false,
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: false,
          isAllowedUri: (url) => safeHref(url) !== null,
        },
      }),
    ],
    editorProps: {
      attributes: { class: "outline-none" },
      handleKeyDown:
        mode === "inline" ? (_view, event) => event.key === "Enter" : undefined,
      // One paragraph: paste as plain text on a single line.
      handlePaste:
        mode === "inline"
          ? (view, event) => {
              const text = event.clipboardData?.getData("text/plain");
              if (!text) return false;
              view.dispatch(
                view.state.tr.insertText(text.replace(/\s*\n+\s*/g, " ")),
              );
              return true;
            }
          : undefined,
    },
    onUpdate: ({ editor }) => {
      const doc = toJson(editor);
      const next = mode === "inline" ? docToMarkup(doc) : docToLines(doc);
      const key = JSON.stringify(next);
      if (key === last.current) return;
      last.current = key;
      (onChange.current as (v: string | string[]) => void)(next);
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      link: editor?.isActive("link") ?? false,
      heading: editor?.isActive("heading") ?? false,
    }),
  });

  function setLink() {
    if (!editor) return;
    const current = editor.getAttributes("link").href as string | undefined;
    const raw = window.prompt(
      "Link address (leave empty to remove the link)",
      current ?? "https://",
    );
    if (raw === null) return;
    if (!raw.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = normalizeHref(raw);
    if (!href) {
      window.alert("That doesn't look like a web address.");
      return;
    }
    if (editor.state.selection.empty && !current)
      // Nothing selected: the address itself becomes the link text.
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: href,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  /**
   * Turns the line the cursor is on into a sub-heading, or back into a bullet.
   * Done on the stored lines and the document rebuilt from them, so the editor
   * never holds a shape the text can't store. The cursor stays on that line.
   */
  function toggleHeading() {
    if (!editor) return;
    const { from } = editor.state.selection;
    let line = -1;
    let seen = 0;
    editor.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      if (line < 0 && from < pos + node.nodeSize) line = seen;
      seen++;
    });
    if (line < 0) return;
    const lines = docToLines(toJson(editor), true).map((l, i) =>
      i === line ? toggleHeadingLine(l) : l,
    );
    editor.commands.setContent(highlightsToDoc(lines, true), {
      emitUpdate: true,
    });
    let k = 0;
    editor.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      if (k++ === line)
        editor.commands.setTextSelection(pos + node.nodeSize - 1);
    });
    editor.commands.focus();
  }

  return (
    <div
      className="rounded-lg border border-input bg-transparent text-sm shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
      onKeyDown={(e) => {
        if (
          (e.ctrlKey || e.metaKey) &&
          !e.altKey &&
          e.key.toLowerCase() === "k"
        ) {
          e.preventDefault();
          // The app's global search also listens for Ctrl+K; here it means "link".
          e.stopPropagation();
          setLink();
        }
      }}
    >
      <div className="flex gap-0.5 border-b px-1.5 py-1">
        <ToolButton
          label="Bold (Ctrl+B)"
          active={state?.bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolButton>
        <ToolButton
          label="Italic (Ctrl+I)"
          active={state?.italic}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolButton>
        <ToolButton
          label="Link (Ctrl+K)"
          active={state?.link}
          onClick={setLink}
        >
          <LinkIcon />
        </ToolButton>
        {mode === "bullets" && (
          <ToolButton
            label="Sub-heading: a bold line that names the bullets below it"
            active={state?.heading}
            onClick={toggleHeading}
          >
            <Heading />
          </ToolButton>
        )}
      </div>
      <EditorContent
        editor={editor}
        className="[&_.ProseMirror]:min-h-14 [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:outline-none [&_a]:text-primary [&_a]:underline [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3:first-child]:mt-0 [&_li]:my-0.5 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
}
