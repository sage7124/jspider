import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Clock, Send, Lock, X, Settings, Info, Mail, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uzbobbzbbkqzgtjemayu.supabase.co';
const supabaseAnonKey = 'sb_publishable_r0jMviNey66U0tDDtyScEQ_CRmZg-Rr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FilePreview = ({ url, label }: { url: string; label: string }) => {
  if (!url) return <span className="text-gray-400 italic mt-1 block">No {label} uploaded</span>;

  const isPdf = url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf');

  return (
    <div className="mt-2 border rounded-lg overflow-hidden bg-white shadow-sm max-w-xs transition-all hover:shadow-md">
      <div className="bg-gray-100 px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase border-b flex justify-between items-center">
        <span>{label} Preview</span>
        <a href={url} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
          👁️ Open
        </a>
      </div>
      <div className="p-2 flex justify-center items-center bg-gray-50/50 min-h-[100px]">
        {isPdf ? (
          <iframe src={url} className="w-full h-40 border-0 rounded" title={label} />
        ) : (
          <img src={url} alt={label} className="max-w-full max-h-32 object-contain rounded" />
        )}
      </div>
    </div>
  );
};

const ChipInput = ({ 
  value, 
  onChange, 
  placeholder, 
  disabled 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  placeholder: string; 
  disabled?: boolean;
}) => {
  const [inputValue, setInputValue] = useState('');
  const items = value ? value.split(',').map(item => item.trim()).filter(Boolean) : [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const cleanVal = inputValue.trim().replace(/,/g, '');
      if (cleanVal && !items.includes(cleanVal)) {
        const newItems = [...items, cleanVal];
        onChange(newItems.join(', '));
      }
      setInputValue('');
    }
  };

  const handleBlur = () => {
    const cleanVal = inputValue.trim().replace(/,/g, '');
    if (cleanVal && !items.includes(cleanVal)) {
      const newItems = [...items, cleanVal];
      onChange(newItems.join(', '));
    }
    setInputValue('');
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems.join(', '));
  };

  return (
    <div className="w-full mt-1 text-left">
      <div className="flex flex-wrap gap-1 bg-white min-h-[36px] p-1.5 border rounded border-gray-200">
        {items.length === 0 ? (
          <span className="text-gray-400 text-xs italic self-center px-1">None added yet</span>
        ) : (
          items.map((item, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-blue-100 shadow-sm">
              {item}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-blue-400 hover:text-blue-700 font-bold ml-0.5 focus:outline-none"
                >
                  &times;
                </button>
              )}
            </span>
          ))
        )}
      </div>
      {!disabled && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full mt-1 px-3 py-1.5 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
        />
      )}
    </div>
  );
};

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
  const [showAdminNoticeModal, setShowAdminNoticeModal] = useState(false);

  const hasAlertedForgetRef = useRef(false);

  // Profile Onboarding states
  const [profile, setProfile] = useState<any>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMemos, setShowMemos] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [educations, setEducations] = useState<string[]>([]);
  const [classifications, setClassifications] = useState<string[]>([]);

  // Inline Report state
  const [reportMonth, setReportMonth] = useState((new Date().getMonth() + 1).toString());
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [startingBreak, setStartingBreak] = useState(false);
  const [endingBreak, setEndingBreak] = useState(false);
  const [showBreakReasonModal, setShowBreakReasonModal] = useState(false);
  const [breakReason, setBreakReason] = useState('');

  useEffect(() => {
    fetchStatus();
    fetchLeaveStatus();
    fetchHistory();
    fetchReportData();
    fetchHolidays();
    fetchNotices();
    fetchProfile();
    fetchDropdowns();
    
    // Global interceptor: auto-logout if session was replaced by another device
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && error.response?.data?.code === 'SESSION_REPLACED') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          alert('You have been logged in on another device. Please login again.');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };

  }, []);

  useEffect(() => {
    fetchReportData();
  }, [reportMonth, reportYear]);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/attendance/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(res.data);
      
      if (res.data.forgotPunchOut && !hasAlertedForgetRef.current) {
        alert("⚠️ IMPORTANT: You forgot to punch out during a previous session! Contact admin ASAP.");
        hasAlertedForgetRef.current = true;
      }
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

  const fetchReportData = async () => {
    setLoadingReport(true);
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/attendance/reports/monthly-json?month=${reportMonth}&year=${reportYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReport(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/attendance/holidays`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHolidays(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchNotices = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/auth/notices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotices(res.data);
      
      // Show premium notice popup on first login / session initialization if any notices exist
      if (res.data && res.data.length > 0 && !sessionStorage.getItem('adminNoticeShown')) {
        setShowAdminNoticeModal(true);
      }
    } catch (err) { console.error(err); }
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(res.data.user);
      setCanEdit(res.data.canEdit);
    } catch (err) {
      console.error('Failed to fetch profile', err);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/auth/dropdown-options`);
      setEducations(res.data.educations);
      setClassifications(res.data.classifications);
    } catch (err) {
      console.error('Failed to fetch dropdown options', err);
    }
  };

  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'photoUrl' | 'aadhaarPhotoUrl' | 'panPhotoUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('File size must be less than 1MB');
      return;
    }

    setUploadingField(fieldName);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id || 'user'}_${fieldName}_${Date.now()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { data, error } = await supabase.storage
        .from('nict-onboarding')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('nict-onboarding')
        .getPublicUrl(filePath);

      setProfile((prev: any) => ({
        ...prev,
        [fieldName]: publicUrl
      }));
      alert('Document uploaded successfully!');
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(`Upload failed: ${err.message || err}`);
    } finally {
      setUploadingField(null);
    }
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

  const handleBreakOut = async (reasonText: string) => {
    const cleanReason = reasonText.trim();
    if (!cleanReason) {
      alert('Reason is required to request a break.');
      return;
    }

    try {
      setStartingBreak(true);
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/attendance/break/out`, { reason: cleanReason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Break started successfully! Safe travels.');
      fetchStatus();
      setShowBreakReasonModal(false);
      setBreakReason('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to start break');
    } finally {
      setStartingBreak(false);
    }
  };

  const handleBreakIn = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setEndingBreak(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const token = localStorage.getItem('token');
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          await axios.post(`${API_URL}/api/attendance/break/in`, {
            lat: latitude,
            lng: longitude
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          alert('Welcome back! Break ended successfully.');
          fetchStatus();
        } catch (err: any) {
          alert(err.response?.data?.error || 'Failed to complete break');
        } finally {
          setEndingBreak(false);
        }
      },
      (err) => {
        alert('Unable to retrieve your location. Location permission is required to check-in from break.');
        setEndingBreak(false);
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 relative">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-lg font-black text-gray-800 tracking-tight">NICTian Teacher Portal</h2>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowMemos(true)}
            className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <Mail size={14} /> My Memos
          </button>
          <button onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            👤 My Onboarding Profile
          </button>
          <button onClick={() => setShowPasswordModal(true)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-xs font-medium transition-colors"
          >
            <Settings size={14} /> Security Settings
          </button>
        </div>
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

      {status?.status === 'IN' && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-purple-100 mt-6 transition-all hover:shadow-lg">
          <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
            <Clock className="text-purple-600 animate-pulse" size={22} />
            Teacher Break Controls
          </h3>

          {status?.currentlyOnBreak ? (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="font-extrabold text-purple-900 text-sm">⚠️ YOU ARE CURRENTLY ON BREAK</p>
                  <p className="text-xs text-purple-700 mt-1">
                    Departed at: <span className="font-semibold">{status.activeBreak?.breakOut ? new Date(status.activeBreak.breakOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                  </p>
                </div>
                <button
                  onClick={() => handleBreakIn()}
                  disabled={endingBreak}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-black px-6 py-3 rounded-lg text-xs uppercase tracking-wider shadow-lg hover:shadow-purple-200 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {endingBreak ? 'Verifying Coordinates...' : '👋 Arrived Inside Premises (Break In)'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-150 text-xs">
                <span className="text-gray-500 font-semibold uppercase tracking-wider">Breaks Taken Today:</span>
                <span className={`font-black px-2.5 py-1 rounded-full ${status?.todayBreaksCount >= 4 ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                  {status?.todayBreaksCount || 0} / 4
                </span>
              </div>

              {/* Completed Breaks List */}
              {status?.completedBreaks && status.completedBreaks.length > 0 && (
                <div className="border border-gray-100 rounded overflow-hidden text-xs bg-white">
                  <div className="bg-gray-50/50 px-3 py-1.5 font-bold text-gray-500 uppercase border-b text-[10px] tracking-wider">Today's Breaks Log</div>
                  <div className="divide-y divide-gray-100">
                    {status.completedBreaks.map((b: any, index: number) => {
                      const outTime = new Date(b.breakOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const inTime = b.breakIn ? new Date(b.breakIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
                      const dur = b.breakIn ? Math.round((new Date(b.breakIn).getTime() - new Date(b.breakOut).getTime()) / (1000 * 60)) : null;

                      return (
                        <div key={b.id} className="p-3 flex flex-col gap-1 hover:bg-gray-50/50 transition-colors">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-gray-600">Break {index + 1}</span>
                            <span className="text-gray-800 font-mono">{outTime} - {inTime}</span>
                            <span className="font-extrabold text-purple-700">{dur !== null ? `${dur} mins` : 'On Break'}</span>
                          </div>
                          {b.reason && (
                            <p className="text-[10px] text-gray-500 italic bg-gray-50 px-2 py-0.5 rounded border border-gray-100 mt-0.5">
                              <span className="font-bold text-gray-600 not-italic mr-1">Reason:</span>
                              {b.reason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {status?.todayBreaksCount < 4 ? (
                <button
                  onClick={() => setShowBreakReasonModal(true)}
                  disabled={startingBreak}
                  className="w-full bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 font-black py-4 rounded-xl text-xs uppercase tracking-wider transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {startingBreak ? 'Starting Break...' : '🚀 Request Break Out'}
                </button>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center text-xs font-bold text-red-700">
                  🚫 Maximum 4 breaks reached for today. No further breaks are allowed.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {notices.length > 0 && (
        <div className="mt-6">
          <div className="bg-white rounded-lg shadow-sm border border-yellow-200 overflow-hidden">
            <div className="bg-yellow-50 p-4 border-b border-yellow-200">
              <h3 className="text-lg font-bold text-yellow-800 flex items-center gap-2">
                <Info size={20} /> Notice Board
              </h3>
            </div>
            <div className="p-0">
              {notices.map((n, idx) => (
                <div key={n.id} className={`p-4 ${idx !== notices.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <p className="font-medium text-gray-800">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-2">Posted on {new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mt-6">
        {/* Leave Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex flex-col justify-center min-h-[160px]">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Send className="text-[#1976D2]" /> Leave Status
          </h3>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <span className="block text-2xl font-bold text-gray-800">{leaves?.requests?.filter((r: any) => r.status === 'APPROVED').length || 0}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Approved Leaves Taken</span>
            </div>
          </div>
        </div>

        {/* Absent Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex flex-col justify-center min-h-[160px]">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="text-red-600" /> Absent Status
          </h3>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <span className="block text-2xl font-bold text-red-600">
                {reportData?.rows?.filter((row: any) => 
                  ['s1Late', 's2Late', 's3Late'].some(key => row[key] === 'ABSENT')
                ).length || 0}
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Total Absents ({reportMonth}/{reportYear})</span>
            </div>
          </div>
        </div>

        {/* Upcoming Holidays */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex flex-col justify-between min-h-[160px]">
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <Calendar className="text-pink-600" /> Upcoming Holidays
          </h3>
          <div className="space-y-3 max-h-[85px] overflow-y-auto pr-2 custom-scrollbar">
            {holidays.length === 0 ? (
              <p className="text-center py-2 text-gray-400 text-xs italic">No upcoming holidays</p>
            ) : (
              holidays.map((h, i) => {
                const d = new Date(h.date);
                return (
                  <div key={i} className="flex justify-between items-center p-1.5 bg-pink-50/70 rounded border border-pink-100 text-xs">
                    <div className="flex flex-col">
                      <span className="font-bold text-[10px] text-pink-700">{h.name}</span>
                      <span className="text-[9px] text-pink-600">{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-700">{d.toLocaleDateString()}</span>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-[9px] text-gray-400 mt-2 italic">* Attendance not required on holidays.</p>
        </div>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-6">
        {/* Removed small history report here in favor of full table at bottom */}


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
      {/* Inline Monthly Report Table */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b flex flex-wrap justify-between items-center gap-4 bg-gray-50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="text-blue-600" /> Monthly Attendance Report
          </h2>
          <div className="flex gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">MONTH</label>
              <select value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium">
                {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">YEAR</label>
              <select value={reportYear} onChange={e => setReportYear(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto w-full">
          {loadingReport ? (
            <div className="flex items-center justify-center p-12 text-gray-500 font-medium">Loading report data...</div>
          ) : !reportData || reportData.rows.length === 0 ? (
            <div className="flex items-center justify-center p-12 text-gray-500 font-medium">No records found for this month</div>
          ) : (
            <table className="w-full text-sm text-left min-w-[1000px]">
              <thead className="bg-[#1976D2] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Day</th>
                  {reportData.hasSlot1 && (
                    <>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#1565C0]">S1 In</th>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#1565C0]">S1 Out</th>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#1565C0]">S1 Late</th>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#1565C0]">S1 Early</th>
                    </>
                  )}
                  {reportData.hasSlot2 && (
                    <>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#0D47A1]">S2 In</th>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#0D47A1]">S2 Out</th>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#0D47A1]">S2 Late</th>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#0D47A1]">S2 Early</th>
                    </>
                  )}
                  {reportData.hasSlot3 && (
                    <>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#1565C0]">S3 In</th>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#1565C0]">S3 Out</th>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#1565C0]">S3 Late</th>
                      <th className="px-2 py-3 font-semibold whitespace-nowrap text-center bg-[#1565C0]">S3 Early</th>
                    </>
                  )}
                  <th className="px-4 py-3 font-semibold whitespace-nowrap text-center bg-indigo-700">Info</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {reportData.rows.map((r: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium whitespace-nowrap border-r">{r.date}</td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{r.day}</td>
                    {reportData.hasSlot1 && (
                      <>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-50/30 border-r">{r.s1In}</td>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-50/30 border-r">{r.s1Out}</td>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-50/30 border-r">{r.s1Late}</td>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-50/30 border-r">{r.s1Early}</td>
                      </>
                    )}
                    {reportData.hasSlot2 && (
                      <>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-100/30 border-r">{r.s2In}</td>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-100/30 border-r">{r.s2Out}</td>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-100/30 border-r">{r.s2Late}</td>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-100/30 border-r">{r.s2Early}</td>
                      </>
                    )}
                    {reportData.hasSlot3 && (
                      <>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-50/30 border-r">{r.s3In}</td>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-50/30 border-r">{r.s3Out}</td>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-50/30 border-r">{r.s3Late}</td>
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-50/30 border-r">{r.s3Early}</td>
                      </>
                    )}
                    <td className="px-4 py-2 text-center text-gray-600 whitespace-nowrap border-r font-medium">{r.infoText || '--'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <tr>
                  <td colSpan={3 + 4 * [reportData.hasSlot1, reportData.hasSlot2, reportData.hasSlot3].filter(Boolean).length} className="px-4 py-4 text-center">
                    <span className="text-red-600 text-lg mr-8">Total Late: {reportData.totals.late}</span>
                    <span className="text-orange-600 text-lg">Total Early Leave: {reportData.totals.earlyDeparture}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>


      {/* Onboarding Profile Modal */}
      {showProfileModal && profile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowProfileModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2 border-b pb-3">
              👤 Onboarding Profile & Paperless Form
            </h3>
            
            {/* Status Info */}
            <div className={`mb-6 p-4 rounded-lg flex items-center justify-between text-sm ${
              canEdit ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'
            }`}>
              <div>
                <p className="font-bold">{canEdit ? '🔓 PROFILE EDITING ACTIVE' : '🔒 PROFILE IS LOCKED'}</p>
                <p className="text-xs opacity-90 mt-0.5">
                  {canEdit 
                    ? 'You can update your profile fields. All changes are secure.' 
                    : 'The 3-day editing window has closed. Please contact Admin to unlock edit access.'}
                </p>
              </div>
              {profile.createdAt && (
                <div className="text-right text-xs">
                  <span className="font-semibold block">Registered On:</span>
                  <span>{new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!canEdit) return alert('Profile editing is locked.');
              setSavingProfile(true);
              try {
                const token = localStorage.getItem('token');
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                await axios.put(`${API_URL}/api/auth/profile`, profile, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                alert('Profile updated successfully!');
                fetchProfile();
              } catch (err: any) {
                alert(err.response?.data?.error || 'Failed to update profile');
              } finally {
                setSavingProfile(false);
              }
            }} className="space-y-6 text-left">

              {/* Personal Details */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">1. Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Full Name with Initials</label>
                    <input type="text" value={profile.fullName || ''} onChange={e => setProfile({...profile, fullName: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Father's Name</label>
                    <input type="text" value={profile.fatherName || ''} onChange={e => setProfile({...profile, fatherName: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Mother's Name</label>
                    <input type="text" value={profile.motherName || ''} onChange={e => setProfile({...profile, motherName: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Mobile Number</label>
                    <input type="text" value={profile.identifier || ''} disabled
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-gray-100 text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Email ID</label>
                    <input type="email" value={profile.email || ''} onChange={e => setProfile({...profile, email: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Profile Photo</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 items-center">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileUpload(e, 'photoUrl')} 
                          disabled={!canEdit || uploadingField === 'photoUrl'}
                          className="hidden" 
                          id="photoUrl-input" 
                        />
                        <label 
                          htmlFor="photoUrl-input"
                          className={`flex-1 border-2 border-dashed rounded px-3 py-1.5 text-xs font-bold text-center cursor-pointer transition-all ${
                            !canEdit ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' :
                            uploadingField === 'photoUrl' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse' :
                            profile.photoUrl ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          {uploadingField === 'photoUrl' ? '⏳ Uploading...' : profile.photoUrl ? '✅ Change Photo' : '📁 Upload Photo (<1MB)'}
                        </label>
                      </div>
                      <FilePreview url={profile.photoUrl} label="Profile Photo" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Onboarding & Sub classification */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">2. Onboarding Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Date of Joining NICT (DDMMYYYY)</label>
                    <input type="text" value={profile.dateOfJoining || ''} onChange={e => setProfile({...profile, dateOfJoining: e.target.value})} placeholder="e.g. 01052026" disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Office Timings with Cycle</label>
                    <textarea value={profile.officeTimings || ''} onChange={e => setProfile({...profile, officeTimings: e.target.value})} placeholder="e.g. 9 AM - 5 PM Shift A" disabled={!canEdit} rows={2}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Education Completed</label>
                    <ChipInput 
                      value={profile.educationCompleted || ''} 
                      onChange={val => setProfile({ ...profile, educationCompleted: val })}
                      placeholder="Type degree & press Enter"
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Subjects / Modules classes that you can take</label>
                    <ChipInput 
                      value={profile.subClassification || ''} 
                      onChange={val => setProfile({ ...profile, subClassification: val })}
                      placeholder="Type module & press Enter"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Present Address</label>
                    <textarea value={profile.presentAddress || ''} onChange={e => setProfile({...profile, presentAddress: e.target.value})} disabled={!canEdit} rows={2}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 resize-none"></textarea>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Permanent Address</label>
                    <textarea value={profile.permanentAddress || ''} onChange={e => setProfile({...profile, permanentAddress: e.target.value})} disabled={!canEdit} rows={2}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 resize-none"></textarea>
                  </div>
                </div>
              </div>

              {/* Identification Documents */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">3. Document Identification</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Aadhaar Number</label>
                    <input type="text" value={profile.aadhaarNumber || ''} onChange={e => setProfile({...profile, aadhaarNumber: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Aadhaar Document</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 items-center">
                        <input 
                          type="file" 
                          accept="image/*,application/pdf" 
                          onChange={(e) => handleFileUpload(e, 'aadhaarPhotoUrl')} 
                          disabled={!canEdit || uploadingField === 'aadhaarPhotoUrl'}
                          className="hidden" 
                          id="aadhaarPhotoUrl-input" 
                        />
                        <label 
                          htmlFor="aadhaarPhotoUrl-input"
                          className={`flex-1 border-2 border-dashed rounded px-3 py-1.5 text-xs font-bold text-center cursor-pointer transition-all ${
                            !canEdit ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' :
                            uploadingField === 'aadhaarPhotoUrl' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse' :
                            profile.aadhaarPhotoUrl ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          {uploadingField === 'aadhaarPhotoUrl' ? '⏳ Uploading...' : profile.aadhaarPhotoUrl ? '✅ Change Document' : '📁 Upload Aadhaar (<1MB)'}
                        </label>
                      </div>
                      <FilePreview url={profile.aadhaarPhotoUrl} label="Aadhaar Document" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">PAN Number</label>
                    <input type="text" value={profile.panNumber || ''} onChange={e => setProfile({...profile, panNumber: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">PAN Document</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 items-center">
                        <input 
                          type="file" 
                          accept="image/*,application/pdf" 
                          onChange={(e) => handleFileUpload(e, 'panPhotoUrl')} 
                          disabled={!canEdit || uploadingField === 'panPhotoUrl'}
                          className="hidden" 
                          id="panPhotoUrl-input" 
                        />
                        <label 
                          htmlFor="panPhotoUrl-input"
                          className={`flex-1 border-2 border-dashed rounded px-3 py-1.5 text-xs font-bold text-center cursor-pointer transition-all ${
                            !canEdit ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' :
                            uploadingField === 'panPhotoUrl' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse' :
                            profile.panPhotoUrl ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          {uploadingField === 'panPhotoUrl' ? '⏳ Uploading...' : profile.panPhotoUrl ? '✅ Change Document' : '📁 Upload PAN (<1MB)'}
                        </label>
                      </div>
                      <FilePreview url={profile.panPhotoUrl} label="PAN Document" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Information */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">4. Bank Account Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Bank Name</label>
                    <input type="text" value={profile.bankName || ''} onChange={e => setProfile({...profile, bankName: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Bank Account Number</label>
                    <input type="text" value={profile.bankAccountNo || ''} onChange={e => setProfile({...profile, bankAccountNo: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Bank IFSC Code</label>
                    <input type="text" value={profile.bankIfscCode || ''} onChange={e => setProfile({...profile, bankIfscCode: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Bank Branch Name</label>
                    <input type="text" value={profile.bankBranchName || ''} onChange={e => setProfile({...profile, bankBranchName: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">5. Emergency Contact Info</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Emergency Contact Name</label>
                    <input type="text" value={profile.emergencyContactName || ''} onChange={e => setProfile({...profile, emergencyContactName: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Emergency Contact Mobile</label>
                    <input type="text" value={profile.emergencyContactMobile || ''} onChange={e => setProfile({...profile, emergencyContactMobile: e.target.value})} disabled={!canEdit}
                      className="w-full border rounded px-3 py-1.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                </div>
              </div>

              {canEdit && (
                <button type="submit" disabled={savingProfile}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50 shadow-lg">
                  {savingProfile ? 'Saving...' : '💾 Save Profile Details'}
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 📢 Dynamic Live Admin Notice Modal */}
      {showAdminNoticeModal && notices && notices.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200 text-left">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5 flex items-center gap-3 text-white border-b border-orange-100/20">
              <div className="bg-white/20 p-2 rounded-xl shadow-inner">
                <Info size={24} className="animate-pulse text-white" />
              </div>
              <div>
                <h3 className="font-black text-lg tracking-wide leading-tight">Important Admin Announcement</h3>
                <p className="text-[10px] font-bold opacity-90 uppercase tracking-wider mt-0.5">High Priority Bulletin</p>
              </div>
              <button 
                onClick={() => {
                  setShowAdminNoticeModal(false);
                  sessionStorage.setItem('adminNoticeShown', 'true');
                }} 
                className="ml-auto text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4 bg-amber-50/20 custom-scrollbar">
              {notices.map((n: any) => (
                <div key={n.id} className="p-5 bg-white border border-amber-100 rounded-2xl shadow-sm text-left relative group hover:border-amber-200 transition-colors">
                  <div className="absolute top-4 right-4 bg-amber-100 text-amber-800 font-black text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    📢 Latest
                  </div>
                  <p className="font-bold text-gray-800 text-sm leading-relaxed pt-3 whitespace-pre-line">{n.message}</p>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Administration Desk</span>
                    <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-1 rounded-lg">
                      📆 {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-white border-t flex items-center justify-end shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
              <button
                onClick={() => {
                  setShowAdminNoticeModal(false);
                  sessionStorage.setItem('adminNoticeShown', 'true');
                }}
                className="w-full bg-gray-900 hover:bg-black text-white font-black py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-95 tracking-wider text-xs uppercase"
              >
                I Acknowledge and Understand
              </button>
            </div>
          </div>
        </div>
      )}
      {showMemos && <MemoManagementModal onClose={() => setShowMemos(false)} role="TRAINEE" />}
      {showBreakReasonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowBreakReasonModal(false);
                setBreakReason('');
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-purple-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
              <Clock size={20} className="animate-pulse" /> Request Break Out
            </h3>
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-black text-purple-700 mb-2 uppercase tracking-wide">
                  Reason for Break
                </label>
                <textarea
                  required
                  rows={3}
                  value={breakReason}
                  onChange={(e) => setBreakReason(e.target.value)}
                  className="w-full border border-purple-100 rounded-lg p-3 text-xs outline-none focus:border-purple-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                  placeholder="Enter the reason for taking a break (e.g., Lunch, Personal Work)..."
                />
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowBreakReasonModal(false);
                    setBreakReason('');
                  }}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-bold tracking-wider text-xs uppercase shadow-sm hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={startingBreak || !breakReason.trim()}
                  onClick={() => handleBreakOut(breakReason)}
                  className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-black tracking-widest text-xs uppercase shadow-lg shadow-purple-100 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {startingBreak ? 'Starting...' : '🚀 Start Break'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Teacher Memo Management Modal ─────────────────────────────────────────────
const MemoManagementModal = ({ onClose, role }: { onClose: () => void; role: string }) => {
  const [memos, setMemos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReceivedMemos();
  }, []);

  const fetchReceivedMemos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/admin/memos/received`, { headers: { Authorization: `Bearer ${token}` } });
      setMemos(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl p-6 relative max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-purple-700 flex items-center gap-2 border-b pb-3">
          <Mail size={20} /> My Official Memos
        </h2>

        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {loading ? (
            <p className="text-center py-10 text-gray-400">Loading memos...</p>
          ) : (
            <div className="space-y-3 text-left">
              {memos.length === 0 ? (
                <p className="text-center py-10 text-gray-400 italic text-sm">No official memos received from Admin yet.</p>
              ) : (
                memos.map((m) => (
                  <div key={m.id} className="p-4 rounded-lg bg-purple-50/50 border border-purple-100 flex flex-col gap-1 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-purple-800 uppercase">FROM: {m.sender?.fullName || 'ADMIN'}</span>
                      <span className="text-[10px] text-gray-400">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed bg-white p-2.5 rounded border border-purple-50 whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TraineeDashboard;
