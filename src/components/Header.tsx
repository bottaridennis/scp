import { Menu, X, Search, Shield, Fingerprint } from 'lucide-react';
import React, { useState } from 'react';
import { motion } from 'motion/react';

interface HeaderProps {
  onMenuClick: () => void;
  isMobileMenuOpen: boolean;
  onSearch: (query: string) => void;
  onHomeClick: () => void;
}

export default function Header({ onMenuClick, isMobileMenuOpen, onSearch, onHomeClick }: HeaderProps) {
  const [searchVal, setSearchVal] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchVal);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b-2 border-slate-900 shadow-sm no-print">
      {/* Top Warning Bar */}
      <div className="bg-red-700 text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-center py-1 overflow-hidden whitespace-nowrap">
        <motion.div
          animate={{ x: ["100%", "-100%"] }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        >
           RESTRICTED ACCESS — AUTHORIZED PERSONNEL ONLY — ANY UNAUTHORIZED ACCESS WILL BE LOGGED AND INVESTIGATED —
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          <div className="flex items-center gap-4">
            <button 
              onClick={onMenuClick}
              className="p-2 -ml-2 text-slate-800 hover:text-red-700 focus:outline-none transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={onHomeClick}
            >
              {/* Simplistic SCP Logo */}
              <div className="w-10 h-10 border-[3px] border-slate-900 rounded-full flex items-center justify-center group-hover:border-red-700 transition-colors">
                <div className="w-4 h-4 border-t-[3px] border-l-[3px] border-slate-900 transform rotate-45 group-hover:border-red-700 transition-colors"></div>
              </div>
              <div className="hidden sm:block leading-none">
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  SCP Foundation
                </h1>
                <p className="text-[9px] tracking-[0.25em] text-slate-500 font-bold uppercase mt-0.5">
                  Secure. Contain. Protect.
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-lg px-6 hidden md:block">
            <form onSubmit={handleSearch} className="relative group">
              <input 
                type="text" 
                placeholder="SEARCH DATABASE..." 
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 text-sm font-sans text-slate-900 px-4 py-2 focus:outline-none focus:border-red-700 focus:ring-1 focus:ring-red-700 transition-all placeholder:text-slate-400"
              />
              <button type="submit" className="absolute right-3 top-2 text-slate-400 group-hover:text-red-700 transition-colors">
                <Search size={18} />
              </button>
            </form>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
             <div className="hidden lg:block text-right">
              <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">Clearance</p>
              <p className="text-xs font-mono text-slate-900 font-bold border border-slate-300 px-2 py-0.5 mt-0.5 inline-block">LEVEL 04</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-400 hover:text-slate-900 cursor-help transition-colors">
              <Fingerprint size={20} />
            </div>
          </div>

        </div>
      </div>
      
      {/* Mobile Search */}
      <div className="md:hidden border-t border-slate-200 p-2 bg-slate-50">
        <form onSubmit={handleSearch} className="relative">
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full bg-white border border-slate-300 text-sm font-sans text-slate-900 px-4 py-2 focus:outline-none focus:border-red-700"
          />
        </form>
      </div>
    </header>
  );
}
