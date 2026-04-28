import React, { useState } from 'react';
import Header from '../components/Header';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import { User } from 'lucide-react';

const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'TEACHER' | 'ADMIN'>('TEACHER');
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md w-full max-w-md relative pt-12 pb-8 px-8 mt-8">
          {/* Profile Icon / Logo Badge */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white rounded-full p-2 shadow-md border border-gray-100 flex items-center justify-center w-16 h-16 overflow-hidden">
            {import.meta.env.VITE_INSTITUTE_LOGO ? (
              <img src={import.meta.env.VITE_INSTITUTE_LOGO} alt="Institute Logo" className="w-full h-full object-contain" />
            ) : (
              <User className="h-7 w-7 text-[#1a1f2e]" />
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              className={`flex-1 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                activeTab === 'TEACHER'
                  ? 'text-[#1976D2] border-b-2 border-[#1976D2]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              onClick={() => {
                setActiveTab('TEACHER');
                setIsLogin(true); // Reset to login when switching tabs
              }}
            >
              TEACHER
            </button>
            <button
              className={`flex-1 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                activeTab === 'ADMIN'
                  ? 'text-[#1976D2] border-b-2 border-[#1976D2]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              onClick={() => {
                setActiveTab('ADMIN');
                setIsLogin(true); // Admin only has login
              }}
            >
              ADMIN
            </button>
          </div>

          {/* Form Area */}
          <div className="mt-4">
            {isLogin ? (
              <LoginForm role={activeTab} />
            ) : (
              <RegisterForm />
            )}
          </div>

          {/* Toggle Login/Register for Teacher */}
          {activeTab === 'TEACHER' && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-gray-500 hover:text-[#1976D2] transition-colors"
              >
                {isLogin ? 'New user? Register here' : 'Already registered? Login'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
