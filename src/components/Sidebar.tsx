import { ChevronRight } from 'lucide-react';

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
    <aside className={`w-full lg:w-64 flex-shrink-0 flex flex-col bg-[#0f0f0f] border-r border-[#333] ${className}`}>
      <div className="p-6 space-y-8 flex-1 overflow-y-auto">
        
        {/* Navigation block */}
        <section>
          <h2 className="text-[10px] text-[#666] font-bold uppercase tracking-widest mb-4">
            Main Directive
          </h2>
          <ul className="space-y-3 text-xs font-medium">
            <li className="flex justify-between hover:text-white cursor-pointer" onClick={() => onLinkClick?.('home')}>
              <span>[HOME]</span>
            </li>
            <li className="flex justify-between hover:text-white cursor-pointer" onClick={() => onLinkClick?.('favorites')}>
              <span>[FAVORITES]</span>
            </li>
            <li className="flex justify-between hover:text-white cursor-pointer" onClick={() => onLinkClick?.('scp-173')}>
              <span className="text-red-500 font-bold">[SCP-173]</span>
            </li>
          </ul>
        </section>

        {/* Dynamic Nav Data */}
        {NAV_DATA.map((section, idx) => (
          <section key={idx}>
            <h2 className="text-[10px] text-[#666] font-bold uppercase tracking-widest mb-4">
              {section.category}
            </h2>
            <ul className="space-y-3 text-xs font-medium opacity-70">
              {section.items.map((item, idy) => (
                <li key={idy} onClick={() => onLinkClick?.(`${item.action}:${item.label}`)} className="hover:text-white hover:opacity-100 cursor-pointer">
                  {item.label.toUpperCase()}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      
      <div className="mt-auto p-6 border-t border-[#333]">
        <div className="bg-red-900/10 border border-red-900/40 p-3 rounded text-[10px] text-red-500 font-mono leading-tight">
          WARNING: DATA BREACH DETECTED IN SECTOR 4-B.
        </div>
      </div>
    </aside>
  );
}
