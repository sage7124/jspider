import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, Edit, Clock, Key, FileDown, LogOut, CheckCircle, Bell, X, ArrowLeft, Trash2, MapPin, Calendar, Eye, User } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
            <span key={idx} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-purple-100 shadow-sm">
              {item}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-purple-400 hover:text-purple-700 font-bold ml-0.5 focus:outline-none"
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
          placeholder={placeholder}
          className="w-full mt-1 px-3 py-1.5 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
        />
      )}
    </div>
  );
};

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin`;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_MAP: Record<string, string> = {
  Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED', Thursday: 'THU',
  Friday: 'FRI', Saturday: 'SAT', Sunday: 'SUN',
};
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const AMPM = ['AM', 'PM'];
const SLOT_COUNT = 5; // Allocating up to 5 dynamic slots per day

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

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || timeStr === '--') return null;
  const parts = timeStr.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const timePart = parts[0];
  const ampm = parts[1].toUpperCase();
  const timeSplit = timePart.split(':');
  if (timeSplit.length < 2) return null;
  let hours = parseInt(timeSplit[0], 10);
  const minutes = parseInt(timeSplit[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function calculateExtraWork(t: Trainee): string {
  if (!t.in || t.in === '--' || !t.out || t.out === '--' || !t.slots || t.slots.length === 0) return '--';

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const todayDay = days[new Date().getDay()];

  const todaySlots = t.slots.filter(s => s.day.toUpperCase() === todayDay);
  if (todaySlots.length === 0) return '--';

  let minStart = Infinity;
  let maxEnd = -Infinity;

  todaySlots.forEach(s => {
    const startMin = parseTimeToMinutes(s.start);
    const endMin = parseTimeToMinutes(s.end);
    if (startMin !== null && startMin < minStart) minStart = startMin;
    if (endMin !== null && endMin > maxEnd) maxEnd = endMin;
  });

  if (minStart === Infinity || maxEnd === -Infinity) return '--';

  const actualIn = parseTimeToMinutes(t.in);
  const actualOut = parseTimeToMinutes(t.out);

  if (actualIn === null || actualOut === null) return '--';

  let extraMinutes = 0;

  if (actualIn < minStart) {
    extraMinutes += (minStart - actualIn);
  }

  if (actualOut > maxEnd) {
    extraMinutes += (actualOut - maxEnd);
  }

  if (extraMinutes <= 0) return '--';

  const hrs = Math.floor(extraMinutes / 60);
  const mins = extraMinutes % 60;
  if (hrs > 0) {
    return `${hrs} hr ${mins} mins`;
  }
  return `${mins} mins`;
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

  const [leaves, setLeaves] = useState(trainee.leaveBalance || 0);

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/user/${trainee.id}`, { 
        fullName: name, 
        identifier: mobile, 
        email,
        leaveBalance: leaves
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
          {[['Name', name, setName], ['Mobile', mobile, setMobile]].map(([label, val, setter]) => (
            <div key={label as string}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label as string}</label>
              <input value={val as string} onChange={(e) => (setter as any)(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          {/* Leave balance input removed */}
          
          <div className="mt-2 border-t pt-4 flex flex-col gap-3">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0">Security & Devices</label>
            <div className="flex gap-3">
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
            <button 
              onClick={async () => {
                if(!confirm('Grant 24-hour Profile Edit Override?')) return;
                const token = localStorage.getItem('token');
                await axios.post(`${API}/user/${trainee.id}/grant-edit`, {}, { headers: { Authorization: `Bearer ${token}` } });
                alert('24-hour temporary profile edit access granted successfully!');
              }}
              className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 py-2 rounded text-xs font-bold transition-all"
            >
              🔓 Grant 24h Profile Edit Override
            </button>
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
  const [sourceDay, setSourceDay] = useState('Monday');
  const [targetDays, setTargetDays] = useState<string[]>([]);
  
  // Initial state calculates current max assigned slot up to 5, but defaults minimum view to 3.
  const initialMax = Math.max(3, ...trainee.slots.map(s => s.slotNo || 0));
  const [visibleSlots, setVisibleSlots] = useState(Math.min(initialMax, SLOT_COUNT));

  const update = (day: string, slotIdx: number, side: 'from' | 'to', field: keyof TimeField, val: string) => {
    setDaySlots((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[day][slotIdx][side][field] = val;
      return copy;
    });
  };

  const clearDaySlots = (day: string) => {
    setDaySlots((prev) => {
      const copy = { ...prev };
      copy[day] = emptyDaySlots();
      return copy;
    });
  };

  const handleUpdate = async () => {
    setSaving(true);
    const slots: any[] = [];
    DAYS.forEach((day) => {
      daySlots[day].forEach((row, idx) => {
        if (idx >= visibleSlots) return; // Skip slots beyond current visible count (handles removal)
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
                const mondaySlots = copy['Monday'];
                DAYS.forEach((day) => {
                  if (day !== 'Monday') {
                    copy[day] = JSON.parse(JSON.stringify(mondaySlots));
                  }
                });
                return copy;
              });
            }}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-1.5 rounded font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm"
          >
            📋 Copy Monday to All Days
          </button>
          
          {/* Add/Remove Extra Slot buttons explicitly disabled visually as requested by user to hide functionality without deleting source */}
          {false && visibleSlots < SLOT_COUNT && (
            <button
              onClick={() => setVisibleSlots(p => Math.min(p + 1, SLOT_COUNT))}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-1.5 rounded font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm"
            >
              ➕ Add Extra Slot
            </button>
          )}
          
          {false && visibleSlots > 3 && (
            <button
              onClick={() => setVisibleSlots(p => Math.max(3, p - 1))}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-1.5 rounded font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm"
            >
              ➖ Remove Last Slot
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="py-2 px-2 text-left font-semibold w-24">Day</th>
                {Array.from({ length: Math.min(visibleSlots, 3) }, (_, si) => (
                  <React.Fragment key={si}>
                    <th className={`py-2 px-1 text-center font-bold border-l ${si + 1 > 3 ? 'bg-orange-50 text-orange-600' : 'text-gray-700'}`} colSpan={6}>
                      {si + 1 > 3 ? `🔥 Extra Slot ${si - 2}` : `Slot-${si + 1}`}
                    </th>
                  </React.Fragment>
                ))}
              </tr>
              <tr className="bg-gray-50 border-b text-gray-500">
                <th className="py-1 px-2"></th>
                {Array.from({ length: Math.min(visibleSlots, 3) }, (_, si) => (
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
                  <td className="py-2 px-2 font-medium text-gray-700">
                    <div className="flex items-center justify-between gap-1.5 pr-2">
                      <span>{day}</span>
                      <button 
                        onClick={() => clearDaySlots(day)}
                        className="text-[10px] bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-1.5 py-0.5 rounded font-semibold transition-colors shadow-sm"
                        title={`Clear all slots for ${day}`}
                      >
                        Clear
                      </button>
                    </div>
                  </td>
                  {Array.from({ length: Math.min(visibleSlots, 3) }, (_, si) => (
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
        slotNo,
        inTime,
        outTime
      };

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
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">
              Date <span className="text-blue-500 ml-1">({new Date(date).toLocaleDateString('en-US', { weekday: 'long' })})</span>
            </label>
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
              {currentDaySlots.filter(s => s.slotNo <= 3).map((activeSlot) => {
                const num = activeSlot.slotNo;
                const isExtra = num > 3;
                const label = isExtra ? `🔥 Extra Slot ${num - 3}` : `Slot ${num}`;
                // Consistently include time range next to slot so admin knows exactly which one they are targeting
                const timeStr = ` (${activeSlot.start} - ${activeSlot.end})`;
                return (
                  <option key={num} value={num.toString()}>{label}{timeStr}</option>
                );
              })}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-bold text-gray-400 uppercase">Punch IN</label>
                <button 
                  onClick={() => setInTime('')} 
                  className="text-[10px] bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-2 py-0.5 rounded font-bold shadow-sm"
                >
                  Clear
                </button>
              </div>
              <input type="time" value={inTime} onChange={e => setInTime(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-bold text-gray-400 uppercase">Punch OUT</label>
                <button 
                  onClick={() => setOutTime('')} 
                  className="text-[10px] bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-2 py-0.5 rounded font-bold shadow-sm"
                >
                  Clear
                </button>
              </div>
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
  const [showDropdownOptions, setShowDropdownOptions] = useState(false);
  const [viewOnboardingUser, setViewOnboardingUser] = useState<Trainee | null>(null);

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
                        <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                          {daySlots.filter(s => s.slotNo <= 3).map((s, i) => {
                            const isExtra = s.slotNo > 3;
                            return (
                              <span key={i} className={`font-medium flex items-center gap-1 ${isExtra ? 'text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200 shadow-sm' : 'text-[#be123c]'}`}>
                                {isExtra ? `🔥 Extra Slot ${s.slotNo - 3}: ` : '⏰ '}
                                {s.start} – {s.end}
                              </span>
                            );
                          })}
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
                    <button onClick={() => setViewOnboardingUser(t)} className="text-purple-600 hover:text-purple-800 transition-colors" title="View Onboarding Profile"><User size={16} /></button>
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
      {showDropdownOptions && <DropdownOptionsModal onClose={() => setShowDropdownOptions(false)} />}
      {viewOnboardingUser && <ViewOnboardingProfileModal trainee={viewOnboardingUser} onClose={() => { setViewOnboardingUser(null); fetchTrainees(); }} />}
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
  const [appliedDate, setAppliedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [remarksAlternative, setRemarksAlternative] = useState('');
  const [remarksOfficeUse, setRemarksOfficeUse] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!startDate || !endDate) return alert('Please select start and end dates');
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/leaves/direct`, {
        traineeId: trainee.id, startDate, endDate, reason, appliedDate, remarksAlternative, remarksOfficeUse
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Leave assigned successfully');
      onSave();
      onClose();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to assign leave');
    } finally { setSaving(false); }
  };

  const getWeekdayName = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getDaysCount = () => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    if (end.getTime() < start.getTime()) return 'Invalid Date Range';

    // Track which days the trainee actually has scheduled slots
    const scheduledDays = new Set((trainee.slots || []).map(s => s.day.toUpperCase()));
    const dMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    let diffDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const curDay = dMap[d.getDay()];
      if (scheduledDays.has(curDay)) {
        diffDays += 1;
      }
    }

    return `${diffDays} Day${diffDays !== 1 ? 's' : ''} (Active working days in range)`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <h2 className="text-lg font-bold mb-1">Assign Direct Leave</h2>
        <p className="text-xs text-gray-500 mb-6">{trainee.name}</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">
              Date on which applied {appliedDate && <span className="text-indigo-600 font-extrabold normal-case ml-1">({getWeekdayName(appliedDate)})</span>}
            </label>
            <input type="date" value={appliedDate} onChange={e => setAppliedDate(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">
                Leave Start Date {startDate && <span className="text-indigo-600 font-extrabold normal-case ml-1">({getWeekdayName(startDate)})</span>}
              </label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">
                Leave End Date {endDate && <span className="text-indigo-600 font-extrabold normal-case ml-1">({getWeekdayName(endDate)})</span>}
              </label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>

          {startDate && endDate && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center shadow-sm">
              <span className="text-[10px] font-bold text-indigo-700 uppercase block tracking-wider mb-0.5">Calculated Leave Duration</span>
              <span className="text-base font-black text-indigo-950">{getDaysCount()}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Reason (Optional)</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Sick leave"
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Remarks Alternative</label>
            <input type="text" value={remarksAlternative} onChange={e => setRemarksAlternative(e.target.value)} placeholder="Alternative details..."
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Remarks Office Use</label>
            <input type="text" value={remarksOfficeUse} onChange={e => setRemarksOfficeUse(e.target.value)} placeholder="Office use remarks..."
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
                        {r.status === 'IN' || r.status === 'OUT' || r.status === 'PRESENT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                            PRESENT
                          </span>
                        ) : r.status === '--' ? (
                          <span className="text-gray-400 font-bold">--</span>
                        ) : r.status === 'HOLIDAY' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                            HOLIDAY
                          </span>
                        ) : r.status === 'LEAVE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                            LEAVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            {r.status}
                          </span>
                        )}
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
                  <th className="px-4 py-3 font-semibold">Nictian</th>
                  <th className="px-4 py-3 font-semibold">From Day - To Day</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
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
                      {/* Balance info removed */}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-medium flex items-center gap-2">
                        <span>{startDate.toLocaleDateString()} ({startDate.toLocaleDateString('en-US', { weekday: 'long' })})</span>
                        <span>–</span>
                        {r.status === 'PENDING' ? (
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="date" 
                              className="border rounded px-1 text-xs py-0.5"
                              value={currentEndDateStr}
                              onChange={(e) => setEditedEndDates({...editedEndDates, [r.id]: e.target.value})}
                            />
                            {!isNaN(currentEndDate.getTime()) && (
                              <span className="text-[10px] text-blue-600 font-bold">
                                ({currentEndDate.toLocaleDateString('en-US', { weekday: 'long' })})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span>{new Date(r.endDate).toLocaleDateString()} ({new Date(r.endDate).toLocaleDateString('en-US', { weekday: 'long' })})</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {dynamicDays > 0 ? `${dynamicDays} Days` : 'Invalid Date'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      <div className="font-medium italic">"{r.reason || 'No reason'}"</div>
                      <div className="mt-2 text-[10px] bg-white border p-1 rounded">
                        <div className="font-bold text-gray-700">Applied On: <span className="font-normal">{new Date(r.appliedDate || r.createdAt).toLocaleDateString()}</span></div>
                        {r.remarksAlternative && <div><span className="font-bold text-gray-700">Alternative:</span> {r.remarksAlternative}</div>}
                        {r.remarksOfficeUse && <div><span className="font-bold text-gray-700">Office Use:</span> {r.remarksOfficeUse}</div>}
                      </div>
                    </td>
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
// ── Settings Modal ────────────────────────────────────────────────────────────
const SettingsModal = ({ onClose }: { onClose: () => void }) => {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBranch, setNewBranch] = useState({ name: '', lat: '', lng: '', radius: '100' });
  const [passwords, setPasswords] = useState({ current: '', new: '' });
  const [activeTab, setActiveTab] = useState<'gps' | 'password' | 'system'>('gps');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleForceSync = async () => {
    if (!window.confirm('Are you sure you want to execute the Master Cloud Sync?\n\nThis will fetch ALL active records from the sister system and merge them permanently into this database.')) return;
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/sync-sister-permanent`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert(res.data.message || 'Cloud fusion successful!');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Sister Sync Failed. Please check server logs.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/branches`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setBranches(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const addBranch = async () => {
    if (!newBranch.name || !newBranch.lat || !newBranch.lng) return alert('Fill name, lat, and lng');
    setSaving(true);
    try {
      await axios.post(`${API}/branches`, newBranch, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setNewBranch({ name: '', lat: '', lng: '', radius: '100' });
      await fetchBranches();
    } catch (e) {
      alert('Failed to add branch');
    } finally { setSaving(false); }
  };

  const deleteBranch = async (id: number) => {
    if (!window.confirm('Delete this location permanently?')) return;
    try {
      await axios.delete(`${API}/branches/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      await fetchBranches();
    } catch (e) {
      alert('Failed to delete');
    }
  };

  const loadBranchToEdit = (b: any) => {
    setNewBranch({ name: b.name, lat: b.lat.toString(), lng: b.lng.toString(), radius: b.radius.toString() });
    // Scroll slightly to give feedback
    document.getElementById('new-branch-form-header')?.scrollIntoView({ behavior: 'smooth' });
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
        <div className="flex border-b mb-4 flex-shrink-0 text-[11px] xs:text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
          <button onClick={() => setActiveTab('gps')} className={`flex-1 py-2 font-bold px-2 ${activeTab === 'gps' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}>Dynamic Locations</button>
          <button onClick={() => setActiveTab('password')} className={`flex-1 py-2 font-bold px-2 ${activeTab === 'password' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}>Change Password</button>
          <button onClick={() => setActiveTab('system')} className={`flex-1 py-2 font-bold px-2 ${activeTab === 'system' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-400 hover:text-orange-500'} transition-colors`}>⚡ Cloud Sync</button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'gps' ? (
            <div className="space-y-6">
              {/* Saved Branches List */}
              <div>
                <h3 className="text-sm font-black text-gray-700 uppercase mb-3 tracking-wider">SAVED BRANCHES</h3>
                {loading ? <p className="text-xs text-gray-500 italic">Loading locations...</p> : branches.length === 0 ? (
                  <p className="text-sm text-gray-400 bg-gray-50 p-3 rounded border border-dashed text-center">No branches configured yet.</p>
                ) : (
                  <div className="space-y-2">
                    {branches.map((b) => (
                      <div key={b.id} className="flex justify-between items-center p-3 bg-blue-50 border border-blue-100 rounded-lg shadow-sm hover:bg-blue-100 transition-colors group">
                        <div>
                          <p className="font-extrabold text-blue-800 text-sm">{b.name}</p>
                          <p className="text-[10px] text-blue-600/70 font-mono">{b.lat}, {b.lng} (Radius: {b.radius}m)</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => loadBranchToEdit(b)}
                            className="text-blue-600 hover:text-blue-800 p-1.5 bg-white/50 hover:bg-blue-100 rounded transition-all border border-blue-100"
                            title="Edit Branch"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => deleteBranch(b.id)}
                            className="text-red-400 hover:text-red-700 p-1.5 bg-white/50 hover:bg-red-50 rounded transition-all border border-red-100"
                            title="Delete Branch"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <hr className="border-gray-200" />

              {/* Add New Branch Form */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-inner">
                <h4 id="new-branch-form-header" className="text-sm font-black text-emerald-700 mb-3 border-b border-emerald-200 pb-1 uppercase tracking-wide flex justify-between items-center">
                  <span>Add or Update Institute Branch</span>
                  {newBranch.name && <span className="text-[9px] bg-emerald-200 px-1.5 py-0.5 rounded animate-pulse text-emerald-800">Editing Mode</span>}
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-emerald-600 mb-1 uppercase">Branch Name</label>
                    <input value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} className="w-full border border-emerald-200 rounded px-3 py-2 bg-white font-bold text-gray-700" placeholder="e.g., INDIRANAGAR" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-emerald-600 mb-1 uppercase">Latitude</label>
                      <input value={newBranch.lat} onChange={e => setNewBranch({...newBranch, lat: e.target.value})} className="w-full border border-emerald-200 rounded px-3 py-2 bg-white font-mono text-sm" placeholder="12.9716" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-emerald-600 mb-1 uppercase">Longitude</label>
                      <input value={newBranch.lng} onChange={e => setNewBranch({...newBranch, lng: e.target.value})} className="w-full border border-emerald-200 rounded px-3 py-2 bg-white font-mono text-sm" placeholder="77.5946" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-emerald-600 mb-1 uppercase">Validation Radius (Meters)</label>
                    <input type="number" value={newBranch.radius} onChange={e => setNewBranch({...newBranch, radius: e.target.value})} className="w-full border border-emerald-200 rounded px-3 py-2 bg-white text-sm" placeholder="100" />
                  </div>

                  <button onClick={addBranch} disabled={saving} className="w-full mt-2 bg-emerald-600 text-white py-3 rounded-lg font-black tracking-wide shadow-md hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                    {saving ? 'UPDATING...' : <span>💾 {branches.some(b => b.name.toUpperCase() === newBranch.name.trim().toUpperCase()) ? 'SAVE CHANGES' : 'REGISTER NEW BRANCH'}</span>}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">CURRENT PASSWORD</label><input type="password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">NEW PASSWORD</label><input type="password" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
              <button onClick={changePassword} disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold tracking-wide mt-2">{saving ? 'Updating...' : 'Update Admin Password'}</button>
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-500" />
                <h3 className="text-lg font-black text-orange-800 flex items-center gap-2 mb-2">
                  ⚡ Master Cloud Synchronization
                </h3>
                <p className="text-xs text-orange-700/90 font-semibold leading-relaxed mb-6">
                  This command executes a permanent database fusion. It queries all records from the sister system for this month and merges them physically into this local server. Run this if you want to safely transition from the old platform.
                </p>
                
                <button 
                  onClick={handleForceSync} 
                  disabled={syncing}
                  className={`w-full py-4 rounded-lg font-black text-sm uppercase tracking-wider shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                    syncing 
                      ? 'bg-orange-200 text-orange-600 border border-orange-300 cursor-not-allowed animate-pulse' 
                      : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 hover:shadow-lg hover:-translate-y-0.5'
                  }`}
                >
                  {syncing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                      Fusing Datasets...
                    </>
                  ) : 'Execute Permanent Data Sync Now'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 italic text-center font-bold tracking-tight">Note: This operation utilizes advanced upsert logic ensuring local records are protected.</p>
            </div>
          )}
        </div>

        <div className="pt-4 mt-2 border-t flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 text-gray-500 hover:text-gray-800 text-sm font-bold transition-colors">DONE & CLOSE</button>
        </div>
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

// ── View Onboarding Profile Modal ──────────────────────────────────────────────
const ViewOnboardingProfileModal = ({ trainee, onClose }: { trainee: Trainee; onClose: () => void }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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
      const fileName = `${profile?.id || 'user'}_${fieldName}_${Date.now()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { data, error } = await supabase.storage
        .from('nict-onboarding')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

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

  const educationOptions = ['Undergraduate', 'Postgraduate', 'Diploma', 'Doctorate'];
  const classificationOptions = ['Full-time', 'Part-time', 'Contract', 'Temporary'];

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/user/${trainee.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = async (field: 'educationCompleted' | 'subClassification', value: string) => {
    try {
      const token = localStorage.getItem('token');
      setProfile((prev: any) => ({ ...prev, [field]: value }));
      
      await axios.put(`${API}/user/${trainee.id}`, {
        [field]: value
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Failed to save field', err);
      alert('Failed to save field change');
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.put(`${API}/user/${trainee.id}`, {
        fullName: profile.fullName,
        fatherName: profile.fatherName,
        motherName: profile.motherName,
        email: profile.email,
        photoUrl: profile.photoUrl,
        dateOfJoining: profile.dateOfJoining,
        officeTimings: profile.officeTimings,
        educationCompleted: profile.educationCompleted,
        subClassification: profile.subClassification,
        presentAddress: profile.presentAddress,
        permanentAddress: profile.permanentAddress,
        aadhaarNumber: profile.aadhaarNumber,
        panNumber: profile.panNumber,
        bankName: profile.bankName,
        bankAccountNo: profile.bankAccountNo,
        bankIfscCode: profile.bankIfscCode,
        bankBranchName: profile.bankBranchName,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactMobile: profile.emergencyContactMobile
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Profile updated successfully!');
      setIsEditing(false);
      fetchProfile();
    } catch (err: any) {
      console.error(err);
      alert('Failed to save profile changes');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto text-left">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        <div className="absolute right-12 top-3.5 flex items-center gap-2">
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded text-xs font-bold transition-all active:scale-95"
          >
            <Edit size={14} /> {isEditing ? 'Cancel Edit' : 'Edit Profile'}
          </button>
        </div>
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-3 text-purple-700">
          👤 {trainee.name}'s Onboarding Profile
        </h3>

        {loading ? (
          <p className="text-gray-500 py-8 text-center animate-pulse">Loading profile details...</p>
        ) : !profile ? (
          <p className="text-gray-500 py-8 text-center">No onboarding profile data found.</p>
        ) : (
          <div className="space-y-6">
            {/* Personal Details */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">1. Personal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Full Name</span>
                  {isEditing ? (
                    <input type="text" value={profile.fullName || ''} onChange={e => setProfile({...profile, fullName: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.fullName || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Father's Name</span>
                  {isEditing ? (
                    <input type="text" value={profile.fatherName || ''} onChange={e => setProfile({...profile, fatherName: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.fatherName || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Mother's Name</span>
                  {isEditing ? (
                    <input type="text" value={profile.motherName || ''} onChange={e => setProfile({...profile, motherName: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.motherName || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Mobile Number</span>
                  {isEditing ? (
                    <input type="text" value={profile.identifier || ''} onChange={e => setProfile({...profile, identifier: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.identifier || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Email ID</span>
                  {isEditing ? (
                    <input type="email" value={profile.email || ''} onChange={e => setProfile({...profile, email: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.email || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Profile Photo</span>
                  {isEditing ? (
                    <div className="mt-1">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFileUpload(e, 'photoUrl')} 
                        disabled={uploadingField === 'photoUrl'}
                        className="w-full text-xs font-semibold text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-all cursor-pointer"
                      />
                      {uploadingField === 'photoUrl' && <p className="text-[10px] text-purple-600 animate-pulse mt-1">⏳ Uploading...</p>}
                    </div>
                  ) : null}
                  <FilePreview url={profile.photoUrl} label="Profile Photo" />
                </div>
              </div>
            </div>

            {/* Onboarding Details */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">2. Onboarding Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Date of Joining NICT</span>
                  {isEditing ? (
                    <input type="date" value={profile.dateOfJoining || ''} onChange={e => setProfile({...profile, dateOfJoining: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.dateOfJoining || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Office Timings with Cycle</span>
                  {isEditing ? (
                    <textarea value={profile.officeTimings || ''} onChange={e => setProfile({...profile, officeTimings: e.target.value})} rows={2}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1 resize-none" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1 whitespace-pre-wrap">{profile.officeTimings || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Education Completed</span>
                  <ChipInput 
                    value={profile.educationCompleted || ''} 
                    onChange={val => {
                      setProfile({ ...profile, educationCompleted: val });
                      if (!isEditing) {
                        handleFieldChange('educationCompleted', val);
                      }
                    }}
                    placeholder="Type degree & press Enter"
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Subjects / Modules classes that you can take</span>
                  <ChipInput 
                    value={profile.subClassification || ''} 
                    onChange={val => {
                      setProfile({ ...profile, subClassification: val });
                      if (!isEditing) {
                        handleFieldChange('subClassification', val);
                      }
                    }}
                    placeholder="Type module & press Enter"
                    disabled={!isEditing}
                  />
                </div>
                <div className="md:col-span-2">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Present Address</span>
                  {isEditing ? (
                    <textarea value={profile.presentAddress || ''} onChange={e => setProfile({...profile, presentAddress: e.target.value})} rows={2}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1 resize-none" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.presentAddress || '--'}</span>
                  )}
                </div>
                <div className="md:col-span-2">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Permanent Address</span>
                  {isEditing ? (
                    <textarea value={profile.permanentAddress || ''} onChange={e => setProfile({...profile, permanentAddress: e.target.value})} rows={2}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1 resize-none" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.permanentAddress || '--'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Identification Documents */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">3. Document Identification</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Aadhaar Number</span>
                  {isEditing ? (
                    <input type="text" value={profile.aadhaarNumber || ''} onChange={e => setProfile({...profile, aadhaarNumber: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.aadhaarNumber || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Aadhaar Document</span>
                  {isEditing ? (
                    <div className="mt-1">
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        onChange={(e) => handleFileUpload(e, 'aadhaarPhotoUrl')} 
                        disabled={uploadingField === 'aadhaarPhotoUrl'}
                        className="w-full text-xs font-semibold text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-all cursor-pointer"
                      />
                      {uploadingField === 'aadhaarPhotoUrl' && <p className="text-[10px] text-purple-600 animate-pulse mt-1">⏳ Uploading...</p>}
                    </div>
                  ) : null}
                  <FilePreview url={profile.aadhaarPhotoUrl} label="Aadhaar Document" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">PAN Number</span>
                  {isEditing ? (
                    <input type="text" value={profile.panNumber || ''} onChange={e => setProfile({...profile, panNumber: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.panNumber || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">PAN Document</span>
                  {isEditing ? (
                    <div className="mt-1">
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        onChange={(e) => handleFileUpload(e, 'panPhotoUrl')} 
                        disabled={uploadingField === 'panPhotoUrl'}
                        className="w-full text-xs font-semibold text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-all cursor-pointer"
                      />
                      {uploadingField === 'panPhotoUrl' && <p className="text-[10px] text-purple-600 animate-pulse mt-1">⏳ Uploading...</p>}
                    </div>
                  ) : null}
                  <FilePreview url={profile.panPhotoUrl} label="PAN Document" />
                </div>
              </div>
            </div>

            {/* Bank Information */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">4. Bank Account Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Bank Name</span>
                  {isEditing ? (
                    <input type="text" value={profile.bankName || ''} onChange={e => setProfile({...profile, bankName: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.bankName || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Account Number</span>
                  {isEditing ? (
                    <input type="text" value={profile.bankAccountNo || ''} onChange={e => setProfile({...profile, bankAccountNo: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.bankAccountNo || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">IFSC Code</span>
                  {isEditing ? (
                    <input type="text" value={profile.bankIfscCode || ''} onChange={e => setProfile({...profile, bankIfscCode: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.bankIfscCode || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Branch Name</span>
                  {isEditing ? (
                    <input type="text" value={profile.bankBranchName || ''} onChange={e => setProfile({...profile, bankBranchName: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.bankBranchName || '--'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Contacts */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">5. Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Contact Name</span>
                  {isEditing ? (
                    <input type="text" value={profile.emergencyContactName || ''} onChange={e => setProfile({...profile, emergencyContactName: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.emergencyContactName || '--'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Contact Mobile Number</span>
                  {isEditing ? (
                    <input type="text" value={profile.emergencyContactMobile || ''} onChange={e => setProfile({...profile, emergencyContactMobile: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs font-semibold outline-none bg-white focus:ring-2 focus:ring-purple-500 text-gray-700 mt-1" />
                  ) : (
                    <span className="font-semibold text-gray-800 block mt-1">{profile.emergencyContactMobile || '--'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button */}
            {isEditing && (
              <div className="flex justify-end pt-4 border-t mt-4">
                <button 
                  onClick={handleSaveAll} 
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded text-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? '⏳ Saving...' : '💾 Save Profile'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Dropdown Options Management Modal ──────────────────────────────────────────
const DropdownOptionsModal = ({ onClose }: { onClose: () => void }) => {
  const [options, setOptions] = useState<any[]>([]);
  const [type, setType] = useState<'EDUCATION' | 'CLASSIFICATION'>('EDUCATION');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchOptions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/options`, { headers: { Authorization: `Bearer ${token}` } });
      setOptions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return alert('Please enter an option value');
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/options`, { type, value: value.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      setValue('');
      fetchOptions();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add option');
    }
  };

  const handleDeleteOption = async (id: number) => {
    if (!confirm('Are you sure you want to delete this option?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/options/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchOptions();
    } catch (err) {
      alert('Failed to delete option');
    }
  };

  const educations = options.filter(o => o.type === 'EDUCATION');
  const classifications = options.filter(o => o.type === 'CLASSIFICATION');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[70vh] flex flex-col overflow-hidden relative">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold flex items-center gap-2">📋 Manage Dropdown Options</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
          {/* Add Form */}
          <div className="flex-1">
            <h3 className="font-bold mb-4 text-sm text-gray-700">Add New Option</h3>
            <form onSubmit={handleAddOption} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Dropdown Type</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full border p-2 rounded text-sm bg-white">
                  <option value="EDUCATION">Education Completed</option>
                  <option value="CLASSIFICATION">Sub-Classification</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Option Value</label>
                <input type="text" required value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. Postgraduate, Part-time"
                  className="w-full border p-2 rounded text-sm" />
              </div>
              <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded text-xs transition-colors">
                Add Option
              </button>
            </form>
          </div>

          {/* List of active options */}
          <div className="flex-1 border-l pl-0 md:pl-6 flex flex-col min-h-0">
            <h3 className="font-bold mb-4 text-sm text-gray-700">Active Options</h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              <div>
                <h4 className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-2">Education Completed</h4>
                {educations.length === 0 ? <p className="text-xs text-gray-400">No options</p> : (
                  <div className="space-y-1">
                    {educations.map(o => (
                      <div key={o.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border text-xs">
                        <span>{o.value}</span>
                        <button onClick={() => handleDeleteOption(o.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-2 mt-4">Sub Classification</h4>
                {classifications.length === 0 ? <p className="text-xs text-gray-400">No options</p> : (
                  <div className="space-y-1">
                    {classifications.map(o => (
                      <div key={o.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border text-xs">
                        <span>{o.value}</span>
                        <button onClick={() => handleDeleteOption(o.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
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
  const [editNoticeId, setEditNoticeId] = useState<number | null>(null);
  const [noticeTab, setNoticeTab] = useState<'active' | 'previous'>('active');

  const todayStr = new Date().toISOString().split('T')[0];
  const activeNotices = notices.filter(n => n.toDate.split('T')[0] >= todayStr);
  const previousNotices = notices.filter(n => n.toDate.split('T')[0] < todayStr);

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
      const payload = { message, fromDate, toDate, userId: userId ? Number(userId) : null };
      
      if (editNoticeId) {
        await axios.put(`${API}/notices/${editNoticeId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API}/notices`, payload, { headers: { Authorization: `Bearer ${token}` } });
      }
      
      setMessage(''); setFromDate(''); setToDate(''); setUserId(''); setEditNoticeId(null);
      fetchNotices();
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to ${editNoticeId ? 'update' : 'add'} notice`);
    }
  };

  const handleEditClick = (n: any) => {
    setEditNoticeId(n.id);
    setMessage(n.message);
    setFromDate(n.fromDate.split('T')[0]);
    setToDate(n.toDate.split('T')[0]);
    setUserId(n.userId ? String(n.userId) : '');
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
            <h3 className="font-bold mb-4">{editNoticeId ? 'Update Notice' : 'Add New Notice'}</h3>
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
              <div className="flex gap-2 mt-2">
                <button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded transition-colors">
                  {editNoticeId ? 'Update Notice' : 'Send Notice'}
                </button>
                {editNoticeId && (
                  <button type="button" onClick={() => { setEditNoticeId(null); setMessage(''); setFromDate(''); setToDate(''); setUserId(''); }} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex border-b mb-4">
              <button 
                onClick={() => setNoticeTab('active')} 
                className={`px-4 py-2 font-bold text-sm transition-colors ${noticeTab === 'active' ? 'border-b-2 border-teal-600 text-teal-600' : 'text-gray-500'}`}
              >
                Active
              </button>
              <button 
                onClick={() => setNoticeTab('previous')} 
                className={`px-4 py-2 font-bold text-sm transition-colors ${noticeTab === 'previous' ? 'border-b-2 border-teal-600 text-teal-600' : 'text-gray-500'}`}
              >
                Previous
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              {loading ? <p className="text-gray-500">Loading notices...</p> : (
                <div className="space-y-4">
                  {(noticeTab === 'active' ? activeNotices : previousNotices).length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No {noticeTab} notices found.</p>
                  ) : (noticeTab === 'active' ? activeNotices : previousNotices).map(n => (
                    <div key={n.id} className={`border p-4 rounded bg-gray-50 flex justify-between gap-4 ${noticeTab === 'previous' ? 'opacity-70' : ''}`}>
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
                      <div className="flex flex-col gap-2 self-start">
                        <button onClick={() => handleEditClick(n)} className="text-blue-500 hover:bg-blue-100 p-2 rounded">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDeleteNotice(n.id)} className="text-red-500 hover:bg-red-100 p-2 rounded">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

