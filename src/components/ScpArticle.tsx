import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Calendar,
  ExternalLink,
  Printer,
  Shuffle,
  Star,
  User,
} from 'lucide-react';
import { fetchScpContent, prepareContent, type SCPItem } from '../services/scpApi';
import { compareByNumber, formatDate, formatRating, getObjectClass, getSeriesInfo, seriesLabel } from '../lib/scp';
import { href } from '../lib/router';
import { addToHistory, useDocumentTitle, useFavorites } from '../lib/storage';
import ClassBadge from './ClassBadge';
import { EmptyState, ErrorState, Loader } from './States';

interface ScpArticleProps {
  id: string;
  items: SCPItem[];
  byId: Map<string, SCPItem>;
  isLoadingIndex: boolean;
  onRandom: () => void;
}

type ContentState =
  | { status: 'loading' }
  | { status: 'ready'; html: string }
  | { status: 'error'; message: string };

export default function ScpArticle({ id, items, byId, isLoadingIndex, onRandom }: ScpArticleProps) {
  const item = byId.get(id);
  const [content, setContent] = useState<ContentState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const { isFavorite, toggle } = useFavorites();

  useDocumentTitle(item ? `${item.scp}: ${item.title}` : id);

  useEffect(() => {
    if (!item) return;
    addToHistory(item.id);
    let cancelled = false;
    setContent({ status: 'loading' });
    fetchScpContent(item)
      .then((raw) => {
        if (cancelled) return;
        setContent({ status: 'ready', html: prepareContent(raw, (k) => byId.has(k)) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setContent({ status: 'error', message: err instanceof Error ? err.message : 'Dati corrotti o non disponibili' });
      });
    return () => {
      cancelled = true;
    };
    // Reload only when the file itself changes (not when titles get enriched).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, attempt]);

  // Reading progress
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [content]);

  // Previous / next file within the same series
  const { prev, next } = useMemo(() => {
    if (!item) return { prev: undefined, next: undefined };
    const siblings = items.filter((i) => i.series === item.series).sort(compareByNumber);
    const idx = siblings.findIndex((i) => i.id === item.id);
    return { prev: siblings[idx - 1], next: siblings[idx + 1] };
  }, [item, items]);

  if (!item) {
    if (isLoadingIndex) return <Loader label="Decrittazione del fascicolo…" />;
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <EmptyState title={`${id}: fascicolo non trovato`}>
          <p>Il documento richiesto non è presente nell&rsquo;archivio locale.</p>
          <p className="mt-4 flex flex-wrap justify-center gap-4 font-mono text-xs uppercase tracking-widest">
            <a className="text-accent underline" href={`https://scp-wiki.wikidot.com/${id.toLowerCase()}`} target="_blank" rel="noopener noreferrer">
              Cerca sul wiki originale
            </a>
            <a className="underline" href={href.search(id)}>
              Cerca nell&rsquo;archivio
            </a>
          </p>
        </EmptyState>
      </div>
    );
  }

  const cls = getObjectClass(item);
  const saved = isFavorite(item.id);
  const series = getSeriesInfo(item.series);
  const created = formatDate(item.createdAt);
  const visibleTags = item.tags.filter((t) => !t.startsWith('_'));

  return (
    <article className="relative">
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 no-print" aria-hidden="true">
        <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* Dossier header */}
      <header className="border-b border-line bg-grid">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-8 sm:pt-10">
          <nav className="kicker mb-8 flex flex-wrap items-center gap-2 no-print" aria-label="Percorso">
            <a href={href.archive()} className="hover:text-ink">Archivio</a>
            <span>/</span>
            <a href={href.series(item.series)} className="hover:text-ink">{series?.label ?? item.series}</a>
            <span>/</span>
            <span className="text-ink">{item.scp}</span>
          </nav>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 animate-rise">
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-accent">
                Documento riservato · Livello 4
              </p>
              <h1 className="break-words font-display text-5xl font-black leading-none tracking-[-0.03em] sm:text-7xl lg:text-8xl">
                {item.scp}
              </h1>
              {item.title !== item.scp && (
                <p className="mt-4 max-w-3xl font-serif text-2xl italic leading-snug text-ink-2 sm:text-3xl">{item.title}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 no-print lg:justify-end">
              <button
                onClick={() => toggle(item.id)}
                aria-pressed={saved}
                className={`inline-flex items-center gap-2 border px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                  saved ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong hover:bg-surface-2'
                }`}
              >
                <Bookmark size={14} className={saved ? 'fill-current' : ''} /> {saved ? 'Salvato' : 'Salva'}
              </button>
              <button
                onClick={() => window.print()}
                className="grid size-9 place-items-center border border-line hover:border-line-strong"
                aria-label="Stampa"
                title="Stampa"
              >
                <Printer size={15} />
              </button>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-9 place-items-center border border-line hover:border-line-strong"
                aria-label="Apri sul wiki originale"
                title="Apri sul wiki originale"
              >
                <ExternalLink size={15} />
              </a>
              <button
                onClick={onRandom}
                className="grid size-9 place-items-center border border-line hover:border-line-strong"
                aria-label="Dossier casuale"
                title="Dossier casuale"
              >
                <Shuffle size={15} />
              </button>
            </div>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            <div className="bg-surface p-4">
              <dt className="kicker mb-2">Classe</dt>
              <dd>
                <a href={href.objectClass(cls.key)}>
                  <ClassBadge cls={cls} size="lg" />
                </a>
              </dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="kicker mb-2">Valutazione</dt>
              <dd className="flex items-center gap-1.5 font-display text-2xl font-black">
                <Star size={16} className="fill-current text-accent" /> {formatRating(item.rating)}
              </dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="kicker mb-2">Autore</dt>
              <dd className="flex items-center gap-1.5 truncate font-mono text-sm">
                <User size={14} className="shrink-0 text-muted" /> {item.createdBy ?? 'Sconosciuto'}
              </dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="kicker mb-2">Archiviato</dt>
              <dd className="flex items-center gap-1.5 font-mono text-sm">
                <Calendar size={14} className="shrink-0 text-muted" /> {created ?? '—'}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          {content.status === 'loading' && <Loader label="Decrittazione del fascicolo…" />}
          {content.status === 'error' && (
            <ErrorState message={content.message} onRetry={() => setAttempt((a) => a + 1)} />
          )}
          {content.status === 'ready' && (
            <div className="scp-content max-w-[72ch] animate-rise" dangerouslySetInnerHTML={{ __html: content.html }} />
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start no-print">
          {item.images.length > 0 && (
            <figure className="border border-line bg-surface p-2">
              <img src={item.images[0]} alt={`Immagine di ${item.scp}`} className="w-full" loading="lazy" onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')} />
              <figcaption className="kicker px-1 pt-2">Allegato 1</figcaption>
            </figure>
          )}

          {visibleTags.length > 0 && (
            <section>
              <h2 className="kicker mb-3">Tag assegnati</h2>
              <ul className="flex flex-wrap gap-1.5">
                {visibleTags.map((tag) => (
                  <li key={tag}>
                    <a
                      href={href.tag(tag)}
                      className="block border border-line px-2 py-0.5 font-mono text-[11px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {tag}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="kicker mb-3">Serie</h2>
            <a href={href.series(item.series)} className="font-mono text-sm underline-offset-4 hover:underline">
              {seriesLabel(item.series)}
            </a>
          </section>
        </aside>
      </div>

      {/* Prev / next */}
      {(prev || next) && (
        <nav className="mx-auto grid max-w-6xl gap-px border-y border-line bg-line px-0 sm:grid-cols-2 no-print" aria-label="Dossier adiacenti">
          {prev ? (
            <a href={href.article(prev.id)} className="group bg-bg p-6 hover:bg-surface sm:p-8">
              <span className="kicker flex items-center gap-2">
                <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-1" /> Precedente
              </span>
              <span className="mt-3 block font-display text-2xl font-black">{prev.scp}</span>
              <span className="block truncate font-serif text-ink-2">{prev.title}</span>
            </a>
          ) : (
            <span className="hidden bg-bg sm:block" />
          )}
          {next && (
            <a href={href.article(next.id)} className="group bg-bg p-6 text-right hover:bg-surface sm:p-8">
              <span className="kicker flex items-center justify-end gap-2">
                Successivo <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </span>
              <span className="mt-3 block font-display text-2xl font-black">{next.scp}</span>
              <span className="block truncate font-serif text-ink-2">{next.title}</span>
            </a>
          )}
        </nav>
      )}

      <p className="mx-auto max-w-6xl px-4 py-8 font-mono text-[11px] leading-relaxed text-muted sm:px-8">
        &ldquo;{item.scp}&rdquo; {item.createdBy ? <>di {item.createdBy}, </> : null}dal{' '}
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          SCP Wiki
        </a>
        . Distribuito con licenza{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer" className="underline">
          CC BY-SA 3.0
        </a>
        .
      </p>
    </article>
  );
}
