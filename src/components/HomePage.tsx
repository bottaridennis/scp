import React, { useState, useMemo, useEffect } from 'react';
import WarningBanner from './WarningBanner';
import { Newspaper, FileText, Bookmark, Clock, ShieldAlert } from 'lucide-react';
import { SCPItem, toggleFavorite, getHistory } from '../services/scpApi';

interface HomePageProps {
  onReadMore: () => void;
  items: SCPItem[];
  isLoading: boolean;
  onOpenArticle: (id: string) => void;
}

export default function HomePage({ onReadMore, items, isLoading, onOpenArticle }: HomePageProps) {
  const [visibleCount, setVisibleCount] = useState(12);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
     setFavorites(localStorage.getItem("scp-favorites") ? JSON.parse(localStorage.getItem("scp-favorites")!) : []);
     setHistory(getHistory());
  }, [items]);

  const toggleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newFavs = toggleFavorite(id);
    setFavorites(newFavs);
  };

  const sortedItems = useMemo(() => {
    const validItems = items.filter(i => i.scpNumber !== null);
    validItems.sort((a, b) => (a.scpNumber || 0) - (b.scpNumber || 0));
    return validItems;
  }, [items]);
  
  const historyItems = useMemo(() => {
    return history.map(id => items.find(i => i.id === id)).filter(Boolean) as SCPItem[];
  }, [history, items]);

  const visibleItems = sortedItems.slice(0, visibleCount);
  const hasMore = visibleCount < sortedItems.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 12);
  };

  return (
    <div className="max-w-6xl w-full mx-auto font-sans p-4 md:p-8 space-y-8">
      <WarningBanner />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Column */}
        <div className="col-span-1 lg:col-span-8 space-y-8">
          
          <section className="bg-white border-t-4 border-slate-900 shadow-sm border-x border-b border-slate-200 p-8">
            <h2 className="text-3xl font-black font-sans text-slate-900 mb-6 uppercase tracking-tight">
              Intranet Dashboard
            </h2>
            <div className="space-y-4 text-slate-700 leading-relaxed font-serif text-lg">
              <p>
                Mankind in its present state has been around for a quarter of a million years, yet only the last 4,000 have been of any significance. So, what did we do for nearly 250,000 years? We huddled in caves and around small fires, fearful of the things that we didn't understand. 
              </p>
              <p>
                We call them <strong className="text-slate-900 font-bold">anomalies</strong>. We secure them. We contain them. We protect the rest of humanity from them.
              </p>
              <div className="bg-slate-50 border border-slate-200 p-4 mt-6">
                <p className="font-mono text-sm text-slate-600 border-l-2 border-red-700 pl-4">
                  The Foundation operates outside of jurisdiction, empowered and entrusted by every major national government with the task of containing anomalous objects, entities, and phenomena.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row overflow-hidden relative group cursor-pointer hover:shadow-md transition-shadow" onClick={onReadMore}>
            <div className="absolute top-0 left-0 h-full w-1.5 bg-red-700"></div>
            <div className="p-8 flex-1 pl-10">
              <div className="flex items-center gap-2 mb-3 text-red-700 font-mono text-xs font-bold uppercase tracking-widest bg-red-50 inline-flex px-2 py-1 rounded-sm">
                <ShieldAlert size={16} /> High Priority Alert
              </div>
              <h3 className="text-3xl font-black mb-2 text-slate-900 uppercase">SCP-173: The Sculpture</h3>
              <p className="text-slate-600 mb-6 line-clamp-2 font-serif text-lg">
                Moved to Site-19 [DATA EXPUNGED]. Origin is as of yet unknown. It is constructed from concrete and rebar with traces of Krylon brand spray paint. SCP-173 is animate and extremely hostile.
              </p>
              <span className="inline-flex items-center text-xs font-bold text-slate-900 border-2 border-slate-900 bg-white px-6 py-2 hover:bg-slate-900 hover:text-white transition-colors uppercase tracking-widest">
                Access File SCP-173
              </span>
            </div>
          </section>
        </div>

        {/* Sidebar Column */}
        <div className="col-span-1 lg:col-span-4 space-y-6">
          
          <section className="bg-slate-50 border border-slate-200 p-6">
             <div className="flex items-center gap-2 mb-4 text-slate-800 font-sans font-black text-sm border-b-2 border-slate-300 pb-3 uppercase tracking-widest">
                <Newspaper size={18} /> Internal Bulletins
              </div>
              <ul className="space-y-4">
                <li className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] text-red-700 font-bold uppercase tracking-widest shrink-0">12 JUN 2026</span>
                  <span className="text-sm text-slate-700 font-medium leading-snug">Database migration to Light Mode completed successfully.</span>
                </li>
                <li className="flex flex-col gap-1 border-t border-slate-200 pt-3">
                  <span className="font-mono text-[10px] text-red-700 font-bold uppercase tracking-widest shrink-0">05 JUN 2026</span>
                  <span className="text-sm text-slate-700 font-medium leading-snug">New guidelines for Class-D personnel handling.</span>
                </li>
                <li className="flex flex-col gap-1 border-t border-slate-200 pt-3">
                  <span className="font-mono text-[10px] text-red-700 font-bold uppercase tracking-widest shrink-0">28 MAY 2026</span>
                  <span className="text-sm text-slate-700 font-medium leading-snug">Incident Report 096-1-A has been declassified.</span>
                </li>
              </ul>
          </section>

          {/* History Panel */}
          {historyItems.length > 0 && (
            <section className="bg-slate-50 border border-slate-200 p-6">
               <div className="flex items-center gap-2 mb-4 text-slate-800 font-sans font-black text-sm border-b-2 border-slate-300 pb-3 uppercase tracking-widest">
                  <Clock size={18} /> Recent Access Logs
                </div>
                <ul className="space-y-2">
                  {historyItems.slice(0, 5).map(item => (
                    <li key={`hist-${item.id}`} className="group">
                      <button 
                        onClick={() => onOpenArticle(item.id)}
                        className="w-full text-left flex items-center gap-3 p-2 hover:bg-slate-200 rounded transition-colors"
                      >
                         <span className="font-mono text-xs font-bold text-red-700 whitespace-nowrap">{item.scp}</span>
                         <span className="text-sm text-slate-700 truncate font-serif">{item.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
            </section>
          )}

        </div>
      </div>

      {/* SCP Database List section */}
      <div className="pt-10">
        <div className="flex items-end justify-between border-b-2 border-slate-300 pb-4 mb-8">
          <h2 className="text-2xl font-black font-sans text-slate-900 uppercase tracking-tight">
            Main Database Registry
          </h2>
          <span className="text-xs font-mono text-slate-500 font-bold uppercase tracking-widest">
            {sortedItems.length} Records
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 font-mono text-slate-500 animate-pulse border border-slate-200 bg-slate-50 rounded">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-4"></div>
            &gt; ACCESSING DATABASE...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleItems.map(item => (
                <div 
                  key={item.id}
                  onClick={() => onOpenArticle(item.id)}
                  className="bg-white border border-slate-300 flex flex-col overflow-hidden relative group cursor-pointer hover:border-slate-500 hover:shadow-md transition-all rounded-sm"
                >
                  <div className="absolute top-0 left-0 h-full w-1 bg-slate-200 group-hover:bg-red-700 transition-colors z-10"></div>
                  
                  {item.images && item.images.length > 0 && (
                    <div className="aspect-[16/9] w-full bg-slate-100 border-b border-slate-200 overflow-hidden relative">
                      <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors z-10"></div>
                      <img src={item.images[0]} alt={item.title} loading="lazy" className="w-full h-full object-cover mix-blend-multiply grayscale-[50%] group-hover:grayscale-0 transition-all duration-500" onError={(e) => e.currentTarget.style.display = 'none'} />
                    </div>
                  )}
                  
                  <div className="p-5 flex-1 flex flex-col ml-1">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="text-red-700 font-mono text-sm font-bold uppercase tracking-widest flex items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded-sm">
                        <FileText size={14} /> {item.scp}
                      </div>
                      <button onClick={(e) => toggleFav(e, item.id)} className={`transition-colors p-1.5 rounded-sm ${favorites.includes(item.id) ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                        <Bookmark size={16} fill={favorites.includes(item.id) ? "currentColor" : "none"} />
                      </button>
                    </div>
                    
                    <h3 className="text-lg font-bold mb-3 text-slate-900 leading-tight font-serif line-clamp-2">{item.title}</h3>
                    
                    <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-slate-100">
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 font-medium">
                        RATING: {item.rating > 0 ? `+${item.rating}` : item.rating}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 font-medium truncate max-w-[150px]">
                        {item.series}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMore && (
              <div className="mt-12 text-center">
                <button 
                  onClick={handleLoadMore}
                  className="px-8 py-3 border-2 border-slate-300 bg-white hover:border-slate-800 hover:text-slate-900 transition-colors font-sans font-bold tracking-widest text-sm text-slate-600 uppercase rounded-sm shadow-sm"
                >
                  Load More Records
                </button>
              </div>
            )}
            {!hasMore && sortedItems.length > 0 && (
               <div className="mt-12 text-center font-mono font-bold text-slate-400 text-xs tracking-widest uppercase border-t border-slate-200 pt-8">
                 END OF ARCHIVE
               </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
