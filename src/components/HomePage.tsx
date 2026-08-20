import React, { useState, useMemo, useEffect } from 'react';
import WarningBanner from './WarningBanner';
import { Newspaper, FileText, Star } from 'lucide-react';
import { SCPItem, toggleFavorite } from '../services/scpApi';

interface HomePageProps {
  onReadMore: () => void;
  items: SCPItem[];
  isLoading: boolean;
  onOpenArticle: (id: string) => void;
}

export default function HomePage({ onReadMore, items, isLoading, onOpenArticle }: HomePageProps) {
  const [visibleCount, setVisibleCount] = useState(12);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
     setFavorites(localStorage.getItem("scp-favorites") ? JSON.parse(localStorage.getItem("scp-favorites")!) : []);
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

  const visibleItems = sortedItems.slice(0, visibleCount);
  const hasMore = visibleCount < sortedItems.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 12);
  };

  return (
    <div className="max-w-4xl w-full mx-auto font-sans p-6 md:p-10 space-y-12">
      <WarningBanner />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="col-span-1 lg:col-span-2 space-y-8">
          <section className="bg-transparent border border-[#333] p-6">
            <h2 className="text-2xl font-bold font-sans text-white mb-4 pb-2 border-b border-[#333]">
              Welcome to the SCP Foundation
            </h2>
            <div className="space-y-4 text-[#d4d4d4] leading-relaxed font-sans text-sm">
              <p>
                Mankind in its present state has been around for a quarter of a million years, yet only the last 4,000 have been of any significance. So, what did we do for nearly 250,000 years? We huddled in caves and around small fires, fearful of the things that we didn't understand. 
              </p>
              <p>
                We call them <strong className="text-white font-semibold">anomalies</strong>. We secure them. We contain them. We protect the rest of humanity from them.
              </p>
              <p className="font-mono text-xs bg-[#111] p-4 text-[#888] border-l-2 border-red-600">
                The Foundation operates outside of jurisdiction, empowered and entrusted by every major national government with the task of containing anomalous objects, entities, and phenomena.
              </p>
            </div>
          </section>

          <section className="bg-transparent border border-[#333] flex flex-col md:flex-row overflow-hidden relative group">
            <div className="absolute top-0 left-0 h-full w-1 bg-red-600 transition-all"></div>
            <div className="p-6 flex-1 bg-[#0f0f0f]">
              <div className="flex items-center gap-2 mb-2 text-red-600 font-mono text-xs font-bold uppercase tracking-widest">
                <FileText size={16} /> Featured Article
              </div>
              <h3 className="text-2xl font-bold mb-2 text-white">SCP-173: The Sculpture</h3>
              <p className="text-[#888] mb-4 line-clamp-3 text-sm">
                Moved to Site-19 [DATA EXPUNGED]. Origin is as of yet unknown. It is constructed from concrete and rebar with traces of Krylon brand spray paint. SCP-173 is animate and extremely hostile.
              </p>
              <button 
                onClick={onReadMore}
                className="inline-flex items-center text-xs font-bold text-black bg-white px-4 py-2 hover:bg-gray-200 transition-colors uppercase tracking-wider"
              >
                Access File
              </button>
            </div>
          </section>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <section className="bg-[#111] border border-[#333] p-5">
             <div className="flex items-center gap-2 mb-4 text-[#888] font-mono font-bold text-xs border-b border-[#333] pb-3 uppercase tracking-widest">
                <Newspaper size={16} /> Site News
              </div>
              <ul className="space-y-4">
                <li className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] text-red-600 shrink-0">12 JUN 2026</span>
                  <a href="#" className="text-xs text-[#d4d4d4] hover:text-white font-medium leading-tight">Database migration completed successfully.</a>
                </li>
                <li className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] text-red-600 shrink-0">05 JUN 2026</span>
                  <a href="#" className="text-xs text-[#d4d4d4] hover:text-white font-medium leading-tight">New guidelines for Class-D personnel handling.</a>
                </li>
                <li className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] text-red-600 shrink-0">28 MAY 2026</span>
                  <a href="#" className="text-xs text-[#d4d4d4] hover:text-white font-medium leading-tight">Incident Report 096-1-A has been declassified.</a>
                </li>
              </ul>
          </section>

          <section className="bg-[#1a1a1a] text-green-500 p-5 border border-[#333] font-mono text-xs">
            <p className="mb-2 text-[#444]">{`> TERMINAL ACTIVE`}</p>
            <p className="mb-2 text-[#444]">{`> STATUS: 1 LOGGED IN`}</p>
            <p className="animate-pulse text-[#444]">{`> _`}</p>
          </section>
        </div>
      </div>

      {/* SCP Database List section */}
      <div className="pt-8 border-t border-[#333]">
        <h2 className="text-2xl font-bold font-sans text-white mb-6 uppercase tracking-widest">
          Database Archive Start
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center p-10 font-mono text-red-500 animate-pulse border border-[#333]">
            &gt; ACCESSING DATABASE...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visibleItems.map(item => (
                <div 
                  key={item.id}
                  onClick={() => onOpenArticle(item.id)}
                  className="bg-transparent border border-[#333] flex flex-col overflow-hidden relative group cursor-pointer hover:border-[#555] transition-colors"
                >
                  <div className="absolute top-0 left-0 h-full w-1 bg-[#333] group-hover:bg-red-600 transition-all"></div>
                  {item.images && item.images.length > 0 && (
                    <div className="aspect-video w-full bg-[#111] overflow-hidden border-b border-[#333]">
                      <img src={item.images[0]} alt={item.title} loading="lazy" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" onError={(e) => e.currentTarget.style.display = 'none'} />
                    </div>
                  )}
                  <div className="p-5 flex-1 bg-[#0f0f0f] flex flex-col ml-1">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-red-600 font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                        <FileText size={14} /> {item.scp}
                      </div>
                      <button onClick={(e) => toggleFav(e, item.id)} className={`transition-colors ${favorites.includes(item.id) ? 'text-yellow-500' : 'text-[#444] hover:text-[#888]'}`}>
                        <Star size={16} fill={favorites.includes(item.id) ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-white line-clamp-1">{item.title}</h3>
                    
                    <div className="flex flex-wrap gap-2 mt-auto pt-4">
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-[#111] border border-[#333] text-[#888]">
                        Rating: {item.rating > 0 ? `+${item.rating}` : item.rating}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-[#111] border border-[#333] text-[#888] truncate max-w-[120px]">
                        {item.series}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMore && (
              <div className="mt-8 text-center">
                <button 
                  onClick={handleLoadMore}
                  className="px-6 py-3 border border-[#333] hover:border-red-600 hover:text-white transition-colors font-mono tracking-widest text-sm text-[#888] uppercase"
                >
                  CARICA ALTRI
                </button>
              </div>
            )}
            {!hasMore && sortedItems.length > 0 && (
               <div className="mt-8 text-center font-mono text-[#555] text-xs">
                 END OF ARCHIVE
               </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
