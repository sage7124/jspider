import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, Edit, Clock, Key, FileDown, LogOut, CheckCircle, Bell, X, ArrowLeft, Trash2, MapPin, Calendar, Eye } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin`;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_MAP: Record<string, string> = {
  Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED', Thursday: 'THU',
  Friday: 'FRI', Saturday: 'SAT', Sunday: 'SUN',
};
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINS = ['00', '15', '30', '45'];
const AMPM = ['AM', 'PM'];
const SLOT_COUNT = 3; // 3 slots per day

// ── Types ─────────────────────────────────────────────────────────────────────
interface Slot { day: string; start: string; end: string; slotNo: number }
interface Trainee {
  id: number; empCode: string; name: string; email: string | null; department: string | null;
  slots: Slot[]; status: string; date: string; in: string; out: string;
  inTime1?: string; outTime1?: string; inTime2?: string; outTime2?: string; inTime3?: string; outTime3?: string;
  isLate: boolean; isApproved: boolean; leaveBalance: number; totalLeaves: number;
}
interface LeaveRequest {
  id: number; userId: number; startDate: string; endDate: string; reason: string | null;
  status: string; createdAt: string;
  user: { fullName: string; identifier: string; department: string | null; leaveBalance: number };
}
interface PendingNICTian {
  id: number; identifier: string; fullName: string; email: string | null;
  department: string | null; createdAt: string;
}

// ── Time field helpers ────────────────────────────────────────────────────────
type TimeField = { h: string; m: string; p: string };
type SlotRow = { from: TimeField; to: TimeField };
type DaySlots = SlotRow[];

function emptyField(): TimeField { return { h: '--', m: '--', p: '--' }; }
function emptyRow(): SlotRow { return { from: emptyField(), to: emptyField() }; }
function emptyDaySlots(): DaySlots { return Array.from({ length: SLOT_COUNT }, emptyRow); }

function parseTime(t: string): TimeField {
  if (!t || t === '--') return emptyField();
  const [time, p] = t.split(' ');
  const [h, m] = time.split(':');
  return { h, m, p };
}

function fieldToStr(f: TimeField): string {
  if (f.h === '--' || f.m === '--' || f.p === '--') return '--';
  return `${f.h}:${f.m} ${f.p}`;
}

function buildInitSlots(slots: Slot[]): Record<string, DaySlots> {
  const init: Record<string, DaySlots> = {};
  DAYS.forEach((d) => { init[d] = emptyDaySlots(); });
  slots.forEach((s) => {
    const fullDay = Object.entries(DAY_MAP).find(([, v]) => v === s.day)?.[0];
    if (!fullDay) return;
    const idx = (s.slotNo ?? 1) - 1;
    if (idx >= 0 && idx < SLOT_COUNT) {
      init[fullDay][idx].from = parseTime(s.start);
      init[fullDay][idx].to = parseTime(s.end);
    }
  });
  return init;
}

// ── Select component ──────────────────────────────────────────────────────────
const Sel = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}
    className="border border-gray-300 rounded px-0.5 py-1 text-xs w-full bg-white">
    <option value="--">--</option>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);

// ── Edit User Modal ───────────────────────────────────────────────────────────
const EditUserModal = ({ trainee, onClose, onSave }: { trainee: Trainee; onClose: () => void; onSave: () => void }) => {
  const [name, setName] = useState(trainee.name);
  const [mobile, setMobile] = useState(trainee.empCode);
  const [email, setEmail] = useState(trainee.email || '');

  const [leaves, setLeaves] = useState(trainee.totalLeaves || 0);

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/user/${trainee.id}`, { 
        fullName: name, 
        identifier: mobile, 
        email,
        totalLeaves: leaves
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onSave(); 
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update user information');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative">
        <h2 className="text-lg font-bold text-center mb-6">Edit User Information</h2>
        <div className="flex flex-col gap-4">
          {[['Name', name, setName], ['Mobile', mobile, setMobile], ['Email', email, setEmail]].map(([label, val, setter]) => (
            <div key={label as string}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label as string}</label>
              <input value={val as string} onChange={(e) => (setter as any)(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Yearly Leave Quota</label>
            <input type="number" value={leaves} onChange={(e) => setLeaves(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-[10px] text-gray-400 mt-1">Updating this will reset the balance to this total.</p>
          </div>
          
          <div className="mt-2 border-t pt-4">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Security & Devices</label>
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  if(!confirm('Reset Mobile lock?')) return;
                  const token = localStorage.getItem('token');
                  await axios.post(`${API}/reset-device/${trainee.id}`, { type: 'mobile' }, { headers: { Authorization: `Bearer ${token}` } });
                  alert('Mobile lock reset');
                }}
                className="flex-1 bg-orange-50 text-orange-700 border border-orange-200 py-2 rounded text-xs font-bold hover:bg-orange-100 transition-colors">
                Reset Mobile Lock
              </button>
              <button 
                onClick={async () => {
                  if(!confirm('Reset Laptop lock?')) return;
                  const token = localStorage.getItem('token');
                  await axios.post(`${API}/reset-device/${trainee.id}`, { type: 'desktop' }, { headers: { Authorization: `Bearer ${token}` } });
                  alert('Laptop lock reset');
                }}
                className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded text-xs font-bold hover:bg-blue-100 transition-colors">
                Reset Laptop Lock
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-center">
          <button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded font-medium transition-colors">Update</button>
          <button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-2 rounded font-medium transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ── Time Slots Modal (5 slots) ────────────────────────────────────────────────
const SlotsModal = ({ trainee, onClose, onSave }: { trainee: Trainee; onClose: () => void; onSave: () => void }) => {
  const [daySlots, setDaySlots] = useState<Record<string, DaySlots>>(buildInitSlots(trainee.slots));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (day: string, slotIdx: number, side: 'from' | 'to', field: keyof TimeField, val: string) => {
    setDaySlots((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[day][slotIdx][side][field] = val;
      return copy;
    });
  };

  const handleUpdate = async () => {
    setSaving(true);
    const slots: any[] = [];
    DAYS.forEach((day) => {
      daySlots[day].forEach((row, idx) => {
        const from = fieldToStr(row.from);
        const to = fieldToStr(row.to);
        if (from !== '--' && to !== '--') {
          slots.push({ dayOfWeek: DAY_MAP[day], slotNo: idx + 1, startTime: from, endTime: to });
        }
      });
    });
    try {
      await axios.put(`${API}/slots/${trainee.id}`, { slots }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setSaved(true);
      onSave();
      setTimeout(() => onClose(), 800);
    } catch (e) {
      alert('Failed to update slots');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-6">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Update Time Slots – {trainee.name}</h2>
          <button 
            onClick={() => {
              setDaySlots((prev) => {
                const copy = JSON.parse(JSON.stringify(prev));
                const mon = copy['Monday'];
                DAYS.forEach(d => { if (d !== 'Monday') copy[d] = JSON.parse(JSON.stringify(mon)); });
                return copy;
              });
            }}
            className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded font-bold transition-colors flex items-center gap-1"
          >
            <span>📋</span> Copy Monday to All Days
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="py-2 px-2 text-left font-semibold w-24">Day</th>
                {Array.from({ length: SLOT_COUNT }, (_, si) => (
                  <React.Fragment key={si}>
                    <th className="py-2 px-1 text-center font-bold text-gray-700 border-l" colSpan={6}>
                      Slot-{si + 1}
                    </th>
                  </React.Fragment>
                ))}
              </tr>
              <tr className="bg-gray-50 border-b text-gray-500">
                <th className="py-1 px-2"></th>
                {Array.from({ length: SLOT_COUNT }, (_, si) => (
                  <React.Fragment key={si}>
                    <th className="py-1 px-1 text-center border-l" colSpan={3}>From</th>
                    <th className="py-1 px-1 text-center" colSpan={3}>To</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium text-gray-700">{day}</td>
                  {Array.from({ length: SLOT_COUNT }, (_, si) => (
                    <React.Fragment key={si}>
                      {(['from', 'to'] as const).map((side) => (
                        <React.Fragment key={side}>
                          <td className={`py-1 px-0.5 ${side === 'from' ? 'border-l' : ''}`}>
                            <Sel value={daySlots[day][si][side].h} onChange={(v) => update(day, si, side, 'h', v)} options={HOURS} />
                          </td>
                          <td className="py-1 px-0.5">
                            <Sel value={daySlots[day][si][side].m} onChange={(v) => update(day, si, side, 'm', v)} options={MINS} />
                          </td>
                          <td className="py-1 px-0.5">
                            <Sel value={daySlots[day][si][side].p} onChange={(v) => update(day, si, side, 'p', v)} options={AMPM} />
                          </td>
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 mt-5 justify-center">
          <button onClick={handleUpdate} disabled={saving}
            className={`px-10 py-2 rounded font-medium text-white transition-colors ${saved ? 'bg-green-600' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-60`}>
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Update'}
          </button>
          <button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white px-10 py-2 rounded font-medium transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Reset Password Modal ──────────────────────────────────────────────────────
const ResetPasswordModal = ({ trainee, onClose }: { trainee: Trainee; onClose: () => void }) => {
  const [done, setDone] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (isManual: boolean) => {
    if (isManual && !newPassword) return alert('Please enter a password');
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/reset-password/${trainee.id}`, { 
        newPassword: isManual ? newPassword : null 
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDone(true);
    } catch (e) {
      alert('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-8 text-center relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <div className="w-16 h-16 rounded-full border-4 border-orange-400 flex items-center justify-center mx-auto mb-4">
          <span className="text-orange-400 text-3xl font-bold">!</span>
        </div>
        {done ? (
          <>
            <h2 className="text-lg font-bold mb-2 text-green-600">Successfully Reset!</h2>
            <p className="text-gray-600 text-sm mb-6">
              Password for <strong>{trainee.name}</strong> has been updated.
            </p>
            <button onClick={onClose} className="w-full bg-gray-600 hover:bg-gray-700 text-white px-8 py-2 rounded font-medium">Close</button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-2">Reset Password?</h2>
            <p className="text-gray-500 text-sm mb-4">For trainee <strong>{trainee.name}</strong></p>
            <div className="mb-6 text-left">
              <label className="block text-xs font-bold text-gray-400 mb-1">SET NEW PASSWORD DIRECTLY</label>
              <input 
                type="text" 
                placeholder="Enter custom password..." 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button 
                onClick={() => handleReset(true)} 
                disabled={loading}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-xs font-bold transition-all disabled:opacity-50">
                Update to this Password
              </button>
            </div>

            <div className="relative flex items-center justify-center mb-6">
              <div className="border-t w-full"></div>
              <span className="absolute bg-white px-2 text-[10px] text-gray-400 font-bold">OR</span>
            </div>

            <button 
              onClick={() => handleReset(false)} 
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded font-medium text-sm transition-all disabled:opacity-50">
              Reset to Mobile Number
            </button>
            <p className="text-[10px] text-gray-400 mt-2">Mobile: {trainee.empCode}</p>
          </>
        )}
      </div>
    </div>
  );
};

// ── Manual Attendance Edit Modal ──────────────────────────────────────────────
const ManualPunchModal = ({ trainee, onClose, onSave }: { trainee: Trainee; onClose: () => void; onSave: () => void }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotNo, setSlotNo] = useState<number | null>(null);
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [loading, setLoading] = useState(false);

  const getLocalDay = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(y, m - 1, d).getDay()];
  };

  const to24Hour = (time12: string) => {
    if (!time12) return '';
    const [time, modifier] = time12.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12).padStart(2, '0');
    return `${hours.padStart(2, '0')}:${minutes}`;
  };

  const dayOfWeek = getLocalDay(date);
  const currentDaySlots = trainee.slots.filter(s => s.day === dayOfWeek).sort((a, b) => a.slotNo - b.slotNo);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload: any = { 
        date, 
        slotNo 
      };

      if (inTime) payload.inTime = inTime;
      if (outTime) payload.outTime = outTime;

      await axios.put(`${API}/attendance-manual/${trainee.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onSave();
      onClose();
    } catch (e) {
      alert('Failed to update attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleClearPunchOut = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/attendance-manual/${trainee.id}`, {
        date,
        slotNo,
        clearPunchOut: true
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onSave();
      onClose();
    } catch (e) {
      alert('Failed to clear punch out time');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <h2 className="text-lg font-bold mb-1">Manual Attendance</h2>
        <p className="text-xs text-gray-500 mb-6">{trainee.name}</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Select Slot ({dayOfWeek})</label>
            <select 
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              value={slotNo || 'global'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'global') {
                  setSlotNo(null);
                  setInTime('');
                  setOutTime('');
                } else {
                  const sNum = Number(val);
                  setSlotNo(sNum);
                  const sObj = currentDaySlots.find(s => s.slotNo === sNum) || trainee.slots.find(s => s.slotNo === sNum);
                  if (sObj) {
                    setInTime(to24Hour(sObj.start));
                    setOutTime(to24Hour(sObj.end));
                  } else {
                    setInTime('');
                    setOutTime('');
                  }
                }
              }}
            >
              <option value="global">Overall Day Punch</option>
              {trainee.slots.some(s => s.slotNo === 1) && (
                <option value="1">Slot 1 {currentDaySlots.find(s => s.slotNo === 1) ? `(${currentDaySlots.find(s => s.slotNo === 1)?.start} - ${currentDaySlots.find(s => s.slotNo === 1)?.end})` : ''}</option>
              )}
              {trainee.slots.some(s => s.slotNo === 2) && (
                <option value="2">Slot 2 {currentDaySlots.find(s => s.slotNo === 2) ? `(${currentDaySlots.find(s => s.slotNo === 2)?.start} - ${currentDaySlots.find(s => s.slotNo === 2)?.end})` : ''}</option>
              )}
              {trainee.slots.some(s => s.slotNo === 3) && (
                <option value="3">Slot 3 {currentDaySlots.find(s => s.slotNo === 3) ? `(${currentDaySlots.find(s => s.slotNo === 3)?.start} - ${currentDaySlots.find(s => s.slotNo === 3)?.end})` : ''}</option>
              )}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Punch IN</label>
              <input type="time" value={inTime} onChange={e => setInTime(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Punch OUT</label>
              <input type="time" value={outTime} onChange={e => setOutTime(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-8">
          <button onClick={handleUpdate} disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold transition-colors disabled:opacity-50">
            {loading ? 'Updating...' : 'Save Punch'}
          </button>
          <button onClick={handleClearPunchOut} disabled={loading}
            className="flex-1 border-2 border-red-500 hover:bg-red-50 text-red-600 py-2 rounded font-bold transition-colors disabled:opacity-50">
            {loading ? 'Clearing...' : 'Clear Out'}
          </button>
        </div>
      </div>
    </div>
  );
};


// ── Individual Download Modal ──────────────────────────────────────────────
const IndividualDownloadModal = ({ trainee, onClose }: { trainee: Trainee; onClose: () => void }) => {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/individual/${trainee.id}?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Report_${trainee.name}_${month}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      onClose();
    } catch (e) {
      alert('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <h2 className="text-lg font-bold mb-2">Download Report</h2>
        <p className="text-sm text-gray-500 mb-4">{trainee.name}</p>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6" />
        <button onClick={handleDownload} disabled={downloading}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold transition-colors disabled:opacity-60">
          {downloading ? 'Downloading...' : '⬇ Download Excel'}
        </button>
      </div>
    </div>
  );
};

// ── Monthly Download Modal ────────────────────────────────────────────────────
const MonthlyDownloadModal = ({ onClose }: { onClose: () => void }) => {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/monthly?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_${month}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      onClose();
    } catch (e) {
      alert('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <h2 className="text-lg font-bold mb-4">Download Monthly Report</h2>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6" />
        <button onClick={handleDownload} disabled={downloading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold transition-colors disabled:opacity-60">
          {downloading ? 'Downloading...' : '⬇ Download All Data'}
        </button>
      </div>
    </div>
  );
};

// ── Pending Approvals Page ────────────────────────────────────────────────────
const PendingApprovalsPage = ({ onBack, onApprove }: { onBack: () => void; onApprove: () => void }) => {
  const [pending, setPending] = useState<PendingNICTian[]>([]);

  useEffect(() => { fetchPending(); }, []);

  const fetchPending = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${API}/pending`, { headers: { Authorization: `Bearer ${token}` } });
    setPending(res.data);
  };

  const handleApprove = async (id: number) => {
    const token = localStorage.getItem('token');
    await axios.post(`${API}/approve`, { traineeId: id }, { headers: { Authorization: `Bearer ${token}` } });
    fetchPending();
    onApprove();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-4 border-b flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800 transition-colors"><ArrowLeft size={20} /></button>
        <h2 className="text-xl font-bold">Pending NICTians Approvals</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-600">Mobile Number</th>
              <th className="px-6 py-4 font-semibold text-gray-600">Name</th>
              <th className="px-6 py-4 font-semibold text-gray-600">Contact</th>
              <th className="px-6 py-4 font-semibold text-gray-600">Location</th>
              <th className="px-6 py-4 font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No pending NICTians 🎉</td></tr>
            ) : (
              pending.map((t) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{t.identifier}</td>
                  <td className="px-6 py-4 font-bold">{t.fullName}</td>
                  <td className="px-6 py-4 text-gray-600">{t.email || '--'}</td>
                  <td className="px-6 py-4 text-gray-600">{t.department || '--'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleApprove(t.id)}
                      className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors">
                      <CheckCircle size={14} /> Approve
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Main Admin Dashboard ──────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [qrToken, setQrToken] = useState('TOKEN_' + Math.random().toString(36).substring(2, 10).toUpperCase());
  const [search, setSearch] = useState('');

  // View state
  const [view, setView] = useState<'main' | 'pending'>('main');

  // Modal states
  const [editUser, setEditUser] = useState<Trainee | null>(null);
  const [slotsUser, setSlotsUser] = useState<Trainee | null>(null);
  const [resetUser, setResetUser] = useState<Trainee | null>(null);
  const [manualPunchUser, setManualPunchUser] = useState<Trainee | null>(null);
  const [deleteUser, setDeleteUser] = useState<Trainee | null>(null);
  const [showLeaves, setShowLeaves] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [individualReport, setIndividualReport] = useState<Trainee | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [directLeaveUser, setDirectLeaveUser] = useState<Trainee | null>(null);
  const [viewDetailUser, setViewDetailUser] = useState<Trainee | null>(null);
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const [showNotices, setShowNotices] = useState(false);

  const regenerateQr = () => {
    setQrToken('TOKEN_' + Math.random().toString(36).substring(2, 10).toUpperCase());
  };

  useEffect(() => {
    fetchTrainees();
    fetchPendingCount();
  }, []);

  const fetchTrainees = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/attendance?search=${search}`, { headers: { Authorization: `Bearer ${token}` } });
      setTrainees(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchTrainees(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPendingCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/pending`, { headers: { Authorization: `Bearer ${token}` } });
      setPendingCount(res.data.length);
    } catch (err) { console.error(err); }
  };

  if (view === 'pending') {
    return (
      <PendingApprovalsPage
        onBack={() => { setView('main'); fetchTrainees(); fetchPendingCount(); }}
        onApprove={() => fetchPendingCount()}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header Row */}
      <div className="p-4 border-b flex flex-wrap justify-between items-center gap-4 bg-[#f8fafc]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-6 bg-pink-500 rounded-sm"></div>
            <div className="w-2 h-6 bg-green-500 rounded-sm -ml-1"></div>
          </div>
          <h2 className="text-xl font-bold">NICTian Attendance</h2>

          {/* 🔔 Notification Bell */}
          <button onClick={() => setView('pending')} className="relative ml-2 text-gray-500 hover:text-yellow-500 transition-colors" title="Pending Approvals">
            <Bell size={22} />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* 🔍 Global Search */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search by Name, Mobile, or Dept..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-full py-2 px-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="bg-white p-3 rounded shadow-sm border border-blue-100 flex items-center gap-3">
            <MapPin className="text-blue-600" size={24} />
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Geofence Status</p>
              <p className="text-xs font-bold text-green-600">Active & Secure</p>
            </div>
          </div>
          <button onClick={() => setShowLeaves(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-medium transition-colors">
            Leaves
          </button>
          <button onClick={() => setShowHolidays(true)}
            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded font-medium transition-colors">
            Holidays
          </button>
          <button onClick={() => setShowNotices(true)}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded font-medium transition-colors">
            Notices
          </button>
          <button onClick={() => setShowDailyReport(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium transition-colors">
            <Calendar size={18} /> Daily Report
          </button>
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded font-medium transition-colors">
            Settings
          </button>
          <button onClick={() => setShowDownload(true)}
            className="flex items-center gap-2 bg-[#1976D2] hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors">
            <Download size={18} /> Download
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#f8fafc] text-gray-700 font-bold border-b">
            <tr>
              <th className="px-4 py-4">Mobile Number</th>
              <th className="px-4 py-4">Name</th>
              <th className="px-4 py-4">Time Slot</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">Date</th>
              <th className="px-4 py-4">In</th>
              <th className="px-4 py-4">Out</th>
              <th className="px-4 py-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {trainees.map((t) => (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-4 font-medium text-gray-700">{t.empCode}</td>
                <td className="px-4 py-4 font-bold">{t.name}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1.5">
                    {Object.entries(t.slots.reduce((acc, s) => {
                      if (!acc[s.day]) acc[s.day] = [];
                      acc[s.day].push(s);
                      return acc;
                    }, {} as Record<string, typeof t.slots>))
                    .sort(([dayA], [dayB]) => {
                      const order = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                      return order.indexOf(dayA) - order.indexOf(dayB);
                    })
                    .map(([day, daySlots], idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs">
                        <span className="bg-[#e0f2fe] text-[#0369a1] font-bold px-2 py-0.5 rounded flex items-center justify-center gap-1 min-w-[72px] shadow-sm whitespace-nowrap">
                          📅 {day}
                        </span>
                        <div className="flex gap-4">
                          {daySlots.map((s, i) => (
                            <span key={i} className="text-[#be123c] font-medium flex items-center gap-1">
                              ⏰ {s.start} – {s.end}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {t.slots.length === 0 && <span className="text-gray-400 italic text-xs">No slots assigned</span>}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    t.status === 'IN' ? 'bg-green-500 text-white' :
                    t.status === 'OUT' ? 'bg-gray-200 text-gray-700' : 'bg-red-100 text-red-700'
                  }`}>{t.status}</span>
                  {t.isLate && <span className="ml-1 text-xs font-bold text-red-500">LATE</span>}
                </td>
                <td className="px-4 py-4 text-gray-600">{t.date}</td>
                <td className="px-4 py-4 font-medium">{t.in}</td>
                <td className="px-4 py-4 font-medium">{t.out}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setEditUser(t)} className="text-emerald-600 hover:text-emerald-800 transition-colors" title="Edit User Info"><Edit size={16} /></button>
                    <button onClick={() => setSlotsUser(t)} className="text-green-600 hover:text-green-800 transition-colors" title="Update Slots"><Clock size={16} /></button>
                    <button onClick={() => setResetUser(t)} className="text-yellow-600 hover:text-yellow-800 transition-colors" title="Reset Password"><Key size={16} /></button>
                    <button onClick={() => setManualPunchUser(t)} className="text-orange-600 hover:text-orange-800 transition-colors" title="Manual Attendance"><Clock size={16} /></button>
                    <button onClick={() => setDirectLeaveUser(t)} className="text-indigo-600 hover:text-indigo-800 transition-colors" title="Direct Leave"><Calendar size={16} /></button>
                    <button onClick={() => setDeleteUser(t)} className="text-red-600 hover:text-red-800 transition-colors" title="Delete User"><Trash2 size={16} /></button>
                    <button onClick={() => setViewDetailUser(t)} className="text-pink-600 hover:text-pink-800 transition-colors" title="View Slot Statuses"><Eye size={16} /></button>
                    <button onClick={() => setIndividualReport(t)} className="text-blue-600 hover:text-blue-800 transition-colors" title="Download Report"><FileDown size={16} /></button>
                    <button onClick={async () => {
                      if(!confirm('Force Punch Out for this user?')) return;
                      const token = localStorage.getItem('token');
                      await axios.post(`${API}/force-logout/${t.id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                      fetchTrainees();
                      alert('User forced to punch out');
                    }} className="text-red-600 hover:text-red-800 transition-colors" title="Force Logout"><LogOut size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {trainees.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">No trainees registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {editUser && <EditUserModal trainee={editUser} onClose={() => setEditUser(null)} onSave={fetchTrainees} />}
      {slotsUser && <SlotsModal trainee={slotsUser} onClose={() => setSlotsUser(null)} onSave={fetchTrainees} />}
      {resetUser && <ResetPasswordModal trainee={resetUser} onClose={() => setResetUser(null)} />}
      {manualPunchUser && <ManualPunchModal trainee={manualPunchUser} onClose={() => setManualPunchUser(null)} onSave={fetchTrainees} />}
      {deleteUser && <DeleteConfirmModal trainee={deleteUser} onClose={() => setDeleteUser(null)} onDeleted={fetchTrainees} />}
      {showLeaves && <LeaveManagementModal onClose={() => setShowLeaves(null as any)} onProcessed={fetchTrainees} />}
      {showDownload && <MonthlyDownloadModal onClose={() => setShowDownload(false)} />}
      {individualReport && <IndividualDownloadModal trainee={individualReport} onClose={() => setIndividualReport(null)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {directLeaveUser && <DirectLeaveModal trainee={directLeaveUser} onClose={() => setDirectLeaveUser(null)} onSave={fetchTrainees} />}
      {viewDetailUser && <ViewSlotsDetailModal trainee={viewDetailUser} onClose={() => setViewDetailUser(null)} />}
      {showDailyReport && <DailyReportModal onClose={() => setShowDailyReport(false)} />}
      {showHolidays && <HolidayManagementModal onClose={() => setShowHolidays(false)} />}
      {showNotices && <NoticesModal onClose={() => setShowNotices(false)} />}
    </div>
  );
};
// ── View Slots Detail Modal ──────────────────────────────────────────────────
const ViewSlotsDetailModal = ({ trainee, onClose }: { trainee: Trainee; onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <h2 className="text-lg font-bold mb-1">Detailed Punch Status</h2>
        <p className="text-xs text-gray-500 mb-6">{trainee.name}</p>
        
        <div className="space-y-4">
          <div className="border rounded p-3 bg-gray-50">
            <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Slot 1</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase">Punch In</span>
                <span className="text-sm font-bold text-gray-800">{(!trainee.inTime1 || trainee.inTime1 === '--') ? trainee.in : trainee.inTime1}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase">Punch Out</span>
                <span className="text-sm font-bold text-gray-800">{(!trainee.outTime1 || trainee.outTime1 === '--') ? trainee.out : trainee.outTime1}</span>
              </div>
            </div>
          </div>

          <div className="border rounded p-3 bg-gray-50">
            <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Slot 2</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase">Punch In</span>
                <span className="text-sm font-bold text-gray-800">{trainee.inTime2 || '--'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase">Punch Out</span>
                <span className="text-sm font-bold text-gray-800">{trainee.outTime2 || '--'}</span>
              </div>
            </div>
          </div>

          <div className="border rounded p-3 bg-gray-50">
            <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Slot 3</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase">Punch In</span>
                <span className="text-sm font-bold text-gray-800">{trainee.inTime3 || '--'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase">Punch Out</span>
                <span className="text-sm font-bold text-gray-800">{trainee.outTime3 || '--'}</span>
              </div>
            </div>
          </div>
        </div>

        <button onClick={onClose}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold transition-colors">
          Close
        </button>
      </div>
    </div>
  );
};

// ── Direct Leave Modal ────────────────────────────────────────────────────────
const DirectLeaveModal = ({ trainee, onClose, onSave }: { trainee: Trainee; onClose: () => void; onSave: () => void }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!startDate || !endDate) return alert('Please select start and end dates');
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/leaves/direct`, {
        traineeId: trainee.id, startDate, endDate, reason
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Leave assigned successfully');
      onSave();
      onClose();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to assign leave');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <h2 className="text-lg font-bold mb-1">Assign Direct Leave</h2>
        <p className="text-xs text-gray-500 mb-6">{trainee.name} (Balance: {trainee.leaveBalance})</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Reason (Optional)</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Sick leave"
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded font-bold transition-colors disabled:opacity-50">
          {saving ? 'Assigning...' : 'Assign Leave'}
        </button>
      </div>
    </div>
  );
};

// ── Daily Report Modal ────────────────────────────────────────────────────────
const DailyReportModal = ({ onClose }: { onClose: () => void }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState('ALL');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDailyReport();
  }, [date, filter]);

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/attendance/daily?date=${date}&statusFilter=${filter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };
  const getLocalDayAndDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(y, m - 1, d).getDay()];
    return `${dayName}, ${new Date(y, m - 1, d).toLocaleDateString('en-IN')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl p-6 relative max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <h2 className="text-xl font-bold mb-6 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="text-indigo-600" /> Daily Attendance Report
          </span>
          <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {getLocalDayAndDate(date)}
          </span>
        </h2>
        
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Filter</label>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[150px]">
              <option value="ALL">All NICTians</option>
              <option value="PRESENT">Present Only</option>
              <option value="ABSENT">Absent Only</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center py-10 text-gray-400">Loading...</p>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600">Mobile Number</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-2 py-3 font-semibold text-gray-600 text-center border-l bg-blue-50/30">Slot 1 In</th>
                  <th className="px-2 py-3 font-semibold text-gray-600 text-center bg-blue-50/30">Slot 1 Out</th>
                  <th className="px-2 py-3 font-semibold text-gray-600 text-center border-l bg-indigo-50/30">Slot 2 In</th>
                  <th className="px-2 py-3 font-semibold text-gray-600 text-center bg-indigo-50/30">Slot 2 Out</th>
                  <th className="px-2 py-3 font-semibold text-gray-600 text-center border-l bg-purple-50/30">Slot 3 In</th>
                  <th className="px-2 py-3 font-semibold text-gray-600 text-center bg-purple-50/30">Slot 3 Out</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No records found</td></tr>
                ) : (
                  data.map((r, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.empCode}</td>
                      <td className="px-4 py-3 font-bold">{r.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'IN' || r.status === 'OUT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {r.status === 'IN' || r.status === 'OUT' ? 'PRESENT' : 'ABSENT'}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center border-l text-gray-600">{r.inTime1 || '--'}</td>
                      <td className="px-2 py-3 text-center text-gray-600">{r.outTime1 || '--'}</td>
                      <td className="px-2 py-3 text-center border-l text-gray-600">{r.inTime2 || '--'}</td>
                      <td className="px-2 py-3 text-center text-gray-600">{r.outTime2 || '--'}</td>
                      <td className="px-2 py-3 text-center border-l text-gray-600">{r.inTime3 || '--'}</td>
                      <td className="px-2 py-3 text-center text-gray-600">{r.outTime3 || '--'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Delete Confirmation Modal ────────────────────────────────────────────────
const DeleteConfirmModal = ({ trainee, onClose, onDeleted }: { trainee: Trainee; onClose: () => void; onDeleted: () => void }) => {
  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/user/${trainee.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      onDeleted();
      onClose();
    } catch (e) {
      alert('Failed to delete user');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-8 text-center border-t-4 border-red-500">
        <h2 className="text-xl font-bold mb-4 text-red-600">Delete Account?</h2>
        <p className="text-gray-600 mb-2 text-sm">Are you sure you want to permanently delete</p>
        <p className="font-bold text-lg mb-1">{trainee.name}</p>
        <p className="text-xs text-gray-400 mb-8 italic">This will also delete all their attendance records and slots.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded font-medium">Cancel</button>
          <button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-medium">Yes, Delete</button>
        </div>
      </div>
    </div>
  );
};

// ── Leave Management Modal ──────────────────────────────────────────────────
const LeaveManagementModal = ({ onClose, onProcessed }: { onClose: () => void; onProcessed: () => void }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editedEndDates, setEditedEndDates] = useState<Record<number, string>>({});
  const [adminReasons, setAdminReasons] = useState<Record<number, string>>({});

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${API}/leaves/requests`, { headers: { Authorization: `Bearer ${token}` } });
    setRequests(res.data);
    setLoading(false);
  };

  const handleProcess = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      const token = localStorage.getItem('token');
      const payload: any = { requestId: id, status };
      if (status === 'APPROVED' && editedEndDates[id]) {
        payload.newEndDate = editedEndDates[id];
      }
      if (adminReasons[id]) {
        payload.adminReason = adminReasons[id];
      }
      await axios.post(`${API}/leaves/process`, payload, { headers: { Authorization: `Bearer ${token}` } });
      fetchRequests();
      onProcessed();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to process request');
    }
  };

  const handleDeleteLeave = async (id: number) => {
    if (!confirm('Are you sure you want to delete this leave request? This will refund any deducted balance if it was approved.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/leaves/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchRequests();
      onProcessed();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to delete leave');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Leave Requests Management</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        {loading ? <p className="text-center py-10">Loading requests...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold">Trainee</th>
                  <th className="px-4 py-3 font-semibold">Dates</th>
                  <th className="px-4 py-3 font-semibold">Trainee Reason</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions / Admin Reason</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No leave requests found</td></tr>
                ) : requests.map((r) => {
                  // Calculate dynamic days based on edited date or original date
                  const currentEndDateStr = editedEndDates[r.id] || r.endDate.split('T')[0];
                  const currentEndDate = new Date(currentEndDateStr);
                  const startDate = new Date(r.startDate);
                  const dynamicDays = Math.ceil((currentEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                  return (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-bold">{r.user.fullName}</div>
                      <div className="text-[10px] text-gray-500">{r.user.identifier} • {r.user.department}</div>
                      <div className="text-[10px] text-blue-600 font-bold mt-1">Balance: {r.user.leaveBalance} Days</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-medium flex items-center gap-2">
                        <span>{startDate.toLocaleDateString()}</span>
                        <span>–</span>
                        {r.status === 'PENDING' ? (
                          <input 
                            type="date" 
                            className="border rounded px-1 text-xs py-0.5"
                            value={currentEndDateStr}
                            onChange={(e) => setEditedEndDates({...editedEndDates, [r.id]: e.target.value})}
                          />
                        ) : (
                          <span>{new Date(r.endDate).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {dynamicDays > 0 ? `${dynamicDays} Days` : 'Invalid Date'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs italic">"{r.reason || 'No reason'}"</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col gap-2 items-end">
                        {r.status === 'PENDING' ? (
                          <div className="flex flex-col gap-2 items-end">
                            <input 
                              type="text" 
                              placeholder="Optional remark..." 
                              className="border rounded px-2 py-1 text-xs w-48"
                              value={adminReasons[r.id] || ''}
                              onChange={(e) => setAdminReasons({...adminReasons, [r.id]: e.target.value})}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleProcess(r.id, 'APPROVED')} className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1 rounded">Approve</button>
                              <button onClick={() => handleProcess(r.id, 'REJECTED')} className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-3 py-1 rounded">Reject</button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 italic max-w-[200px] ml-auto">
                            {r.adminReason ? `Admin: "${r.adminReason}"` : '--'}
                          </div>
                        )}
                        <button onClick={() => handleDeleteLeave(r.id)} className="text-red-500 hover:text-red-700 p-1 flex items-center gap-1 text-[10px] font-bold mt-1" title="Delete Leave Record">
                          <Trash2 size={12} /> Remove Record
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
// ── Settings Modal ────────────────────────────────────────────────────────────
const SettingsModal = ({ onClose }: { onClose: () => void }) => {
  const [settings, setSettings] = useState({ lat: '', lng: '', radius: '' });
  const [passwords, setPasswords] = useState({ current: '', new: '' });
  const [activeTab, setActiveTab] = useState<'gps' | 'password'>('gps');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const res = await axios.get(`${API}/settings`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    setSettings({ lat: res.data.lat.toString(), lng: res.data.lng.toString(), radius: res.data.radius.toString() });
  };

  const saveSettings = async () => {
    setSaving(true);
    await axios.put(`${API}/settings`, settings, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    setSaving(false);
    onClose();
  };

  const changePassword = async () => {
    try {
      setSaving(true);
      await axios.post(`${API}/change-password`, { currentPassword: passwords.current, newPassword: passwords.new }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('Password changed successfully');
      onClose();
    } catch (e) {
      alert('Failed to change password. Check current password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
        <div className="flex border-b mb-4">
          <button onClick={() => setActiveTab('gps')} className={`flex-1 py-2 font-bold ${activeTab === 'gps' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}>GPS Settings</button>
          <button onClick={() => setActiveTab('password')} className={`flex-1 py-2 font-bold ${activeTab === 'password' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}>Change Password</button>
        </div>

        {activeTab === 'gps' ? (
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">LATITUDE</label><input value={settings.lat} onChange={e => setSettings({...settings, lat: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">LONGITUDE</label><input value={settings.lng} onChange={e => setSettings({...settings, lng: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">RADIUS (METERS)</label><input value={settings.radius} onChange={e => setSettings({...settings, radius: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
            <button onClick={saveSettings} disabled={saving} className="w-full bg-blue-600 text-white py-2 rounded font-bold">{saving ? 'Saving...' : 'Save Settings'}</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">CURRENT PASSWORD</label><input type="password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">NEW PASSWORD</label><input type="password" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
            <button onClick={changePassword} disabled={saving} className="w-full bg-blue-600 text-white py-2 rounded font-bold">{saving ? 'Saving...' : 'Update Password'}</button>
          </div>
        )}
        <button onClick={onClose} className="w-full mt-2 text-gray-500 text-sm">Cancel</button>
      </div>
    </div>
  );
};

// ── Holiday Management Modal ──────────────────────────────────────────────────
const HolidayManagementModal = ({ onClose }: { onClose: () => void }) => {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [quota, setQuota] = useState(0);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [hRes, sRes] = await Promise.all([
        axios.get(`${API}/holidays`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/settings`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setHolidays(hRes.data);
      setQuota(sRes.data?.totalHolidaysQuota || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newDate || !newName) return alert('Date and Name are required');
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/holidays`, { date: newDate, name: newName }, { headers: { Authorization: `Bearer ${token}` } });
      setNewDate('');
      setNewName('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('Delete this holiday?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/holidays/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      alert('Failed to delete holiday');
    }
  };

  const handleUpdateQuota = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/settings`, { totalHolidaysQuota: quota }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Holiday quota updated');
    } catch (err) {
      console.error('Update Quota Error:', err);
      alert('Failed to update quota');
    }
  };


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl p-6 relative flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Calendar className="text-pink-600" /> Holiday Management
        </h2>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="bg-pink-50 p-4 rounded-lg border border-pink-100">
            <h3 className="text-sm font-bold text-pink-700 mb-4 uppercase tracking-wider">Holiday Quota</h3>
            <div className="flex gap-2">
              <input type="number" value={quota} onChange={e => setQuota(parseInt(e.target.value) || 0)}
                className="flex-1 border border-pink-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 outline-none" />
              <button onClick={handleUpdateQuota} className="bg-pink-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-pink-700 transition-colors">
                Set Quota
              </button>
            </div>
            <p className="text-[10px] text-pink-600 mt-2 italic font-medium">Total holidays allowed for this session</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Add New Holiday</h3>
            <div className="space-y-2">
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="text" placeholder="Holiday Name (e.g., Diwali)" value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <button onClick={handleAddHoliday} disabled={saving}
                className="w-full bg-blue-600 text-white py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Adding...' : 'Add Holiday'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700">Scheduled Holidays ({holidays.length})</h3>
            <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">
              Remaining: {Math.max(0, quota - holidays.length)}
            </span>
          </div>
          {loading ? <p className="text-center py-10 text-gray-400">Loading...</p> : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Day</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Holiday Name</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No holidays scheduled</td></tr>
                ) : (
                  holidays.map((h) => {
                    const d = new Date(h.date);
                    return (
                      <tr key={h.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{d.toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-gray-500">{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]}</td>
                        <td className="px-4 py-3 font-bold">{h.name}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-500 hover:text-red-700 p-1">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Notices Management Modal ───────────────────────────────────────────────────
const NoticesModal = ({ onClose }: { onClose: () => void }) => {
  const [notices, setNotices] = useState<any[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [message, setMessage] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userId, setUserId] = useState<string>('');

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/notices`, { headers: { Authorization: `Bearer ${token}` } });
      setNotices(res.data);
      const userRes = await axios.get(`${API}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
      setTrainees(userRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !fromDate || !toDate) return alert('Message, From Date, and To Date are required');
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/notices`, { message, fromDate, toDate, userId: userId ? Number(userId) : null }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage(''); setFromDate(''); setToDate(''); setUserId('');
      fetchNotices();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add notice');
    }
  };

  const handleDeleteNotice = async (id: number) => {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/notices/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchNotices();
    } catch (err) {
      alert('Failed to delete notice');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden relative">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">Manage Notices</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <h3 className="font-bold mb-4">Add New Notice</h3>
            <form onSubmit={handleAddNotice} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Message</label>
                <textarea 
                  className="w-full border p-2 rounded" 
                  rows={3} 
                  required 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">From Date</label>
                  <input type="date" required className="w-full border p-2 rounded" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">To Date</label>
                  <input type="date" required className="w-full border p-2 rounded" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Target NICTian (Optional)</label>
                <select className="w-full border p-2 rounded" value={userId} onChange={e => setUserId(e.target.value)}>
                  <option value="">All NICTians</option>
                  {trainees.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.empCode})</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded transition-colors mt-2">
                Send Notice
              </button>
            </form>
          </div>

          <div className="flex-1">
            <h3 className="font-bold mb-4">Active Notices</h3>
            {loading ? <p className="text-gray-500">Loading notices...</p> : (
              <div className="space-y-4">
                {notices.length === 0 ? <p className="text-gray-400">No notices found.</p> : notices.map(n => (
                  <div key={n.id} className="border p-4 rounded bg-gray-50 flex justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{n.message}</p>
                      <div className="text-xs text-gray-500 mt-2 flex gap-4">
                        <span>From: {new Date(n.fromDate).toLocaleDateString()}</span>
                        <span>To: {new Date(n.toDate).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        Target: {n.userId ? `${n.user?.fullName} (${n.user?.identifier})` : 'All NICTians'}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteNotice(n.id)} className="text-red-500 hover:bg-red-100 p-2 rounded self-start">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

