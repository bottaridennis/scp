import { ShieldAlert, Search, User, Menu, X } from 'lucide-react';
import React, { useState } from 'react';

interface HeaderProps {
  onMenuClick: () => void;
  isMobileMenuOpen: boolean;
  onSearch: (query: string) => void;
}

export default function Header({ onMenuClick, isMobileMenuOpen, onSearch }: HeaderProps) {
  const [searchVal, setSearchVal] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchVal);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#111] border-b border-[#333]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo & Title */}
          <div className="flex items-center gap-6">
            <button 
              onClick={onMenuClick}
              className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-white focus:outline-none"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="w-12 h-12 border-2 border-red-600 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 border-t-2 border-l-2 border-red-600 transform rotate-45"></div>
            </div>
            <div className="hidden sm:block leading-none">
              <h1 className="text-2xl font-bold tracking-tighter text-white uppercase">
                SCP Foundation
              </h1>
              <p className="text-[10px] tracking-[0.3em] text-red-600 font-bold uppercase mt-1">
                Secure. Contain. Protect.
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-md px-6">
            <form onSubmit={handleSearch} className="relative">
              <input 
                type="text" 
                placeholder="SEARCH ARCHIVE..." 
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] text-xs font-mono text-white px-4 py-2 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-sm transition-all placeholder:text-[#555]"
              />
              <button type="submit" className="absolute right-3 top-2 text-[#666] hover:text-red-600 transition-colors">
                <Search size={16} />
              </button>
            </form>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-[#666] uppercase">Security Clearance</p>
              <p className="text-sm font-mono text-red-500 font-bold">LEVEL 04 [CLASSIFIED]</p>
            </div>
            <div className="w-10 h-10 bg-[#222] border border-[#444] rounded flex items-center justify-center text-xs text-[#d4d4d4]">
              ID
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
