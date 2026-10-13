'use client';

import { useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Link2, Link2Off, List, ListOrdered } from 'lucide-react';
import { Markdown } from 'tiptap-markdown';
import { cn } from '@/lib/utils';
import { Button, IconButton, Spinner } from '@/components/ui';

/** tiptap-markdown 通过 storage 暴露序列化能力，官方类型未声明。 */
function getMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as { markdown?: { getMarkdown(): string } };
  return storage.markdown?.getMarkdown() ?? '';
}

export default function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (markdown: string) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } },
      }),
      Markdown.configure({ html: false, linkify: true, breaks: false, tightLists: true }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          'tf-scroll max-h-52 min-h-[76px] overflow-y-auto px-3 py-2 text-[13px] leading-relaxed text-zinc-700 focus:outline-none dark:text-zinc-200',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(getMarkdown(ed));
    },
  });

  if (!editor) {
    return (
      <div className="flex h-[110px] items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800">
        <Spinner />
      </div>
    );
  }

  const active = (name: string) => editor.isActive(name);

  function applyLink() {
    const url = linkUrl.trim();
    if (!url) {
      editor!.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      editor!.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkOpen(false);
    setLinkUrl('');
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-zinc-800">
      <div className="flex items-center gap-0.5 border-b border-zinc-100 bg-zinc-50/60 px-1.5 py-1 dark:border-zinc-800 dark:bg-zinc-800/40">
        <ToolbarButton label="加粗" active={active('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="text-[13px] font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton label="斜体" active={active('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="text-[13px] italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          label="无序列表"
          active={active('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="有序列表"
          active={active('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="链接"
          active={active('link')}
          onClick={() => {
            setLinkUrl(editor.getAttributes('link').href ?? '');
            setLinkOpen((v) => !v);
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        {active('link') && (
          <IconButton
            aria-label="移除链接"
            onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
          >
            <Link2Off className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>

      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-zinc-100 px-2 py-1.5 dark:border-zinc-800">
          <input
            autoFocus
            value={linkUrl}
            placeholder="https://example.com"
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
              if (e.key === 'Escape') setLinkOpen(false);
            }}
            className="h-7 flex-1 rounded-md bg-transparent px-1 text-[12px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-200"
          />
          <Button size="sm" variant="primary" className="h-7 px-2 text-[12px]" onClick={applyLink}>
            确定
          </Button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
          : 'text-zinc-500 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-700',
      )}
    >
      {children}
    </button>
  );
}