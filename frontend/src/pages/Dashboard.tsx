import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
    <div className="min-h-screen bg-gradient-to-br from-[#E3F2FD] via-[#BBDEFB] to-[#90CAF9] flex flex-col">
      <Header />
      
      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6 max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome, {user.fullName}
          </h2>
          <div className="flex items-center gap-3">
            {user.role === 'ADMIN' && (
              <button 
                onClick={async () => {
                  if (!window.confirm('Are you sure you want to allow everyone to edit their profiles for the next 24 hours?')) return;
                  try {
                    const token = localStorage.getItem('token');
                    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                    await axios.post(`${API_URL}/api/admin/allow-all-edit-24h`, {}, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    alert('🔓 All teacher profiles unlocked for editing for the next 24 hours successfully!');
                  } catch (err: any) {
                    console.error(err);
                    alert('Failed to unlock profiles');
                  }
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded shadow text-sm font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                🔓 Unlock Profiles (24h)
              </button>
            )}
            <button 
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login');
              }}
              className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>

        {user.role === 'TRAINEE' && <TraineeDashboard user={user} />}
        {user.role === 'SUPERVISOR' && <AdminDashboard role="SUPERVISOR" />}
        {user.role === 'ADMIN' && <AdminDashboard />}
      </main>
    </div>
  );
};

export default Dashboard;
