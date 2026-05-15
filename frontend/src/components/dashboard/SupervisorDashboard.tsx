import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Calendar, Clock, FileDown, Key, Bell, CheckCircle, XCircle, 
  Search, AlertCircle, Trash2, Info, X, Send, ShieldAlert
} from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin`;

const SupervisorDashboard: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'leaves' | 'reports' | 'passwords' | 'notices'>('leaves');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Global dynamic notice popup
  const [showAdminNoticeModal, setShowAdminNoticeModal] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);

  // Leave Board State
  const [leaves, setLeaves] = useState<any[]>([]);
  const [trainees, setTrainees] = useState<any[]>([]); // for selection dropdowns & search
  const [directLeave, setDirectLeave] = useState({ traineeId: '', startDate: '', endDate: '', reason: '', remarksAlternative: '' });
  const [processingReason, setProcessingReason] = useState<Record<number, string>>({});

  // Monthly Reports State
  const [repMonth, setRepMonth] = useState(String(new Date().getMonth() + 1));
  const [repYear, setRepYear] = useState(String(new Date().getFullYear()));

  // Password Reset State
  const [passSearch, setPassSearch] = useState('');
  const [selectedTrainee, setSelectedTrainee] = useState<any>(null);
  const [newPass, setNewPass] = useState('');

  // Notice Creation State
  const [noticeForm, setNoticeForm] = useState({ message: '', fromDate: '', toDate: '', targetGroup: 'ALL' });

  // ── Life Cycle Hooks ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchInitialData();
    fetchAnnouncements();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch all trainees (for select dropdowns and lists)
      const trRes = await axios.get(`${API}/attendance`, { headers });
      setTrainees(trRes.data.users || trRes.data || []);

      // Fetch all pending/processed leaves
      const lvRes = await axios.get(`${API}/leaves/requests`, { headers });
      setLeaves(lvRes.data || []);

      // Fetch global dashboard notices 
      const ntRes = await axios.get(`${API}/notices`, { headers });
      setNotices(ntRes.data || []);
    } catch (err: any) {
      console.error('Supervisor Dashboard fetch failed:', err);
      setError('Data fetch synchronization failure.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch notices specifically for the dynamic alert popup (matches trainee logic)
  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/auth/notices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Show premium notice popup on first login / session initialization if any notices exist
      if (res.data && res.data.length > 0 && !sessionStorage.getItem('adminNoticeShown')) {
        setShowAdminNoticeModal(true);
      }
    } catch (err) { console.error(err); }
  };

  // ── Utilities ───────────────────────────────────────────────────────────────
  const clearAlerts = () => {
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  // ── Leave Board Controllers ──────────────────────────────────────────────────
  const processLeave = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      const token = localStorage.getItem('token');
      const reason = processingReason[id] || '';
      
      await axios.post(`${API}/leaves/process`, 
        { requestId: id, status, adminReason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess(`Leave application ${status.toLowerCase()} successfully!`);
      setProcessingReason(prev => { const c = {...prev}; delete c[id]; return c; });
      fetchInitialData();
      clearAlerts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Action processing halted.');
      clearAlerts();
    }
  };

  const applyDirectLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directLeave.traineeId || !directLeave.startDate || !directLeave.endDate) {
      setError('Required selection targets are missing.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/leaves/direct`, directLeave, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Direct leave granted and balance modified.');
      setDirectLeave({ traineeId: '', startDate: '', endDate: '', reason: '', remarksAlternative: '' });
      fetchInitialData();
      clearAlerts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Direct push allocation failure.');
      clearAlerts();
    }
  };

  // ── Monthly Reports Controllers ───────────────────────────────────────────────
  const downloadMonthlyReport = () => {
    const token = localStorage.getItem('token');
    const url = `${API}/reports/monthly?month=${repMonth}&year=${repYear}&token=${token}`;
    window.open(url, '_blank');
  };

  // ── Password Reset Controllers ───────────────────────────────────────────────
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainee || !newPass) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/change-password`, {
        userId: selectedTrainee.id,
        newPassword: newPass
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setSuccess(`Access key for ${selectedTrainee.fullName} rewritten successfully!`);
      setSelectedTrainee(null);
      setNewPass('');
      clearAlerts();
    } catch (err: any) {
      setError('Failed to redefine system credentials.');
      clearAlerts();
    }
  };

  // ── Notice Center Controllers ────────────────────────────────────────────────
  const createNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeForm.message || !noticeForm.fromDate || !noticeForm.toDate) {
      setError('Announcement details missing.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/notices`, noticeForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Targeted notification propagated successfully.');
      setNoticeForm({ message: '', fromDate: '', toDate: '', targetGroup: 'ALL' });
      fetchInitialData();
      clearAlerts();
    } catch (err: any) {
      setError('Notice publication fault.');
      clearAlerts();
    }
  };

  const deleteNotice = async (id: number) => {
    if (!window.confirm('Permanently recall this notice broadcast?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/notices/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Announcement purged.');
      fetchInitialData();
      clearAlerts();
    } catch (err) {
      setError('Purging failed.');
      clearAlerts();
    }
  };

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filteredTrainees = trainees.filter(t => {
    const q = passSearch.toLowerCase();
    return (t.fullName || '').toLowerCase().includes(q) || (t.identifier || '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto mt-2 select-none">
      
      {/* Security Clearance Alert */}
      <div className="bg-indigo-50 border-l-4 border-indigo-500 text-indigo-800 p-4 rounded-r-xl mb-6 flex items-center gap-3 shadow-sm">
        <div className="bg-indigo-200 p-2 rounded-full">
          <ShieldAlert size={20} className="text-indigo-700" />
        </div>
        <div>
          <h4 className="font-black text-sm uppercase tracking-wider">Supervisor Restricted Space</h4>
          <p className="text-xs font-semibold opacity-90">Delegated authority: Leave management, Report retrieval, Credential reset & Notices.</p>
        </div>
      </div>

      {/* Action Success / Error Toasts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm mb-4 animate-pulse">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm mb-4">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Premium Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-6 bg-white/80 backdrop-blur p-1.5 rounded-2xl shadow-sm">
        <button 
          onClick={() => setActiveSubTab('leaves')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeSubTab === 'leaves' ? 'bg-blue-600 text-white shadow-md shadow-blue-200 transform scale-105' : 'text-gray-500 hover:bg-gray-100'}`}>
          <Calendar size={16} /> Leave Approvals
        </button>
        
        <button 
          onClick={() => setActiveSubTab('reports')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeSubTab === 'reports' ? 'bg-purple-600 text-white shadow-md shadow-purple-200 transform scale-105' : 'text-gray-500 hover:bg-gray-100'}`}>
          <FileDown size={16} /> Monthly Reports
        </button>

        <button 
          onClick={() => setActiveSubTab('passwords')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeSubTab === 'passwords' ? 'bg-rose-600 text-white shadow-md shadow-rose-200 transform scale-105' : 'text-gray-500 hover:bg-gray-100'}`}>
          <Key size={16} /> Reset Passwords
        </button>

        <button 
          onClick={() => setActiveSubTab('notices')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeSubTab === 'notices' ? 'bg-amber-600 text-white shadow-md shadow-amber-200 transform scale-105' : 'text-gray-500 hover:bg-gray-100'}`}>
          <Bell size={16} /> Notice Board
        </button>
      </div>

      {/* ── Main Module Rendering ─────────────────────────────────────────────── */}
      <div className="space-y-6">
        {loading && <div className="p-12 text-center text-gray-500 font-black animate-pulse">Synchronizing Secure Channel...</div>}

        {!loading && activeSubTab === 'leaves' && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Direct Leave Assigner (Left) */}
            <div className="md:col-span-1 bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-5 text-white font-black tracking-wider uppercase text-xs">
                Grant Direct Leave
              </div>
              <form onSubmit={applyDirectLeave} className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Target Trainee</label>
                  <select 
                    value={directLeave.traineeId} 
                    onChange={(e) => setDirectLeave({...directLeave, traineeId: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-gray-50 outline-none focus:border-blue-500">
                    <option value="">-- Select Student --</option>
                    {trainees.map(t => <option key={t.id} value={t.id}>{t.fullName} ({t.identifier})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">From Date</label>
                    <input 
                      type="date" 
                      value={directLeave.startDate}
                      onChange={(e) => setDirectLeave({...directLeave, startDate: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold bg-gray-50 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">To Date</label>
                    <input 
                      type="date" 
                      value={directLeave.endDate}
                      onChange={(e) => setDirectLeave({...directLeave, endDate: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold bg-gray-50 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Absence Code / Reason</label>
                  <textarea 
                    placeholder="Operational Reason..."
                    value={directLeave.reason}
                    onChange={(e) => setDirectLeave({...directLeave, reason: e.target.value})}
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-gray-50 outline-none resize-none" />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl shadow-lg text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2">
                  <CheckCircle size={14} /> Authorize & Deduct
                </button>
              </form>
            </div>

            {/* Processing Table (Right) */}
            <div className="md:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-xl p-6">
              <h3 className="font-black text-sm text-gray-800 tracking-wide uppercase mb-4 flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" /> Queue: Active Leave Requests
              </h3>
              
              {leaves.filter(l => l.status === 'PENDING').length === 0 ? (
                <div className="text-center p-12 bg-gray-50/50 border-2 border-dashed rounded-2xl text-gray-400 font-bold text-xs">
                  Inbox Cleared. No pending leave requests found.
                </div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {leaves.filter(l => l.status === 'PENDING').map((l: any) => (
                    <div key={l.id} className="border border-gray-100 bg-slate-50/30 p-4 rounded-2xl shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black text-gray-800 text-sm">{l.user?.fullName}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ID: {l.user?.identifier}</p>
                        </div>
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-blue-100 uppercase">
                          ⚖️ Bal: {l.user?.leaveBalance ?? 0}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-4 text-xs bg-white p-3 rounded-xl border border-gray-100">
                        <div>
                          <span className="text-[9px] text-gray-400 font-black block uppercase mb-0.5">Timeline</span>
                          <span className="font-bold text-gray-700">
                            📅 {new Date(l.startDate).toLocaleDateString()} ➔ {new Date(l.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-400 font-black block uppercase mb-0.5">Trainee Stated Reason</span>
                          <span className="font-bold text-gray-600 italic">"{l.reason || 'No reason provided'}"</span>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2 items-center">
                        <input 
                          type="text" 
                          placeholder="Optional decision remarks..."
                          value={processingReason[l.id] || ''}
                          onChange={(e) => setProcessingReason({...processingReason, [l.id]: e.target.value})}
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold bg-white outline-none" />
                        
                        <button 
                          onClick={() => processLeave(l.id, 'APPROVED')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl flex items-center justify-center shadow shadow-emerald-100 hover:shadow-lg transition-all active:scale-95">
                          <CheckCircle size={18} />
                        </button>

                        <button 
                          onClick={() => processLeave(l.id, 'REJECTED')}
                          className="bg-rose-600 hover:bg-rose-700 text-white p-2.5 rounded-xl flex items-center justify-center shadow shadow-rose-100 hover:shadow-lg transition-all active:scale-95">
                          <XCircle size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && activeSubTab === 'reports' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 max-w-md mx-auto text-center">
            <div className="bg-purple-100 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 shadow-inner">
              <FileDown size={32} className="text-purple-600" />
            </div>
            <h3 className="font-black text-gray-800 text-lg tracking-wide">Secure Sheet Generation</h3>
            <p className="text-xs font-bold text-gray-400 mt-1 mb-6 uppercase tracking-wider">Download Monthly Excel Attendance Metrics</p>
            
            <div className="space-y-4 text-left mb-8">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Target Reporting Month</label>
                <select 
                  value={repMonth}
                  onChange={(e) => setRepMonth(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 font-bold text-xs bg-gray-50 text-gray-700 outline-none">
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={i+1}>
                      {new Date(2020, i, 1).toLocaleString('default', {month: 'long'})}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Select Calendar Year</label>
                <select 
                  value={repYear}
                  onChange={(e) => setRepYear(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 font-bold text-xs bg-gray-50 text-gray-700 outline-none">
                  {[2025, 2026, 2027].map(yr => <option key={yr} value={yr}>{yr}</option>)}
                </select>
              </div>
            </div>

            <button 
              onClick={downloadMonthlyReport}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
              <FileDown size={16} /> Compile and Download Excel
            </button>
          </div>
        )}

        {!loading && activeSubTab === 'passwords' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6 border-b pb-4 border-gray-50">
              <div>
                <h3 className="font-black text-sm text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <Key size={18} className="text-rose-600" /> Credential Access Rewriting
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Redefine locked trainee password identifiers</p>
              </div>
              
              <div className="relative max-w-xs w-full">
                <input 
                  type="text" 
                  placeholder="Lookup Trainee Name / ID..."
                  value={passSearch}
                  onChange={(e) => setPassSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:bg-white focus:border-rose-500 outline-none transition-all shadow-inner" />
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            {/* Modal Pop-Up for password input */}
            {selectedTrainee && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden relative p-6 text-left animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-rose-700 text-xs uppercase tracking-wider">🛡️ Critical Account Override</h4>
                    <button onClick={() => setSelectedTrainee(null)} className="text-gray-400 hover:text-black bg-gray-50 p-1 rounded-full"><X size={16} /></button>
                  </div>
                  <p className="text-xs font-semibold text-gray-500 leading-relaxed mb-4">
                    You are redefining the security credentials for <span className="font-black text-gray-800">{selectedTrainee.fullName}</span>. Specify a new temporary password.
                  </p>
                  <form onSubmit={handlePasswordReset} className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Type New Strong Password..."
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-xs font-black text-gray-700 outline-none bg-gray-50"
                      required />
                    <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl shadow-lg hover:shadow-xl transition-all uppercase tracking-widest text-[10px]">
                      Commit Key Override
                    </button>
                  </form>
                </div>
              </div>
            )}

            {filteredTrainees.length === 0 ? (
              <div className="p-12 text-center font-bold text-gray-400 text-xs border-2 border-dashed rounded-2xl">
                Zero user directory records found matching Query.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left text-xs border-collapse bg-slate-50/20">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200">
                      <th className="p-4 text-[10px]">Full Name</th>
                      <th className="p-4 text-[10px]">Reg Mobile</th>
                      <th className="p-4 text-[10px]">Domain / Department</th>
                      <th className="p-4 text-right text-[10px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white font-semibold text-gray-700">
                    {filteredTrainees.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-4 font-black text-gray-800">{t.fullName}</td>
                        <td className="p-4 font-mono text-[10px] text-gray-500 tracking-widest">{t.identifier}</td>
                        <td className="p-4">{t.department || '--'}</td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => { setSelectedTrainee(t); setNewPass(''); }}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white font-black px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-rose-200 transition-all flex items-center gap-1 ml-auto shadow-sm">
                            <Key size={12} /> Overwrite
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!loading && activeSubTab === 'notices' && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Publish Notification Form */}
            <div className="md:col-span-1 bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-5 text-white font-black tracking-wider uppercase text-xs flex items-center gap-2">
                <Send size={14} /> Dispatch Notice Bulletin
              </div>
              
              <form onSubmit={createNotice} className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Broadcasting Target Group</label>
                  <select 
                    value={noticeForm.targetGroup} 
                    onChange={(e) => setNoticeForm({...noticeForm, targetGroup: e.target.value})}
                    className="w-full border border-gray-200 bg-amber-50/30 rounded-xl px-3 py-2.5 text-xs font-black outline-none focus:border-amber-500">
                    <option value="ALL">🌍 EVERYONE (Admin, Trainee, Supervisor)</option>
                    <option value="SUPERVISOR">👥 SUPERVISORS ONLY</option>
                    <option value="TRAINEE">🎓 TRAINEES (NICTians) ONLY</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Bulletin Body Text</label>
                  <textarea 
                    placeholder="Message body..."
                    value={noticeForm.message}
                    onChange={(e) => setNoticeForm({...noticeForm, message: e.target.value})}
                    rows={4}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-gray-50 outline-none resize-none"
                    required />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Active From</label>
                    <input 
                      type="date" 
                      value={noticeForm.fromDate}
                      onChange={(e) => setNoticeForm({...noticeForm, fromDate: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold bg-gray-50 outline-none"
                      required />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Active Until</label>
                    <input 
                      type="date" 
                      value={noticeForm.toDate}
                      onChange={(e) => setNoticeForm({...noticeForm, toDate: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold bg-gray-50 outline-none"
                      required />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-3.5 rounded-xl shadow-lg text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 shadow-amber-100">
                  <Bell size={14} /> Publish Bulletin
                </button>
              </form>
            </div>

            {/* Active Bulletin Catalog */}
            <div className="md:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-xl p-6">
              <h3 className="font-black text-sm text-gray-800 tracking-wide uppercase mb-4 flex items-center gap-2">
                <Bell size={18} className="text-amber-600" /> Catalog: Published Bulletins
              </h3>
              
              {notices.length === 0 ? (
                <div className="p-12 text-center font-bold text-gray-400 text-xs border-2 border-dashed rounded-2xl">
                  No active notice configurations are broadcasted.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {notices.map((n: any) => (
                    <div key={n.id} className="border border-gray-100 bg-white p-4 rounded-2xl shadow-sm flex justify-between items-start group hover:border-amber-200 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                            n.targetGroup === 'ALL' ? 'bg-emerald-100 text-emerald-800' :
                            n.targetGroup === 'SUPERVISOR' ? 'bg-blue-100 text-blue-800' :
                            'bg-indigo-100 text-indigo-800'
                          }`}>
                            🎯 {n.targetGroup || 'ALL'}
                          </span>
                          <span className="text-[9px] font-black text-gray-400">
                            📅 {new Date(n.fromDate).toLocaleDateString()} → {new Date(n.toDate).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-gray-700 mt-2 pt-1 leading-relaxed">{n.message}</p>
                      </div>

                      <button 
                        onClick={() => deleteNotice(n.id)}
                        className="text-gray-400 hover:text-rose-600 bg-gray-50 hover:bg-rose-50 p-2 rounded-xl transition-all active:scale-95 border border-transparent hover:border-rose-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 📢 Dynamic Live Announcement Popup Modal (Premium Session Layer) */}
      {showAdminNoticeModal && notices && notices.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
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
    </div>
  );
};

export default SupervisorDashboard;
