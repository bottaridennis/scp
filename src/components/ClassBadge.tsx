import type { CSSProperties } from 'react';
import type { ObjectClassInfo } from '../lib/scp';

export default function ClassBadge({ cls, size = 'sm' }: { cls: ObjectClassInfo; size?: 'sm' | 'lg' }) {
  const style = { '--c': cls.color } as CSSProperties;
  return (
    <span
      style={style}
      className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase whitespace-nowrap border border-[color:var(--c)] text-[color:var(--c)] bg-[color-mix(in_srgb,var(--c)_9%,transparent)] ${
        size === 'lg' ? 'text-xs tracking-[0.16em] px-3 py-1.5' : 'text-[10px] tracking-[0.14em] px-1.5 py-0.5'
      }`}
    >
      <span className="size-1.5 rounded-full bg-[color:var(--c)]" />
      {cls.label}
    </span>
  );
}
