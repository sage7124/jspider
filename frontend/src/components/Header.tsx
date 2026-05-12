import React from 'react';
import { ClipboardList } from 'lucide-react';

const Header: React.FC = () => {
  const logoUrl = import.meta.env.VITE_INSTITUTE_LOGO || '/nict-logo.jpeg';

  return (
    <header className="bg-[#1976D2] text-white py-3 px-6 flex items-center relative shadow-md">
      {/* Logo left aligned */}
      <div className="flex items-center gap-3 z-10">
        {logoUrl ? (
          <div className="bg-white px-2 py-1 rounded">
            <img src={logoUrl} alt="Institute Logo" className="h-10 object-contain" />
          </div>
        ) : (
          <ClipboardList className="h-8 w-8" />
        )}
      </div>

      {/* Centered Title Block */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <h1 className="text-lg font-extrabold tracking-widest uppercase drop-shadow-sm">
          NICT COMPUTER EDUCATION PVT LTD
        </h1>
        <span className="text-[10px] opacity-70 tracking-tighter font-mono -mt-0.5">v1.0 UNIFIED</span>
      </div>
    </header>
  );
};

export default Header;
