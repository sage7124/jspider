import React from 'react';
import { ClipboardList } from 'lucide-react';

const Header: React.FC = () => {
  const logoUrl = import.meta.env.VITE_INSTITUTE_LOGO;

  return (
    <header className="bg-[#1976D2] text-white py-3 px-6 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        {logoUrl && (
          <div className="bg-white px-2 py-1 rounded">
            <img src={logoUrl} alt="Institute Logo" className="h-10 object-contain" />
          </div>
        )}
        <div className="flex flex-col">
          <h1 className="text-lg font-bold tracking-tight">
            {import.meta.env.VITE_APP_TITLE || 'Attendance System'}
          </h1>
          <span className="text-[10px] opacity-80">v0.1</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
