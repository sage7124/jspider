import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Clock, Send, Lock, X, Settings, Info } from 'lucide-react';
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
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  // Inline Report state
  const [reportMonth, setReportMonth] = useState((new Date().getMonth() + 1).toString());
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);

  useEffect(() => {
    fetchStatus();
    fetchLeaveStatus();
    fetchHistory();
    fetchReportData();
    fetchHolidays();
    fetchNotices();
    
    if (!sessionStorage.getItem('leaveNoticeShown')) {
      setShowNoticeModal(true);
      sessionStorage.setItem('leaveNoticeShown', 'true');
    }
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

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* Leave Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex flex-col justify-center">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Send className="text-[#1976D2]" /> Leave Status
          </h3>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <span className="block text-2xl font-bold text-gray-800">{leaves?.totalLeaves || 0}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Total Quota</span>
            </div>
            <div className="h-10 w-[1px] bg-gray-100"></div>
            <div className="text-center">
              <span className="block text-2xl font-bold text-blue-600">{leaves?.leaveBalance || 0}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Remaining</span>
            </div>
          </div>
          <div className="mt-4 p-2 bg-blue-50 rounded text-[10px] text-blue-700 font-medium">
            * Leaves are assigned by management on a monthly/yearly basis.
          </div>
        </div>

        {/* Upcoming Holidays */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Calendar className="text-pink-600" /> Upcoming Holidays
          </h3>
          <div className="space-y-3 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
            {holidays.length === 0 ? (
              <p className="text-center py-4 text-gray-400 text-sm italic">No upcoming holidays</p>
            ) : (
              holidays.map((h, i) => {
                const d = new Date(h.date);
                return (
                  <div key={i} className="flex justify-between items-center p-2 bg-pink-50 rounded border border-pink-100">
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-pink-700">{h.name}</span>
                      <span className="text-[10px] text-pink-600">{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-700">{d.toLocaleDateString()}</span>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-4 italic">* Attendance is not required on scheduled holidays.</p>
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
                        <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap bg-blue-50/30">{r.s3Early}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <tr>
                  <td colSpan={2 + 4 * [reportData.hasSlot1, reportData.hasSlot2, reportData.hasSlot3].filter(Boolean).length} className="px-4 py-4 text-center">
                    <span className="text-red-600 text-lg mr-8">Total Late: {reportData.totals.late}</span>
                    <span className="text-orange-600 text-lg">Total Early Leave: {reportData.totals.earlyDeparture}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>


      {/* Notice Modal */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 relative">
            <button onClick={() => setShowNoticeModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
              <X size={20} />
            </button>
            <div className="flex flex-col items-center text-center mt-2">
              <div className="bg-blue-100 p-3 rounded-full mb-4">
                <Info className="text-blue-600" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">Important Notice</h2>
              <p className="text-sm text-gray-600 mb-6">
                For any leave requests or attendance adjustments, please contact the management directly. The leave application portal is no longer available.
              </p>
              <button 
                onClick={() => setShowNoticeModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TraineeDashboard;
