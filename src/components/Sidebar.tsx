import { Bookmark, Home, BookOpen, AlertCircle, FileText } from 'lucide-react';

const NAV_DATA = [
  {
    category: "Database Archives",
    items: [
      { label: "Series IX (8000-8999)", action: 'range:8000:8999' },
      { label: "Series VIII (7000-7999)", action: 'range:7000:7999' },
      { label: "Series VII (6000-6999)", action: 'range:6000:6999' },
      { label: "Series VI (5000-5999)", action: 'range:5000:5999' },
      { label: "Series V (4000-4999)", action: 'range:4000:4999' },
      { label: "Series IV (3000-3999)", action: 'range:3000:3999' },
      { label: "Series III (2000-2999)", action: 'range:2000:2999' },
      { label: "Series II (1000-1999)", action: 'range:1000:1999' },
      { label: "Series I (001-999)", action: 'range:1:999' }
    ]
  },
  {
    category: "Library",
    items: [
      { label: "Joke SCPs", action: 'tag:joke' },
      { label: "Archived SCPs", action: 'tag:archived' },
      { label: "SCP-EX", action: 'tag:explained' }
    ]
  },
  {
    category: "Tales",
    items: [
      { label: "Foundation Tales", action: 'tag:tale' }
    ]
  }
];

interface SidebarProps {
  className?: string;
  onLinkClick?: (page: string) => void;
}

export default function Sidebar({ className = "", onLinkClick }: SidebarProps) {
  return (
    <aside className={`w-full lg:w-64 flex-shrink-0 flex flex-col bg-slate-50 border-r border-slate-300 no-print ${className}`}>
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        
        {/* Navigation block */}
        <section>
          <h2 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 px-2">
            Main Directive
          </h2>
          <ul className="space-y-1 text-sm font-sans font-medium">
            <li>
              <button 
                onClick={() => onLinkClick?.('home')} 
                className="w-full flex items-center gap-2 px-2 py-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors text-left"
              >
                <Home size={16} /> Dashboard
              </button>
            </li>
            <li>
              <button 
                onClick={() => onLinkClick?.('favorites')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors text-left"
              >
                <Bookmark size={16} /> Saved Files
              </button>
            </li>
            <li>
              <button 
                onClick={() => onLinkClick?.('scp-173')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-red-700 hover:bg-red-50 hover:text-red-800 rounded transition-colors text-left"
              >
                <AlertCircle size={16} /> Priority: SCP-173
              </button>
            </li>
          </ul>
        </section>

        {/* Dynamic Nav Data */}
        {NAV_DATA.map((section, idx) => (
          <section key={idx}>
            <h2 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 px-2">
              {section.category}
            </h2>
            <ul className="space-y-1 text-sm font-sans opacity-90">
              {section.items.map((item, idy) => (
                <li key={idy}>
                  <button 
                    onClick={() => onLinkClick?.(`${item.action}:${item.label}`)}
                    className="w-full flex items-center gap-2 px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors text-left"
                  >
                    <FileText size={14} className="opacity-50" />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      
      <div className="mt-auto p-4 border-t border-slate-300 bg-slate-100">
        <div className="border border-slate-300 p-3 bg-white text-[10px] text-slate-600 font-mono leading-relaxed relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
          <strong>SYSTEM STATUS</strong><br/>
          No active breaches detected.
        </div>
      </div>
    </aside>
  );
}
