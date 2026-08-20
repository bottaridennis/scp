import React, { useEffect, useState } from 'react';
import { SCPItem, fetchScpContent } from '../services/scpApi';
import DOMPurify from 'dompurify';

const Redacted = ({ children, width }: { children?: React.ReactNode, width?: string }) => {
  if (width) {
    return <span className={`inline-block redacted select-none `} style={{ width, height: '1em', verticalAlign: 'middle' }}>&nbsp;</span>;
  }
  return <span className="redacted select-none px-1 rounded-[1px]">{children || "██████"}</span>;
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

    if (scpId === 'scp-173') {
        const has173Content = baseItem?.contentFile;
        // Optimization: fallback nicely if we just want the hardcoded one and we fail to fetch, 
        // but let's try to fetch so it's uniform.
    }

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

  return (
    <article className="flex-1 p-6 md:p-10 w-full font-sans">
      <div className="max-w-4xl mx-auto w-full">
        <header className="flex flex-col md:flex-row justify-between items-start mb-12 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-red-600 font-bold font-mono">DATA-LOG_SERIAL: #{item.scp.replace('SCP-', '')}-Q</p>
            <h1 className="text-5xl font-extrabold text-white tracking-tighter uppercase mb-1">{item.scp}</h1>
            <p className="text-lg italic text-[#888]">{item.title}</p>
          </div>
          <div className="text-right flex flex-col items-start md:items-end gap-1">
            <div className="bg-red-600 text-black px-4 py-1 font-bold text-sm uppercase tracking-widest">
              Series: {item.series || 'UNKNOWN'}
            </div>
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-[#888] hover:text-white underline font-mono">
              [SOURCE_FILE]
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 text-sm leading-relaxed text-[#d4d4d4]">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            
            {loading ? (
                <div className="font-mono text-red-500 animate-pulse py-10">&gt; DECRYPTING ARCHIVE...</div>
            ) : error ? (
                <div className="font-mono text-red-500 py-10">&gt; {error}</div>
            ) : htmlContent ? (
                <div className="scp-content space-y-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} />
            ) : (
                // Fallback hardcoded for 173 if not available via API? 
                // Or just show standard warning.
                scpId === 'scp-173' ? (
                   <>
                   {/* Special Containment Procedures */}
                    <section className="space-y-2">
                    <h3 className="text-[11px] font-bold uppercase text-[#666] tracking-widest mb-2">Special Containment Procedures</h3>
                    <p className="mb-4">
                        Item SCP-173 is to be kept in a locked container at all times. When personnel must enter SCP-173's container, no fewer than three may enter at any time and the door is to be relocked behind them.
                    </p>
                    <p>
                        At all times, two persons must maintain direct eye contact with SCP-173 until all personnel have vacated and relocked the container.
                    </p>
                    </section>

                    {/* Description */}
                    <section className="space-y-2 pt-2">
                    <h3 className="text-[11px] font-bold uppercase text-[#666] tracking-widest mb-2">Description</h3>
                    <p className="mb-4">
                        Moved to Site-19 <Redacted>1993</Redacted>. Origin is as of yet unknown. It is constructed from concrete and rebar with traces of Krylon brand spray paint. SCP-173 is animate and extremely hostile. The object cannot move while within a direct line of sight. Line of sight must not be broken at any time with SCP-173. 
                    </p>
                    <p className="mb-4">
                        Personnel assigned to enter container are instructed to alert one another before blinking. Object is reported to attack by snapping the neck at the base of the skull, or by strangulation. In the event of an attack, personnel are to observe Class 4 hazardous object containment procedures.
                    </p>
                    <p className="mb-4">
                        Personnel report sounds of scraping stone originating from within the container when no one is present inside. This is considered normal, and any change in this behaviour should be reported to the acting HMCL supervisor on duty.
                    </p>
                    <p>
                        The reddish brown substance on the floor is a combination of feces and blood. Origin of these materials is unknown. The enclosure must be cleaned on a bi-weekly basis.
                    </p>
                    </section>
                   </>
                ) : (
                    <div className="font-mono text-[#888] py-10">&gt; DOCUMENT EMPTY</div>
                )
            )}
          </div>

          <div className="col-span-1 space-y-4">
            <div className="aspect-square bg-[#1a1a1a] border border-[#333] flex items-center justify-center p-4 relative overflow-hidden">
              <div className="absolute top-2 left-2 text-[8px] text-white bg-black/50 px-1 font-mono z-10">IMG_SRC: SITE-19_CAM_01</div>
              {item.images && item.images.length > 0 ? (
                  <img src={item.images[0]} alt={item.title} className="w-full h-full object-contain" />
              ) : (
                  <div className="w-full h-full bg-[#222] border-2 border-dashed border-[#444] flex flex-col items-center justify-center space-y-2">
                      <div className="w-8 h-8 rounded-full border-2 border-red-800/30"></div>
                      <p className="text-[10px] text-[#444] uppercase tracking-tighter">Visual Corrupted</p>
                  </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#111] border border-[#333] text-[#888] uppercase">
                CLASS: {item.tags?.find(t => ['safe', 'euclid', 'keter', 'thaumiel', 'apollyon', 'esoteric-class'].includes(t)) || 'UNKNOWN'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#111] border border-[#333] text-[#888]">
                RATING: {item.rating > 0 ? `+${item.rating}` : item.rating}
              </span>
            </div>
          </div>
        </div>

        {/* Tags Addendum */}
        {item.tags && item.tags.length > 0 && (
          <section className="border-t border-[#333] pt-6 flex flex-wrap items-center text-[10px] font-mono text-[#666] gap-2 mb-8">
            <span className="font-bold text-red-600">TAGS:</span>
            {item.tags.map(tag => (
                <span key={tag} className="border border-[#333] px-1.5 py-0.5 hover:bg-[#111] transition-colors">{tag}</span>
            ))}
          </section>
        )}
        
        <section className="mt-4">
          <div className="bg-[#111] border border-[#333] font-mono p-4 text-xs leading-relaxed text-[#d4d4d4]">
            <p className="mb-2 text-[#666]">{`> RETRIEVING ARCHIVED LOG...`}</p>
            <p className="mb-2 text-green-600">{`> AUTHENTICATION VALID`}</p>
            <p className="text-green-600 animate-pulse">{`> TERMINAL IDLE`}</p>
          </div>
        </section>
      </div>
    </article>
  );
}
