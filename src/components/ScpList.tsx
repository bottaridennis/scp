import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import type { SCPItem } from '../services/scpApi';
import { compareByNumber, formatRating, getObjectClass, OBJECT_CLASSES, seriesLabel } from '../lib/scp';
import { href } from '../lib/router';
import { useFavorites } from '../lib/storage';
import ScpCard from './ScpCard';
import ClassBadge from './ClassBadge';
import { EmptyState } from './States';

type Sort = 'relevance' | 'number' | 'number-desc' | 'rating' | 'title';
type View = 'grid' | 'table';

const PAGE_SIZE = 24;

const SORTS: { key: Sort; label: string }[] = [
  { key: 'relevance', label: 'Rilevanza' },
  { key: 'number', label: 'N° ↑' },
  { key: 'number-desc', label: 'N° ↓' },
  { key: 'rating', label: 'Voto' },
  { key: 'title', label: 'A–Z' },
];

interface ScpListProps {
  kicker: string;
  title: string;
  description?: ReactNode;
  items: SCPItem[];
  defaultSort?: Sort;
  /** Changing this key resets filters and pagination (e.g. route changes). */
  resetKey: string;
  emptyMessage?: ReactNode;
}

function readView(): View {
  try {
    return localStorage.getItem('scp-view') === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}

export default function ScpList({ kicker, title, description, items, defaultSort = 'number', resetKey, emptyMessage }: ScpListProps) {
  const [sort, setSort] = useState<Sort>(defaultSort);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>(readView);
  const { favorites, toggle } = useFavorites();

  useEffect(() => {
    setSort(defaultSort);
    setClassFilter(null);
    setPage(1);
  }, [resetKey, defaultSort]);

  useEffect(() => {
    try {
      localStorage.setItem('scp-view', view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const k = getObjectClass(item).key;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const arr = classFilter ? items.filter((i) => getObjectClass(i).key === classFilter) : [...items];
    switch (sort) {
      case 'number':
        arr.sort(compareByNumber);
        break;
      case 'number-desc':
        arr.sort((a, b) => compareByNumber(b, a));
        break;
      case 'rating':
        arr.sort((a, b) => b.rating - a.rating);
        break;
      case 'title':
        arr.sort((a, b) => a.title.localeCompare(b.title, 'it'));
        break;
    }
    return arr;
  }, [items, sort, classFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const goTo = (p: number) => {
    setPage(Math.min(Math.max(1, p), pageCount));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const availableClasses = OBJECT_CLASSES.filter((c) => classCounts[c.key]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="mb-8 border-b border-line-strong pb-6 animate-rise">
        <p className="kicker mb-3">{kicker}</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl">{title}</h1>
          <p className="font-mono text-xs uppercase tracking-widest text-ink-2">
            <span className="text-2xl font-bold text-ink">{filtered.length.toLocaleString('it-IT')}</span>{' '}
            dossier
          </p>
        </div>
        {description && <div className="mt-4 max-w-2xl font-serif text-lg text-ink-2">{description}</div>}
      </header>

      {items.length > 0 && (
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtra per classe">
            <button
              onClick={() => {
                setClassFilter(null);
                setPage(1);
              }}
              aria-pressed={classFilter === null}
              className={`border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                classFilter === null ? 'border-line-strong bg-ink text-bg' : 'border-line text-ink-2 hover:border-line-strong'
              }`}
            >
              Tutte
            </button>
            {availableClasses.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  setClassFilter(classFilter === c.key ? null : c.key);
                  setPage(1);
                }}
                aria-pressed={classFilter === c.key}
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  classFilter === c.key ? 'border-line-strong bg-ink text-bg' : 'border-line text-ink-2 hover:border-line-strong'
                }`}
              >
                <span className="size-1.5 rounded-full" style={{ background: c.color }} />
                {c.label}
                <span className="opacity-60">{classCounts[c.key]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex border border-line" role="group" aria-label="Ordina">
              {SORTS.filter((s) => s.key !== 'relevance' || defaultSort === 'relevance').map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    setSort(s.key);
                    setPage(1);
                  }}
                  aria-pressed={sort === s.key}
                  className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                    sort === s.key ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex border border-line" role="group" aria-label="Vista">
              <button
                onClick={() => setView('grid')}
                aria-pressed={view === 'grid'}
                aria-label="Vista a griglia"
                className={`grid size-8 place-items-center ${view === 'grid' ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2'}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView('table')}
                aria-pressed={view === 'table'}
                aria-label="Vista a elenco"
                className={`grid size-8 place-items-center ${view === 'table' ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2'}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="Nessun dossier trovato">{emptyMessage}</EmptyState>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <ScpCard key={item.id} item={item} saved={favorites.includes(item.id)} onToggleSave={toggle} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-strong">
              <tr className="kicker">
                <th className="px-4 py-3 font-medium">Designazione</th>
                <th className="px-4 py-3 font-medium">Titolo</th>
                <th className="px-4 py-3 font-medium">Classe</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Serie</th>
                <th className="px-4 py-3 text-right font-medium">Voto</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold">
                    <a href={href.article(item.id)} className="hover:text-accent">
                      {item.scp}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-serif text-base">
                    <a href={href.article(item.id)} className="hover:text-accent">
                      {item.title}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <ClassBadge cls={getObjectClass(item)} />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-[11px] uppercase text-muted md:table-cell">
                    {seriesLabel(item.series)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{formatRating(item.rating)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-1 font-mono text-xs" aria-label="Paginazione">
          <button
            disabled={current === 1}
            onClick={() => goTo(current - 1)}
            className="grid size-9 place-items-center border border-line hover:border-line-strong disabled:opacity-30 disabled:hover:border-line"
            aria-label="Pagina precedente"
          >
            <ChevronLeft size={15} />
          </button>
          {pageNumbers(current, pageCount).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1 text-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => goTo(p)}
                aria-current={p === current ? 'page' : undefined}
                className={`h-9 min-w-9 border px-2 ${
                  p === current ? 'border-line-strong bg-ink text-bg' : 'border-line hover:border-line-strong'
                }`}
              >
                {p}
              </button>
            ),
          )}
          <button
            disabled={current === pageCount}
            onClick={() => goTo(current + 1)}
            className="grid size-9 place-items-center border border-line hover:border-line-strong disabled:opacity-30 disabled:hover:border-line"
            aria-label="Pagina successiva"
          >
            <ChevronRight size={15} />
          </button>
        </nav>
      )}
    </div>
  );
}

function pageNumbers(current: number, total: number): (number | null)[] {
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}
