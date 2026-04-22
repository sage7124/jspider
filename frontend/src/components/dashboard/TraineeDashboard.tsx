import React, { useState, useEffect } from 'react';
import { QrCode, MapPin } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';

interface TraineeDashboardProps {
  user: any;
}

const TraineeDashboard: React.FC<TraineeDashboardProps> = ({ user }) => {
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');
  const [scanning, setScanning] = useState(false);
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

  useEffect(() => {
    if (scanning) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(
        async (decodedText) => {
          // On successful scan
          scanner.clear();
          setScanning(false);
          await submitPunch(decodedText);
        },
        (error) => {
          // Ignore scanning errors, they happen continuously until a QR is found
        }
      );

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [scanning, location, punchType]);

  const submitPunch = async (qrToken: string) => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/attendance/punch`, {
        type: punchType,
        qrToken,
        lat: location?.lat,
        lng: location?.lng
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Successfully punched ${punchType}`);
      fetchStatus();
    } catch (err: any) {
      alert(`Failed to punch: ${err.response?.data?.error || err.message}`);
    }
  };

  const requestLocation = (type: 'IN' | 'OUT') => {
    setPunchType(type);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationError('');
        setScanning(true); // Open scanner after getting location
      },
      (err) => {
        setLocationError('Unable to retrieve your location. Please allow location access.');
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
      {/* Attendance Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <QrCode className="text-[#1976D2]" /> 
          Attendance Punch
        </h3>
        
        {locationError && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">
            {locationError}
          </div>
        )}

        {location && !scanning && (
          <div className="mb-4 flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
            <MapPin size={16} /> Location verified.
          </div>
        )}

        {!scanning && (
          <div className="flex gap-4 mt-6">
            <button 
              onClick={() => requestLocation('IN')}
              className="flex-1 bg-[#1976D2] hover:bg-blue-700 text-white font-bold py-4 rounded transition-colors disabled:opacity-50"
              disabled={status?.status === 'IN'}
            >
              PUNCH IN
            </button>
            <button 
              onClick={() => requestLocation('OUT')}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded transition-colors disabled:opacity-50"
              disabled={status?.status === 'OUT' || !status?.inTime}
            >
              PUNCH OUT
            </button>
          </div>
        )}

        {scanning && (
          <div className="mt-6 p-4 rounded-lg text-center bg-gray-50 border border-gray-200">
            <div id="reader" className="w-full"></div>
            <button 
              onClick={() => setScanning(false)}
              className="mt-4 text-sm text-red-500 underline"
            >
              Cancel Scan
            </button>
          </div>
        )}
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
