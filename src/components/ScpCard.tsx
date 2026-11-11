import type { CSSProperties } from 'react';
import { Bookmark, Star } from 'lucide-react';
import type { SCPItem } from '../services/scpApi';
import { formatRating, getObjectClass, seriesLabel } from '../lib/scp';
import { href } from '../lib/router';
import ClassBadge from './ClassBadge';

interface ScpCardProps {
  item: SCPItem;
  saved: boolean;
  onToggleSave: (id: string) => void;
}

export default function ScpCard({ item, saved, onToggleSave }: ScpCardProps) {
  const cls = getObjectClass(item);
  return (
    <article
      style={{ '--c': cls.color } as CSSProperties}
      className="group relative flex flex-col border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card"
    >
      <span className="absolute inset-y-0 left-0 w-[3px] bg-[color:var(--c)] opacity-70 transition-opacity group-hover:opacity-100" />
      <a href={href.article(item.id)} className="flex flex-1 flex-col p-5 pl-6 after:absolute after:inset-0">
        <div className="mb-4 flex items-start justify-between gap-3 pr-8">
          <span className="font-mono text-[13px] font-bold tracking-wider text-ink">{item.scp}</span>
        </div>
        <h3 className={`font-serif text-[1.3rem] leading-snug line-clamp-2 ${item.title === item.scp ? 'italic text-muted' : 'text-ink'}`}>
          {item.title === item.scp ? 'Titolo non registrato' : item.title}
        </h3>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-5">
          <ClassBadge cls={cls} />
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-2">
            <Star size={11} className="fill-current" /> {formatRating(item.rating)}
          </span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted">
            {seriesLabel(item.series)}
          </span>
        </div>
      </a>
      <button
        onClick={() => onToggleSave(item.id)}
        aria-pressed={saved}
        aria-label={saved ? `Rimuovi ${item.scp} dai salvati` : `Salva ${item.scp}`}
        className={`absolute right-3 top-3 z-10 grid size-8 place-items-center transition-colors ${
          saved ? 'text-accent' : 'text-muted hover:text-ink'
        }`}
      >
        <Bookmark size={17} className={saved ? 'fill-current' : ''} />
      </button>
    </article>
  );
}
