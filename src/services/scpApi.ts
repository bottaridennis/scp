export type SCPItem = {
  id: string;
  scp: string;
  scpNumber: number | null;
  title: string;
  series: string;
  rating: number;
  tags: string[];
  images: string[];
  sourceUrl: string;
  contentFile?: string;
  createdAt?: string;
  createdBy?: string;
};

export const normalizeScpItem = (id: string, raw: any): SCPItem => ({
  id,
  scp: raw.scp ?? id.toUpperCase(),
  scpNumber: raw.scp_number ? Number(raw.scp_number) : null,
  title: raw.title ?? "Titolo non disponibile",
  series: raw.series ?? "Serie non disponibile",
  rating: Number(raw.rating ?? 0),
  tags: Array.isArray(raw.tags) ? raw.tags : [],
  images: Array.isArray(raw.images) ? raw.images : [],
  sourceUrl: raw.url ?? "",
  contentFile: raw.content_file,
  createdAt: raw.created_at,
  createdBy: raw.created_by
});

let metadataCache: SCPItem[] | null = null;
const contentCache: Record<string, string> = {};

const API_BASE = import.meta.env.DEV ? '/scp-api' : 'https://scp-data.tedivm.com';

export async function fetchScpMetadata(): Promise<SCPItem[]> {
  if (metadataCache) return metadataCache;

  try {
    const res = await fetch(`${API_BASE}/data/scp/items/index.json`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    
    // Normalize data (could be array or object-like)
    const items: SCPItem[] = [];
    if (Array.isArray(data)) {
        data.forEach((item, index) => {
            if (item) {
                items.push(normalizeScpItem(item.scp || String(index), item));
            }
        });
    } else {
        Object.keys(data).forEach(key => {
            items.push(normalizeScpItem(key, data[key]));
        });
    }
    
    metadataCache = items;
    return items;
  } catch (error) {
    console.error("Failed to fetch SCP metadata", error);
    throw error;
  }
}

export async function fetchScpContent(scpItem: SCPItem): Promise<string> {
  if (scpItem.id && contentCache[scpItem.id]) {
    return contentCache[scpItem.id];
  }

  try {
    let url = `${API_BASE}/data/scp/items/content_index.json`;
    if (scpItem.contentFile) {
      url = `${API_BASE}/data/scp/items/${scpItem.contentFile}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Network response was not ok');
    
    let htmlContent = "";
    
    const isJson = url.endsWith('.json') || res.headers.get("content-type")?.includes("json");
    
    if (isJson) {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        const keyMatch = data[scpItem.id] || data[scpItem.scp];
        const scpData = keyMatch || data;
        
        if (scpData && scpData.raw_content) {
          const formatText = (text: string) => {
            let t = text.replace(/\n/g, '<br />');
            t = t.replace(/\[DATA EXPUNGED\]/gi, '<span class="redacted text-[10px]">DATA EXT</span>');
            t = t.replace(/\[REDACTED\]/gi, '<span class="redacted text-[10px]">REDACT</span>');
            t = t.replace(/██+/g, () => `<span class="redacted text-[10px]">████</span>`);
            return t;
          };

          const paragraphs = scpData.raw_content.split(/\n\n+/);
          htmlContent = paragraphs.map((p: string) => {
            p = p.trim();
            if (!p) return "";
            
            // Skip wikidot module garbage
            if (p.includes('[[module') || p.includes('[[/module]]') || p.includes('[[>]]') || p.startsWith('[[include')) {
               return '';
            }

            const inlineHeaderMatch = p.match(/^(Item #|Item|Object Class|Special Containment Procedures|Description|Addendum[\w\s.-]*):\s*(.*)/is);
            const blockHeaderMatch = p.match(/^(Addendum[\w\s.-]*)(:?)$/i);
            
            if (inlineHeaderMatch) {
              const header = inlineHeaderMatch[1];
              const rest = inlineHeaderMatch[2];
              return `
                <div class="mt-8 mb-4">
                  <h3 class="text-[11px] font-bold uppercase text-red-600 tracking-widest mb-3 flex items-center gap-2">
                    <span class="w-1.5 h-1.5 bg-red-600 inline-block shrink-0"></span> ${header}
                  </h3>
                  <div class="text-[#d4d4d4] leading-relaxed text-sm pl-4 border-l border-[#333] pt-1 pb-2">
                    ${formatText(rest)}
                  </div>
                </div>`;
            } else if (blockHeaderMatch) {
              const header = blockHeaderMatch[1];
              return `
                <div class="mt-8 mb-2">
                  <h3 class="text-[11px] font-bold uppercase text-[#888] tracking-widest mb-2 flex items-center gap-2 border-b border-[#333] pb-2">
                    <span class="w-1.5 h-1.5 bg-[#333] inline-block shrink-0"></span> ${header}
                  </h3>
                </div>`;
            } else {
              return `<div class="mb-4 text-[#d4d4d4] leading-relaxed text-sm">${formatText(p)}</div>`;
            }
          }).join('');
        } else if (typeof scpData === 'string') {
          htmlContent = scpData;
        } else {
          htmlContent = `<p>Error: Could not parse content data</p>`;
        }
      } catch (err) {
        // Fallback if parsing fails
        htmlContent = text;
      }
    } else {
      htmlContent = await res.text();
    }
    
    if (scpItem.id) {
        contentCache[scpItem.id] = htmlContent;
    }
    return htmlContent;
  } catch (error) {
    console.error("Failed to fetch SCP content", error);
    throw error;
  }
}

export const FAVORITES_STORAGE_KEY = "scp-favorites";

export function getFavorites(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("Error reading favorites", err);
  }
  return [];
}

export function saveFavorites(favs: string[]) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
  } catch (err) {
    console.error("Error saving favorites", err);
  }
}

export function toggleFavorite(id: string): string[] {
  const favs = getFavorites();
  const index = favs.indexOf(id);
  const newFavs = [...favs];
  if (index >= 0) {
    newFavs.splice(index, 1);
  } else {
    newFavs.push(id);
  }
  saveFavorites(newFavs);
  return newFavs;
}

export const HISTORY_STORAGE_KEY = "scp-history";

export function getHistory(): string[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("Error reading history", err);
  }
  return [];
}

export function addHistory(id: string) {
  const history = getHistory();
  const index = history.indexOf(id);
  if (index >= 0) {
    history.splice(index, 1);
  }
  history.unshift(id); // Add to front
  // Keep only last 50
  if (history.length > 50) {
    history.length = 50;
  }
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error("Error saving history", err);
  }
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id);
}
