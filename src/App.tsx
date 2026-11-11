import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import HomePage from './components/HomePage';
import ScpArticle from './components/ScpArticle';
import ScpList from './components/ScpList';
import { ErrorState } from './components/States';
import { fetchScpMetadata, fetchScpNicknames, type SCPItem } from './services/scpApi';
import { href, navigate, useRoute, type Route } from './lib/router';
import { getClassInfo, getSeriesInfo, searchItems } from './lib/scp';
import { useDocumentTitle, useFavorites } from './lib/storage';
import { Loader } from './components/States';

export default function App() {
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rawItems, setRawItems] = useState<SCPItem[]>([]);
  const [nicknames, setNicknames] = useState<Map<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { favorites } = useFavorites();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchScpMetadata()
      .then((data) => {
        if (!cancelled) setRawItems(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Human-readable names are a nice-to-have: load them in the background.
  useEffect(() => {
    if (rawItems.length === 0 || nicknames) return;
    fetchScpNicknames()
      .then(setNicknames)
      .catch(() => setNicknames(new Map()));
  }, [rawItems, nicknames]);

  const items = useMemo(() => {
    if (!nicknames || nicknames.size === 0) return rawItems;
    return rawItems.map((item) => {
      const name = nicknames.get(item.id);
      return name && item.title === item.scp ? { ...item, title: name } : item;
    });
  }, [rawItems, nicknames]);

  // Scroll to top and close the drawer on navigation.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setMenuOpen(false);
  }, [route]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const { seriesCounts, tagCounts } = useMemo(() => {
    const s: Record<string, number> = {};
    const t: Record<string, number> = {};
    for (const item of items) {
      s[item.series] = (s[item.series] ?? 0) + 1;
      for (const tag of item.tags) t[tag] = (t[tag] ?? 0) + 1;
    }
    return { seriesCounts: s, tagCounts: t };
  }, [items]);

  const openRandom = useCallback(() => {
    if (items.length === 0) return;
    navigate(href.article(items[Math.floor(Math.random() * items.length)].id));
  }, [items]);

  const searchQuery = route.name === 'search' ? route.query : '';

  return (
    <div className="min-h-screen bg-bg text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">
        Vai al contenuto
      </a>
      <Header items={items} searchQuery={searchQuery} isMenuOpen={menuOpen} onMenuToggle={() => setMenuOpen((o) => !o)} />

      <div className="flex">
        {/* Mobile backdrop */}
        <div
          className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden ${
            menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />

        <aside
          className={`fixed bottom-0 left-0 top-[125px] md:top-16 z-30 w-72 overflow-y-auto border-r border-line bg-bg transition-transform duration-300 lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:translate-x-0 no-print ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            route={route}
            counts={seriesCounts}
            classCounts={tagCounts}
            savedCount={favorites.length}
            onRandom={openRandom}
            onNavigate={() => setMenuOpen(false)}
          />
        </aside>

        <main id="main" className="min-w-0 flex-1">
          {error && !loading && items.length === 0 ? (
            <ErrorState message={`Impossibile accedere all'archivio: ${error}`} onRetry={() => setAttempt((a) => a + 1)} />
          ) : (
            <Page
              route={route}
              items={items}
              byId={byId}
              loading={loading}
              favorites={favorites}
              seriesCounts={seriesCounts}
              onRandom={openRandom}
            />
          )}

          <footer className="border-t border-line px-4 py-8 sm:px-8 no-print">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 font-mono text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>
                Contenuti della{' '}
                <a href="https://scp-wiki.wikidot.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                  SCP Foundation
                </a>{' '}
                distribuiti con licenza{' '}
                <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                  CC BY-SA 3.0
                </a>
                .
              </p>
              <p className="uppercase tracking-widest">Secure · Contain · Protect</p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

interface PageProps {
  route: Route;
  items: SCPItem[];
  byId: Map<string, SCPItem>;
  loading: boolean;
  favorites: string[];
  seriesCounts: Record<string, number>;
  onRandom: () => void;
}

function Page({ route, items, byId, loading, favorites, seriesCounts, onRandom }: PageProps) {
  const list = useMemo(() => {
    switch (route.name) {
      case 'archive':
        return { kicker: 'Database', title: 'Archivio completo', items, key: 'archive' };
      case 'saved':
        return {
          kicker: 'Personale',
          title: 'Dossier salvati',
          items: favorites.map((id) => byId.get(id)).filter((x): x is SCPItem => Boolean(x)),
          key: 'saved',
          empty: 'Usa l’icona segnalibro su un dossier per salvarlo qui.',
          sort: 'number' as const,
        };
      case 'series': {
        const info = getSeriesInfo(route.key);
        return {
          kicker: info?.range ? `Serie · ${info.range}` : 'Collezione',
          title: info?.label ?? route.key,
          items: items.filter((i) => i.series === route.key),
          key: `series:${route.key}`,
        };
      }
      case 'class': {
        const info = getClassInfo(route.key);
        return {
          kicker: "Classe d'oggetto",
          title: info?.label ?? route.key,
          description: info?.description,
          items: items.filter((i) => i.tags.includes(route.key)),
          key: `class:${route.key}`,
        };
      }
      case 'tag':
        return {
          kicker: 'Tag',
          title: `#${route.tag}`,
          items: items.filter((i) => i.tags.includes(route.tag)),
          key: `tag:${route.tag}`,
        };
      case 'search':
        return {
          kicker: 'Risultati della ricerca',
          title: `“${route.query}”`,
          items: searchItems(items, route.query),
          key: `search:${route.query}`,
          empty: 'Prova con un numero (es. 173), una parola del titolo o un tag.',
          sort: 'relevance' as const,
        };
      default:
        return null;
    }
  }, [route, items, byId, favorites]);

  useDocumentTitle(list ? list.title : route.name === 'home' ? '' : route.name === 'not-found' ? 'Pagina non trovata' : '');

  if (route.name === 'home') {
    return <HomePage items={items} byId={byId} isLoading={loading} seriesCounts={seriesCounts} onRandom={onRandom} />;
  }
  if (route.name === 'article') {
    return <ScpArticle key={route.id} id={route.id} items={items} byId={byId} isLoadingIndex={loading} onRandom={onRandom} />;
  }
  if (!list) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-display text-8xl font-black text-accent">404</p>
        <p className="mt-4 font-serif text-xl text-ink-2">Questa sezione dell&rsquo;archivio non esiste — oppure è stata cancellata.</p>
        <a href={href.home()} className="mt-8 inline-block border border-line-strong px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-bg">
          Torna alla dashboard
        </a>
      </div>
    );
  }
  if (loading && items.length === 0) return <Loader label="Recupero dei record in corso…" />;

  return (
    <ScpList
      kicker={list.kicker}
      title={list.title}
      description={'description' in list ? list.description : undefined}
      items={list.items}
      resetKey={list.key}
      defaultSort={'sort' in list ? list.sort : 'number'}
      emptyMessage={'empty' in list ? list.empty : undefined}
    />
  );
}
