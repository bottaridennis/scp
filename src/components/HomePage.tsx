import { useMemo } from 'react';
import { ArrowRight, Clock, Shuffle, Star, Trash2 } from 'lucide-react';
import type { SCPItem } from '../services/scpApi';
import { FEATURED_IDS, formatRating, getObjectClass, NUMBERED_SERIES, OBJECT_CLASSES } from '../lib/scp';
import { href } from '../lib/router';
import { useFavorites, useHistory } from '../lib/storage';
import ClassBadge from './ClassBadge';
import ScpCard from './ScpCard';
import Logo from './Logo';
import { Loader } from './States';

interface HomePageProps {
  items: SCPItem[];
  byId: Map<string, SCPItem>;
  isLoading: boolean;
  seriesCounts: Record<string, number>;
  onRandom: () => void;
}

export default function HomePage({ items, byId, isLoading, seriesCounts, onRandom }: HomePageProps) {
  const { favorites, toggle } = useFavorites();
  const { history, clear } = useHistory();

  const featured = useMemo(
    () => FEATURED_IDS.map((id) => byId.get(id)).filter((x): x is SCPItem => Boolean(x)),
    [byId],
  );
  const hero = byId.get('SCP-173');

  const topRated = useMemo(() => [...items].sort((a, b) => b.rating - a.rating).slice(0, 8), [items]);

  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    let total = 0;
    for (const item of items) {
      const k = getObjectClass(item).key;
      if (!item.tags.includes(k)) continue; // only explicitly classified items
      counts.set(k, (counts.get(k) ?? 0) + 1);
      total++;
    }
    return {
      total,
      rows: OBJECT_CLASSES.map((c) => ({ cls: c, count: counts.get(c.key) ?? 0 })).filter((r) => r.count > 0),
    };
  }, [items]);

  const recent = useMemo(
    () => history.map((id) => byId.get(id)).filter((x): x is SCPItem => Boolean(x)).slice(0, 6),
    [history, byId],
  );

  return (
    <div className="pb-16">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line bg-grid">
        <Logo className="pointer-events-none absolute -right-24 -top-24 size-[28rem] text-ink opacity-[0.04] sm:-right-16" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="animate-rise">
            <p className="kicker mb-6 flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" /> Terminale sicuro · Livello 4
            </p>
            <h1 className="font-display text-[3.4rem] font-black uppercase leading-[0.88] tracking-[-0.03em] sm:text-7xl xl:text-[5.5rem]">
              Secure<span className="text-accent">.</span>
              <br />
              Contain<span className="text-accent">.</span>
              <br />
              Protect<span className="text-accent">.</span>
            </h1>
            <p className="mt-8 max-w-xl font-serif text-xl leading-relaxed text-ink-2">
              L&rsquo;umanità non può più nascondersi nella paura. Mentre il resto del mondo vive alla luce, noi
              restiamo nell&rsquo;oscurità per combattere l&rsquo;anomalo, contenerlo e proteggere tutti gli altri.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={href.archive()}
                className="inline-flex items-center gap-2 bg-ink px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-bg transition-colors hover:bg-accent hover:text-accent-ink"
              >
                Esplora l&rsquo;archivio <ArrowRight size={15} />
              </a>
              <button
                onClick={onRandom}
                disabled={items.length === 0}
                className="inline-flex items-center gap-2 border border-line-strong px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-colors hover:bg-surface-2 disabled:opacity-40"
              >
                <Shuffle size={15} /> Dossier casuale
              </button>
            </div>
          </div>

          {/* Featured dossier */}
          {hero ? (
            <a
              href={href.article(hero.id)}
              className="group relative block border border-line-strong bg-surface p-7 shadow-card transition-transform duration-300 hover:-rotate-[0.6deg] animate-rise sm:p-9"
              style={{ animationDelay: '80ms' }}
            >
              <div className="absolute right-6 top-6 rotate-[8deg] border-2 border-accent px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-accent opacity-80">
                Riservato
              </div>
              <p className="kicker">Dossier in evidenza</p>
              <p className="mt-6 font-display text-6xl font-black tracking-tight sm:text-7xl">{hero.scp}</p>
              <p className="mt-2 font-serif text-2xl italic text-ink-2">{hero.title}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <ClassBadge cls={getObjectClass(hero)} size="lg" />
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-2">
                  <Star size={12} className="fill-current" /> {formatRating(hero.rating)}
                </span>
              </div>
              <p className="mt-6 border-l-2 border-accent pl-4 font-serif text-[17px] leading-relaxed text-ink-2">
                L&rsquo;oggetto non può muoversi finché si trova nel campo visivo diretto. Il contatto visivo non deve
                essere interrotto in nessun momento.
              </p>
              <span className="mt-8 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest group-hover:text-accent">
                Apri il fascicolo <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </span>
            </a>
          ) : (
            <div className="border border-line bg-surface">{isLoading && <Loader label="Accesso all'archivio in corso…" />}</div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 pt-14 sm:px-8">
        {/* STATS */}
        <section aria-labelledby="stats-title">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="kicker mb-2">Stato del contenimento</p>
              <h2 id="stats-title" className="font-display text-3xl font-black uppercase tracking-tight">
                Distribuzione per classe
              </h2>
            </div>
            <p className="text-right font-mono text-xs uppercase tracking-widest text-ink-2">
              <span className="block font-display text-4xl font-black tracking-tight text-ink">
                {isLoading ? '—' : items.length.toLocaleString('it-IT')}
              </span>
              record in archivio
            </p>
          </div>
          {distribution.total > 0 ? (
            <>
              <div className="flex h-4 w-full overflow-hidden border border-line-strong" role="img" aria-label="Distribuzione delle classi d'oggetto">
                {distribution.rows.map(({ cls, count }) => (
                  <a
                    key={cls.key}
                    href={href.objectClass(cls.key)}
                    title={`${cls.label}: ${count}`}
                    className="h-full transition-opacity hover:opacity-75"
                    style={{ width: `${(count / distribution.total) * 100}%`, background: cls.color }}
                  />
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-px border border-line bg-line">
                {distribution.rows.map(({ cls, count }) => (
                  <a key={cls.key} href={href.objectClass(cls.key)} className="group flex-1 basis-[130px] bg-surface p-4 hover:bg-surface-2">
                    <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-2">
                      <span className="size-2 rounded-full" style={{ background: cls.color }} />
                      {cls.label}
                    </span>
                    <span className="mt-2 block font-display text-2xl font-black tracking-tight">
                      {count.toLocaleString('it-IT')}
                    </span>
                    <span className="font-mono text-[10px] text-muted">
                      {((count / distribution.total) * 100).toFixed(1)}%
                    </span>
                  </a>
                ))}
              </div>
            </>
          ) : (
            isLoading && <div className="h-4 w-full animate-pulse bg-surface-2" />
          )}
        </section>

        {/* SERIES */}
        <section aria-labelledby="series-title">
          <p className="kicker mb-2">Indice</p>
          <h2 id="series-title" className="mb-6 font-display text-3xl font-black uppercase tracking-tight">
            Le serie
          </h2>
          <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
            {NUMBERED_SERIES.map((s) => (
              <a key={s.key} href={href.series(s.key)} className="group relative overflow-hidden bg-surface p-5 transition-colors hover:bg-ink hover:text-bg">
                <span className="font-display text-5xl font-black tracking-tighter opacity-90">{s.short}</span>
                <span className="mt-4 block font-mono text-[11px] uppercase tracking-widest">{s.range}</span>
                <span className="mt-1 block font-mono text-[10px] text-muted group-hover:text-bg/60">
                  {seriesCounts[s.key] ? `${seriesCounts[s.key]} dossier` : '—'}
                </span>
                <ArrowRight size={16} className="absolute bottom-5 right-5 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </section>

        {/* FEATURED + TOP */}
        <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
          <section aria-labelledby="featured-title">
            <p className="kicker mb-2">Selezione del Consiglio O5</p>
            <h2 id="featured-title" className="mb-6 font-display text-3xl font-black uppercase tracking-tight">
              Dossier essenziali
            </h2>
            {featured.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {featured.filter((i) => i !== hero).slice(0, 6).map((item) => (
                  <ScpCard key={item.id} item={item} saved={favorites.includes(item.id)} onToggleSave={toggle} />
                ))}
              </div>
            ) : (
              isLoading && <Loader label="Caricamento…" />
            )}
          </section>

          <div className="space-y-12">
            <section aria-labelledby="top-title">
              <p className="kicker mb-2">Valutazione comunitaria</p>
              <h2 id="top-title" className="mb-6 font-display text-3xl font-black uppercase tracking-tight">
                I più votati
              </h2>
              <ol className="border-t border-line-strong">
                {topRated.map((item, i) => (
                  <li key={item.id} className="border-b border-line">
                    <a href={href.article(item.id)} className="group flex items-baseline gap-4 py-3 hover:bg-surface-2">
                      <span className="w-6 shrink-0 text-right font-display text-lg font-black text-muted group-hover:text-accent">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[11px] font-bold">{item.scp}</span>
                        <span className="block truncate font-serif text-[17px] text-ink-2">{item.title}</span>
                      </span>
                      <span className="shrink-0 pr-2 font-mono text-xs text-ink-2">{formatRating(item.rating)}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>

            {recent.length > 0 && (
              <section aria-labelledby="recent-title">
                <div className="mb-4 flex items-center justify-between">
                  <h2 id="recent-title" className="kicker flex items-center gap-2">
                    <Clock size={13} /> Accessi recenti
                  </h2>
                  <button onClick={clear} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-accent">
                    <Trash2 size={11} /> Cancella
                  </button>
                </div>
                <ul className="space-y-px">
                  {recent.map((item) => (
                    <li key={item.id}>
                      <a href={href.article(item.id)} className="flex items-center gap-3 bg-surface px-3 py-2.5 hover:bg-surface-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: getObjectClass(item).color }} />
                        <span className="w-24 shrink-0 font-mono text-xs font-bold">{item.scp}</span>
                        <span className="truncate font-serif text-[15px] text-ink-2">{item.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
