import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PublicScanPage = lazy(() => import('./pages/PublicScanPage'));

function App() {
  useEffect(() => {
    const title = import.meta.env.VITE_APP_TITLE || 'NICT';
    document.title = title;
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm font-medium">Loading...</div>}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scan-qr" element={<PublicScanPage />} />
          <Route path="/qr-submit" element={<PublicScanPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;


