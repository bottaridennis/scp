import React, { useState, useMemo, useEffect } from 'react';
import { FileText, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { SCPItem, isFavorite, toggleFavorite } from '../services/scpApi';

interface ScpListProps {
  items: SCPItem[];
  isLoading: boolean;
  error: string | null;
  onOpenArticle: (id: string) => void;
  title: string;
}

const ITEMS_PER_PAGE = 24;

export default function ScpList({ items, isLoading, error, onOpenArticle, title }: ScpListProps) {
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'rating'>('asc');
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
    const arr = [...items];
    if (sortOrder === 'asc') {
      arr.sort((a, b) => (a.scpNumber || 0) - (b.scpNumber || 0));
    } else if (sortOrder === 'desc') {
      arr.sort((a, b) => (b.scpNumber || 0) - (a.scpNumber || 0));
    } else if (sortOrder === 'rating') {
      arr.sort((a, b) => b.rating - a.rating);
    }
    return arr;
  }, [items, sortOrder]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return sortedItems.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedItems, page]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 font-mono text-red-500 animate-pulse">
        &gt; ACCESSING MAINFRAME... PLEASE WAIT
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-10 font-mono text-red-500">
        &gt; ERROR: {error.toUpperCase()}
      </div>
    );
  }

  return (
    <div className="max-w-6xl w-full mx-auto font-sans p-6 md:p-10 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-[#333] pb-4">
        <h2 className="text-2xl font-bold text-white uppercase">{title}</h2>
        
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <span className="text-[#666]">SORT BY:</span>
          <button 
            onClick={() => setSortOrder('asc')} 
            className={`px-3 py-1 border ${sortOrder === 'asc' ? 'border-red-600 text-red-600 bg-red-900/10' : 'border-[#333] hover:border-[#555] text-[#888]'}`}
          >
            <ArrowUp className="inline w-3 h-3 mr-1"/> NUM
          </button>
          <button 
            onClick={() => setSortOrder('desc')} 
            className={`px-3 py-1 border ${sortOrder === 'desc' ? 'border-red-600 text-red-600 bg-red-900/10' : 'border-[#333] hover:border-[#555] text-[#888]'}`}
          >
            <ArrowDown className="inline w-3 h-3 mr-1"/> NUM
          </button>
          <button 
            onClick={() => setSortOrder('rating')} 
            className={`px-3 py-1 border ${sortOrder === 'rating' ? 'border-red-600 text-red-600 bg-red-900/10' : 'border-[#333] hover:border-[#555] text-[#888]'}`}
          >
            <Star className="inline w-3 h-3 mr-1"/> RATING
          </button>
        </div>
      </div>

      <p className="text-sm text-[#888] font-mono">FOUND: {items.length} RECORDS</p>

      {items.length === 0 ? (
        <div className="text-[#666] font-mono text-center py-20">
          &gt; NO RECORDS FOUND MATCHING THE CURRENT DIRECTIVE.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {paginatedItems.map(item => (
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
      )}

      {/* Pagination component */}
      {items.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center items-center gap-4 mt-12 mb-8 font-mono text-sm">
          <button 
            disabled={page === 1}
            onClick={() => { setPage(p => p - 1); window.scrollTo(0,0); }}
            className="px-4 py-2 border border-[#333] hover:border-red-600 hover:text-white disabled:opacity-50 disabled:hover:border-[#333] transition-colors"
          >
            &lt; PREV
          </button>
          <span className="text-[#888]">PAGE {page} OF {Math.ceil(items.length / ITEMS_PER_PAGE)}</span>
          <button 
            disabled={page >= Math.ceil(items.length / ITEMS_PER_PAGE)}
            onClick={() => { setPage(p => p + 1); window.scrollTo(0,0); }}
            className="px-4 py-2 border border-[#333] hover:border-red-600 hover:text-white disabled:opacity-50 disabled:hover:border-[#333] transition-colors"
          >
            NEXT &gt;
          </button>
        </div>
      )}
    </div>
  );
}
