import React from 'react';
import { ClipboardList } from 'lucide-react';

const Header: React.FC = () => {
  const logoUrl = import.meta.env.VITE_INSTITUTE_LOGO || '/nict-logo.jpeg';

  return (
    <header className="bg-[#1976D2] text-white py-3 px-4 sm:px-6 flex items-center relative shadow-md h-16 overflow-hidden">
      {/* Logo left aligned */}
      <div className="flex items-center z-10 shrink-0">
        {logoUrl ? (
          <div className="bg-white px-2 py-1 rounded shadow-sm">
            <img src={logoUrl} alt="Institute Logo" className="h-8 sm:h-10 object-contain" />
          </div>
        ) : (
          <ClipboardList className="h-8 w-8" />
        )}
      </div>

      {/* Centered Title Block with responsive fonts to fit phones perfectly */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-16 text-center">
        <h1 className="text-[10px] xs:text-xs sm:text-base md:text-lg font-black tracking-wide sm:tracking-widest uppercase drop-shadow-md leading-tight">
          NICT COMPUTER EDUCATION PVT LTD
        </h1>
        <span className="text-[8px] sm:text-[10px] opacity-70 tracking-tighter font-mono">v1.0 UNIFIED</span>
      </div>
    </header>
  );
};

export default Header;
