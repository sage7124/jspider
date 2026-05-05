import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

interface LoginFormProps {
  role: 'NICTIANS' | 'ADMIN';
}

const LoginForm: React.FC<LoginFormProps> = ({ role }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Map NICTIANS tab → TRAINEE role for backend
      const backendRole = role === 'NICTIANS' ? 'TRAINEE' : 'ADMIN';
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      // Device Locking Logic
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
      }
      const platform = window.innerWidth <= 768 ? 'mobile' : 'desktop';

      const response = await axios.post(`${API_URL}/api/auth/login`, {
        role: backendRole,
        identifier,
        password,
        deviceId,
        platform
      });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <div className="text-red-500 text-sm text-center">{error}</div>}
      <div>
        <input
          type={role === 'ADMIN' ? "text" : "text"}
          placeholder={role === 'ADMIN' ? "Mobile No." : "Mobile Number"}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1976D2] focus:border-transparent"
          required
        />
      </div>
      
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1976D2] focus:border-transparent pr-12"
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full bg-[#1976D2] hover:bg-blue-700 text-white font-bold py-3 px-4 rounded mt-2 transition-all ${loading ? 'opacity-70 cursor-wait' : ''}`}
      >
        {loading ? 'SIGNING IN...' : 'SIGN IN'}
      </button>
    </form>
  );
};

export default LoginForm;
