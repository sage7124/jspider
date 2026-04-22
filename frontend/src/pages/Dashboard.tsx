import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import TraineeDashboard from '../components/dashboard/TraineeDashboard';
import AdminDashboard from '../components/dashboard/AdminDashboard';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    setUser(JSON.parse(userData));
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col">
      <Header />
      
      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6 max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome, {user.fullName}
          </h2>
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              navigate('/login');
            }}
            className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium hover:bg-gray-50"
          >
            Logout
          </button>
        </div>

        {user.role === 'TRAINEE' ? (
          <TraineeDashboard user={user} />
        ) : (
          <AdminDashboard />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
