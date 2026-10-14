import React, { useState, useMemo, useEffect } from 'react';
import { FileText, Bookmark, ArrowUp, ArrowDown, Star } from 'lucide-react';
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
      <div className="flex-1 flex flex-col items-center justify-center p-10 font-mono text-slate-500 animate-pulse">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-4"></div>
        &gt; RETRIEVING RECORDS... PLEASE WAIT
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-10 font-mono text-red-600 font-bold bg-red-50 border border-red-200 m-6">
        &gt; SYSTEM ERROR: {error.toUpperCase()}
      </div>
    );
  }

  return (
    <div className="max-w-6xl w-full mx-auto font-sans p-6 md:p-10 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 border-b-2 border-slate-200 pb-4">
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Database Query Results</p>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{title}</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-slate-500 mr-2">SORT:</span>
          <button 
            onClick={() => setSortOrder('asc')} 
            className={`px-3 py-1.5 border rounded-sm transition-colors ${sortOrder === 'asc' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white hover:border-slate-400 text-slate-600'}`}
          >
            <ArrowUp className="inline w-3 h-3 mr-1"/> NUM
          </button>
          <button 
            onClick={() => setSortOrder('desc')} 
            className={`px-3 py-1.5 border rounded-sm transition-colors ${sortOrder === 'desc' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white hover:border-slate-400 text-slate-600'}`}
          >
            <ArrowDown className="inline w-3 h-3 mr-1"/> NUM
          </button>
          <button 
            onClick={() => setSortOrder('rating')} 
            className={`px-3 py-1.5 border rounded-sm transition-colors ${sortOrder === 'rating' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white hover:border-slate-400 text-slate-600'}`}
          >
            <Star className="inline w-3 h-3 mr-1"/> RATING
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500 font-mono">MATCHING DOSSIERS: {items.length}</p>

      {items.length === 0 ? (
        <div className="text-slate-500 font-mono text-center py-20 bg-slate-100 border border-slate-200 rounded">
          &gt; NO RECORDS FOUND MATCHING THE CURRENT DIRECTIVE.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {paginatedItems.map(item => (
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
      )}

      {/* Pagination component */}
      {items.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center items-center gap-4 mt-12 mb-8 font-mono text-sm">
          <button 
            disabled={page === 1}
            onClick={() => { setPage(p => p - 1); window.scrollTo(0,0); }}
            className="px-4 py-2 border border-slate-300 bg-white hover:border-slate-800 hover:text-slate-900 disabled:opacity-50 disabled:hover:border-slate-300 transition-colors rounded-sm shadow-sm"
          >
            &lt; PREV
          </button>
          <span className="text-slate-600 font-medium">PAGE {page} OF {Math.ceil(items.length / ITEMS_PER_PAGE)}</span>
          <button 
            disabled={page >= Math.ceil(items.length / ITEMS_PER_PAGE)}
            onClick={() => { setPage(p => p + 1); window.scrollTo(0,0); }}
            className="px-4 py-2 border border-slate-300 bg-white hover:border-slate-800 hover:text-slate-900 disabled:opacity-50 disabled:hover:border-slate-300 transition-colors rounded-sm shadow-sm"
          >
            NEXT &gt;
          </button>
        </div>
      )}
    </div>
  );
}
