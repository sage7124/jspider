import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import axios from 'axios';

interface TraineeDashboardProps {
  user: any;
}

const TraineeDashboard: React.FC<TraineeDashboardProps> = ({ user }) => {
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');
  const [punchType, setPunchType] = useState<'IN' | 'OUT' | null>(null);
  const [status, setStatus] = useState<any>(null); // To store current punch status from backend

  useEffect(() => {
    // Fetch today's status on mount
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/attendance/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch status', err);
    }
  };



  const submitPunch = async (lat: number, lng: number, type: 'IN' | 'OUT') => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/attendance/punch`, {
        type,
        lat,
        lng,
        qrToken: 'BUTTON_PUNCH' // Dummy token since requirement removed
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Successfully punched ${type}`);
      fetchStatus();
    } catch (err: any) {
      alert(`Failed to punch: ${err.response?.data?.error || err.message}`);
    }
  };

  const handlePunch = (type: 'IN' | 'OUT') => {
    setPunchType(type);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        setLocationError('');
        submitPunch(latitude, longitude, type);
      },
      (err) => {
        setLocationError('Unable to retrieve your location. Please allow location access to punch.');
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
      {/* Attendance Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MapPin className="text-[#1976D2]" /> 
          Attendance Punch
        </h3>
        
        {locationError && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">
            {locationError}
          </div>
        )}

        <p className="text-sm text-gray-500 mb-6 italic">
          Note: You can only punch in/out when you are inside the institute premises.
        </p>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => handlePunch('IN')}
            className={`w-full text-white font-bold py-4 rounded transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2 ${
              status?.status === 'IN' ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-green-200'
            }`}
            disabled={status?.status === 'IN'}
          >
            {status?.status === 'IN' ? '✅ ALREADY IN' : 'PUNCH IN'}
          </button>
          
          <button 
            onClick={() => handlePunch('OUT')}
            className={`w-full text-white font-bold py-4 rounded transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2 ${
              status?.status === 'OUT' || !status?.inTime ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-red-200'
            }`}
            disabled={status?.status === 'OUT' || !status?.inTime}
          >
            PUNCH OUT
          </button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-bold mb-4">Today's Status</h3>
        <div className="space-y-4">
          <div className="flex flex-col py-2 border-b">
            <span className="text-gray-600 text-sm mb-1">Assigned Slots:</span>
            <div className="flex flex-col gap-1">
              {status?.slots && status.slots.length > 0 ? (
                status.slots.map((s: string, i: number) => (
                  <span key={i} className="font-semibold text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">📅 {s}</span>
                ))
              ) : (
                <span className="font-semibold text-gray-400">Not Assigned</span>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">Current Status:</span>
            <span className={`font-bold ${status?.status === 'IN' ? 'text-green-600' : 'text-gray-400'}`}>
              {status?.status === 'IN' ? 'PUNCHED IN' : 'NOT PUNCHED IN / OUT'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">Punch In Time:</span>
            <span className="font-semibold">{status?.inTime ? new Date(status.inTime).toLocaleTimeString() : '--:--'}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Punch Out Time:</span>
            <span className="font-semibold">{status?.outTime ? new Date(status.outTime).toLocaleTimeString() : '--:--'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraineeDashboard;
