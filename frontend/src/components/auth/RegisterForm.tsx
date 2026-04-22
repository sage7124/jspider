import React, { useState } from 'react';
import axios from 'axios';

const RegisterForm: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    department: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/auth/register`, formData);
      setSuccess(true);
      setFormData({ fullName: '', email: '', mobile: '', department: '', password: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <div className="text-red-500 text-sm text-center">{error}</div>}
      {success && <div className="text-green-600 text-sm text-center">Registration successful! Please login.</div>}
      <div>
        <input
          type="text"
          name="fullName"
          placeholder="Full Name"
          value={formData.fullName}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1976D2] focus:border-transparent"
          required
        />
      </div>

      <div className="flex gap-4">
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1976D2] focus:border-transparent"
          required
        />
        <input
          type="tel"
          name="mobile"
          placeholder="Mobile"
          value={formData.mobile}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1976D2] focus:border-transparent"
          required
        />
      </div>

      <div>
        <select
          name="department"
          value={formData.department}
          onChange={handleChange}
          className={`w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1976D2] focus:border-transparent appearance-none bg-white ${!formData.department ? 'text-gray-500' : 'text-black'}`}
          required
        >
          <option value="" disabled>Select Department</option>
          <option value="Technical">Technical</option>
          <option value="Non-Technical">Non-Technical</option>
        </select>
      </div>

      <div>
        <input
          type="password"
          name="password"
          placeholder="Create Password"
          value={formData.password}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1976D2] focus:border-transparent"
          required
        />
      </div>

      <button
        type="submit"
        className="w-full bg-[#1976D2] hover:bg-blue-700 text-white font-bold py-3 px-4 rounded mt-2 transition-colors"
      >
        REGISTER
      </button>
    </form>
  );
};

export default RegisterForm;
