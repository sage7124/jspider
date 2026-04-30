import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Clock, Send, Lock, X, Settings } from 'lucide-react';
import axios from 'axios';

interface TraineeDashboardProps {
  user: any;
}

const TraineeDashboard: React.FC<TraineeDashboardProps> = ({ user }) => {
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');
  const [punchType, setPunchType] = useState<'IN' | 'OUT' | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [leaves, setLeaves] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [changingPass, setChangingPass] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchLeaveStatus();
    fetchHistory();
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
  const fetchLeaveStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/attendance/leave/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeaves(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/attendance/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data);
    } catch (err) { console.error(err); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) return alert('New passwords do not match');
    setChangingPass(true);
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/attendance/change-password`, {
        currentPassword: passwords.current,
        newPassword: passwords.new
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Password changed successfully!');
      setShowPasswordModal(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to change password');
    } finally { setChangingPass(false); }
  };




  const submitPunch = async (lat: number, lng: number, type: 'IN' | 'OUT') => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const deviceId = localStorage.getItem('deviceId');
      const platform = window.innerWidth <= 768 ? 'mobile' : 'desktop';

      await axios.post(`${API_URL}/api/attendance/punch`, {
        type,
        lat,
        lng,
        qrToken: 'BUTTON_PUNCH',
        deviceId,
        platform
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
    <div className="max-w-4xl mx-auto py-8 px-4 relative">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowPasswordModal(true)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-medium transition-colors">
          <Settings size={16} /> Security Settings
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
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

      <div className="mt-8 grid md:grid-cols-2 gap-6">
        {/* Daily Attendance Report */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Calendar className="text-blue-600" /> My Attendance Report
          </h3>
          <div className="overflow-y-auto max-h-[300px] pr-2 space-y-2">
            {history.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-sm">No recent attendance records</p>
            ) : history.map((record: any) => (
              <div key={record.id} className="p-3 rounded border bg-gray-50 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">{new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    record.status === 'IN' ? 'bg-green-100 text-green-700' :
                    record.status === 'OUT' ? 'bg-gray-200 text-gray-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {record.status}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>In: <span className="font-semibold text-gray-800">{record.inTime ? new Date(record.inTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--'}</span></span>
                  <span>Out: <span className="font-semibold text-gray-800">{record.outTime ? new Date(record.outTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--'}</span></span>
                  {record.isLate && <span className="text-red-500 font-bold ml-2">LATE</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Status List */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Clock className="text-gray-600" /> Leave History
            </h3>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Leave Balance</p>
              <p className="text-xl font-black text-orange-600">{leaves?.balance || 0} / {leaves?.total || 0}</p>
            </div>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2">
            {leaves?.requests?.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-sm">No leave history found</p>
            ) : leaves?.requests?.map((r: any) => (
              <div key={r.id} className="p-3 rounded border bg-gray-50 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold">{new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 italic line-clamp-1">{r.reason || 'No reason'}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    r.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {r.status}
                  </span>
                </div>
                {r.adminReason && (
                  <div className="text-[10px] text-gray-600 bg-white border px-2 py-1 rounded italic">
                    <span className="font-bold mr-1">Admin Remark:</span>{r.adminReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setShowPasswordModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Lock className="text-blue-600" size={20} /> Change Password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">CURRENT PASSWORD</label>
                <input type="password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">NEW PASSWORD</label>
                <input type="password" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">CONFIRM NEW PASSWORD</label>
                <input type="password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <button type="submit" disabled={changingPass}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition-all active:scale-95 disabled:opacity-50 mt-4">
                {changingPass ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TraineeDashboard;
