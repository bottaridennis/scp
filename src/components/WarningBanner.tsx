import { AlertOctagon } from 'lucide-react';

export default function WarningBanner() {
  return (
    <div className="w-full bg-[#1a0f0f] border border-red-900/40 px-6 py-8 mb-8 relative overflow-hidden">
      {/* Decorative top red line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
      
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
        <div className="flex-shrink-0 bg-[#0f0f0f] p-3 rounded-none border border-red-900/40">
          <AlertOctagon className="w-12 h-12 text-red-600 stroke-[1.5]" />
        </div>
        
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold tracking-widest text-red-600 uppercase mb-3 font-sans">
            Classified Information
          </h2>
          <div className="space-y-2 font-mono text-sm md:text-md text-[#d4d4d4] font-medium border-l border-red-900/40 pl-4">
            <p>
              WARNING: THE FOUNDATION DATABASE IS CLASSIFIED.
            </p>
            <p className="text-[#888]">
              ACCESS BY UNAUTHORIZED PERSONNEL IS STRICTLY PROHIBITED.
            </p>
            <p className="text-red-500 font-bold bg-red-900/10 inline-block px-1">
              PERPETRATORS WILL BE TRACKED, LOCATED, AND DETAINED.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
