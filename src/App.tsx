import { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import HomePage from './components/HomePage';
import ScpArticle from './components/ScpArticle';
import ScpList from './components/ScpList';
import { SCPItem, fetchScpMetadata, getFavorites } from './services/scpApi';

type PageState = 
  | { type: 'home' }
  | { type: 'article', scp: string }
  | { type: 'favorites' }
  | { type: 'range', min: number, max: number, label: string }
  | { type: 'tag', tag: string, label: string }
  | { type: 'search', query: string };

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [page, setPage] = useState<PageState>({ type: 'home' });
  const [allItems, setAllItems] = useState<SCPItem[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingMetadata(true);
    fetchScpMetadata()
      .then(items => {
        setAllItems(items);
        setIsLoadingMetadata(false);
      })
      .catch(err => {
        let msg = "Unknown Error";
        if (err instanceof Error) msg = err.message;
        setMetadataError(msg);
        setIsLoadingMetadata(false);
      });
  }, []);

  const handleNavClick = (navString: string) => {
    if (navString === 'home') setPage({ type: 'home' });
    else if (navString === 'favorites') setPage({ type: 'favorites' });
    else if (navString === 'scp-173') setPage({ type: 'article', scp: 'scp-173' });
    else if (navString.startsWith('range:')) {
      const parts = navString.substring('range:'.length).split(':');
      setPage({ type: 'range', min: parseInt(parts[0], 10), max: parseInt(parts[1], 10), label: parts.slice(2).join(':') });
    } else if (navString.startsWith('tag:')) {
      const parts = navString.substring('tag:'.length).split(':');
      setPage({ type: 'tag', tag: parts[0], label: parts.slice(1).join(':') });
    } else {
      setPage({ type: 'article', scp: navString });
    }
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      setPage({ type: 'search', query: query.trim() });
    } else {
      setPage({ type: 'home' });
    }
  };

  // Filter items based on current page state
  const listData = useMemo(() => {
    if (page.type === 'favorites') {
      const favs = getFavorites();
      return { title: 'FAVORITES', items: allItems.filter(i => favs.includes(i.id)) };
    }
    if (page.type === 'range') {
      return { 
        title: page.label.toUpperCase(), 
        items: allItems.filter(i => i.scpNumber !== null && i.scpNumber >= page.min && i.scpNumber <= page.max) 
      };
    }
    if (page.type === 'tag') {
      return { 
        title: `TAG: ${page.label.toUpperCase()}`, 
        items: allItems.filter(i => i.tags && i.tags.includes(page.tag)) 
      };
    }
    if (page.type === 'search') {
      const q = page.query.toLowerCase();
      const filtered = allItems.filter(item => 
        item.scp.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.tags.some(tag => tag.toLowerCase().includes(q))
      );
      return { title: `SEARCH FILTER: "${page.query.toUpperCase()}"`, items: filtered };
    }
    return { title: "SCP DATABASE", items: allItems };
  }, [page, allItems]);

  return (
    <div className="h-screen bg-[#0c0c0c] text-[#d4d4d4] flex flex-col font-sans overflow-hidden antialiased selection:bg-red-600 selection:text-white">
      <Header 
        isMobileMenuOpen={isMobileMenuOpen} 
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
        onSearch={handleSearch}
      />
      
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Mobile Navigation overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        {/* Sidebar */}
        <Sidebar 
          className={`
            absolute lg:static top-0 left-0 h-full
            w-64 bg-[#0f0f0f] z-50
            transform transition-transform duration-300 ease-in-out
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
          onLinkClick={(dest) => {
            handleNavClick(dest);
            setIsMobileMenuOpen(false);
          }}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto flex flex-col relative grid-bg">
          {page.type === 'home' && (
            <HomePage 
              items={allItems} 
              isLoading={isLoadingMetadata} 
              onReadMore={() => setPage({ type: 'article', scp: 'scp-173'})} 
              onOpenArticle={(id) => setPage({ type: 'article', scp: id })} 
            />
          )}
          {page.type === 'article' && <ScpArticle scpId={page.scp} scpItems={allItems} />}
          {(page.type === 'favorites' || page.type === 'range' || page.type === 'tag' || page.type === 'search') && (
            <ScpList 
              title={listData.title}
              items={listData.items} 
              isLoading={isLoadingMetadata} 
              error={metadataError}
              onOpenArticle={(id) => setPage({ type: 'article', scp: id })}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="h-10 bg-[#111] border-t border-[#333] flex items-center justify-between px-6 text-[10px] text-[#444] font-mono shrink-0">
        <p>Contenuti derivati dalla SCP Foundation e distribuiti secondo licenza CC BY-SA 3.0. Questo progetto non è affiliato ufficialmente alla SCP Foundation.</p>
        <p>LATENCY: 14MS // USER: RAISA_ADMIN</p>
      </footer>
    </div>
  );
}
