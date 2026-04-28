import React from 'react';
import { ClipboardList } from 'lucide-react';

const Header: React.FC = () => {
  const logoUrl = import.meta.env.VITE_INSTITUTE_LOGO;

  return (
    <header className="bg-[#1a1f2e] text-white py-3 px-6 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <div className="bg-white px-2 py-1 rounded">
            <img src={logoUrl} alt="Institute Logo" className="h-10 object-contain" />
          </div>
        ) : (
          <>
            <ClipboardList className="h-6 w-6 text-blue-400" />
            <h1 className="text-xl font-bold tracking-tight">Attendance System</h1>
          </>
        )}
        <span className="bg-white text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded ml-2">v0.1</span>
      </div>
    </header>
  );
};

export default Header;
