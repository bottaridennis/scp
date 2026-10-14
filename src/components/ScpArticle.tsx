import React, { useEffect, useState } from 'react';
import { SCPItem, fetchScpContent, addHistory } from '../services/scpApi';
import DOMPurify from 'dompurify';
import { FileText, Download, Printer, Lock } from 'lucide-react';
import { motion } from 'motion/react';

const Redacted = ({ children, width }: { children?: React.ReactNode, width?: string }) => {
  if (width) {
    return <span className={`inline-block redacted select-none`} style={{ width, height: '1em', verticalAlign: 'middle' }}>&nbsp;</span>;
  }
  return <span className="redacted select-none px-1">{children || "██████"}</span>;
};

interface ScpArticleProps {
  scpId: string;
  scpItems: SCPItem[];
}

export default function ScpArticle({ scpId, scpItems }: ScpArticleProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseItem = scpItems.find(i => i.id === scpId);

  useEffect(() => {
    if (!scpId) return;

    // Track in recent history
    addHistory(scpId);

    setLoading(true);
    setError(null);
    setHtmlContent(null);

    // Provide a dummy item if not loaded to fetch by ID
    const fetchItem = baseItem || { id: scpId, scp: scpId, scpNumber: null, title: 'Loading...', series: '', rating: 0, tags: [], images: [], sourceUrl: `https://scp-wiki.wikidot.com/${scpId}` };

    fetchScpContent(fetchItem)
      .then(content => {
        setHtmlContent(content);
        setLoading(false);
      })
      .catch(err => {
        setError("DATA CORRUPTED OR UNAVAILABLE");
        setLoading(false);
      });
  }, [scpId, baseItem]);

  const fallbackItem = {
    scp: scpId.toUpperCase(),
    title: "ACCESSING...",
    series: "UNKNOWN",
    rating: 0,
    tags: [],
    images: [],
    sourceUrl: `https://scp-wiki.wikidot.com/${scpId}`
  };

  const item = baseItem || fallbackItem;

  const objectClass = item.tags?.find(t => ['safe', 'euclid', 'keter', 'thaumiel', 'apollyon', 'esoteric-class'].includes(t)) || 'UNKNOWN';

  return (
    <article className="flex-1 p-4 md:p-8 w-full font-sans bg-slate-50 relative min-h-screen">
      <div className="max-w-4xl mx-auto w-full bg-white shadow-xl border border-slate-200">
        
        {/* Document Header */}
        <div className="border-b-4 border-slate-900 p-6 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]">
          <div className="absolute -top-10 -right-10 text-slate-100 opacity-50 transform rotate-12 select-none">
             <Lock size={200} />
          </div>

          <div className="space-y-4 z-10 w-full md:w-auto">
            <div className="flex items-center justify-between w-full">
               <div className="text-[10px] text-red-700 font-mono font-bold uppercase tracking-widest border border-red-700 px-2 py-0.5 bg-red-50 inline-block">
                 CLASSIFIED DOCUMENT
               </div>
               <div className="md:hidden text-[10px] font-mono text-slate-500 font-bold uppercase text-right">
                 {item.series || 'UNKNOWN'}
               </div>
            </div>
            
            <div>
               <p className="text-xs text-slate-500 font-bold font-mono tracking-widest mb-1">ITEM #: {item.scp.replace('SCP-', '')}</p>
               <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase mb-2 font-sans">{item.scp}</h1>
               <p className="text-lg italic text-slate-600 font-serif border-l-2 border-red-700 pl-3 py-1">{item.title}</p>
            </div>
          </div>
          
          <div className="z-10 text-right flex flex-col items-start md:items-end gap-2 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-200">
             <div className="text-[10px] font-mono text-slate-500 font-bold uppercase mb-1 hidden md:block">
               SERIES: {item.series || 'UNKNOWN'}
             </div>
             
             <div className="bg-slate-900 text-white px-4 py-1.5 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
               Class: {objectClass}
             </div>
             
             <div className="flex gap-3 mt-3">
               <button onClick={() => window.print()} className="text-slate-500 hover:text-slate-900 transition-colors p-1 bg-slate-100 rounded no-print">
                 <Printer size={16} />
               </button>
               <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-900 transition-colors p-1 bg-slate-100 rounded no-print">
                 <Download size={16} />
               </a>
             </div>
          </div>
        </div>

        <div className="p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 text-[15px] leading-relaxed text-slate-900 font-serif">
          
          <div className="col-span-1 lg:col-span-8 space-y-6">
            
            {loading ? (
                <div className="font-mono text-slate-500 animate-pulse py-10 flex flex-col items-center gap-4">
                   <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                   &gt; DECRYPTING SECURE ARCHIVE...
                </div>
            ) : error ? (
                <div className="font-mono text-red-700 font-bold bg-red-50 p-6 border border-red-200 text-center uppercase tracking-widest">
                   &gt; {error}
                </div>
            ) : htmlContent ? (
                <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   transition={{ duration: 0.5 }}
                   className="scp-content space-y-5 prose prose-slate max-w-none prose-headings:font-sans prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-widest prose-h3:text-sm prose-h3:text-red-700 prose-p:leading-relaxed" 
                   dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} 
                />
            ) : (
                <div className="font-mono text-slate-500 py-10 text-center border-2 border-dashed border-slate-300">
                   &gt; DOCUMENT EMPTY OR REDACTED
                </div>
            )}
          </div>

          <aside className="col-span-1 lg:col-span-4 space-y-6">
            <div className="bg-slate-100 border border-slate-300 p-2 relative overflow-hidden group">
              <div className="absolute top-0 left-0 bg-red-700 text-white text-[8px] font-mono px-1.5 py-0.5 z-10 uppercase tracking-widest font-bold shadow-sm">
                Attachment 1
              </div>
              {item.images && item.images.length > 0 ? (
                  <img src={item.images[0]} alt={item.title} className="w-full h-auto object-contain mix-blend-multiply grayscale-[20%] group-hover:grayscale-0 transition-all duration-500 bg-white" />
              ) : (
                  <div className="w-full aspect-square bg-slate-200 border-2 border-dashed border-slate-400 flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full border-4 border-slate-300 flex items-center justify-center">
                         <div className="w-1 h-6 bg-slate-300 transform rotate-45"></div>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">Image Missing</p>
                  </div>
              )}
            </div>
            
            <div className="bg-slate-50 border border-slate-200 p-4 font-mono text-[11px] uppercase tracking-wider space-y-3">
               <h4 className="font-bold border-b border-slate-300 pb-2 mb-2 text-slate-800">Metadata</h4>
               <div className="grid grid-cols-2 gap-2 text-slate-600">
                 <span className="font-bold text-slate-900">Rating:</span>
                 <span className="text-right">{item.rating > 0 ? `+${item.rating}` : item.rating}</span>
                 
                 <span className="font-bold text-slate-900">Class:</span>
                 <span className="text-right">{objectClass}</span>
                 
                 <span className="font-bold text-slate-900">Clearance:</span>
                 <span className="text-right">Level 4</span>
               </div>
            </div>

            {/* Tags Addendum */}
            {item.tags && item.tags.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 p-4 font-mono text-[10px] uppercase tracking-wider space-y-2">
                <h4 className="font-bold border-b border-slate-300 pb-2 mb-2 text-slate-800">Assigned Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map(tag => (
                      <span key={tag} className="bg-white border border-slate-300 px-1.5 py-0.5 text-slate-600">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        <footer className="border-t-4 border-slate-900 p-6 md:p-10 bg-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
           <div>
             Property of the SCP Foundation. Secure. Contain. Protect.
           </div>
           <div className="text-slate-400">
             END OF FILE
           </div>
        </footer>
      </div>
    </article>
  );
}
