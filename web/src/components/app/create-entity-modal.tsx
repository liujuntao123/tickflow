'use client';

import { useEffect, useState } from 'react';
import { useCreateFolder, useCreateList, useCreateTag, useFolders } from '@/lib/hooks/use-org';
import { PRESET_COLORS, cn, hexToColorInt } from '@/lib/utils';
import { Button, Field, Input, Modal } from '@/components/ui';

export type CreateKind = 'list' | 'folder' | 'tag';

export function CreateEntityModal({
  kind,
  folderId,
  onClose,
}: {
  kind: CreateKind;
  folderId?: string | null;
  onClose: () => void;
}) {
  const createList = useCreateList();
  const createFolder = useCreateFolder();
  const createTag = useCreateTag();
  const { data: folders = [] } = useFolders();

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [parentFolder, setParentFolder] = useState<string>(folderId ?? '');

  useEffect(() => {
    setParentFolder(folderId ?? '');
  }, [folderId]);

  const pending = createList.isPending || createFolder.isPending || createTag.isPending;

  const titles: Record<CreateKind, string> = {
    list: '新建清单',
    folder: '新建文件夹',
    tag: '新建标签',
  };

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const colorInt = hexToColorInt(color);
    if (kind === 'list') {
      await createList.mutateAsync({ name: trimmed, color: colorInt, folderId: parentFolder || null });
    } else if (kind === 'folder') {
      await createFolder.mutateAsync({ name: trimmed, color: colorInt });
    } else {
      await createTag.mutateAsync({ name: trimmed, color: colorInt });
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={titles[kind]}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" loading={pending} onClick={submit} disabled={!name.trim()}>
            创建
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="名称">
          <Input
            autoFocus
            value={name}
            placeholder={kind === 'tag' ? '如：紧急' : '输入名称'}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </Field>

        {kind === 'list' && (
          <Field label="所属文件夹">
            <InnerSelect value={parentFolder} onChange={setParentFolder} folders={folders} />
          </Field>
        )}

        <div className="space-y-1.5">
          <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">颜色</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn(
                  'h-7 w-7 rounded-full ring-offset-2 transition-transform hover:scale-110 dark:ring-offset-zinc-900',
                  color === c ? 'ring-2 ring-zinc-400' : '',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function InnerSelect({
  value,
  onChange,
  folders,
}: {
  value: string;
  onChange: (v: string) => void;
  folders: { id: string; name: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <option value="">无（顶层）</option>
      {folders.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );
}