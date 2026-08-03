import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, Edit, Clock, Key, FileDown, LogOut, CheckCircle, Bell, X, ArrowLeft, Trash2, MapPin, Calendar, Eye, User, Mail, ChevronDown, ChevronUp, GraduationCap, BookOpen, CalendarX, Ban, UserX, UserCheck, FileSpreadsheet, Upload, Plus, Settings, Search, Printer, Banknote, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@supabase/supabase-js';
import QRCodeGeneratorModal from './QRCodeGeneratorModal';


const supabaseUrl = 'https://uzbobbzbbkqzgtjemayu.supabase.co';
const supabaseAnonKey = 'sb_publishable_r0jMviNey66U0tDDtyScEQ_CRmZg-Rr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FilePreview = ({ url, label }: { url: string; label: string }) => {
  if (!url) return <span className="text-gray-400 italic mt-1 block">No {label} uploaded</span>;

  const isPdf = url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf');

  const handleDownload = () => {
    if (isPdf) {
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${label.replace(/\s+/g, '_')}.pdf`);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert("Please allow popups to download/print this document.");
        return;
      }
      printWindow.document.write(`
        <html>
          <head>
            <title>${label}</title>
            <style>
              @page {
                size: auto;
                margin: 10mm;
              }
              body {
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background-color: white;
              }
              img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
              }
              @media print {
                body {
                  margin: 0;
                }
                img {
                  max-width: 100%;
                  max-height: 100%;
                }
              }
            </style>
          </head>
          <body>
            <img src="${url}" />
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="mt-2 border rounded-lg overflow-hidden bg-white shadow-sm max-w-xs transition-all hover:shadow-md">
      <div className="bg-gray-100 px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase border-b flex justify-between items-center">
        <span>{label} Preview</span>
        <div className="flex gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
            👁️ Open
          </a>
          <span className="text-gray-300">|</span>
          <button 
            type="button" 
            onClick={handleDownload} 
            className="text-purple-600 hover:underline bg-transparent border-none cursor-pointer p-0 font-bold"
          >
            ⬇️ PDF
          </button>
        </div>
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
          onBlur={handleBlur}
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
  isDisabled?: boolean; disableReason?: string | null; hasLeft?: boolean;
  fullName?: string;
  professionalFee?: number;
  trainingFee?: number;
  personalLateRate?: number | null;
  personalEarlyRate?: number | null;
  personalAbsentRate?: number | null;
  personalTdsRate?: number | null;
  otherAdditions?: number;
  otherDeductions?: number;
  personalLateDeductionType?: string | null;
  personalLateIntervalValue?: number | null;
  personalEarlyDeductionType?: string | null;
  personalEarlyIntervalValue?: number | null;
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

function convertTo24h(hour: string, min: string, period: string): string {
  let h = parseInt(hour, 10);
  const m = min.padStart(2, '0');
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function calculateDuration12h(outHour: string, outMin: string, outPeriod: string, inHour: string, inMin: string, inPeriod: string): string {
  const out24 = convertTo24h(outHour, outMin, outPeriod);
  const in24 = convertTo24h(inHour, inMin, inPeriod);
  const [hOut, mOut] = out24.split(':').map(Number);
  const [hIn, mIn] = in24.split(':').map(Number);
  let diffMin = (hIn * 60 + mIn) - (hOut * 60 + mOut);
  if (diffMin < 0) diffMin += 24 * 60;
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hrs > 0) {
    return `${hrs} hr ${mins} mins`;
  }
  return `${mins} mins`;
}

function getDurationInHours(outHour: string, outMin: string, outPeriod: string, inHour: string, inMin: string, inPeriod: string): number {
  const out24 = convertTo24h(outHour, outMin, outPeriod);
  const in24 = convertTo24h(inHour, inMin, inPeriod);
  const [hOut, mOut] = out24.split(':').map(Number);
  const [hIn, mIn] = in24.split(':').map(Number);
  let diffMin = (hIn * 60 + mIn) - (hOut * 60 + mOut);
  if (diffMin < 0) diffMin += 24 * 60;
  return Number((diffMin / 60).toFixed(2));
}

function parse12hTime(timeStr: string) {
  if (!timeStr || timeStr === 'On Break' || timeStr === '--') return { hour: '10', min: '00', period: 'AM' };
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM|am|pm)?/i);
  if (match) {
    let hour = match[1];
    let min = match[2];
    let period = match[3] ? match[3].toUpperCase() : 'AM';
    let hNum = parseInt(hour, 10);
    if (hNum > 12) {
      hNum = hNum - 12;
      period = 'PM';
    } else if (hNum === 0) {
      hNum = 12;
      period = 'AM';
    }
    hour = String(hNum);
    return {
      hour: hour.padStart(2, '0'),
      min: min.padStart(2, '0'),
      period
    };
  }
  return { hour: '10', min: '00', period: 'AM' };
}

function parseInDate(inDateStr: string) {
  const parts = inDateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
            <input 
              value={mobile} 
              maxLength={10}
              onChange={(e) => {
                const numericVal = e.target.value.replace(/\D/g, '').slice(0, 10);
                setMobile(numericVal);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* Leave balance input removed */}
          
          <div className="mt-2 border-t pt-4 flex flex-col gap-3">
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
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<any>(null);

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API}/attendance-manual/${trainee.id}?date=${date}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setExistingAttendance(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchExisting();
  }, [date, trainee.id]);

  const formatTime12 = (isoString: string | Date | null | undefined) => {
    if (!isoString) return '--';
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) return '--';
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getRealTimes = () => {
    if (!existingAttendance) return { realIn: '--', realOut: '--' };
    if (slotNo === null) {
      const validRealIns: Date[] = [];
      const validRealOuts: Date[] = [];
      for (let i = 1; i <= 5; i++) {
        const ri = existingAttendance[`realInTime${i}`] || existingAttendance[`inTime${i}`];
        const ro = existingAttendance[`realOutTime${i}`] || existingAttendance[`outTime${i}`];
        if (ri) validRealIns.push(new Date(ri));
        if (ro) validRealOuts.push(new Date(ro));
      }
      const realIn = validRealIns.length > 0 ? new Date(Math.min(...validRealIns.map(d => d.getTime()))) : existingAttendance.inTime;
      const realOut = validRealOuts.length > 0 ? new Date(Math.max(...validRealOuts.map(d => d.getTime()))) : existingAttendance.outTime;
      return {
        realIn: formatTime12(realIn),
        realOut: formatTime12(realOut)
      };
    } else {
      const realIn = existingAttendance[`realInTime${slotNo}`] || existingAttendance[`inTime${slotNo}`];
      const realOut = existingAttendance[`realOutTime${slotNo}`] || existingAttendance[`outTime${slotNo}`];
      return {
        realIn: formatTime12(realIn),
        realOut: formatTime12(realOut)
      };
    }
  };

  const { realIn, realOut } = getRealTimes();

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
        outTime,
        info
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
              <p className="text-[10px] text-gray-400 mt-1 font-semibold">Real: {realIn}</p>
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
              <p className="text-[10px] text-gray-400 mt-1 font-semibold">Real: {realOut}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Info</label>
            <input 
              type="text" 
              placeholder="e.g. Late due to heavy rain, forgot punch, etc."
              value={info} 
              onChange={e => setInfo(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder-gray-400" 
            />
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

// Helper to style printable payslips like the Excel sheet layout
const sharedPayslipStyles = `
  body {
    font-family: 'Calibri', 'Arial', sans-serif;
    color: #000;
    margin: 0;
    padding: 20px;
    background-color: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .payslip-card {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    border: 1px solid #cbd5e1;
    padding: 20px;
    position: relative;
    box-sizing: border-box;
  }
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-12deg);
    font-size: 80px;
    font-weight: 900;
    color: rgba(226, 232, 240, 0.25);
    pointer-events: none;
    z-index: 0;
    letter-spacing: 5px;
  }
  .header-box {
    border: 1px solid #cbd5e1;
    padding: 12px;
    text-align: center;
    position: relative;
    z-index: 1;
  }
  .header-box h2 {
    font-size: 26px;
    color: #1e3b8a;
    margin: 0;
    font-weight: 700;
  }
  .header-box p {
    font-size: 11px;
    color: #475569;
    margin: 4px 0 0 0;
  }
  .header-box a {
    color: #2563eb;
    text-decoration: underline;
    font-size: 11px;
  }
  .title-box {
    border-left: 1px solid #cbd5e1;
    border-right: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    padding: 8px;
    text-align: center;
    background-color: #f8fafc;
    position: relative;
    z-index: 1;
  }
  .title-box h3 {
    font-size: 20px;
    color: #800000;
    margin: 0;
    font-weight: 800;
    letter-spacing: 1px;
  }
  .grid-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border-left: 1px solid #cbd5e1;
    border-right: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    font-size: 12px;
    font-weight: 600;
    align-items: center;
    position: relative;
    z-index: 1;
  }
  .grid-cell-label {
    grid-column: span 3;
    padding: 8px 12px;
    text-align: right;
    background-color: #f8fafc;
    border-right: 1px solid #cbd5e1;
  }
  .grid-cell-month {
    grid-column: span 2;
    padding: 8px;
    text-align: center;
    background-color: #cffafe;
    color: #083344;
    font-weight: 700;
    border-right: 1px solid #cbd5e1;
  }
  .grid-cell-year {
    grid-column: span 1;
    padding: 8px;
    text-align: center;
    background-color: #f8fafc;
  }
  .grid-cell-prof-label {
    grid-column: span 2;
    padding: 8px 12px;
    text-align: right;
    background-color: #f8fafc;
    border-right: 1px solid #cbd5e1;
  }
  .grid-cell-prof-value {
    grid-column: span 4;
    padding: 8px 12px;
    text-align: center;
    color: #1d4ed8;
    font-weight: 800;
  }
  .grid-cell-pan-label {
    grid-column: span 1;
    padding: 8px;
    text-align: right;
    background-color: #f8fafc;
    border-right: 1px solid #cbd5e1;
  }
  .grid-cell-pan-value {
    grid-column: span 2;
    padding: 8px 12px;
    text-align: left;
    border-right: 1px solid #cbd5e1;
  }
  .grid-cell-aadhaar-label {
    grid-column: span 1;
    padding: 8px;
    text-align: right;
    background-color: #f8fafc;
    border-right: 1px solid #cbd5e1;
  }
  .grid-cell-aadhaar-value {
    grid-column: span 2;
    padding: 8px 12px;
    text-align: left;
  }
  .payslip-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    position: relative;
    z-index: 1;
  }
  .payslip-table th, .payslip-table td {
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
    vertical-align: middle;
  }
  .payslip-table th {
    background-color: #f1f5f9;
    color: #800000;
    font-weight: 800;
    text-transform: uppercase;
    text-align: center;
  }
  .payslip-table td.font-medium {
    font-weight: 600;
    color: #334155;
  }
  .payslip-table td.font-bold {
    font-weight: 700;
  }
  .payslip-table td.text-right {
    text-align: right;
  }
  .payslip-table td.text-center {
    text-align: center;
  }
  .payslip-table td.text-red-650, .payslip-table td.text-red-600 {
    color: #b91c1c;
  }
  .payslip-table td.text-gray-700 {
    color: #334155;
  }
  .payslip-table td.text-gray-600 {
    color: #475569;
  }
  .payslip-table td.text-gray-400 {
    color: #94a3b8;
  }
  .payslip-table td.bg-slate-50 {
    background-color: #f8fafc;
    font-size: 9px;
  }
  .payslip-table td.bg-aliceblue {
    background-color: #f0f9ff;
  }
  .payslip-table td.text-blue-800 {
    color: #1e40af;
  }
  .payslip-table td.text-maroon {
    color: #800000;
  }
  .payslip-table td .subtext {
    font-size: 9px;
    color: #64748b;
    display: block;
    font-weight: 500;
    margin-top: 1px;
  }
  .payslip-table tr.totals-row td {
    font-weight: 850;
    background-color: #f8fafc;
  }
  .payslip-table tr.net-row td {
    font-weight: 850;
    font-size: 12px;
  }
  .words-box {
    border-left: 1px solid #cbd5e1;
    border-right: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    padding: 8px 12px;
    font-size: 10px;
    color: #475569;
    position: relative;
    z-index: 1;
  }
  .att-header {
    border-left: 1px solid #cbd5e1;
    border-right: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    background-color: #800000;
    color: #fff;
    font-weight: 800;
    font-size: 11px;
    padding: 6px;
    text-align: center;
    text-transform: uppercase;
    position: relative;
    z-index: 1;
  }
  .att-grid-header {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border-left: 1px solid #cbd5e1;
    border-right: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    background-color: #f8fafc;
    position: relative;
    z-index: 1;
  }
  .att-grid-header div {
    padding: 6px 4px;
  }
  .att-grid-header div:not(:last-child) {
    border-right: 1px solid #cbd5e1;
  }
  .att-grid-values {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border-left: 1px solid #cbd5e1;
    border-right: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    position: relative;
    z-index: 1;
  }
  .att-grid-values div {
    padding: 8px 4px;
  }
  .att-grid-values div:not(:last-child) {
    border-right: 1px solid #cbd5e1;
  }
  .cyan-bg {
    background-color: #e0f7fa;
  }
  .sig-row {
    display: grid;
    grid-template-columns: 1fr;
    margin-top: 40px;
    padding-top: 30px;
    font-size: 11px;
    font-weight: 700;
    position: relative;
    z-index: 1;
  }
  .sig-box {
    text-align: left;
    padding-left: 40px;
  }
  .sig-line {
    width: 180px;
    border-bottom: 1px solid #94a3b8;
    margin: 0 0 6px 0;
  }
  .sig-title {
    color: #64748b;
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 0.5px;
  }
  .page-break {
    page-break-after: always;
    margin-top: 40px;
  }
  .print-btn-container {
    text-align: center;
    margin-bottom: 20px;
  }
  .btn-print {
    background-color: #1e3b8a;
    color: white;
    border: none;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  @media print {
    body {
      padding: 0;
    }
    .print-btn-container {
      display: none;
    }
    .payslip-card {
      border: 1px solid #cbd5e1 !important;
      box-shadow: none !important;
    }
  }
`;

// Helper to generate the exact HTML string for a single trainee payslip
const generateIndividualPayslipHtmlString = (t: any, month: string, inWords: (num: number) => string) => {
  const [y, m] = month.split('-');
  const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-IN', { month: 'long' });

  const isLocked = t.netSalary !== undefined;

  const basicVal = isLocked ? (t.basicSalary || 0) : (t.professionalFee || 0);
  const conveyanceVal = isLocked ? (t.conveyance || 0) : (t.conveyance || 0);
  const foodVal = isLocked ? (t.food || 0) : (t.food || 0);
  const additionsVal = isLocked ? (t.otherAllowance || 0) : (t.otherAdditions || 0);
  const deductionsVal = isLocked ? (t.otherDeductions || 0) : (t.otherDeductions || 0);

  const collegeVisitHours = t.collegeVisitHours || 0;
  const collegeVisitEarnings = t.collegeVisitEarnings || 0;

  const extraClassesHours = t.extraClassesHours || 0;
  const extraClassEarnings = t.extraClassEarnings || 0;

  const otherCenterClassesHours = t.otherCenterClassesHours || 0;
  const otherCenterClassEarnings = t.otherCenterClassEarnings || 0;
  const otherCenterClassesBreakdown = t.otherCenterClassesBreakdown || '';

  const totalLateMinutes = t.totalLateMinutes || 0;
  const lateInstances = t.lateInstances || 0;
  const lateDeduction = t.lateDeduction || 0;

  const totalEarlyMinutes = t.totalEarlyMinutes || 0;
  const earlyInstances = t.earlyInstances || 0;
  const earlyDeduction = t.earlyDeduction || 0;

  const absentDays = t.absentDays || 0;
  const absentDeduction = t.absentDeduction || 0;

  const unpaidApprovedLeaves = t.unpaidApprovedLeaves || 0;
  const unpaidApprovedLeavesDeduction = t.unpaidApprovedLeavesDeduction || 0;

  const approvedLeavesCount = t.approvedLeavesCount || 0;
  const paidLeavesLimit = t.paidLeavesLimit || 0;

  const tdsVal = isLocked ? (t.tds || 0) : (t.tdsDeduction || 0);
  const tdsPercentage = t.tdsPercentage || 10;

  const grossEarnings = basicVal + conveyanceVal + foodVal + additionsVal + collegeVisitEarnings + extraClassEarnings + otherCenterClassEarnings;
  const grossDeductions = deductionsVal + tdsVal + lateDeduction + earlyDeduction + absentDeduction + unpaidApprovedLeavesDeduction;
  const netTakeHome = Math.max(0, grossEarnings - grossDeductions);

  return `
    <div class="payslip-card">
      <div class="watermark">NICT</div>
      
      <div class="header-box">
        <h2>NICT Computer Education</h2>
        <p><a href="mailto:info@nictcomputereducation.com">info@nictcomputereducation.com</a></p>
      </div>

      <div class="title-box">
        <h3>NICT Pay Slip</h3>
      </div>

      <div class="grid-row">
        <div class="grid-cell-label">for the month of:</div>
        <div class="grid-cell-month">${monthName}</div>
        <div class="grid-cell-year">${y}</div>
      </div>

      <div class="grid-row">
        <div class="grid-cell-prof-label">Name of the Professional:</div>
        <div class="grid-cell-prof-value">${t.fullName}</div>
      </div>

      <div class="grid-row">
        <div class="grid-cell-pan-label">PAN No:</div>
        <div class="grid-cell-pan-value">
          ${t.panNo || t.pan || '--'}
        </div>
        <div class="grid-cell-pan-label" style="border-left: 1px solid #cbd5e1;">Aadhaar No:</div>
        <div class="grid-cell-pan-value" style="border-right: none;">
          ${t.aadhaarNo || t.aadhaar || '--'}
        </div>
      </div>

      <table class="payslip-table">
        <thead>
          <tr>
            <th colspan="2" style="border-right: 1px solid #cbd5e1;">Earnings</th>
            <th colspan="4">Deductions</th>
          </tr>
        </thead>
        <tbody>
          <!-- Row 10 -->
          <tr>
            <td class="font-medium">Professional Fee (Basic) :</td>
            <td class="font-bold text-right">₹${basicVal.toLocaleString('en-IN')}</td>
            <td class="font-bold bg-slate-50 text-center">Description</td>
            <td class="font-bold bg-slate-50 text-center">Details</td>
            <td class="font-bold bg-slate-50 text-center">Remarks</td>
            <td class="font-bold bg-slate-50 text-right">Amount</td>
          </tr>
          <!-- Row 11 -->
          <tr>
            <td class="font-medium">
              College Visits
              <span class="subtext">(${collegeVisitHours.toFixed(2)}h)</span>
            </td>
            <td class="font-bold text-right">₹${collegeVisitEarnings.toLocaleString('en-IN')}</td>
            <td class="text-gray-700">Late Arrivals :</td>
            <td class="text-center">${totalLateMinutes}m (${(totalLateMinutes / 60).toFixed(2)}h)</td>
            <td class="text-center">${lateInstances} times</td>
            <td class="font-bold text-right text-red-600">₹${lateDeduction.toLocaleString('en-IN')}</td>
          </tr>
          <!-- Row 12 -->
          <tr>
            <td class="font-medium">Other Additions :</td>
            <td class="font-bold text-right">₹${additionsVal.toLocaleString('en-IN')}</td>
            <td class="text-gray-700">Early Depart :</td>
            <td class="text-center">${totalEarlyMinutes}m (${(totalEarlyMinutes / 60).toFixed(2)}h)</td>
            <td class="text-center">${earlyInstances} times</td>
            <td class="font-bold text-right text-red-600">₹${earlyDeduction.toLocaleString('en-IN')}</td>
          </tr>
          <!-- Row 13 -->
          <tr>
            <td class="font-medium">
              Extra Classes
              <span class="subtext">(${extraClassesHours.toFixed(2)}h)</span>
            </td>
            <td class="font-bold text-right">₹${extraClassEarnings.toLocaleString('en-IN')}</td>
            <td class="text-gray-700">Absence Deduction :</td>
            <td class="text-center">${absentDays} days</td>
            <td class="text-center">Absent</td>
            <td class="font-bold text-right text-red-600">₹${absentDeduction.toLocaleString('en-IN')}</td>
          </tr>
          <!-- Row 14 -->
          <tr>
            <td class="font-medium">
              Other Center Classes
              ${otherCenterClassesBreakdown ? `<span class="subtext">(${otherCenterClassesBreakdown})</span>` : ''}
            </td>
            <td class="font-bold text-right">₹${otherCenterClassEarnings.toLocaleString('en-IN')}</td>
            <td class="text-gray-700">Unpaid Approved Leaves :</td>
            <td class="text-center">${unpaidApprovedLeaves} days</td>
            <td class="text-center">Unpaid</td>
            <td class="font-bold text-right text-red-600">₹${unpaidApprovedLeavesDeduction.toLocaleString('en-IN')}</td>
          </tr>
          <!-- Row 15 -->
          <tr>
            <td class="font-medium">Conveyance Allowance :</td>
            <td class="font-bold text-right">₹${conveyanceVal.toLocaleString('en-IN')}</td>
            <td class="text-gray-700">Approved Leaves :</td>
            <td class="text-center">${approvedLeavesCount} days</td>
            <td class="text-center">Leaves Taken</td>
            <td class="text-right text-gray-600"></td>
          </tr>
          <!-- Row 16 -->
          <tr>
            <td class="font-medium">Food Allowance :</td>
            <td class="font-bold text-right">₹${foodVal.toLocaleString('en-IN')}</td>
            <td colspan="4"></td>
          </tr>
          <!-- Row 17 -->
          <tr>
            <td colspan="2"></td>
            <td colspan="3" class="text-gray-700 font-medium">Other Deductions :</td>
            <td class="font-bold text-right text-red-600">₹${deductionsVal.toLocaleString('en-IN')}</td>
          </tr>
          <!-- Row 18 -->
          <tr>
            <td colspan="2"></td>
            <td colspan="3" class="text-gray-700 font-medium">Tax Deducted at Source (TDS, ${tdsPercentage}%) :</td>
            <td class="font-bold text-right text-red-600">₹${tdsVal.toLocaleString('en-IN')}</td>
          </tr>

          <!-- Row 17 Totals -->
          <tr class="totals-row">
            <td class="font-bold text-maroon" style="border-right: 1px solid #cbd5e1;">Total Earnings :</td>
            <td class="font-bold text-right" style="border-right: 1px solid #cbd5e1;">₹${grossEarnings.toLocaleString('en-IN')}</td>
            <td colspan="3" class="font-bold text-maroon" style="border-right: 1px solid #cbd5e1;">Total Deductions :</td>
            <td class="font-bold text-right">₹${grossDeductions.toLocaleString('en-IN')}</td>
          </tr>

          <!-- Row 18 Nett Take Home -->
          <tr class="net-row">
            <td colspan="2" class="font-bold text-right" style="border-right: 1px solid #cbd5e1;">Nett Take Home / NEFT done :</td>
            <td colspan="4" class="font-bold text-center text-blue-800 bg-aliceblue text-lg">₹${netTakeHome.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>

      <div class="words-box">
        <strong>Amount in Words:</strong> ${inWords(netTakeHome)}
      </div>

      <div class="att-header">Attendance Details</div>
      
      <div class="att-grid-header" style="grid-template-columns: repeat(4, 1fr) 2fr;">
        <div>Leaves Taken</div>
        <div>Paid Leaves</div>
        <div>Unpaid Approved Leaves</div>
        <div>Absent Days</div>
        <div>Approval Status</div>
      </div>
      
      <div class="att-grid-values" style="grid-template-columns: repeat(4, 1fr) 2fr;">
        <div class="cyan-bg">${approvedLeavesCount}</div>
        <div class="cyan-bg">${paidLeavesLimit}</div>
        <div class="cyan-bg">${unpaidApprovedLeaves}</div>
        <div class="cyan-bg">${absentDays}</div>
        <div style="font-size: 10px; color: #475569; padding-top: 8px;">SK & KK Approved</div>
      </div>

      <div class="sig-row">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">Kushal Pabbi (Authorised Signatory)</div>
        </div>
      </div>
    </div>
  `;
};

// Handle printing/PDF of payslip (defined globally to be shared across dashboard and modals)
const handlePrintPayslip = (t: any, month: string) => {
  // Generate simple number to words in English (Indian numbering system)
  const inWords = (num: number): string => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if ((num = Math.floor(num)) === 0) return 'zero';
    
    const g = (n: number): string => {
      if (n < 20) return a[n];
      const digit = n % 10;
      return b[Math.floor(n / 10)] + (digit !== 0 ? '-' + a[digit] : '');
    };
    
    const convert = (n: number): string => {
      let str = '';
      if (n >= 10000000) {
        str += convert(Math.floor(n / 10000000)) + ' crore ';
        n %= 10000000;
      }
      if (n >= 100000) {
        str += convert(Math.floor(n / 100000)) + ' lakh ';
        n %= 100000;
      }
      if (n >= 1000) {
        str += convert(Math.floor(n / 1000)) + ' thousand ';
        n %= 100;
      }
      if (n >= 100) {
        str += g(Math.floor(n / 100)) + ' hundred ';
        n %= 100;
      }
      if (n > 0) {
        if (str !== '') str += 'and ';
        str += g(n);
      }
      return str;
    };
    
    const res = convert(num).trim();
    return res.charAt(0).toUpperCase() + res.slice(1) + ' Rupees Only';
  };

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Please allow popups to download/print the payslip.");
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Payslip_${t.fullName}_${month}</title>
        <style>${sharedPayslipStyles}</style>
      </head>
      <body>
        <div class="print-btn-container">
          <button class="btn-print" onclick="window.print()">Print Payslip / Save PDF</button>
        </div>
        ${generateIndividualPayslipHtmlString(t, month, inWords)}
        <script>
          window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => { window.print(); }, 500);
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

const OnScreenPayslipCard = ({ data, month }: { data: any; month: string }) => {
  const [y, m] = month.split('-');
  const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-IN', { month: 'long' });

  const hasStoredSlip = data.storedSlip !== undefined && data.storedSlip !== null;
  const isLocked = hasStoredSlip;

  const basicVal = isLocked ? (data.storedSlip.basicSalary || 0) : (data.salaryData?.professionalFee || 0);
  const conveyanceVal = isLocked ? (data.storedSlip.conveyance || 0) : (data.salaryData?.conveyance || 0);
  const foodVal = isLocked ? (data.storedSlip.food || 0) : (data.salaryData?.food || 0);
  const additionsVal = isLocked ? (data.storedSlip.otherAllowance || 0) : (data.salaryData?.otherAdditions || 0);
  const deductionsVal = isLocked ? (data.storedSlip.otherDeductions || 0) : (data.salaryData?.otherDeductions || 0);

  const collegeVisitHours = data.salaryData?.collegeVisitHours || 0;
  const collegeVisitEarnings = data.salaryData?.collegeVisitEarnings || 0;

  const extraClassesHours = data.salaryData?.extraClassesHours || 0;
  const extraClassEarnings = data.salaryData?.extraClassEarnings || 0;

  const otherCenterClassesHours = data.salaryData?.otherCenterClassesHours || 0;
  const otherCenterClassEarnings = data.salaryData?.otherCenterClassEarnings || 0;
  const otherCenterClassesBreakdown = data.salaryData?.otherCenterClassesBreakdown || '';

  const totalLateMinutes = data.salaryData?.totalLateMinutes || 0;
  const lateInstances = data.salaryData?.lateInstances || 0;
  const lateDeduction = data.salaryData?.lateDeduction || 0;

  const totalEarlyMinutes = data.salaryData?.totalEarlyMinutes || 0;
  const earlyInstances = data.salaryData?.earlyInstances || 0;
  const earlyDeduction = data.salaryData?.earlyDeduction || 0;

  const absentDays = data.salaryData?.absentDays || 0;
  const absentDeduction = data.salaryData?.absentDeduction || 0;

  const unpaidApprovedLeaves = data.salaryData?.unpaidApprovedLeaves || 0;
  const unpaidApprovedLeavesDeduction = data.salaryData?.unpaidApprovedLeavesDeduction || 0;

  const approvedLeavesCount = data.salaryData?.approvedLeavesCount || 0;
  const paidLeavesLimit = data.salaryData?.paidLeavesLimit || 0;

  const tdsVal = isLocked ? (data.storedSlip.tds || 0) : (data.salaryData?.tdsDeduction || 0);
  const tdsPercentage = data.salaryData?.tdsPercentage || 10;

  const grossEarnings = basicVal + conveyanceVal + foodVal + additionsVal + collegeVisitEarnings + extraClassEarnings + otherCenterClassEarnings;
  const grossDeductions = deductionsVal + tdsVal + lateDeduction + earlyDeduction + absentDeduction + unpaidApprovedLeavesDeduction;
  const netTakeHome = Math.max(0, grossEarnings - grossDeductions);

  const inWords = (num: number): string => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if ((num = Math.floor(num)) === 0) return 'zero';
    
    const g = (n: number): string => {
      if (n < 20) return a[n];
      const digit = n % 10;
      return b[Math.floor(n / 10)] + (digit !== 0 ? '-' + a[digit] : '');
    };
    
    const convert = (n: number): string => {
      let str = '';
      if (n >= 10000000) {
        str += convert(Math.floor(n / 10000000)) + ' crore ';
        n %= 10000000;
      }
      if (n >= 100000) {
        str += convert(Math.floor(n / 100000)) + ' lakh ';
        n %= 100000;
      }
      if (n >= 1000) {
        str += convert(Math.floor(n / 1000)) + ' thousand ';
        n %= 1000;
      }
      if (n >= 100) {
        str += g(Math.floor(n / 100)) + ' hundred ';
        n %= 100;
      }
      if (n > 0) {
        if (str !== '') str += 'and ';
        str += g(n);
      }
      return str;
    };
    
    const res = convert(num).trim();
    return res.charAt(0).toUpperCase() + res.slice(1) + ' Rupees Only';
  };

  return (
    <div className="bg-white text-gray-900 border border-gray-300 p-8 shadow-md rounded-md w-full max-w-[800px] font-sans relative my-4">
      {/* Watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 text-7xl font-extrabold text-gray-200/20 select-none pointer-events-none tracking-widest z-0">
        NICT
      </div>

      {/* Header Table */}
      <div className="border border-gray-300 p-4 text-center relative z-10">
        <h2 className="text-2xl font-bold text-blue-900 tracking-wide m-0">NICT Computer Education</h2>
        <p className="text-xs text-blue-600 underline m-0 mt-1">
          <a href="mailto:info@nictcomputereducation.com">info@nictcomputereducation.com</a>
        </p>
      </div>

      {/* Document Title */}
      <div className="border-x border-b border-gray-300 py-3 text-center bg-gray-50 relative z-10">
        <h3 className="text-xl font-extrabold text-[#800000] tracking-wider uppercase m-0">NICT Pay Slip</h3>
      </div>

      {/* Month Line */}
      <div className="grid grid-cols-6 border-x border-b border-gray-300 text-sm font-semibold relative z-10">
        <div className="col-span-3 py-2 px-3 text-right bg-gray-50 border-r border-gray-300">
          for the month of:
        </div>
        <div className="col-span-2 py-2 px-3 text-center bg-cyan-100 text-cyan-900 font-bold border-r border-gray-300">
          {monthName}
        </div>
        <div className="col-span-1 py-2 px-3 text-center bg-gray-50">
          {y}
        </div>
      </div>

      {/* Employee Name Line */}
      <div className="grid grid-cols-6 border-x border-b border-gray-300 text-sm font-semibold relative z-10">
        <div className="col-span-2 py-2 px-3 text-right bg-gray-50 border-r border-gray-300">
          Name of the Professional:
        </div>
        <div className="col-span-4 py-2 px-3 text-center text-blue-700 font-extrabold">
          {data.user.fullName}
        </div>
      </div>

      {/* PAN / Aadhaar line */}
      <div className="grid grid-cols-6 border-x border-b border-gray-300 text-xs font-semibold relative z-10">
        <div className="col-span-1 py-2 px-2 text-right bg-gray-50 border-r border-gray-300">
          PAN No:
        </div>
        <div className="col-span-2 py-2 px-3 text-left border-r border-gray-300">
          {isLocked ? (data.storedSlip.pan || '--') : (data.salaryData?.panNo || '--')}
        </div>
        <div className="col-span-1 py-2 px-2 text-right bg-gray-50 border-r border-gray-300 border-l">
          Aadhaar No:
        </div>
        <div className="col-span-2 py-2 px-3 text-left">
          {isLocked ? (data.storedSlip.aadhaar || '--') : (data.salaryData?.aadhaarNo || '--')}
        </div>
      </div>

      {/* 6-Column Grid Table */}
      <style dangerouslySetInnerHTML={{ __html: `
        .payslip-table {
          width: 100% !important;
          border-collapse: collapse !important;
          font-size: 11px !important;
          font-family: 'Calibri', 'Arial', sans-serif !important;
          position: relative !important;
          z-index: 1 !important;
        }
        .payslip-table th, .payslip-table td {
          border: 1px solid #cbd5e1 !important;
          padding: 8px 10px !important;
          vertical-align: middle !important;
          line-height: normal !important;
        }
        .payslip-table th {
          background-color: #f1f5f9 !important;
          color: #800000 !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          text-align: center !important;
        }
        .payslip-table td span {
          display: block !important;
          font-size: 9px !important;
          color: #64748b !important;
          margin-top: 2px !important;
          line-height: normal !important;
          font-weight: 500 !important;
        }
      `}} />
      <div className="relative z-10 mt-0">
        <table className="payslip-table">
          <thead>
            <tr>
              <th colSpan={2} style={{ borderRight: '1px solid #cbd5e1' }}>Earnings</th>
              <th colSpan={4}>Deductions</th>
            </tr>
          </thead>
          <tbody>
            {/* Row 10 */}
            <tr>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-semibold text-slate-700">Professional Fee (Basic) :</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-bold text-right">₹{basicVal.toLocaleString('en-IN')}</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-bold bg-slate-50 text-center text-[9px]">Description</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-bold bg-slate-50 text-center text-[9px]">Details</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-bold bg-slate-50 text-center text-[9px]">Remarks</td>
              <td className="border-b border-gray-300 py-2 px-2.5 font-bold bg-slate-50 text-right text-[9px]">Amount</td>
            </tr>
            {/* Row 11 */}
            <tr>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-semibold text-slate-700">
                College Visits
                <span className="text-[9px] text-slate-500 block font-medium mt-0.5">({collegeVisitHours.toFixed(2)}h)</span>
              </td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-bold text-right">₹{collegeVisitEarnings.toLocaleString('en-IN')}</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-slate-700">Late Arrivals :</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-center">{totalLateMinutes}m ({(totalLateMinutes / 60).toFixed(2)}h)</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-center">{lateInstances} times</td>
              <td className="border-b border-gray-300 py-2 px-2.5 font-bold text-right text-red-600">₹{lateDeduction.toLocaleString('en-IN')}</td>
            </tr>
            {/* Row 12 */}
            <tr>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-semibold text-slate-700">Other Additions :</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-bold text-right">₹{additionsVal.toLocaleString('en-IN')}</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-slate-700">Early Depart :</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-center">{totalEarlyMinutes}m ({(totalEarlyMinutes / 60).toFixed(2)}h)</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-center">{earlyInstances} times</td>
              <td className="border-b border-gray-300 py-2 px-2.5 font-bold text-right text-red-600">₹{earlyDeduction.toLocaleString('en-IN')}</td>
            </tr>
            {/* Row 13 */}
            <tr>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-semibold text-slate-700">
                Extra Classes
                <span className="text-[9px] text-slate-500 block font-medium mt-0.5">({extraClassesHours.toFixed(2)}h)</span>
              </td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-bold text-right">₹{extraClassEarnings.toLocaleString('en-IN')}</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-slate-700">Absence Deduction :</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-center">{absentDays} days</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-center">Absent</td>
              <td className="border-b border-gray-300 py-2 px-2.5 font-bold text-right text-red-600">₹{absentDeduction.toLocaleString('en-IN')}</td>
            </tr>
            {/* Row 14 */}
            <tr>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-semibold text-slate-700">
                Other Center Classes
                {otherCenterClassesBreakdown && (
                  <span className="text-[9px] text-slate-500 block font-medium mt-0.5">({otherCenterClassesBreakdown})</span>
                )}
              </td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-bold text-right">₹{otherCenterClassEarnings.toLocaleString('en-IN')}</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-slate-700">Unpaid Approved Leaves :</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-center">{unpaidApprovedLeaves} days</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-center">Unpaid</td>
              <td className="border-b border-gray-300 py-2 px-2.5 font-bold text-right text-red-600">₹{unpaidApprovedLeavesDeduction.toLocaleString('en-IN')}</td>
            </tr>
            {/* Row 15 */}
            <tr>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-semibold text-slate-700">Conveyance Allowance :</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-bold text-right">₹{conveyanceVal.toLocaleString('en-IN')}</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-slate-700">Approved Leaves :</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-center">{approvedLeavesCount} days</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-center">Leaves Taken</td>
              <td className="border-b border-gray-300 py-2 px-2.5 text-right text-slate-600"></td>
            </tr>
            {/* Row 16 */}
            <tr>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-semibold text-slate-700">Food Allowance :</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 font-bold text-right">₹{foodVal.toLocaleString('en-IN')}</td>
              <td colSpan={4} className="border-b border-gray-300 py-2 px-2.5"></td>
            </tr>
            {/* Row 17 */}
            <tr>
              <td colSpan={2} className="border-b border-r border-gray-300 py-2 px-2.5"></td>
              <td colSpan={3} className="border-b border-r border-gray-300 py-2 px-2.5 text-slate-700 font-semibold">Other Deductions :</td>
              <td className="border-b border-gray-300 py-2 px-2.5 font-bold text-right text-red-600">₹{deductionsVal.toLocaleString('en-IN')}</td>
            </tr>
            {/* Row 18 */}
            <tr>
              <td colSpan={2} className="border-b border-r border-gray-300 py-2 px-2.5"></td>
              <td colSpan={3} className="border-b border-r border-gray-300 py-2 px-2.5 text-slate-700 font-semibold">Tax Deducted at Source (TDS, {tdsPercentage}%) :</td>
              <td className="border-b border-gray-300 py-2 px-2.5 font-bold text-right text-red-600">₹{tdsVal.toLocaleString('en-IN')}</td>
            </tr>

            {/* Row 17 Totals */}
            <tr className="font-extrabold bg-slate-50">
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-[#800000]">Total Earnings :</td>
              <td className="border-b border-r border-gray-300 py-2 px-2.5 text-right text-gray-900">₹{grossEarnings.toLocaleString('en-IN')}</td>
              <td colSpan={3} className="border-b border-r border-gray-300 py-2 px-2.5 text-[#800000]">Total Deductions :</td>
              <td className="border-b border-gray-300 py-2 px-2.5 text-right text-gray-900">₹{grossDeductions.toLocaleString('en-IN')}</td>
            </tr>

            {/* Row 18 Nett Take Home */}
            <tr className="font-extrabold bg-sky-50">
              <td colSpan={2} className="border-b border-r border-gray-300 py-3 px-2.5 text-right text-slate-700">Nett Take Home / NEFT done :</td>
              <td colSpan={4} className="border-b border-gray-300 py-3 px-2.5 text-center text-blue-800 text-sm">₹{netTakeHome.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Words Box */}
      <div className="border-x border-b border-gray-300 py-2 px-3 text-[10px] text-slate-600 relative z-10">
        <strong>Amount in Words:</strong> {inWords(netTakeHome)}
      </div>

      {/* Attendance Header */}
      <div className="border-x border-b border-gray-300 bg-[#800000] text-white font-extrabold text-[11px] py-1.5 text-center uppercase tracking-wider relative z-10">
        Attendance Details
      </div>

      {/* Attendance Grid */}
      <div className="border-x border-b border-gray-300 text-[10px] text-center font-bold relative z-10 bg-slate-50" style={{ gridTemplateColumns: 'repeat(4, 1fr) 2fr', display: 'grid' }}>
        <div className="border-r border-gray-300 py-1.5">Leaves Taken</div>
        <div className="border-r border-gray-300 py-1.5">Paid Leaves</div>
        <div className="border-r border-gray-300 py-1.5">Unpaid Approved Leaves</div>
        <div className="border-r border-gray-300 py-1.5">Absent Days</div>
        <div className="py-1.5">Approval Status</div>
      </div>
      <div className="border-x border-b border-gray-300 text-xs text-center font-bold relative z-10" style={{ gridTemplateColumns: 'repeat(4, 1fr) 2fr', display: 'grid' }}>
        <div className="bg-[#e0f7fa] border-r border-gray-300 py-2">
          {approvedLeavesCount}
        </div>
        <div className="bg-[#e0f7fa] border-r border-gray-300 py-2">
          {paidLeavesLimit}
        </div>
        <div className="bg-[#e0f7fa] border-r border-gray-300 py-2">
          {unpaidApprovedLeaves}
        </div>
        <div className="bg-[#e0f7fa] border-r border-gray-300 py-2">
          {absentDays}
        </div>
        <div className="py-2 text-slate-500 text-[10px] flex items-center justify-center">SK & KK Approved</div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-1 mt-8 text-xs font-bold pt-10 relative z-10">
        <div className="text-left pl-10">
          <div className="w-48 border-b border-slate-300 mb-1"></div>
          <span className="text-slate-500 uppercase tracking-wider text-[9px]">Kushal Pabbi (Authorised Signatory)</span>
        </div>
      </div>
    </div>
  );
};

// ── Main Admin Dashboard ──────────────────────────────────────────────────────
interface AdminDashboardProps {
  role?: 'ADMIN' | 'SUPERVISOR';
}
const AdminDashboard: React.FC<AdminDashboardProps> = ({ role = 'ADMIN' }) => {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [myPermissions, setMyPermissions] = useState<string[]>([]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.permissions) {
          setMyPermissions(parsed.permissions.split(','));
        }
      } catch (e) {
        console.error('Failed to parse user permissions', e);
      }
    }

    const syncPermissions = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const authApi = API.replace('/admin', '/auth');
        const res = await axios.get(`${authApi}/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.user?.permissions) {
          const latestPerms = res.data.user.permissions.split(',');
          setMyPermissions(latestPerms);
          
          const localUser = localStorage.getItem('user');
          if (localUser) {
            const parsed = JSON.parse(localUser);
            parsed.permissions = res.data.user.permissions;
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        }
      } catch (err) {
        console.error('Failed to sync permissions dynamically', err);
      }
    };
    syncPermissions();
  }, []);

  const hasPermission = (perm: string) => {
    if (role === 'ADMIN') return true;
    return myPermissions.includes(perm);
  };
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
  const [showQRCode, setShowQRCode] = useState(false);
  const [directLeaveUser, setDirectLeaveUser] = useState<Trainee | null>(null);
  const [viewDetailUser, setViewDetailUser] = useState<Trainee | null>(null);
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const [showNotices, setShowNotices] = useState(false);
  const [showDropdownOptions, setShowDropdownOptions] = useState(false);
  const [viewOnboardingUser, setViewOnboardingUser] = useState<Trainee | null>(null);
  const [disableUser, setDisableUser] = useState<Trainee | null>(null);
  const [showMemos, setShowMemos] = useState(false);
  const [showBreaks, setShowBreaks] = useState(false);
  const [showCollegeVisits, setShowCollegeVisits] = useState(false);
  const [showExtraClasses, setShowExtraClasses] = useState(false);
  const [showOtherCenterClasses, setShowOtherCenterClasses] = useState(false);
  const [showCancelledClasses, setShowCancelledClasses] = useState(false);
  const [showLeftNICTians, setShowLeftNICTians] = useState(false);
  const [showSalarySlips, setShowSalarySlips] = useState(false);
  const [showMyPayslips, setShowMyPayslips] = useState(false);
  const [managePayslipUser, setManagePayslipUser] = useState<any | null>(null);
  const [showEarlyLeaves, setShowEarlyLeaves] = useState(false);

  const getMonthFromDate = (dateStr: string) => {
    if (!dateStr) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const month = parts[1];
      const year = parts[2];
      if (year.length === 4 && !isNaN(Number(month))) {
        return `${year}-${month.padStart(2, '0')}`;
      }
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

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
          {role === 'ADMIN' && (
            <button onClick={() => setView('pending')} className="relative ml-2 text-gray-500 hover:text-yellow-500 transition-colors" title="Pending Approvals">
              <Bell size={22} />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
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
          {hasPermission('GEOLOCATION') && (
            <div className="bg-white p-3 rounded shadow-sm border border-blue-100 flex items-center gap-3">
              <MapPin className="text-blue-600" size={24} />
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Geofence Status</p>
                <p className="text-xs font-bold text-green-600">Active & Secure</p>
              </div>
            </div>
          )}
          {hasPermission('DIRECT_LEAVE') && (
            <button onClick={() => setShowLeaves(true)}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-medium transition-colors">
              Leaves
            </button>
          )}
          {hasPermission('DIRECT_LEAVE') && (
            <button onClick={() => setShowEarlyLeaves(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium transition-colors">
              Early Leaves
            </button>
          )}
          {hasPermission('HOLIDAYS') && (
            <button onClick={() => setShowHolidays(true)}
              className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded font-medium transition-colors">
              Holidays
            </button>
          )}
          {hasPermission('NOTICES') && (
            <button onClick={() => setShowNotices(true)}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded font-medium transition-colors">
              Notices
            </button>
          )}
          {hasPermission('DOWNLOAD_REPORT') && (
            <button onClick={() => setShowDailyReport(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium transition-colors">
              <Calendar size={18} /> Daily Report
            </button>
          )}
          {hasPermission('GPS_LOCATION') && (
            <button onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded font-medium transition-colors">
              Add GPS Location
            </button>
          )}
          {role === 'ADMIN' && (
            <button onClick={() => setShowQRCode(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors shadow-sm cursor-pointer">
              <QrCode size={18} /> Static QR Code
            </button>
          )}
          {hasPermission('DOWNLOAD_REPORT') && (
            <button onClick={() => setShowDownload(true)}
              className="flex items-center gap-2 bg-[#1976D2] hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors">
              <Download size={18} /> Download
            </button>
          )}
          {hasPermission('MANAGE_MEMOS') && (
            <button onClick={() => setShowMemos(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-medium transition-colors">
              <Mail size={18} /> {role === 'ADMIN' ? 'Memos' : 'My Memos'}
            </button>
          )}
          {hasPermission('MANAGE_BREAKS') && (
            <button onClick={() => setShowBreaks(true)}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-medium transition-colors">
              <Clock size={18} /> Breaks
            </button>
          )}
          {hasPermission('MANAGE_COLLEGE_VISITS') && (
            <button onClick={() => setShowCollegeVisits(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors">
              <GraduationCap size={18} /> College Visits
            </button>
          )}
          {hasPermission('MANAGE_EXTRA_CLASSES') && (
            <button onClick={() => setShowExtraClasses(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-medium transition-colors">
              <BookOpen size={18} /> Extra Classes
            </button>
          )}
          {hasPermission('MANAGE_OTHER_CENTER_CLASSES') && (
            <button onClick={() => setShowOtherCenterClasses(true)}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded font-medium transition-colors">
              <BookOpen size={18} /> Other Center Classes
            </button>
          )}
          {hasPermission('MANAGE_CANCELLED_CLASSES') && (
            <button onClick={() => setShowCancelledClasses(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium transition-colors">
              <CalendarX size={18} /> Cancelled Classes
            </button>
          )}
          {hasPermission('EDIT_USER') && (
            <button onClick={() => setShowLeftNICTians(true)}
              className="flex items-center gap-2 bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 rounded font-medium transition-colors"
              id="btn-left-nictians"
            >
              <UserX size={18} /> Left NICTians
            </button>
          )}
          {hasPermission('MANAGE_SALARY_SLIPS') && (
            <button onClick={() => setShowSalarySlips(true)}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              💵 Salary Slips
            </button>
          )}
          {role === 'SUPERVISOR' && (
            <button onClick={() => setShowMyPayslips(true)}
              className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              💵 My Payslips
            </button>
          )}
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
                    {hasPermission('VIEW_PROFILE') && <button onClick={() => setViewOnboardingUser(t)} className="text-purple-600 hover:text-purple-800 transition-colors" title="View Onboarding Profile"><User size={16} /></button>}
                    {hasPermission('EDIT_USER') && <button onClick={() => setEditUser(t)} className="text-emerald-600 hover:text-emerald-800 transition-colors" title="Edit User Info"><Edit size={16} /></button>}
                    {hasPermission('UPDATE_SLOTS') && <button onClick={() => setSlotsUser(t)} className="text-green-600 hover:text-green-800 transition-colors" title="Update Slots"><Clock size={16} /></button>}
                    {hasPermission('RESET_PASSWORD') && <button onClick={() => setResetUser(t)} className="text-yellow-600 hover:text-yellow-800 transition-colors" title="Reset Password"><Key size={16} /></button>}
                    {hasPermission('MANUAL_ATTENDANCE') && <button onClick={() => setManualPunchUser(t)} className="text-orange-600 hover:text-orange-800 transition-colors" title="Manual Attendance"><Clock size={16} /></button>}
                    {hasPermission('DIRECT_LEAVE') && <button onClick={() => setDirectLeaveUser(t)} className="text-indigo-600 hover:text-indigo-800 transition-colors" title="Direct Leave"><Calendar size={16} /></button>}
                    {hasPermission('DELETE_USER') && <button onClick={() => setDeleteUser(t)} className="text-red-600 hover:text-red-800 transition-colors" title="Delete User"><Trash2 size={16} /></button>}
                    {hasPermission('VIEW_SLOT_STATUS') && <button onClick={() => setViewDetailUser(t)} className="text-pink-600 hover:text-pink-800 transition-colors" title="View Slot Statuses"><Eye size={16} /></button>}
                    {hasPermission('DOWNLOAD_REPORT') && <button onClick={() => setIndividualReport(t)} className="text-blue-600 hover:text-blue-800 transition-colors" title="Download Report"><FileDown size={16} /></button>}
                    {hasPermission('MANAGE_SALARY_SLIPS') && (
                      <button 
                        onClick={() => {
                          setManagePayslipUser({
                            id: t.id,
                            name: t.name,
                            date: t.date,
                            month: getMonthFromDate(t.date)
                          });
                        }} 
                        className="text-emerald-600 hover:text-emerald-800 transition-colors animate-pulse hover:animate-none" 
                        title="Manage Monthly Pay Slip"
                      >
                        <Banknote size={16} />
                      </button>
                    )}
                    {hasPermission('EDIT_USER') && (
                      <button
                        onClick={() => setDisableUser(t)}
                        className={`${t.isDisabled ? 'text-yellow-600 hover:text-yellow-800 font-bold' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
                        title={t.isDisabled ? 'Reactivate / View Disable Logs' : 'Temporarily Disable Account'}
                      >
                        <Ban size={16} />
                      </button>
                    )}
                    {hasPermission('EDIT_USER') && (
                      <button
                        onClick={async () => {
                          const actionText = t.hasLeft ? 'Reactivate User' : 'Mark as Left Institute';
                          if (!confirm(`Are you sure you want to: ${actionText} for ${t.name}?`)) return;
                          try {
                            const token = localStorage.getItem('token');
                            await axios.post(`${API}/user/${t.id}/mark-left`, { hasLeft: !t.hasLeft }, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            alert(`Successfully updated user's left status.`);
                            fetchTrainees();
                          } catch (err: any) {
                            alert(err.response?.data?.error || 'Failed to update left status.');
                          }
                        }}
                        className={`${t.hasLeft ? 'text-red-600 hover:text-red-800 font-bold' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
                        title={t.hasLeft ? 'Reactivate Left Employee' : 'Mark Employee as Left'}
                      >
                        <UserX size={16} />
                      </button>
                    )}
                    {hasPermission('FORCE_LOGOUT') && (
                      <button onClick={async () => {
                        if(!confirm('Force Punch Out for this user?')) return;
                        const token = localStorage.getItem('token');
                        await axios.post(`${API}/force-logout/${t.id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                        fetchTrainees();
                        alert('User forced to punch out');
                      }} className="text-red-600 hover:text-red-800 transition-colors" title="Force Logout"><LogOut size={16} /></button>
                    )}
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
      {showLeftNICTians && (
        <LeftNICTiansModal
          onClose={() => {
            setShowLeftNICTians(false);
            fetchTrainees();
          }}
          setViewOnboardingUser={setViewOnboardingUser}
          setEditUser={setEditUser}
          setSlotsUser={setSlotsUser}
          setResetUser={setResetUser}
          setManualPunchUser={setManualPunchUser}
          setDirectLeaveUser={setDirectLeaveUser}
          setDeleteUser={setDeleteUser}
          setViewDetailUser={setViewDetailUser}
          setIndividualReport={setIndividualReport}
          setDisableUser={setDisableUser}
          hasPermission={hasPermission}
        />
      )}
      {editUser && <EditUserModal trainee={editUser} onClose={() => setEditUser(null)} onSave={fetchTrainees} />}
      {slotsUser && <SlotsModal trainee={slotsUser} onClose={() => setSlotsUser(null)} onSave={fetchTrainees} />}
      {resetUser && <ResetPasswordModal trainee={resetUser} onClose={() => setResetUser(null)} />}
      {manualPunchUser && <ManualPunchModal trainee={manualPunchUser} onClose={() => setManualPunchUser(null)} onSave={fetchTrainees} />}
      {deleteUser && <DeleteConfirmModal trainee={deleteUser} onClose={() => setDeleteUser(null)} onDeleted={fetchTrainees} />}
      {showLeaves && <LeaveManagementModal onClose={() => setShowLeaves(null as any)} onProcessed={fetchTrainees} canManage={hasPermission('DIRECT_LEAVE')} />}
      {showEarlyLeaves && <EarlyLeavePermissionsModal onClose={() => setShowEarlyLeaves(false)} allTrainees={trainees} />}
      {showDownload && <MonthlyDownloadModal onClose={() => setShowDownload(false)} />}
      {individualReport && <IndividualDownloadModal trainee={individualReport} onClose={() => setIndividualReport(null)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} role={role} canManage={hasPermission('GPS_LOCATION')} />}
      {showQRCode && <QRCodeGeneratorModal onClose={() => setShowQRCode(false)} />}
      {directLeaveUser && <DirectLeaveModal trainee={directLeaveUser} onClose={() => setDirectLeaveUser(null)} onSave={fetchTrainees} />}
      {viewDetailUser && <ViewSlotsDetailModal trainee={viewDetailUser} onClose={() => setViewDetailUser(null)} />}
      {showDailyReport && <DailyReportModal onClose={() => setShowDailyReport(false)} />}
      {showHolidays && <HolidayManagementModal onClose={() => setShowHolidays(false)} canManage={hasPermission('HOLIDAYS')} />}
      {showNotices && <NoticesModal onClose={() => setShowNotices(false)} canManage={hasPermission('NOTICES')} />}
      {showDropdownOptions && <DropdownOptionsModal onClose={() => setShowDropdownOptions(false)} />}
      {viewOnboardingUser && <ViewOnboardingProfileModal trainee={viewOnboardingUser} onClose={() => { setViewOnboardingUser(null); fetchTrainees(); }} />}
      {disableUser && <DisableUserModal trainee={disableUser} onClose={() => { setDisableUser(null); fetchTrainees(); }} />}
      {showMemos && <MemoManagementModal onClose={() => setShowMemos(false)} role={role} hasPermission={hasPermission} />}
      {showBreaks && <BreakLogsModal onClose={() => setShowBreaks(false)} allTrainees={trainees} />}
      {showCollegeVisits && <CollegeVisitLogsModal onClose={() => setShowCollegeVisits(false)} allTrainees={trainees} />}
      {showExtraClasses && <ExtraClassesLogsModal onClose={() => setShowExtraClasses(false)} allTrainees={trainees} />}
      {showOtherCenterClasses && <OtherCenterClassesLogsModal onClose={() => setShowOtherCenterClasses(false)} allTrainees={trainees} />}
      {showCancelledClasses && <CancelledClassesLogsModal onClose={() => setShowCancelledClasses(false)} allTrainees={trainees} />}
      {showSalarySlips && (
        <SalarySlipsModal 
          onClose={() => {
            setShowSalarySlips(false);
            fetchTrainees();
          }}
          hasPermission={hasPermission}
        />
      )}
      {showMyPayslips && (
        <MyPayslipsModal
          onClose={() => setShowMyPayslips(false)}
        />
      )}
      {managePayslipUser && (
        <ManagePayslipModal
          userId={managePayslipUser.id}
          name={managePayslipUser.name}
          month={managePayslipUser.month}
          onClose={() => setManagePayslipUser(null)}
          onSuccess={() => {
            setManagePayslipUser(null);
            fetchTrainees();
          }}
          hasPermission={hasPermission}
        />
      )}
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

  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [slotTimes, setSlotTimes] = useState<Record<number, string>>({});

  const uniqueSlots = Array.from(new Set((trainee.slots || []).map((s: any) => s.slotNo))).sort((a, b) => Number(a) - Number(b)) as number[];

  const handleSave = async () => {
    if (!startDate || !endDate) return alert('Please select start and end dates');
    if (!applyToAll && selectedSlots.length === 0) return alert('Please select at least one slot or apply to all slots');
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const slotsPayload = applyToAll 
        ? null 
        : selectedSlots.map(num => slotTimes[num] ? `${num}(${slotTimes[num]})` : `${num}`);

      await axios.post(`${API}/leaves/direct`, {
        traineeId: trainee.id, 
        startDate, 
        endDate, 
        reason, 
        appliedDate, 
        remarksAlternative, 
        remarksOfficeUse,
        slots: slotsPayload
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

    const scheduledDays = new Set((trainee.slots || []).map(s => s.day.toUpperCase()));
    const dMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    let diffDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const curDay = dMap[d.getDay()];
      if (scheduledDays.has(curDay)) {
        if (!applyToAll && selectedSlots.length > 0) {
          const totalSlotsOnDay = (trainee.slots || []).filter(s => s.day.toUpperCase() === curDay).length;
          if (totalSlotsOnDay > 0) {
            let slotWeight = 0;
            selectedSlots.forEach(slotNo => {
              if (slotTimes[slotNo]) {
                slotWeight += 0.5;
              } else {
                slotWeight += 1;
              }
            });
            diffDays += (slotWeight / totalSlotsOnDay);
          }
        } else {
          diffDays += 1;
        }
      }
    }

    return `${diffDays.toFixed(2).replace(/\.00$/, '')} Day${diffDays !== 1 ? 's' : ''} (Active working duration in range)`;
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

          {uniqueSlots.length > 0 && (
            <div className="bg-gray-50 border rounded-lg p-3">
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                Apply Leave To:
              </label>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input type="radio" name="leaveScope" checked={applyToAll} onChange={() => setApplyToAll(true)} />
                  Whole Day (All slots)
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input type="radio" name="leaveScope" checked={!applyToAll} onChange={() => setApplyToAll(false)} />
                  Specific Slot(s)
                </label>
              </div>

              {!applyToAll && (
                <div className="mt-3 space-y-2 border-t pt-2.5">
                  {uniqueSlots.map((slotNo) => {
                    const slotInfo = trainee.slots?.find(s => s.slotNo === slotNo);
                    const timingStr = slotInfo ? ` (${slotInfo.start} - ${slotInfo.end})` : '';
                    
                    return (
                      <div key={slotNo} className="flex items-center justify-between bg-white border rounded p-2.5 hover:bg-indigo-50/50">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSlots.includes(slotNo)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSlots(prev => [...prev, slotNo]);
                              } else {
                                setSelectedSlots(prev => prev.filter(n => n !== slotNo));
                                const newTimes = { ...slotTimes };
                                delete newTimes[slotNo];
                                setSlotTimes(newTimes);
                              }
                            }}
                          />
                          Slot {slotNo}{timingStr}
                        </label>
                        {selectedSlots.includes(slotNo) && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSlotTimes({
                                  ...slotTimes,
                                  [slotNo]: slotTimes[slotNo] === '12:30 PM' ? '' : '12:30 PM'
                                });
                              }}
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                                slotTimes[slotNo] === '12:30 PM' 
                                  ? 'bg-amber-100 border-amber-300 text-amber-800' 
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              Half Day (12:30 PM)
                            </button>
                            <input
                              type="text"
                              placeholder="Leave after (e.g. 02:00 PM)"
                              value={slotTimes[slotNo] || ''}
                              onChange={(e) => setSlotTimes({ ...slotTimes, [slotNo]: e.target.value })}
                              className="border rounded px-2 py-1 text-xs w-44 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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

// ── Edit Leave Modal ─────────────────────────────────────────────────────────
const EditLeaveModal = ({ leave, onClose, onSave }: { leave: any; onClose: () => void; onSave: () => void }) => {
  const [appliedDate, setAppliedDate] = useState(leave.appliedDate ? leave.appliedDate.split('T')[0] : '');
  const [startDate, setStartDate] = useState(leave.startDate ? leave.startDate.split('T')[0] : '');
  const [endDate, setEndDate] = useState(leave.endDate ? leave.endDate.split('T')[0] : '');
  const [reason, setReason] = useState(leave.reason || '');
  const [remarksAlternative, setRemarksAlternative] = useState(leave.remarksAlternative || '');
  const [remarksOfficeUse, setRemarksOfficeUse] = useState(leave.remarksOfficeUse || '');
  const [saving, setSaving] = useState(false);

  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [slotTimes, setSlotTimes] = useState<Record<number, string>>({});

  const trainee = leave.user;
  const uniqueSlots = Array.from(new Set((trainee.slots || []).map((s: any) => s.slotNo))).sort((a, b) => Number(a) - Number(b)) as number[];

  useEffect(() => {
    if (leave.slots) {
      setApplyToAll(false);
      const leaveSlots = leave.slots.split(',').map((s: string) => s.trim());
      const nums: number[] = [];
      const times: Record<number, string> = {};
      leaveSlots.forEach((s: string) => {
        const num = parseInt(s.split('(')[0]);
        if (!isNaN(num)) {
          nums.push(num);
          const match = s.match(/\(([^)]+)\)/);
          if (match) {
            times[num] = match[1];
          }
        }
      });
      setSelectedSlots(nums);
      setSlotTimes(times);
    } else {
      setApplyToAll(true);
      setSelectedSlots([]);
      setSlotTimes({});
    }
  }, [leave]);

  const handleSave = async () => {
    if (!startDate || !endDate) return alert('Please select start and end dates');
    if (!applyToAll && selectedSlots.length === 0) return alert('Please select at least one slot or apply to all slots');
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const slotsPayload = applyToAll 
        ? null 
        : selectedSlots.map(num => slotTimes[num] ? `${num}(${slotTimes[num]})` : `${num}`);

      await axios.put(`${API}/leaves/${leave.id}`, {
        startDate, 
        endDate, 
        reason, 
        appliedDate, 
        remarksAlternative, 
        remarksOfficeUse,
        slots: slotsPayload
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Leave updated successfully');
      onSave();
      onClose();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to update leave');
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

    const scheduledDays = new Set((trainee.slots || []).map((s: any) => s.day.toUpperCase()));
    const dMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    let diffDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const curDay = dMap[d.getDay()];
      if (scheduledDays.has(curDay)) {
        if (!applyToAll && selectedSlots.length > 0) {
          const totalSlotsOnDay = (trainee.slots || []).filter((s: any) => s.day.toUpperCase() === curDay).length;
          if (totalSlotsOnDay > 0) {
            let slotWeight = 0;
            selectedSlots.forEach(slotNo => {
              if (slotTimes[slotNo]) {
                slotWeight += 0.5;
              } else {
                slotWeight += 1;
              }
            });
            diffDays += (slotWeight / totalSlotsOnDay);
          }
        } else {
          diffDays += 1;
        }
      }
    }

    return `${diffDays.toFixed(2).replace(/\.00$/, '')} Day${diffDays !== 1 ? 's' : ''} (Active working duration in range)`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <h2 className="text-lg font-bold mb-1">Edit Assigned Leave</h2>
        <p className="text-xs text-gray-500 mb-6">{trainee.fullName}</p>
        
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

          {uniqueSlots.length > 0 && (
            <div className="bg-gray-50 border rounded-lg p-3">
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                Apply Leave To:
              </label>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input type="radio" name="editLeaveScope" checked={applyToAll} onChange={() => setApplyToAll(true)} />
                  Whole Day (All slots)
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input type="radio" name="editLeaveScope" checked={!applyToAll} onChange={() => setApplyToAll(false)} />
                  Specific Slot(s)
                </label>
              </div>

              {!applyToAll && (
                <div className="mt-3 space-y-2 border-t pt-2.5">
                  {uniqueSlots.map((slotNo) => {
                    const slotInfo = trainee.slots?.find((s: any) => s.slotNo === slotNo);
                    const timingStr = slotInfo ? ` (${slotInfo.start || slotInfo.startTime} - ${slotInfo.end || slotInfo.endTime})` : '';
                    
                    return (
                      <div key={slotNo} className="flex items-center justify-between bg-white border rounded p-2.5 hover:bg-indigo-50/50">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSlots.includes(slotNo)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSlots(prev => [...prev, slotNo]);
                              } else {
                                setSelectedSlots(prev => prev.filter(n => n !== slotNo));
                                const newTimes = { ...slotTimes };
                                delete newTimes[slotNo];
                                setSlotTimes(newTimes);
                              }
                            }}
                          />
                          Slot {slotNo}{timingStr}
                        </label>
                        {selectedSlots.includes(slotNo) && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSlotTimes({
                                  ...slotTimes,
                                  [slotNo]: slotTimes[slotNo] === '12:30 PM' ? '' : '12:30 PM'
                                });
                              }}
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                                slotTimes[slotNo] === '12:30 PM' 
                                  ? 'bg-amber-100 border-amber-300 text-amber-800' 
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              Half Day (12:30 PM)
                            </button>
                            <input
                              type="text"
                              placeholder="Leave after (e.g. 02:00 PM)"
                              value={slotTimes[slotNo] || ''}
                              onChange={(e) => setSlotTimes({ ...slotTimes, [slotNo]: e.target.value })}
                              className="border rounded px-2 py-1 text-xs w-44 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
          {saving ? 'Updating...' : 'Update Leave'}
        </button>
      </div>
    </div>
  );
};

// ── Leave Management Modal ──────────────────────────────────────────────────
const LeaveManagementModal = ({ onClose, onProcessed, canManage }: { onClose: () => void; onProcessed: () => void; canManage: boolean }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editedEndDates, setEditedEndDates] = useState<Record<number, string>>({});
  const [adminReasons, setAdminReasons] = useState<Record<number, string>>({});
  const [search, setSearch] = useState('');
  const [editingLeave, setEditingLeave] = useState<any | null>(null);

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

  // Filter requests based on search term
  const filteredRequests = requests.filter((r) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    const nameMatch = r.user?.fullName?.toLowerCase().includes(term);
    const identifierMatch = r.user?.identifier?.toLowerCase().includes(term);
    const departmentMatch = r.user?.department?.toLowerCase().includes(term);
    const reasonMatch = r.reason?.toLowerCase().includes(term);
    const statusMatch = r.status?.toLowerCase().includes(term);
    return nameMatch || identifierMatch || departmentMatch || reasonMatch || statusMatch;
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b pb-4">
          <div>
            <h2 className="text-xl font-bold">Leave Requests Management</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64 text-xs">
              <input
                type="text"
                placeholder="Search teacher by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-md pl-3 pr-8 py-1.5 outline-none focus:ring-2 focus:ring-purple-500 font-medium text-gray-700 placeholder-gray-400"
              />
              <span className="absolute right-2.5 top-2 text-gray-400">🔍</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
          </div>
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
                {filteredRequests.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No leave requests found</td></tr>
                ) : filteredRequests.map((r) => {
                  // Calculate dynamic days based on edited date or original date
                  const currentEndDateStr = editedEndDates[r.id] || r.endDate.split('T')[0];
                  const currentEndDate = new Date(currentEndDateStr);
                  const startDate = new Date(r.startDate);

                  const scheduledDays = new Set((r.user?.slots || []).map((s: any) => (s.day || s.dayOfWeek || '').toUpperCase()));
                  const dMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                  let dynamicDays = 0;
                  if (!isNaN(startDate.getTime()) && !isNaN(currentEndDate.getTime())) {
                    const tempStart = new Date(startDate);
                    tempStart.setHours(0, 0, 0, 0);
                    const tempEnd = new Date(currentEndDate);
                    tempEnd.setHours(0, 0, 0, 0);
                    
                    if (tempEnd.getTime() >= tempStart.getTime()) {
                      if (scheduledDays.size > 0) {
                        for (let d = new Date(tempStart); d <= tempEnd; d.setDate(d.getDate() + 1)) {
                          const curDay = dMap[d.getDay()];
                          if (scheduledDays.has(curDay)) {
                            dynamicDays += 1;
                          }
                        }
                      } else {
                        // Fallback to raw calendar day difference if no slots are configured
                        dynamicDays = Math.ceil((tempEnd.getTime() - tempStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      }
                    }
                  }

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
                        {r.status === 'PENDING' && canManage ? (
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
                          canManage ? (
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
                            <span className="text-xs text-gray-400 italic">Pending review</span>
                          )
                        ) : (
                          <div className="text-xs text-gray-500 italic max-w-[200px] ml-auto">
                            {r.adminReason ? `Admin: "${r.adminReason}"` : '--'}
                          </div>
                        )}
                        {canManage && (
                          <div className="flex gap-2 mt-1">
                            <button onClick={() => setEditingLeave(r)} className="text-indigo-600 hover:text-indigo-800 p-1 flex items-center gap-1 text-[10px] font-bold" title="Edit Leave Record">
                              <Edit size={12} /> Edit Record
                            </button>
                            <button onClick={() => handleDeleteLeave(r.id)} className="text-red-500 hover:text-red-700 p-1 flex items-center gap-1 text-[10px] font-bold" title="Delete Leave Record">
                              <Trash2 size={12} /> Remove Record
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editingLeave && (
        <EditLeaveModal
          leave={editingLeave}
          onClose={() => setEditingLeave(null)}
          onSave={() => {
            fetchRequests();
            onProcessed();
          }}
        />
      )}
    </div>
  );
};
// ── Settings Modal ────────────────────────────────────────────────────────────
// ── Settings Modal ────────────────────────────────────────────────────────────
const SettingsModal = ({ onClose, role, canManage }: { onClose: () => void; role: string; canManage: boolean }) => {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBranch, setNewBranch] = useState({ name: '', branchCode: '', lat: '', lng: '', radius: '100' });
  const [passwords, setPasswords] = useState({ current: '', new: '' });
  const [activeTab, setActiveTab] = useState<'gps' | 'password' | 'supervisors'>('gps');
  const [saving, setSaving] = useState(false);
  const [assigningKiosk, setAssigningKiosk] = useState<number | null>(null);

  // Supervisor Account Provisioning States
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [supForm, setSupForm] = useState({ fullName: '', mobile: '', password: '', email: '' });
  const [selectedPerms, setSelectedPerms] = useState<string[]>(["RESET_PASSWORD", "DIRECT_LEAVE", "DOWNLOAD_REPORT"]);
  const [editSupervisorId, setEditSupervisorId] = useState<number | null>(null);
  const [allTrainees, setAllTrainees] = useState<any[]>([]);
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<number[]>([]);
  const [traineeSearch, setTraineeSearch] = useState('');
  const [shownPasswords, setShownPasswords] = useState<Record<number, boolean>>({});
  const [showFormPassword, setShowFormPassword] = useState(false);

  const resetSupForm = () => {
    setSupForm({ fullName: '', mobile: '', password: '', email: '' });
    setSelectedPerms(["RESET_PASSWORD", "DIRECT_LEAVE", "DOWNLOAD_REPORT"]);
    setSelectedTraineeIds([]);
    setTraineeSearch('');
    setEditSupervisorId(null);
  };

  const togglePerm = (perm: string) => {
    setSelectedPerms(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  // Ensure a stable device fingerprint is accessible
  useEffect(() => {
    let devId = localStorage.getItem('deviceId');
    if (!devId) {
      devId = crypto.randomUUID();
      localStorage.setItem('deviceId', devId);
    }
  }, []);


  useEffect(() => {
    fetchBranches();
    fetchSupervisors();
    fetchAllTrainees();
  }, []);

  const fetchAllTrainees = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
      setAllTrainees(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchSupervisors = async () => {
    try {
      const res = await axios.get(`${API}/supervisors`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSupervisors(res.data || []);
    } catch (err) { console.error(err); }
  };

  const handleSupervisorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supForm.fullName || !supForm.mobile) return alert('Required fields missing.');
    if (!editSupervisorId && !supForm.password) return alert('Password is required for new accounts.');
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (editSupervisorId) {
        await axios.put(`${API}/supervisors/${editSupervisorId}`, { ...supForm, permissions: selectedPerms, traineeIds: selectedTraineeIds }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('✅ Supervisor credentials and privileges updated successfully!');
      } else {
        await axios.post(`${API}/supervisors`, { ...supForm, permissions: selectedPerms, traineeIds: selectedTraineeIds }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('🎉 Supervisor identity created and activated successfully!');
      }
      resetSupForm();
      fetchSupervisors();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Process aborted due to an API exception.');
    } finally { setSaving(false); }
  };

  const deleteSupervisor = async (id: number) => {
    if (!confirm('⚠️ WARNING: Are you sure you want to permanently revoke this supervisor\'s clearance?')) return;
    try {
      await axios.delete(`${API}/supervisors/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchSupervisors();
    } catch (err) { alert('Revocation action failed.'); }
  };

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
      setNewBranch({ name: '', branchCode: '', lat: '', lng: '', radius: '100' });
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

  const assignCurrentAsKiosk = async (branchId: number) => {
    try {
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
      }
      setAssigningKiosk(branchId);
      const res = await axios.post(`${API}/branches/${branchId}/kiosk`, { deviceId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert(res.data.message || 'Central device assigned successfully!');
      await fetchBranches();
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.error || 'Failed to assign this device as the kiosk.');
    } finally {
      setAssigningKiosk(null);
    }
  };

  const removeKiosk = async (branchId: number) => {
    if (!window.confirm('Revoke the configured central kiosk from this branch? Any students logging in from that hardware will revert to strict personal device lockouts.')) return;
    try {
      setAssigningKiosk(branchId);
      await axios.delete(`${API}/branches/${branchId}/kiosk`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('Center kiosk cleared successfully.');
      await fetchBranches();
    } catch (e: any) {
      console.error(e);
      alert('Failed to revoke central device assignment.');
    } finally {
      setAssigningKiosk(null);
    }
  };


  const loadBranchToEdit = (b: any) => {
    setNewBranch({ name: b.name, branchCode: b.branchCode || '', lat: b.lat.toString(), lng: b.lng.toString(), radius: b.radius.toString() });
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
        <div className="flex border-b mb-4 flex-shrink-0 text-xs">
          <button onClick={() => setActiveTab('gps')} className={`flex-1 py-3 font-black uppercase tracking-wider ${activeTab === 'gps' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}>Branch Config</button>
          {role === 'ADMIN' && (
            <button onClick={() => setActiveTab('supervisors')} className={`flex-1 py-3 font-black uppercase tracking-wider ${activeTab === 'supervisors' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}>Supervisors</button>
          )}
          <button onClick={() => setActiveTab('password')} className={`flex-1 py-3 font-black uppercase tracking-wider ${activeTab === 'password' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}>Auth Key</button>
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
                      <div key={b.id} className="flex flex-col gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg shadow-sm hover:bg-blue-100/70 transition-colors">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-extrabold text-blue-800 text-sm">{b.name} {b.branchCode ? `(${b.branchCode})` : ''}</p>
                            <p className="text-[10px] text-blue-600/70 font-mono">{b.lat}, {b.lng} (Radius: {b.radius}m)</p>
                          </div>
                          {canManage && (
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
                          )}
                        </div>

                        {/* Central Kiosk Mode Row */}
                        <div className="mt-1 pt-2 border-t border-blue-200/50 flex items-center justify-between bg-white/30 px-2 py-1 rounded">
                          <span className="text-[9px] font-extrabold text-blue-900/60 uppercase tracking-wider flex items-center gap-1">
                            🖥️ Kiosk Device
                          </span>
                          {b.kioskDeviceId ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-tighter ${
                                b.kioskDeviceId === localStorage.getItem('deviceId') 
                                  ? 'bg-emerald-200 text-emerald-900 border border-emerald-300' 
                                  : 'bg-slate-200 text-slate-700 border border-slate-300'
                              }`}>
                                {b.kioskDeviceId === localStorage.getItem('deviceId') ? '✅ THIS DEVICE' : '🔒 CONFIGURED'}
                              </span>
                              {canManage && (
                                <button 
                                  onClick={() => removeKiosk(b.id)} 
                                  disabled={assigningKiosk !== null}
                                  className="text-[9px] font-black text-red-600 hover:text-red-800 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded tracking-tight uppercase active:scale-95 transition-all disabled:opacity-50"
                                  title="Revoke device bypass whitelist"
                                >
                                  {assigningKiosk === b.id ? '...' : 'Revoke'}
                                </button>
                              )}
                            </div>
                          ) : (
                            canManage ? (
                              <button 
                                onClick={() => assignCurrentAsKiosk(b.id)} 
                                disabled={assigningKiosk !== null}
                                className="text-[9px] font-black bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded uppercase tracking-tight shadow-sm active:scale-95 transition-all disabled:opacity-50"
                              >
                                {assigningKiosk === b.id ? 'Saving...' : '🔗 Assign This Device'}
                              </button>
                            ) : (
                              <span className="text-[9px] text-gray-400 italic font-bold">NOT CONFIGURED</span>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                )}
              </div>

              <hr className="border-gray-200" />

              {/* Add New Branch Form */}
              {canManage && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-inner">
                  <h4 id="new-branch-form-header" className="text-sm font-black text-emerald-700 mb-3 border-b border-emerald-200 pb-1 uppercase tracking-wide flex justify-between items-center">
                    <span>Add or Update Institute Branch</span>
                    {newBranch.name && <span className="text-[9px] bg-emerald-200 px-1.5 py-0.5 rounded animate-pulse text-emerald-800">Editing Mode</span>}
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-emerald-600 mb-1 uppercase">Branch Name</label>
                        <input value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} className="w-full border border-emerald-200 rounded px-3 py-2 bg-white font-bold text-gray-700" placeholder="e.g., INDIRANAGAR" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-emerald-600 mb-1 uppercase">Branch Code</label>
                        <input value={newBranch.branchCode} onChange={e => setNewBranch({...newBranch, branchCode: e.target.value})} className="w-full border border-emerald-200 rounded px-3 py-2 bg-white font-bold text-gray-700 uppercase" placeholder="e.g., IND-01" />
                      </div>
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
              )}
            </div>
          ) : activeTab === 'supervisors' && role === 'ADMIN' ? (
            <div className="space-y-6">
              {/* Active Supervisor Index */}
              <div>
                <h3 className="text-sm font-black text-gray-700 uppercase mb-3 tracking-wider flex items-center gap-1">
                  <span>👥 ACTIVE SUPERVISORS</span>
                  <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full">{supervisors.length}</span>
                </h3>
                {supervisors.length === 0 ? (
                  <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded border border-dashed text-center">No delegated supervisor clearance accounts created yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {supervisors.map(s => (
                      <div key={s.id} className="flex justify-between items-start p-3 bg-slate-50 border border-slate-100 rounded-lg group hover:bg-slate-100 transition-colors">
                        <div className="flex-1">
                          <p className="font-black text-slate-800 text-xs">{s.fullName}</p>
                          <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span>📲 {s.identifier}</span>
                            {s.email && <span>| 📧 {s.email}</span>}
                            {s.plainPassword ? (
                              <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-600 shadow-sm ml-1 select-all">
                                🔑 {shownPasswords[s.id] ? s.plainPassword : '••••••••'}
                                <button 
                                  type="button" 
                                  onClick={() => setShownPasswords(prev => ({ ...prev, [s.id]: !prev[s.id] }))} 
                                  className="text-slate-400 hover:text-slate-600 focus:outline-none ml-0.5 shrink-0"
                                >
                                  <Eye size={10} />
                                </button>
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-400 italic font-medium ml-1">🔑 No saved password info</span>
                            )}
                          </p>
                          {/* Trainees Assigned Badge List */}
                          {s.trainees && s.trainees.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {s.trainees.map((t: any) => (
                                <span key={t.id} className="bg-slate-200 text-slate-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  👤 {t.fullName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[8px] text-gray-400 italic mt-1 font-bold">No trainees assigned</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button 
                            onClick={() => {
                              setEditSupervisorId(s.id);
                              setSupForm({
                                fullName: s.fullName,
                                mobile: s.identifier,
                                email: s.email || '',
                                password: '' // Change only if provided
                              });
                              setSelectedPerms(s.permissions ? s.permissions.split(',') : ["RESET_PASSWORD", "DIRECT_LEAVE", "DOWNLOAD_REPORT"]);
                              setSelectedTraineeIds(s.trainees ? s.trainees.map((t: any) => t.id) : []);
                            }}
                            className="text-blue-400 hover:text-blue-600 p-1.5 bg-white/80 border hover:border-blue-100 hover:bg-blue-50 rounded transition-all"
                            title="Edit Account Credentials & Access">
                            <Edit size={13} />
                          </button>
                          <button 
                            onClick={() => deleteSupervisor(s.id)}
                            className="text-gray-400 hover:text-red-600 p-1.5 bg-white/80 border hover:border-red-100 hover:bg-red-50 rounded transition-all"
                            title="Revoke Clearance">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <hr className="border-gray-100" />

              {/* Deploy New Supervisor Frame */}
              <div className={`p-4 rounded-xl border shadow-inner transition-all duration-300 ${editSupervisorId ? 'bg-amber-50/70 border-amber-200' : 'bg-blue-50/70 border-blue-100'}`}>
                <h4 className={`text-sm font-black mb-3 uppercase tracking-wide ${editSupervisorId ? 'text-amber-800' : 'text-blue-800'}`}>
                  {editSupervisorId ? '🛠️ Update Supervisor Configuration' : 'Provision New Supervisor'}
                </h4>
                <form onSubmit={handleSupervisorSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-black text-blue-600 mb-1 uppercase">Full Name</label>
                      <input 
                        required 
                        type="text" 
                        value={supForm.fullName} 
                        onChange={e => setSupForm({...supForm, fullName: e.target.value})} 
                        className="w-full border border-blue-100 rounded px-2.5 py-2 bg-white font-bold text-xs outline-none focus:border-blue-400" 
                        placeholder="Assignee Name" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-blue-600 mb-1 uppercase">Mobile (ID)</label>
                      <input 
                        required 
                        type="text" 
                        value={supForm.mobile} 
                        onChange={e => setSupForm({...supForm, mobile: e.target.value})} 
                        className="w-full border border-blue-100 rounded px-2.5 py-2 bg-white font-mono text-xs outline-none focus:border-blue-400" 
                        placeholder="Numeric ID" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-black text-blue-600 mb-1 uppercase">
                        {editSupervisorId ? 'Change Password' : 'Temp Password'}
                      </label>
                      <div className="relative">
                        <input 
                          required={!editSupervisorId} 
                          type={showFormPassword ? "text" : "password"} 
                          value={supForm.password} 
                          onChange={e => setSupForm({...supForm, password: e.target.value})} 
                          className="w-full border border-blue-100 rounded px-2.5 py-2 pr-8 bg-white text-xs outline-none focus:border-blue-400 font-bold" 
                          placeholder={editSupervisorId ? 'Leave blank to keep current' : '🔑 Strong Pass'} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowFormPassword(!showFormPassword)}
                          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-blue-600 mb-1 uppercase">Email (Optional)</label>
                      <input 
                        type="email" 
                        value={supForm.email} 
                        onChange={e => setSupForm({...supForm, email: e.target.value})} 
                        className="w-full border border-blue-100 rounded px-2.5 py-2 bg-white text-xs outline-none focus:border-blue-400" 
                        placeholder="abc@domain.com" />
                    </div>
                  </div>

                  {/* Assign Trainees Selector */}
                  <div className="py-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[9px] font-black text-blue-600 uppercase tracking-wider">Assign Trainees Under Supervisor</label>
                      <span className="bg-blue-100 text-blue-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase">
                        Selected: {selectedTraineeIds.length}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded border border-blue-100 shadow-inner space-y-2">
                      <input
                        type="text"
                        placeholder="🔍 Search teachers by name..."
                        value={traineeSearch}
                        onChange={e => setTraineeSearch(e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-[10px] outline-none focus:border-blue-400 bg-gray-50/50"
                      />
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-32 overflow-y-auto pr-1">
                        {allTrainees
                          .filter(t => t.name.toLowerCase().includes(traineeSearch.toLowerCase()) || t.empCode.includes(traineeSearch))
                          .map(t => {
                            const isChecked = selectedTraineeIds.includes(t.id);
                            return (
                              <label key={t.id} className="flex items-center gap-2 cursor-pointer text-[10px] font-bold select-none text-gray-700 hover:text-blue-700">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedTraineeIds(prev =>
                                      isChecked ? prev.filter(id => id !== t.id) : [...prev, t.id]
                                    );
                                  }}
                                  className="accent-blue-600 w-3 h-3 rounded"
                                />
                                <span className="truncate">{t.name} <span className="text-[8px] font-mono text-gray-400">({t.empCode})</span></span>
                              </label>
                            );
                          })}
                        {allTrainees.length === 0 && (
                          <div className="col-span-2 text-center text-[10px] text-gray-400 italic py-2">No trainees registered yet.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    <label className="block text-[9px] font-black text-blue-600 mb-2 uppercase tracking-wider">Configure Dynamic Clearance Access</label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-white p-3 rounded border border-blue-100 max-h-36 overflow-y-auto shadow-inner">
                      {[
                        { id: 'RESET_PASSWORD', label: '🔑 Reset Password', core: true },
                        { id: 'DIRECT_LEAVE', label: '📅 Direct Leave', core: true },
                        { id: 'DOWNLOAD_REPORT', label: '📊 Download Report', core: true },
                        { id: 'VIEW_PROFILE', label: '👤 View User Profile', core: false },
                        { id: 'EDIT_USER', label: '✏️ Edit User Info', core: false },
                        { id: 'UPDATE_SLOTS', label: '🕒 Manage Slots', core: false },
                        { id: 'MANUAL_ATTENDANCE', label: '⏰ Manual Punch', core: false },
                        { id: 'DELETE_USER', label: '🗑️ Delete Users', core: false },
                        { id: 'VIEW_SLOT_STATUS', label: '👁️ View Slot Status', core: false },
                        { id: 'FORCE_LOGOUT', label: '🚪 Force Logout', core: false },
                        { id: 'GEOLOCATION', label: '📍 Geofence Status', core: false },
                        { id: 'HOLIDAYS', label: '🌴 Manage Holidays', core: false },
                        { id: 'NOTICES', label: '📢 Manage Notices', core: false },
                        { id: 'GPS_LOCATION', label: '📡 Branch GPS Config', core: false },
                        { id: 'MANAGE_BREAKS', label: '🕒 Manage Breaks', core: false },
                        { id: 'MANAGE_MEMOS', label: '✉️ Manage Memos', core: false },
                        { id: 'MANAGE_COLLEGE_VISITS', label: '🎓 Manage College Visits', core: false },
                        { id: 'MANAGE_EXTRA_CLASSES', label: '📚 Manage Extra Classes', core: false },
                        { id: 'MANAGE_OTHER_CENTER_CLASSES', label: '🏢 Manage Other Center Classes', core: false },
                        { id: 'MANAGE_CANCELLED_CLASSES', label: '❌ Manage Cancelled Classes', core: false },
                        { id: 'MANAGE_SALARY_SLIPS', label: '💵 Manage Salary Slips', core: false },
                      ].map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer text-[10px] font-bold select-none text-gray-700 hover:text-blue-700">
                          <input 
                            type="checkbox" 
                            checked={selectedPerms.includes(p.id)} 
                            onChange={() => togglePerm(p.id)}
                            className="accent-blue-600 w-3 h-3 rounded"
                          />
                          <span className="truncate">{p.label} {p.core && <span className="text-[7px] text-blue-500 bg-blue-50 px-1 rounded font-black">DEFAULT</span>}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    {editSupervisorId && (
                      <button 
                        type="button" 
                        onClick={resetSupForm}
                        className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-lg font-bold tracking-wider text-[10px] uppercase shadow-sm hover:bg-gray-50 active:scale-95 transition-all">
                        Cancel Edit
                      </button>
                    )}
                    <button 
                      type="submit" 
                      disabled={saving} 
                      className={`flex-[2] text-white py-2.5 rounded-lg font-black tracking-widest text-[10px] uppercase shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 ${editSupervisorId ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}>
                      {saving ? 'SAVING...' : editSupervisorId ? '💾 Commit Account Modifications' : '🔥 Activate Supervisor Authority'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">CURRENT PASSWORD</label><input type="password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">NEW PASSWORD</label><input type="password" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
              <button onClick={changePassword} disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold tracking-wide mt-2">{saving ? 'Updating...' : 'Update Admin Password'}</button>
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

// ── Early Leave Permissions Modal ────────────────────────────────────────────
const EarlyLeavePermissionsModal = ({ onClose, allTrainees }: { onClose: () => void; allTrainees: any[] }) => {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingPermissionId, setEditingPermissionId] = useState<number | null>(null);

  // Form states
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState('');
  const [slotNo, setSlotNo] = useState('1');
  const [allowedMinutes, setAllowedMinutes] = useState('60');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/early-leave`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPermissions(res.data);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to fetch early leave permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !date || !allowedMinutes) {
      alert('Please fill in all required fields.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const payload = {
        userId: Number(userId),
        date,
        slotNo: Number(slotNo),
        allowedMinutes: Number(allowedMinutes),
        reason
      };

      if (editingPermissionId) {
        await axios.put(`${API}/early-leave/${editingPermissionId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Early leave permission updated successfully.');
      } else {
        await axios.post(`${API}/early-leave`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Early leave permission added successfully.');
      }

      // Reset form
      setUserId('');
      setDate('');
      setSlotNo('1');
      setAllowedMinutes('60');
      setReason('');
      setEditingPermissionId(null);
      fetchPermissions();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save permission.');
    }
  };

  const handleDeletePermission = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this early leave permission?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/early-leave/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPermissions();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to delete permission.');
    }
  };

  const filteredPermissions = permissions.filter((p: any) =>
    (p.user?.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.user?.identifier || '').includes(search)
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-indigo-600 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold uppercase tracking-wider">Early Leave Permissions</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200 cursor-pointer">
            <X size={24} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Add Permission Form */}
          <form onSubmit={handleAddPermission} className="bg-gray-50/50 p-5 rounded-lg border border-gray-200/60 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Select Trainee *</label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2 bg-white focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="">-- Choose Trainee --</option>
                {allTrainees.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.empCode})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Slot Number *</label>
              <select
                value={slotNo}
                onChange={(e) => setSlotNo(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2 bg-white focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="0">All Slots</option>
                <option value="1">Slot 1</option>
                <option value="2">Slot 2</option>
                <option value="3">Slot 3</option>
                <option value="4">Slot 4</option>
                <option value="5">Slot 5</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Minutes Early *</label>
              <input
                type="number"
                min="1"
                value={allowedMinutes}
                onChange={(e) => setAllowedMinutes(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Reason / Remarks</label>
              <input
                type="text"
                placeholder="e.g. Personal work, Health checkup..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              {editingPermissionId && (
                <button
                  type="button"
                  onClick={() => {
                    setUserId('');
                    setDate('');
                    setSlotNo('1');
                    setAllowedMinutes('60');
                    setReason('');
                    setEditingPermissionId(null);
                  }}
                  className="w-full text-xs font-bold uppercase py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded border border-gray-300 cursor-pointer mb-2 transition-all"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                className="w-full text-xs font-bold uppercase py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer transition-all active:scale-[0.98]"
              >
                {editingPermissionId ? 'Update Permission' : 'Add Permission'}
              </button>
            </div>
          </form>

          {/* Permissions List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Existing Permissions</h3>
              <input
                type="text"
                placeholder="Search by name or mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-xs border border-gray-300 rounded px-3 py-1.5 w-64 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {loading ? (
              <div className="text-center py-6 text-xs text-gray-400">Loading permissions...</div>
            ) : filteredPermissions.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400 border border-dashed rounded-lg bg-gray-50/50">
                No active early leave permissions found.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100/80 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                      <th className="p-3">Trainee Name</th>
                      <th className="p-3">Identifier</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-center">Slot</th>
                      <th className="p-3 text-center">Allowed Minutes</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredPermissions.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 font-semibold text-gray-800">{p.user?.fullName}</td>
                        <td className="p-3 text-gray-600 font-mono">{p.user?.identifier}</td>
                        <td className="p-3 text-gray-700">{new Date(p.date).toLocaleDateString('en-IN')}</td>
                        <td className="p-3 text-center font-bold text-gray-800">
                          {p.slotNo === 0 ? 'All Slots' : `Slot ${p.slotNo}`}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-700">
                          {p.allowedMinutes}m
                        </td>
                        <td className="p-3 text-gray-500 italic">{p.reason || '--'}</td>
                        <td className="p-3 text-center space-x-2">
                          <button
                            onClick={() => {
                              setUserId(String(p.userId));
                              const formattedDate = new Date(p.date).toISOString().split('T')[0];
                              setDate(formattedDate);
                              setSlotNo(String(p.slotNo));
                              setAllowedMinutes(String(p.allowedMinutes));
                              setReason(p.reason || '');
                              setEditingPermissionId(p.id);
                            }}
                            className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded border border-indigo-200 transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePermission(p.id)}
                            className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition-colors cursor-pointer"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Holiday & System Settings Management Modal ────────────────────────────────
const HolidayManagementModal = ({ onClose, canManage }: { onClose: () => void; canManage: boolean }) => {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [quota, setQuota] = useState(0);
  const [lateRate, setLateRate] = useState(30);
  const [earlyRate, setEarlyRate] = useState(30);
  const [paidLeavesLimit, setPaidLeavesLimit] = useState(0);
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
      setLateRate(sRes.data?.lateRate !== undefined ? sRes.data.lateRate : 30);
      setEarlyRate(sRes.data?.earlyRate !== undefined ? sRes.data.earlyRate : 30);
      setPaidLeavesLimit(sRes.data?.paidLeavesLimit !== undefined ? sRes.data.paidLeavesLimit : 0);
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

  const handleUpdateSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/settings`, { 
        totalHolidaysQuota: quota,
        lateRate,
        earlyRate,
        paidLeavesLimit
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('System settings updated successfully');
    } catch (err) {
      console.error('Update Quota Error:', err);
      alert('Failed to update settings');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl p-6 relative flex flex-col max-h-[95vh]">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
          <Calendar className="text-pink-600" /> System Settings & Holiday Management
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-pink-50 p-4 rounded-lg border border-pink-100 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black text-pink-700 mb-2 uppercase tracking-wider">Holiday Quota</h3>
              <div className="flex gap-2">
                <input type="number" value={quota} onChange={e => setQuota(parseInt(e.target.value) || 0)} disabled={!canManage}
                  className="flex-1 border border-pink-200 rounded px-3 py-1.5 text-xs focus:ring-2 focus:ring-pink-500 outline-none disabled:bg-gray-100 disabled:text-gray-500 font-semibold" />
                {canManage && (
                  <button onClick={handleUpdateSettings} className="bg-pink-650 hover:bg-pink-750 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors shadow-sm cursor-pointer">
                    Save Quota
                  </button>
                )}
              </div>
              <p className="text-[9px] text-pink-600 mt-1 italic">Total holidays allowed for this session</p>
            </div>
          </div>

          {canManage && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 font-semibold">
              <h3 className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Add New Holiday</h3>
              <div className="space-y-1.5">
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="text" placeholder="Holiday Name (e.g., Diwali)" value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                <button onClick={handleAddHoliday} disabled={saving}
                  className="w-full bg-blue-600 text-white py-1 rounded text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer">
                  {saving ? 'Adding...' : 'Add Holiday'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-[150px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-700 text-xs">Scheduled Holidays ({holidays.length})</h3>
            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              Remaining: {Math.max(0, quota - holidays.length)}
            </span>
          </div>
          {loading ? <p className="text-center py-5 text-gray-400 text-xs">Loading...</p> : (
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 font-semibold text-gray-600">Date</th>
                  <th className="px-3 py-2 font-semibold text-gray-600">Day</th>
                  <th className="px-3 py-2 font-semibold text-gray-600">Holiday Name</th>
                  {canManage && <th className="px-3 py-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr><td colSpan={canManage ? 4 : 3} className="px-3 py-5 text-center text-gray-400">No holidays scheduled</td></tr>
                ) : (
                  holidays.map((h) => {
                    const d = new Date(h.date);
                    return (
                      <tr key={h.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{d.toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-gray-500">{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]}</td>
                        <td className="px-3 py-2 font-bold">{h.name}</td>
                        {canManage && (
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-500 hover:text-red-700 p-1">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
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

      const updatedProfile = {
        ...profile,
        [fieldName]: publicUrl
      };
      setProfile(updatedProfile);

      const token = localStorage.getItem('token');
      await axios.put(`${API}/user/${trainee.id}`, {
        [fieldName]: publicUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Document uploaded and saved successfully!');
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
        aadhaarPhotoUrl: profile.aadhaarPhotoUrl,
        panNumber: profile.panNumber,
        panPhotoUrl: profile.panPhotoUrl,
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
const NoticesModal = ({ onClose, canManage }: { onClose: () => void; canManage: boolean }) => {
  const [notices, setNotices] = useState<any[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [message, setMessage] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [targetGroup, setTargetGroup] = useState('ALL');
  const [editNoticeId, setEditNoticeId] = useState<number | null>(null);
  const [noticeTab, setNoticeTab] = useState<'active' | 'previous'>('active');

  const getCombinedTarget = () => {
    if (userId) return `USER:${userId}`;
    return `GROUP:${targetGroup || 'ALL'}`;
  };

  const handleCombinedTargetChange = (val: string) => {
    if (val.startsWith('GROUP:')) {
      setTargetGroup(val.split(':')[1]);
      setUserId('');
    } else if (val.startsWith('USER:')) {
      setUserId(val.split(':')[1]);
      // Ensure backend respects userId override by resetting group context or leaving standard
      setTargetGroup('ALL'); 
    }
  };

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
      const payload = { message, fromDate, toDate, userId: userId ? Number(userId) : null, targetGroup };
      
      if (editNoticeId) {
        await axios.put(`${API}/notices/${editNoticeId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API}/notices`, payload, { headers: { Authorization: `Bearer ${token}` } });
      }
      
      setMessage(''); setFromDate(''); setToDate(''); setUserId(''); setTargetGroup('ALL'); setEditNoticeId(null);
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
    setTargetGroup(n.targetGroup || 'ALL');
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
          {canManage && (
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
                  <label className="block text-sm font-bold text-gray-700 mb-1">Select Target Audience</label>
                  <select 
                    className="w-full border p-2.5 rounded text-sm bg-white focus:border-teal-500 font-semibold" 
                    value={getCombinedTarget()} 
                    onChange={e => handleCombinedTargetChange(e.target.value)}
                  >
                    <optgroup label="📢 BROADCAST GROUPS">
                      <option value="GROUP:ALL">🌍 EVERYONE (Admin, Supervisor, Trainees)</option>
                      <option value="GROUP:SUPERVISOR">👥 ALL SUPERVISORS</option>
                      <option value="GROUP:TRAINEE">🎓 ALL NICTIANS (Trainees)</option>
                    </optgroup>
                    <optgroup label="👤 SPECIFIC INDIVIDUALS">
                      {trainees.map(t => (
                        <option key={t.id} value={`USER:${t.id}`}>👤 {t.name} ({t.empCode})</option>
                      ))}
                    </optgroup>
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
          )}

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
                      {canManage && (
                        <div className="flex flex-col gap-2 self-start">
                          <button onClick={() => handleEditClick(n)} className="text-blue-500 hover:bg-blue-100 p-2 rounded">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => handleDeleteNotice(n.id)} className="text-red-500 hover:bg-red-100 p-2 rounded">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
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

// ── Disable User Modal ────────────────────────────────────────────────────────
const DisableUserModal = ({ trainee, onClose }: { trainee: any; onClose: () => void }) => {
  const [reason, setReason] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/user/${trainee.id}/disable-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data || []);
    } catch (e) {
      console.error('Failed to fetch disable logs', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [trainee.id]);

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return alert('Please enter a reason.');
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API}/user/${trainee.id}/disable`, { reason: reason.trim() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Account temporarily disabled successfully.');
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to disable account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnable = async () => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API}/user/${trainee.id}/enable`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Account reactivated successfully.');
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to enable account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl p-6 relative max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-red-700 flex items-center gap-2 border-b pb-3">
          <Ban size={20} /> Account Access Control: {trainee.name}
        </h2>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {trainee.isDisabled ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs font-semibold">
              <div className="flex items-center gap-2 text-yellow-800 font-bold uppercase mb-2">
                <span className="animate-pulse">⚠️</span> Current Status: Temporarily Disabled
              </div>
              <p className="text-gray-700 mb-4">
                <strong>Reason:</strong> {trainee.disableReason || 'No details specified.'}
              </p>
              <button
                onClick={handleEnable}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white font-black px-4 py-2.5 rounded text-xs uppercase tracking-wider transition-all active:scale-95 shadow cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Processing...' : '🔓 Remove Disable / Reactivate Account'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleDisable} className="space-y-3 text-xs">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-gray-700 leading-relaxed font-semibold mb-2">
                Disabling the account will block the employee from viewing their dashboard or punching in. They will see a blocker message prompting them to contact the admin.
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Reason for Disabling Account</label>
                <textarea
                  required
                  placeholder="e.g. Please submit your outstanding onboarding documents immediately."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 outline-none focus:ring-2 focus:ring-red-500 font-semibold resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded font-bold hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded font-black uppercase tracking-wider transition-all active:scale-95 shadow cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Disabling...' : '🚫 Disable Account'}
                </button>
              </div>
            </form>
          )}

          {/* Historical Logs */}
          <div className="border-t pt-4">
            <h3 className="text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock size={14} /> Disable/Enable Log History
            </h3>
            {loadingLogs ? (
              <p className="text-xs text-gray-405 italic">Loading logs...</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-gray-405 italic">No access logs recorded for this employee.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-[#f8fafc] text-gray-600 font-bold border-b">
                    <tr>
                      <th className="px-3 py-2">Disabled Date</th>
                      <th className="px-3 py-2">Re-activated Date</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">Action By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-red-600 font-semibold">{new Date(log.disabledAt).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-green-600 font-semibold">
                          {log.enabledAt ? new Date(log.enabledAt).toLocaleString('en-IN') : <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-black text-[9px] uppercase">Active Disable</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-700 italic max-w-[200px] truncate" title={log.reason}>{log.reason}</td>
                        <td className="px-3 py-2 text-gray-700 font-bold">{log.disabledBy?.fullName || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Teacher Memo Management Modal ─────────────────────────────────────────────
const MemoManagementModal = ({ onClose, role, hasPermission }: { onClose: () => void; role: string; hasPermission: (perm: string) => boolean }) => {
  const [memos, setMemos] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [memoTab, setMemoTab] = useState<'received' | 'send' | 'sent'>('received');

  const currentUser = (() => {
    try {
      const data = localStorage.getItem('user');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  })();

  useEffect(() => {
    if (role === 'ADMIN') {
      setMemoTab('send');
      fetchSupervisors();
      fetchSentMemos();
    } else {
      setMemoTab('received');
      fetchReceivedMemos();
    }
  }, [role]);

  const fetchSupervisors = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/memos/recipients`, { headers: { Authorization: `Bearer ${token}` } });
      setSupervisors(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSentMemos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/memos/sent`, { headers: { Authorization: `Bearer ${token}` } });
      setMemos(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchReceivedMemos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/memos/received`, { headers: { Authorization: `Bearer ${token}` } });
      setMemos(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !content.trim()) return alert('Recipient and Content are required');
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/memos`, {
        recipientId: Number(recipientId),
        content: content.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Memo sent successfully!');
      setContent('');
      setRecipientId('');
      fetchSentMemos();
      setMemoTab('sent');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to send memo');
    }
  };

  const handleDeleteMemo = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this memo?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/memos/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSentMemos();
    } catch (e) {
      alert('Failed to delete memo');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl p-6 relative max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-purple-700 flex items-center gap-2">
          <Mail size={20} /> {role === 'ADMIN' ? 'Delegated Teacher Memos' : 'My Official Memos'}
        </h2>

        {/* Tab Headers */}
        {(role === 'ADMIN' || (role === 'SUPERVISOR' && hasPermission('MANAGE_MEMOS'))) && (
          <div className="flex border-b mb-4">
            {role === 'SUPERVISOR' && (
              <button onClick={() => { setMemoTab('received'); fetchReceivedMemos(); }}
                className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider ${memoTab === 'received' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-400'}`}>
                Received Memos
              </button>
            )}
            <button onClick={() => { setMemoTab('send'); fetchSupervisors(); }}
              className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider ${memoTab === 'send' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-400'}`}>
              Send Memo
            </button>
            <button onClick={() => { setMemoTab('sent'); fetchSentMemos(); }}
              className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider ${memoTab === 'sent' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-400'}`}>
              Sent History ({memos.length})
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {loading ? (
            <p className="text-center py-10 text-gray-400">Loading memos...</p>
          ) : (
            <>
              {/* Send Tab */}
              {memoTab === 'send' && (role === 'ADMIN' || (role === 'SUPERVISOR' && hasPermission('MANAGE_MEMOS'))) && (
                <form onSubmit={handleSendMemo} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Select Teacher</label>
                    <select value={recipientId} onChange={e => setRecipientId(e.target.value)} required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="">-- Choose Teacher / Supervisor --</option>
                      {supervisors.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.fullName} ({s.identifier}) - {s.role === 'TRAINEE' ? 'Teacher' : 'Supervisor'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Memo Message</label>
                    <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Type memo details..." required rows={6}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
                  </div>
                  <button type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded text-xs uppercase tracking-wider shadow transition-all active:scale-95">
                    🚀 Dispatch Official Memo
                  </button>
                </form>
              )}

              {/* Sent Tab */}
              {memoTab === 'sent' && (role === 'ADMIN' || (role === 'SUPERVISOR' && hasPermission('MANAGE_MEMOS'))) && (
                <div className="space-y-3 text-left">
                  {memos.length === 0 ? (
                    <p className="text-center py-10 text-gray-400 italic text-sm">No official memos dispatched yet.</p>
                  ) : (
                    memos.map((m) => (
                      <div key={m.id} className="p-4 rounded-lg bg-gray-50 border border-gray-150 flex flex-col gap-1 text-xs relative">
                        <button onClick={() => handleDeleteMemo(m.id)} className="absolute right-3 top-3 text-red-500 hover:text-red-700" title="Delete Memo">
                          <Trash2 size={16} />
                        </button>
                        <div className="flex justify-between items-center pr-8 mb-1">
                          <span className="font-black text-purple-700 uppercase">To: {m.recipient?.fullName}</span>
                          <span className="text-[10px] text-gray-400">{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-700 leading-relaxed bg-white p-2.5 rounded border border-gray-100 whitespace-pre-wrap">{m.content}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Received Tab (Teacher only) */}
              {memoTab === 'received' && (
                <div className="space-y-3 text-left">
                  {memos.length === 0 ? (
                    <p className="text-center py-10 text-gray-400 italic text-sm">No official memos received from Admin yet.</p>
                  ) : (
                    memos.map((m) => (
                      <div key={m.id} className="p-4 rounded-lg bg-purple-50/50 border border-purple-100 flex flex-col gap-1 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-purple-800 uppercase">FROM: {m.sender?.fullName || 'ADMIN'}</span>
                            {currentUser && m.recipientId !== currentUser.id && (
                              <span className="bg-purple-100 text-purple-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-purple-200 uppercase whitespace-nowrap">
                                TO: {m.recipient?.fullName || 'Trainee'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400">{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-700 leading-relaxed bg-white p-2.5 rounded border border-purple-50 whitespace-pre-wrap">{m.content}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Teacher Break Logs Modal ────────────────────────────────────────────────
const BreakLogsModal = ({ onClose, allTrainees }: { onClose: () => void; allTrainees?: any[] }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().substring(0, 7));
  const [exporting, setExporting] = useState(false);
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [outHour, setOutHour] = useState('10');
  const [outMin, setOutMin] = useState('00');
  const [outPeriod, setOutPeriod] = useState('AM');
  const [inHour, setInHour] = useState('10');
  const [inMin, setInMin] = useState('30');
  const [inPeriod, setInPeriod] = useState('AM');
  const [reason, setReason] = useState('Tea Break');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [date]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/breaks?date=${date}&search=${search}&type=NORMAL`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBreak = async (id: number) => {
    if (!window.confirm('Are you sure you want to completely delete this Outing record? This action cannot be undone.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/breaks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Outing record deleted successfully.');
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete record.');
    }
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingLog(null);
    setSelectedTraineeId('');
    setOutHour('10');
    setOutMin('00');
    setOutPeriod('AM');
    setInHour('10');
    setInMin('30');
    setInPeriod('AM');
    setReason('Tea Break');
  };

  const handleStartEdit = (b: any) => {
    setEditingLog(b);
    setSelectedTraineeId(b.userId || '');
    setLogDate(parseInDate(b.date));
    
    const outTime = parse12hTime(b.breakOut);
    setOutHour(outTime.hour);
    setOutMin(outTime.min);
    setOutPeriod(outTime.period);

    const inTime = parse12hTime(b.breakIn);
    setInHour(inTime.hour);
    setInMin(inTime.min);
    setInPeriod(inTime.period);

    setReason(b.reason || '');
    setShowAddForm(true);
  };

  const handleAddBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraineeId) return alert('Please select a trainee.');

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const out24 = convertTo24h(outHour, outMin, outPeriod);
      const in24 = convertTo24h(inHour, inMin, inPeriod);
      const breakOutStr = `${logDate}T${out24}:00`;
      const breakInStr = `${logDate}T${in24}:00`;

      if (editingLog) {
        await axios.put(`${API}/breaks/${editingLog.id}`, {
          traineeId: Number(selectedTraineeId),
          date: logDate,
          breakType: 'NORMAL',
          breakOut: breakOutStr,
          breakIn: breakInStr,
          reason: reason.trim(),
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Outing updated successfully!');
      } else {
        await axios.post(`${API}/breaks/log`, {
          traineeId: Number(selectedTraineeId),
          date: logDate,
          breakType: 'NORMAL',
          breakOut: breakOutStr,
          breakIn: breakInStr,
          reason: reason.trim(),
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Outing logged successfully!');
      }

      closeForm();
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save outing');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/breaks/export?month=${exportMonth}&search=${encodeURIComponent(search)}&type=NORMAL`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      if (search) {
        link.setAttribute('download', `${search.replace(/\s+/g, '_')}_Daily_Outings.xlsx`);
      } else {
        link.setAttribute('download', `Daily_Outings_Report_${exportMonth}.xlsx`);
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to export breaks report');
    } finally {
      setExporting(false);
    }
  };

  const handleIndividualExport = async (teacherName: string, teacherPhone: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/breaks/export?month=${exportMonth}&search=${encodeURIComponent(teacherPhone)}&type=NORMAL`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${teacherName.replace(/\s+/g, '_')}_Daily_Outings.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert(`Failed to export break report for ${teacherName}`);
    }
  };

  const MINS_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  // Group logs by teacher identifier to combine entries per teacher in a day
  const groupedLogsMap = new Map<string, any>();
  logs.forEach((log) => {
    const key = log.identifier;
    if (!groupedLogsMap.has(key)) {
      groupedLogsMap.set(key, {
        name: log.name,
        identifier: log.identifier,
        department: log.department,
        supervisor: log.supervisor || '--',
        breaks: []
      });
    }
    groupedLogsMap.get(key).breaks.push(log);
  });
  const groupedLogs = Array.from(groupedLogsMap.values());

  const currentDuration = calculateDuration12h(outHour, outMin, outPeriod, inHour, inMin, inPeriod);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl p-6 relative max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-amber-700 flex items-center gap-2 border-b pb-3">
          <Clock size={20} /> Teacher Daily Outing Logs
        </h2>

        {showAddForm ? (
          <form onSubmit={handleAddBreak} className="space-y-4 text-xs overflow-y-auto max-h-[70vh] p-1 text-left">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wide">
                {editingLog ? 'Edit Daily Outing' : 'Log Daily Outing on Behalf of Trainee'}
              </h3>
              <button 
                type="button" 
                onClick={closeForm}
                className="text-gray-500 hover:text-gray-800 font-bold"
              >
                Back to List
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Select Trainee</label>
                <select
                  required
                  disabled={!!editingLog}
                  value={selectedTraineeId}
                  onChange={e => setSelectedTraineeId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                >
                  <option value="">-- Choose Trainee --</option>
                  {(allTrainees || []).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.empCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Date</label>
                <input 
                  type="date" 
                  required
                  value={logDate} 
                  onChange={e => setLogDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-amber-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Reason</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Tea Break"
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-amber-500 font-semibold" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase">Out Time (HH:MM AM/PM)</label>
                <div className="flex gap-2">
                  <select value={outHour} onChange={e => setOutHour(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select value={outMin} onChange={e => setOutMin(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {MINS_60.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={outPeriod} onChange={e => setOutPeriod(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {AMPM.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase">In Time (HH:MM AM/PM)</label>
                <div className="flex gap-2">
                  <select value={inHour} onChange={e => setInHour(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select value={inMin} onChange={e => setInMin(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {MINS_60.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={inPeriod} onChange={e => setInPeriod(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {AMPM.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4 bg-amber-50 p-3 rounded border border-amber-200">
              <span className="text-amber-800 font-bold uppercase text-[10px]">Computed Duration:</span>
              <span className="font-extrabold text-amber-900 bg-amber-100 px-3 py-1 rounded border border-amber-300 text-sm">
                {currentDuration}
              </span>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <button
                type="button"
                onClick={closeForm}
                className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded font-bold hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingLog ? '🚀 Update' : '🚀 Save'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Filter Controls */}
            <div className="flex flex-wrap items-end gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-150 text-xs">
              <div className="min-w-[160px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Filter Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-350 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="min-w-[160px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Search Teacher</label>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or identifier..."
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="min-w-[160px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Export Month</label>
                <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <button onClick={handleExport} disabled={exporting}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded shadow transition-all active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer whitespace-nowrap">
                <Download size={14} /> {exporting ? 'Exporting...' : 'Export'}
              </button>
              <button onClick={() => setShowAddForm(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded shadow transition-all active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer whitespace-nowrap">
                ➕ Log Outing
              </button>
            </div>

            {/* Logs Table */}
            <div className="flex-1 overflow-y-auto min-h-[300px] border border-gray-150 rounded-lg">
              {loading ? (
                <p className="text-center py-10 text-gray-400">Loading break logs...</p>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f8fafc] text-gray-700 font-bold border-b">
                    <tr>
                      <th className="px-4 py-3">Teacher</th>
                      <th className="px-4 py-3">Supervisor</th>
                      <th className="px-4 py-3">Mobile/ID</th>
                      <th className="px-4 py-3 text-center">Total Outings</th>
                      <th className="px-4 py-3 text-center w-[15%]">Export</th>
                      <th className="px-4 py-3 text-center w-[15%]">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic">No daily outing logs found for this date.</td>
                      </tr>
                    ) : (
                      groupedLogs.map((group) => (
                        <React.Fragment key={group.identifier}>
                          <tr className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-800">{group.name}</td>
                            <td className="px-4 py-3 text-gray-600">{group.supervisor}</td>
                            <td className="px-4 py-3 font-mono">{group.identifier}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-extrabold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                                {group.breaks.length} {group.breaks.length === 1 ? 'outing' : 'outings'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleIndividualExport(group.name, group.identifier)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200 rounded p-1.5 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer animate-fade-in"
                                title={`Export monthly report for ${group.name}`}
                              >
                                <Download size={14} />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setExpandedTeacher(expandedTeacher === group.identifier ? null : group.identifier)}
                                className="bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-800 border border-gray-200 rounded p-1.5 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer font-bold animate-fade-in"
                              >
                                {expandedTeacher === group.identifier ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>
                          </tr>
                          {expandedTeacher === group.identifier && (
                            <tr className="bg-amber-50/10">
                              <td colSpan={6} className="px-6 py-4 border-t border-b border-gray-150 bg-gray-50/30">
                                <div className="text-[10px] font-bold text-amber-800 uppercase mb-3 tracking-wider flex items-center gap-1.5">
                                  <Clock size={12} /> Outings for {group.name} on {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </div>
                                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-[#f8fafc] text-gray-600 font-bold border-b">
                                      <tr>
                                        <th className="px-4 py-2 w-[8%] text-center">#</th>
                                        <th className="px-4 py-2">Out Time</th>
                                        <th className="px-2 py-2 text-center w-[5%]">-</th>
                                        <th className="px-4 py-2">In Time</th>
                                        <th className="px-4 py-2 text-center">Duration</th>
                                        <th className="px-4 py-2">Reason</th>
                                        <th className="px-4 py-2 text-right w-[10%]">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-150">
                                      {group.breaks.map((b: any, idx: number) => (
                                        <tr key={b.id} className="hover:bg-gray-50/50">
                                          <td className="px-4 py-2.5 text-center font-bold text-gray-400">{idx + 1}</td>
                                          <td className="px-4 py-2.5 text-purple-700 font-semibold">{b.breakOut}</td>
                                          <td className="px-2 py-2.5 text-center text-gray-400 font-bold">➔</td>
                                          <td className="px-4 py-2.5 text-green-700 font-semibold">{b.breakIn}</td>
                                          <td className="px-4 py-2.5 text-center">
                                            <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                              {b.duration}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2.5 text-gray-600 italic font-medium">{b.reason || '--'}</td>
                                          <td className="px-4 py-2.5 text-right flex items-center justify-end gap-1">
                                            <button
                                              onClick={() => handleStartEdit(b)}
                                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200 rounded p-1 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                                              title="Edit outing details"
                                            >
                                              <Edit size={12} />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteBreak(b.id)}
                                              className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 border border-red-200 rounded p-1 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                                              title="Delete outing details"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Teacher College Visit Logs Modal ─────────────────────────────────────────
const CollegeVisitLogsModal = ({ onClose, allTrainees }: { onClose: () => void; allTrainees?: any[] }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [status, setStatus] = useState('ALL');
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().substring(0, 7));
  const [exporting, setExporting] = useState(false);
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [outHour, setOutHour] = useState('10');
  const [outMin, setOutMin] = useState('00');
  const [outPeriod, setOutPeriod] = useState('AM');
  const [inHour, setInHour] = useState('12');
  const [inMin, setInMin] = useState('30');
  const [inPeriod, setInPeriod] = useState('PM');
  const [bookletNo, setBookletNo] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [subject, setSubject] = useState('');
  const [topicsCovered, setTopicsCovered] = useState('');
  const [conveyance, setConveyance] = useState('Two Wheeler');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [month, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleProcessBreak = async (breakLogId: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/reports/breaks/process`, {
        breakLogId,
        status
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`College Visit request ${status.toLowerCase()} successfully.`);
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to process college visit request.`);
    }
  };

  const handleDeleteCollegeVisit = async (id: number) => {
    if (!window.confirm('Are you sure you want to completely delete this College Visit record? This action cannot be undone.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/breaks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('College visit record deleted successfully.');
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete record.');
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/breaks?month=${month}&search=${encodeURIComponent(search)}&status=${status}&type=COLLEGE_VISIT`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingLog(null);
    setSelectedTraineeId('');
    setBookletNo('');
    setCollegeName('');
    setSubject('');
    setTopicsCovered('');
    setConveyance('Two Wheeler');
    setOutHour('10');
    setOutMin('00');
    setOutPeriod('AM');
    setInHour('12');
    setInMin('30');
    setInPeriod('PM');
  };

  const handleStartEdit = (b: any) => {
    setEditingLog(b);
    setSelectedTraineeId(b.userId || '');
    setLogDate(parseInDate(b.date));
    setBookletNo(b.bookletNo || '');
    setCollegeName(b.collegeName || '');
    setSubject(b.subject || '');
    setTopicsCovered(b.topicsCovered || '');
    setConveyance(b.conveyance || 'Two Wheeler');

    const outTime = parse12hTime(b.fromTime);
    setOutHour(outTime.hour);
    setOutMin(outTime.min);
    setOutPeriod(outTime.period);

    const inTime = parse12hTime(b.toTime);
    setInHour(inTime.hour);
    setInMin(inTime.min);
    setInPeriod(inTime.period);

    setShowAddForm(true);
  };

  const handleAddCollegeVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraineeId) return alert('Please select a trainee.');

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const out24 = convertTo24h(outHour, outMin, outPeriod);
      const in24 = convertTo24h(inHour, inMin, inPeriod);
      const breakOutStr = `${logDate}T${out24}:00`;
      const breakInStr = `${logDate}T${in24}:00`;
      const computedDuration = calculateDuration12h(outHour, outMin, outPeriod, inHour, inMin, inPeriod);

      if (editingLog) {
        await axios.put(`${API}/breaks/${editingLog.id}`, {
          traineeId: Number(selectedTraineeId),
          date: logDate,
          breakType: 'COLLEGE_VISIT',
          breakOut: breakOutStr,
          breakIn: breakInStr,
          bookletNo: bookletNo.trim(),
          collegeName: collegeName.trim(),
          subject: subject.trim(),
          topicsCovered: topicsCovered.trim(),
          conveyance: conveyance.trim(),
          numberOfHours: computedDuration,
          fromTime: `${outHour}:${outMin} ${outPeriod}`,
          toTime: `${inHour}:${inMin} ${inPeriod}`
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('College Visit updated successfully!');
      } else {
        await axios.post(`${API}/breaks/log`, {
          traineeId: Number(selectedTraineeId),
          date: logDate,
          breakType: 'COLLEGE_VISIT',
          breakOut: breakOutStr,
          breakIn: breakInStr,
          bookletNo: bookletNo.trim(),
          collegeName: collegeName.trim(),
          subject: subject.trim(),
          topicsCovered: topicsCovered.trim(),
          conveyance: conveyance.trim(),
          numberOfHours: computedDuration,
          fromTime: `${outHour}:${outMin} ${outPeriod}`,
          toTime: `${inHour}:${inMin} ${inPeriod}`
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('College Visit logged successfully!');
      }

      closeForm();
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save college visit');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/breaks/export?month=${exportMonth}&search=${encodeURIComponent(search)}&status=${status}&type=COLLEGE_VISIT`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      if (search) {
        link.setAttribute('download', `${search.replace(/\s+/g, '_')}_College_Visits.xlsx`);
      } else {
        link.setAttribute('download', `College_Visits_Report_${exportMonth}.xlsx`);
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to export College Visit report');
    } finally {
      setExporting(false);
    }
  };

  const handleIndividualExport = async (teacherName: string, teacherPhone: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/breaks/export?month=${exportMonth}&search=${encodeURIComponent(teacherPhone)}&status=${status}&type=COLLEGE_VISIT`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${teacherName.replace(/\s+/g, '_')}_College_Visits.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert(`Failed to export College Visit report for ${teacherName}`);
    }
  };

  const MINS_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  // Group logs by teacher identifier to combine entries per teacher in a day
  const groupedLogsMap = new Map<string, any>();
  logs.forEach((log) => {
    const key = log.identifier;
    if (!groupedLogsMap.has(key)) {
      groupedLogsMap.set(key, {
        name: log.name,
        identifier: log.identifier,
        department: log.department,
        supervisor: log.supervisor || '--',
        breaks: []
      });
    }
    groupedLogsMap.get(key).breaks.push(log);
  });
  const groupedLogs = Array.from(groupedLogsMap.values());

  const currentDuration = calculateDuration12h(outHour, outMin, outPeriod, inHour, inMin, inPeriod);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl p-6 relative max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-blue-700 flex items-center gap-2 border-b pb-3">
          <GraduationCap size={20} /> Teacher College Visit Logs
        </h2>

        {showAddForm ? (
          <form onSubmit={handleAddCollegeVisit} className="space-y-4 text-xs overflow-y-auto max-h-[70vh] p-1 text-left">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide">
                {editingLog ? 'Edit College Visit' : 'Log College Visit on Behalf of Trainee'}
              </h3>
              <button 
                type="button" 
                onClick={closeForm}
                className="text-gray-500 hover:text-gray-800 font-bold"
              >
                Back to List
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Select Trainee / Teacher *</label>
                <select
                  value={selectedTraineeId}
                  onChange={(e) => setSelectedTraineeId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Trainee --</option>
                  {(allTrainees || []).map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.identifier})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Booklet No</label>
                <input
                  type="text"
                  value={bookletNo}
                  onChange={(e) => setBookletNo(e.target.value)}
                  placeholder="e.g. BKL-1024"
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">College Name *</label>
                <input
                  type="text"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  placeholder="e.g. St. Joseph College"
                  required
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Subject / Purpose *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Python Workshop / Guest Lecture"
                  required
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Conveyance Details</label>
                <input
                  type="text"
                  value={conveyance}
                  onChange={(e) => setConveyance(e.target.value)}
                  placeholder="e.g. Two Wheeler / Bus / Cab"
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Topics Covered</label>
              <textarea
                value={topicsCovered}
                onChange={(e) => setTopicsCovered(e.target.value)}
                rows={2}
                placeholder="Enter details of topics covered during college visit..."
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Timing pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-3 rounded border border-blue-100">
              <div>
                <label className="block font-bold text-blue-900 mb-1">Out Time (From)</label>
                <div className="flex items-center gap-1">
                  <select value={outHour} onChange={(e) => setOutHour(e.target.value)} className="border border-gray-300 rounded p-1 bg-white">
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span>:</span>
                  <select value={outMin} onChange={(e) => setOutMin(e.target.value)} className="border border-gray-300 rounded p-1 bg-white">
                    {MINS_60.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={outPeriod} onChange={(e) => setOutPeriod(e.target.value)} className="border border-gray-300 rounded p-1 bg-white font-bold">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-blue-900 mb-1">In Time (To)</label>
                <div className="flex items-center gap-1">
                  <select value={inHour} onChange={(e) => setInHour(e.target.value)} className="border border-gray-300 rounded p-1 bg-white">
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span>:</span>
                  <select value={inMin} onChange={(e) => setInMin(e.target.value)} className="border border-gray-300 rounded p-1 bg-white">
                    {MINS_60.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={inPeriod} onChange={(e) => setInPeriod(e.target.value)} className="border border-gray-300 rounded p-1 bg-white font-bold">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="text-right text-gray-600 font-semibold pt-1">
              Estimated Duration: <span className="text-blue-700 font-bold">{currentDuration}</span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition-all active:scale-95 cursor-pointer"
              >
                {saving ? 'Saving...' : editingLog ? 'Update College Visit' : 'Save College Visit'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Top Bar Controls */}
            <div className="flex flex-wrap items-end gap-3 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-150 text-xs">
              <div className="min-w-[140px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Filter Month</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="min-w-[160px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Search Teacher</label>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or identifier..."
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="min-w-[130px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="ALL">All Statuses</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Export Month</label>
                <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={handleExport} disabled={exporting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded shadow transition-all active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer whitespace-nowrap">
                <Download size={14} /> {exporting ? 'Exporting...' : 'Export'}
              </button>
              <button onClick={() => setShowAddForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded shadow transition-all active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer whitespace-nowrap">
                ➕ Log College Visit
              </button>
            </div>

            {/* Logs Table */}
            <div className="flex-1 overflow-y-auto min-h-[300px] border border-gray-150 rounded-lg">
              {loading ? (
                <p className="text-center py-10 text-gray-400">Loading College Visit logs...</p>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f8fafc] text-gray-700 font-bold border-b">
                    <tr>
                      <th className="px-4 py-3">Teacher</th>
                      <th className="px-4 py-3">Supervisor</th>
                      <th className="px-4 py-3">Mobile/ID</th>
                      <th className="px-4 py-3 text-center">Total Visits</th>
                      <th className="px-4 py-3 text-center w-[15%]">Export</th>
                      <th className="px-4 py-3 text-center w-[15%]">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic">No College Visit logs found for this month.</td>
                      </tr>
                    ) : (
                      groupedLogs.map((group) => (
                        <React.Fragment key={group.identifier}>
                          <tr className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-800">{group.name}</td>
                            <td className="px-4 py-3 text-gray-600">{group.supervisor}</td>
                            <td className="px-4 py-3 font-mono">{group.identifier}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                                {group.breaks.length} {group.breaks.length === 1 ? 'visit' : 'visits'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleIndividualExport(group.name, group.identifier)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border border-blue-200 rounded p-1.5 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer animate-fade-in"
                                title={`Export monthly report for ${group.name}`}
                              >
                                <Download size={14} />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setExpandedTeacher(expandedTeacher === group.identifier ? null : group.identifier)}
                                className="bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-800 border border-gray-200 rounded p-1.5 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer font-bold animate-fade-in"
                              >
                                {expandedTeacher === group.identifier ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>
                          </tr>
                          {expandedTeacher === group.identifier && (
                            <tr className="bg-blue-50/10">
                              <td colSpan={6} className="px-6 py-4 border-t border-b border-gray-150 bg-gray-50/30">
                                <div className="text-[10px] font-bold text-blue-800 uppercase mb-3 tracking-wider flex items-center gap-1.5">
                                  <GraduationCap size={12} /> Visits for {group.name} ({month})
                                </div>
                                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-[#f8fafc] text-gray-600 font-bold border-b">
                                      <tr>
                                        <th className="px-3 py-2 w-[4%] text-center">#</th>
                                        <th className="px-3 py-2">Date</th>
                                        <th className="px-3 py-2">Booklet No</th>
                                        <th className="px-3 py-2">College Name</th>
                                        <th className="px-3 py-2">Subject / Purpose</th>
                                        <th className="px-3 py-2">Topics Covered</th>
                                        <th className="px-3 py-2">Conveyance</th>
                                        <th className="px-3 py-2">Planned Timing</th>
                                        <th className="px-3 py-2 text-center">No of hours</th>
                                        <th className="px-3 py-2 text-center">Punch In Time</th>
                                        <th className="px-3 py-2 text-center">Punch Out Time</th>
                                        <th className="px-3 py-2 text-center">Punch Duration</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                        <th className="px-3 py-2 text-right w-[15%]">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-150">
                                      {group.breaks.map((b: any, idx: number) => (
                                        <tr key={b.id} className="hover:bg-gray-50/50">
                                          <td className="px-3 py-2.5 text-center font-bold text-gray-400">{idx + 1}</td>
                                          <td className="px-3 py-2.5 font-semibold text-gray-700">{b.date}</td>
                                          <td className="px-3 py-2.5 font-semibold text-gray-700">{b.bookletNo || '--'}</td>
                                          <td className="px-3 py-2.5 text-gray-800 font-medium">{b.collegeName || '--'}</td>
                                          <td className="px-3 py-2.5 text-gray-800 font-medium">{b.subject || b.reason || '--'}</td>
                                          <td className="px-3 py-2.5 text-gray-600">{b.topicsCovered || '--'}</td>
                                          <td className="px-3 py-2.5 text-gray-600">{b.conveyance || '--'}</td>
                                          <td className="px-3 py-2.5 text-gray-700 font-mono">{b.fromTime && b.toTime ? `${b.fromTime} - ${b.toTime}` : '--'}</td>
                                          <td className="px-3 py-2.5 text-center text-gray-600">{b.numberOfHours || '--'}</td>
                                          <td className="px-3 py-2.5 text-center text-purple-700 font-semibold">{b.punchIn || '--'}</td>
                                          <td className="px-3 py-2.5 text-center text-green-700 font-semibold">{b.punchOut || '--'}</td>
                                          <td className="px-3 py-2.5 text-center">
                                            <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                              {b.punchDuration || '--'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2.5 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                                              b.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                              b.status === 'APPROVED' ? 'bg-green-100 text-green-800 border border-green-200' :
                                              'bg-red-100 text-red-800 border border-red-200'
                                            }`}>
                                              {b.status}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2.5 text-right flex items-center justify-end gap-1">
                                            {b.status === 'PENDING' && (
                                              <>
                                                <button
                                                  onClick={() => handleProcessBreak(b.id, 'APPROVED')}
                                                  className="bg-green-50 hover:bg-green-100 text-green-700 hover:text-green-855 border border-green-200 rounded px-1.5 py-0.5 text-[9px] font-bold transition-all active:scale-90 cursor-pointer"
                                                  title="Approve visit"
                                                >
                                                  Approve
                                                </button>
                                                <button
                                                  onClick={() => handleProcessBreak(b.id, 'REJECTED')}
                                                  className="bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-855 border border-red-200 rounded px-1.5 py-0.5 text-[9px] font-bold transition-all active:scale-90 cursor-pointer"
                                                  title="Reject visit"
                                                >
                                                  Reject
                                                </button>
                                              </>
                                            )}
                                            <button
                                              onClick={() => handleStartEdit(b)}
                                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border border-blue-200 rounded p-1 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                                              title="Edit college visit details"
                                            >
                                              <Edit size={12} />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteCollegeVisit(b.id)}
                                              className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 border border-red-200 rounded p-1 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                                              title="Delete college visit record"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold border-t border-gray-200">
                                      <tr>
                                        <td colSpan={8} className="px-3 py-2 text-right text-gray-700">Total Hours:</td>
                                        <td className="px-3 py-2 text-center font-extrabold text-blue-700">
                                          {(() => {
                                            const total = group.breaks.reduce((acc: number, b: any) => {
                                              const val = parseFloat(b.numberOfHours);
                                              return acc + (isNaN(val) ? 0 : val);
                                            }, 0);
                                            return total.toFixed(2);
                                          })()} hrs
                                        </td>
                                        <td colSpan={5} className="px-3 py-2"></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Extra Classes Logs Modal ──────────────────────────────────────────────────
const ExtraClassesLogsModal = ({ onClose, allTrainees }: { onClose: () => void; allTrainees?: any[] }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [status, setStatus] = useState('ALL'); // ALL, PENDING, APPROVED, REJECTED
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [exporting, setExporting] = useState(false);
  const [adminRemarks, setAdminRemarks] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState<Record<number, boolean>>({});

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [subject, setSubject] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [noOfStudents, setNoOfStudents] = useState('0');
  const [centerName, setCenterName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [outHour, setOutHour] = useState('10');
  const [outMin, setOutMin] = useState('00');
  const [outPeriod, setOutPeriod] = useState('AM');
  const [inHour, setInHour] = useState('11');
  const [inMin, setInMin] = useState('30');
  const [inPeriod, setInPeriod] = useState('AM');
  const [saving, setSaving] = useState(false);
  const [classMode, setClassMode] = useState('OFFLINE');

  useEffect(() => {
    fetchLogs();
  }, [search, month, status]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const statusParam = status === 'ALL' ? '' : status;
      const res = await axios.get(`${API}/extra-classes?status=${statusParam}&search=${search}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingLog(null);
    setSelectedTraineeId('');
    setSubject('');
    setBatchNo('');
    setNoOfStudents('0');
    setCenterName('');
    setRemarks('');
    setClassMode('OFFLINE');
    setOutHour('10');
    setOutMin('00');
    setOutPeriod('AM');
    setInHour('11');
    setInMin('30');
    setInPeriod('AM');
  };

  const handleStartEdit = (b: any) => {
    setEditingLog(b);
    setSelectedTraineeId(b.userId || '');
    setLogDate(parseInDate(b.date));
    setSubject(b.subject || '');
    setBatchNo(b.batchNo || '');
    setNoOfStudents(String(b.noOfStudents || 0));
    setCenterName(b.centerName || '');
    setRemarks(b.remarks || '');
    setClassMode(b.classMode || 'OFFLINE');

    const outTime = parse12hTime(b.startTime);
    setOutHour(outTime.hour);
    setOutMin(outTime.min);
    setOutPeriod(outTime.period);

    const inTime = parse12hTime(b.endTime);
    setInHour(inTime.hour);
    setInMin(inTime.min);
    setInPeriod(inTime.period);

    setShowAddForm(true);
  };

  const handleAddExtraClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraineeId) return alert('Please select a trainee.');

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const durationVal = getDurationInHours(outHour, outMin, outPeriod, inHour, inMin, inPeriod);
      const startTimeStr = `${outHour}:${outMin} ${outPeriod}`;
      const endTimeStr = `${inHour}:${inMin} ${inPeriod}`;

      if (editingLog) {
        await axios.put(`${API}/extra-classes/${editingLog.id}`, {
          traineeId: Number(selectedTraineeId),
          date: logDate,
          subject: subject.trim(),
          batchNo: batchNo.trim(),
          duration: durationVal,
          startTime: startTimeStr,
          endTime: endTimeStr,
          noOfStudents: parseInt(noOfStudents) || 0,
          centerName: centerName.trim(),
          remarks: remarks.trim(),
          classMode: classMode
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Extra class updated successfully!');
      } else {
        await axios.post(`${API}/extra-classes/log`, {
          traineeId: Number(selectedTraineeId),
          date: logDate,
          subject: subject.trim(),
          batchNo: batchNo.trim(),
          duration: durationVal,
          startTime: startTimeStr,
          endTime: endTimeStr,
          noOfStudents: parseInt(noOfStudents) || 0,
          centerName: centerName.trim(),
          remarks: remarks.trim(),
          classMode: classMode
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Extra class logged successfully and auto-approved!');
      }

      closeForm();
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save extra class');
    } finally {
      setSaving(false);
    }
  };

  const handleProcess = async (logId: number, newStatus: 'APPROVED' | 'REJECTED') => {
    const remark = adminRemarks[logId] || '';
    if (!remark.trim()) {
      alert(`Please enter a remark before clicking ${newStatus === 'APPROVED' ? 'Approve' : 'Reject'}.`);
      return;
    }
    setProcessing(prev => ({ ...prev, [logId]: true }));
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/extra-classes/process`, {
        logId,
        status: newStatus,
        adminReason: remark
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Log ${newStatus.toLowerCase()} successfully.`);
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to process request');
    } finally {
      setProcessing(prev => ({ ...prev, [logId]: false }));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/extra-classes/export?month=${exportMonth}&search=${search}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Extra_Classes_${exportMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to export Extra Classes report');
    } finally {
      setExporting(false);
    }
  };

  const handleIndividualExport = async (teacherName: string, teacherPhone: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/extra-classes/export?month=${exportMonth}&search=${encodeURIComponent(teacherPhone)}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${teacherName.replace(/\s+/g, '_')}_Extra_Classes_${exportMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert(`Failed to export Extra Classes report for ${teacherName}`);
    }
  };

  const MINS_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  const currentDuration = calculateDuration12h(outHour, outMin, outPeriod, inHour, inMin, inPeriod);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl p-6 relative max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-emerald-700 flex items-center gap-2 border-b pb-3">
          <BookOpen size={20} /> Teacher Extra Classes Logs
        </h2>

        {showAddForm ? (
          <form onSubmit={handleAddExtraClass} className="space-y-4 text-xs overflow-y-auto max-h-[70vh] p-1 text-left">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wide">
                {editingLog ? 'Edit Extra Class' : 'Log Extra Class on Behalf of Trainee'}
              </h3>
              <button 
                type="button" 
                onClick={closeForm}
                className="text-gray-500 hover:text-gray-800 font-bold"
              >
                Back to List
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Select Trainee</label>
                <select
                  required
                  disabled={!!editingLog}
                  value={selectedTraineeId}
                  onChange={e => setSelectedTraineeId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="">-- Choose Trainee --</option>
                  {(allTrainees || []).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.empCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Date</label>
                <input 
                  type="date" 
                  required
                  value={logDate} 
                  onChange={e => setLogDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Center Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="Enter Center Name"
                  value={centerName} 
                  onChange={e => setCenterName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Class Mode</label>
                <select
                  value={classMode}
                  onChange={e => setClassMode(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="OFFLINE">Offline</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Subject / Topic</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. JavaScript Async"
                  value={subject} 
                  onChange={e => setSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Batch Code / No</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. BATCH-101"
                  value={batchNo} 
                  onChange={e => setBatchNo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">No of Students Attended</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  placeholder="e.g. 25"
                  value={noOfStudents} 
                  onChange={e => setNoOfStudents(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase">Class Start Time (HH:MM AM/PM)</label>
                <div className="flex gap-2">
                  <select value={outHour} onChange={e => setOutHour(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select value={outMin} onChange={e => setOutMin(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {MINS_60.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={outPeriod} onChange={e => setOutPeriod(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {AMPM.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase">Class End Time (HH:MM AM/PM)</label>
                <div className="flex gap-2">
                  <select value={inHour} onChange={e => setInHour(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select value={inMin} onChange={e => setInMin(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {MINS_60.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={inPeriod} onChange={e => setInPeriod(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {AMPM.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Remarks / Additional Details</label>
              <textarea 
                placeholder="Enter remarks or additional details..."
                value={remarks} 
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold resize-none" 
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4 bg-emerald-50 p-3 rounded border border-emerald-200">
              <span className="text-emerald-800 font-bold uppercase text-[10px]">Computed Duration:</span>
              <span className="font-extrabold text-emerald-900 bg-emerald-100 px-3 py-1 rounded border border-emerald-300 text-sm">
                {currentDuration}
              </span>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <button
                type="button"
                onClick={closeForm}
                className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded font-bold hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingLog ? '🚀 Update' : '🚀 Save'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Filter Controls */}
            <div className="flex flex-wrap items-end gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-150 text-xs">
              <div className="min-w-[140px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Filter Month</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Search Teacher</label>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or ID..."
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="min-w-[130px]">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium">
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="REJECTED">Rejected Only</option>
                </select>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Export Month</label>
                <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <button onClick={handleExport} disabled={exporting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded shadow transition-all active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer whitespace-nowrap">
                <Download size={14} /> {exporting ? 'Exporting...' : 'Export'}
              </button>
              <button onClick={() => setShowAddForm(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded shadow transition-all active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer whitespace-nowrap">
                ➕ Log Extra Class
              </button>
            </div>

            {/* Logs Table */}
            <div className="flex-1 overflow-auto min-h-[300px] border border-gray-150 rounded-lg">
              {loading ? (
                <p className="text-center py-10 text-gray-400">Loading logs...</p>
              ) : (
                <table className="w-full min-w-[1100px] text-xs text-left">
                  <thead className="bg-[#f8fafc] text-gray-700 font-bold border-b sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3">Teacher</th>
                      <th className="px-4 py-3">Date & Day</th>
                      <th className="px-4 py-3">Subject & Batch</th>
                      <th className="px-4 py-3">Center</th>
                      <th className="px-4 py-3 text-center">Timing & Duration</th>
                      <th className="px-4 py-3 text-center">Students</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Remarks / Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-gray-400 italic">No extra class logs found.</td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-800">{log.user?.fullName}</div>
                            <div className="text-[10px] text-gray-500">{log.user?.identifier} • {log.user?.department}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-700">
                            <div>{new Date(log.date).toLocaleDateString('en-IN')}</div>
                            <div className="text-[10px] text-gray-400">{log.day}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-emerald-800">{log.subject}</div>
                            <div className="text-[10px] font-mono text-gray-500">Batch: {log.batchNo}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-600">
                            <div>{log.centerName}</div>
                            <div className="text-[10px] font-bold text-gray-400">({log.classMode || 'OFFLINE'})</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="font-mono text-purple-700 font-semibold">{log.startTime} - {log.endTime}</div>
                            <div className="text-[10px] font-bold text-gray-500">{log.duration} hrs</div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-700">{log.noOfStudents}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                              log.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                              log.status === 'APPROVED' ? 'bg-green-100 text-green-800 border border-green-200' :
                              'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right max-w-xs">
                            <div className="flex flex-col gap-2 items-end">
                              {log.remarks && (
                                <div className="text-[10px] text-gray-500 italic mb-1 text-left w-full max-w-[200px] line-clamp-2" title={log.remarks}>
                                  Teacher: "{log.remarks}"
                                </div>
                              )}
                              
                              <div className="flex gap-2 items-center w-full justify-between max-w-[200px]">
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleStartEdit(log)}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200 rounded p-1 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                                    title="Edit extra class details"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleIndividualExport(log.user?.fullName, log.user?.identifier)}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200 rounded px-2 py-1 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer text-[10px] font-bold gap-1"
                                    title={`Export monthly report for ${log.user?.fullName}`}
                                  >
                                    <Download size={12} /> Excel
                                  </button>
                                </div>
                                
                                {log.status === 'PENDING' && (
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleProcess(log.id, 'APPROVED')} 
                                      disabled={processing[log.id]}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer shadow-sm active:scale-95"
                                    >
                                      Approve
                                    </button>
                                    <button 
                                      onClick={() => handleProcess(log.id, 'REJECTED')} 
                                      disabled={processing[log.id]}
                                      className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer shadow-sm active:scale-95"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>

                              {log.status === 'PENDING' ? (
                                <input 
                                  type="text"
                                  placeholder="Supervisor remark..."
                                  value={adminRemarks[log.id] || ''}
                                  onChange={(e) => setAdminRemarks(prev => ({ ...prev, [log.id]: e.target.value }))}
                                  className="border border-gray-300 rounded px-2 py-1 text-[11px] w-full max-w-[200px] outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              ) : (
                                <div className="text-[10px] text-gray-500 font-medium text-left bg-gray-50 p-1.5 rounded border w-full max-w-[200px]">
                                  <span className="font-bold text-gray-600 block">Supervisor Remark:</span>
                                  {log.adminReason || '--'}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold border-t border-gray-200 sticky bottom-0 z-10">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Total Approved Hours:</td>
                      <td className="px-4 py-3 text-center font-extrabold text-emerald-700">
                        {(() => {
                          const total = logs.reduce((acc: number, log: any) => {
                            if (log.status === 'APPROVED') {
                              const val = parseFloat(log.duration);
                              return acc + (isNaN(val) ? 0 : val);
                            }
                            return acc;
                          }, 0);
                          return total.toFixed(2);
                        })()} hrs
                      </td>
                      <td colSpan={3} className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Other Center Classes Logs Modal ──────────────────────────────────────────────────
const OtherCenterClassesLogsModal = ({ onClose, allTrainees }: { onClose: () => void; allTrainees?: any[] }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [status, setStatus] = useState('ALL'); // ALL, PENDING, APPROVED, REJECTED
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [exporting, setExporting] = useState(false);
  const [adminRemarks, setAdminRemarks] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState<Record<number, boolean>>({});

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [subject, setSubject] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [noOfStudents, setNoOfStudents] = useState('0');
  const [centerName, setCenterName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [outHour, setOutHour] = useState('10');
  const [outMin, setOutMin] = useState('00');
  const [outPeriod, setOutPeriod] = useState('AM');
  const [inHour, setInHour] = useState('11');
  const [inMin, setInMin] = useState('30');
  const [inPeriod, setInPeriod] = useState('AM');
  const [saving, setSaving] = useState(false);
  const [classMode, setClassMode] = useState('OFFLINE');

  useEffect(() => {
    fetchLogs();
  }, [search, month, status]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const statusParam = status === 'ALL' ? '' : status;
      const res = await axios.get(`${API}/other-center-classes?status=${statusParam}&search=${search}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingLog(null);
    setSelectedTraineeId('');
    setSubject('');
    setBatchNo('');
    setNoOfStudents('0');
    setCenterName('');
    setRemarks('');
    setClassMode('OFFLINE');
    setOutHour('10');
    setOutMin('00');
    setOutPeriod('AM');
    setInHour('11');
    setInMin('30');
    setInPeriod('AM');
  };

  const handleStartEdit = (b: any) => {
    setEditingLog(b);
    setSelectedTraineeId(b.userId || '');
    setLogDate(parseInDate(b.date));
    setSubject(b.subject || '');
    setBatchNo(b.batchNo || '');
    setNoOfStudents(String(b.noOfStudents || 0));
    setCenterName(b.centerName || '');
    setRemarks(b.remarks || '');
    setClassMode(b.classMode || 'OFFLINE');

    const outTime = parse12hTime(b.startTime);
    setOutHour(outTime.hour);
    setOutMin(outTime.min);
    setOutPeriod(outTime.period);

    const inTime = parse12hTime(b.endTime);
    setInHour(inTime.hour);
    setInMin(inTime.min);
    setInPeriod(inTime.period);

    setShowAddForm(true);
  };

  const handleAddOtherCenterClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraineeId) return alert('Please select a trainee.');

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const durationVal = getDurationInHours(outHour, outMin, outPeriod, inHour, inMin, inPeriod);
      const startTimeStr = `${outHour}:${outMin} ${outPeriod}`;
      const endTimeStr = `${inHour}:${inMin} ${inPeriod}`;

      if (editingLog) {
        await axios.put(`${API}/other-center-classes/${editingLog.id}`, {
          traineeId: Number(selectedTraineeId),
          date: logDate,
          subject: subject.trim(),
          batchNo: batchNo.trim(),
          duration: durationVal,
          startTime: startTimeStr,
          endTime: endTimeStr,
          noOfStudents: parseInt(noOfStudents) || 0,
          centerName: centerName.trim(),
          remarks: remarks.trim(),
          classMode: classMode
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Other center class updated successfully!');
      } else {
        await axios.post(`${API}/other-center-classes/log`, {
          traineeId: Number(selectedTraineeId),
          date: logDate,
          subject: subject.trim(),
          batchNo: batchNo.trim(),
          duration: durationVal,
          startTime: startTimeStr,
          endTime: endTimeStr,
          noOfStudents: parseInt(noOfStudents) || 0,
          centerName: centerName.trim(),
          remarks: remarks.trim(),
          classMode: classMode
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Other center class logged successfully and auto-approved!');
      }

      closeForm();
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save other center class');
    } finally {
      setSaving(false);
    }
  };

  const handleProcess = async (logId: number, newStatus: 'APPROVED' | 'REJECTED') => {
    const remark = adminRemarks[logId] || '';
    if (!remark.trim()) {
      alert(`Please enter a remark before clicking ${newStatus === 'APPROVED' ? 'Approve' : 'Reject'}.`);
      return;
    }
    setProcessing(prev => ({ ...prev, [logId]: true }));
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/other-center-classes/process`, {
        logId,
        status: newStatus,
        adminReason: remark
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Log ${newStatus.toLowerCase()} successfully.`);
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to process request');
    } finally {
      setProcessing(prev => ({ ...prev, [logId]: false }));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/other-center-classes/export?month=${exportMonth}&search=${search}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Other_Center_Classes_${exportMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to export Other Center Classes report');
    } finally {
      setExporting(false);
    }
  };

  const handleIndividualExport = async (teacherName: string, teacherPhone: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/other-center-classes/export?month=${exportMonth}&search=${encodeURIComponent(teacherPhone)}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${teacherName.replace(/\s+/g, '_')}_Other_Center_Classes_${exportMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert(`Failed to export Other Center Classes report for ${teacherName}`);
    }
  };

  const MINS_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  const currentDuration = calculateDuration12h(outHour, outMin, outPeriod, inHour, inMin, inPeriod);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl p-6 relative max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-sky-700 flex items-center gap-2 border-b pb-3">
          <BookOpen size={20} className="text-sky-600" /> Teacher Other Center Classes Logs
        </h2>

        {showAddForm ? (
          <form onSubmit={handleAddOtherCenterClass} className="space-y-4 text-xs overflow-y-auto max-h-[70vh] p-1 text-left">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-sky-700 uppercase tracking-wide">
                {editingLog ? 'Edit Other Center Class' : 'Log Other Center Class on Behalf of Trainee'}
              </h3>
              <button 
                type="button" 
                onClick={closeForm}
                className="text-gray-500 hover:text-gray-800 font-bold"
              >
                Back to List
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Select Trainee</label>
                <select
                  required
                  disabled={!!editingLog}
                  value={selectedTraineeId}
                  onChange={e => setSelectedTraineeId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                >
                  <option value="">-- Choose Trainee --</option>
                  {(allTrainees || []).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.empCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Date</label>
                <input 
                  type="date" 
                  required
                  value={logDate} 
                  onChange={e => setLogDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-sky-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Center Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="Enter Center Name"
                  value={centerName} 
                  onChange={e => setCenterName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-sky-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Class Mode</label>
                <select
                  value={classMode}
                  onChange={e => setClassMode(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                >
                  <option value="OFFLINE">Offline</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Subject / Topic</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. JavaScript Async"
                  value={subject} 
                  onChange={e => setSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-sky-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Batch Code / No</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. BATCH-101"
                  value={batchNo} 
                  onChange={e => setBatchNo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-sky-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">No of Students Attended</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  placeholder="e.g. 25"
                  value={noOfStudents} 
                  onChange={e => setNoOfStudents(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-sky-500 font-semibold" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase">Class Start Time (HH:MM AM/PM)</label>
                <div className="flex gap-2">
                  <select value={outHour} onChange={e => setOutHour(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select value={outMin} onChange={e => setOutMin(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {MINS_60.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={outPeriod} onChange={e => setOutPeriod(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {AMPM.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase">Class End Time (HH:MM AM/PM)</label>
                <div className="flex gap-2">
                  <select value={inHour} onChange={e => setInHour(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select value={inMin} onChange={e => setInMin(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {MINS_60.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={inPeriod} onChange={e => setInPeriod(e.target.value)} className="flex-1 border border-gray-300 rounded p-2 bg-white font-semibold">
                    {AMPM.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Remarks / Additional Details</label>
              <textarea 
                placeholder="Enter remarks or additional details..."
                value={remarks} 
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                className="w-full border border-gray-355 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-sky-500 font-semibold resize-none" 
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4 bg-sky-50 p-3 rounded border border-sky-200">
              <span className="text-sky-850 font-bold uppercase text-[10px]">Computed Duration:</span>
              <span className="font-extrabold text-sky-900 bg-sky-100 px-3 py-1 rounded border border-sky-300 text-sm">
                {currentDuration}
              </span>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <button
                type="button"
                onClick={closeForm}
                className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded font-bold hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2 rounded font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingLog ? '🚀 Update' : '🚀 Save'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Filter Controls */}
            <div className="flex flex-wrap items-end gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-150 text-xs">
              <div className="min-w-[140px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Filter Month</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Search Teacher</label>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or ID..."
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="min-w-[130px]">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-sky-500 font-medium">
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="REJECTED">Rejected Only</option>
                </select>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Export Month</label>
                <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <button onClick={handleExport} disabled={exporting}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 rounded shadow transition-all active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer whitespace-nowrap">
                <Download size={14} /> {exporting ? 'Exporting...' : 'Export'}
              </button>
              <button onClick={() => setShowAddForm(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 rounded shadow transition-all active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer whitespace-nowrap">
                ➕ Log Other Center Class
              </button>
            </div>

            {/* Logs Table */}
            <div className="flex-1 overflow-auto min-h-[300px] border border-gray-150 rounded-lg">
              {loading ? (
                <p className="text-center py-10 text-gray-400">Loading logs...</p>
              ) : (
                <table className="w-full min-w-[1100px] text-xs text-left">
                  <thead className="bg-[#f8fafc] text-gray-700 font-bold border-b sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3">Teacher</th>
                      <th className="px-4 py-3">Date & Day</th>
                      <th className="px-4 py-3">Subject & Batch</th>
                      <th className="px-4 py-3">Center</th>
                      <th className="px-4 py-3 text-center">Timing & Duration</th>
                      <th className="px-4 py-3 text-center">Students</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Remarks / Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-gray-400 italic">No other center class logs found.</td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-800">{log.user?.fullName}</div>
                            <div className="text-[10px] text-gray-500">{log.user?.identifier} • {log.user?.department}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-700">
                            <div>{new Date(log.date).toLocaleDateString('en-IN')}</div>
                            <div className="text-[10px] text-gray-400">{log.day}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-sky-800">{log.subject}</div>
                            <div className="text-[10px] font-mono text-gray-500">Batch: {log.batchNo}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-600">
                            <div>{log.centerName}</div>
                            <div className="text-[10px] font-bold text-gray-400">({log.classMode || 'OFFLINE'})</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="font-mono text-purple-700 font-semibold">{log.startTime} - {log.endTime}</div>
                            <div className="text-[10px] font-bold text-gray-500">{log.duration} hrs</div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-700">{log.noOfStudents}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                              log.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                              log.status === 'APPROVED' ? 'bg-green-100 text-green-800 border border-green-200' :
                              'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right max-w-xs">
                            <div className="flex flex-col gap-2 items-end">
                              {log.remarks && (
                                <div className="text-[10px] text-gray-500 italic mb-1 text-left w-full max-w-[200px] line-clamp-2" title={log.remarks}>
                                  Teacher: "{log.remarks}"
                                </div>
                              )}
                              
                              <div className="flex gap-2 items-center w-full justify-between max-w-[200px]">
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleStartEdit(log)}
                                    className="bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-800 border border-sky-200 rounded p-1 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                                    title="Edit other center class details"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleIndividualExport(log.user?.fullName, log.user?.identifier)}
                                    className="bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-800 border border-sky-200 rounded px-2 py-1 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer text-[10px] font-bold gap-1"
                                    title={`Export monthly report for ${log.user?.fullName}`}
                                  >
                                    <Download size={12} /> Excel
                                  </button>
                                </div>
                                
                                {log.status === 'PENDING' && (
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleProcess(log.id, 'APPROVED')} 
                                      disabled={processing[log.id]}
                                      className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer shadow-sm active:scale-95"
                                    >
                                      Approve
                                    </button>
                                    <button 
                                      onClick={() => handleProcess(log.id, 'REJECTED')} 
                                      disabled={processing[log.id]}
                                      className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer shadow-sm active:scale-95"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>

                              {log.status === 'PENDING' ? (
                                <input 
                                  type="text"
                                  placeholder="Supervisor remark..."
                                  value={adminRemarks[log.id] || ''}
                                  onChange={(e) => setAdminRemarks(prev => ({ ...prev, [log.id]: e.target.value }))}
                                  className="border border-gray-300 rounded px-2 py-1 text-[11px] w-full max-w-[200px] outline-none focus:ring-1 focus:ring-sky-500"
                                />
                              ) : (
                                <div className="text-[10px] text-gray-500 font-medium text-left bg-gray-50 p-1.5 rounded border w-full max-w-[200px]">
                                  <span className="font-bold text-gray-600 block">Supervisor Remark:</span>
                                  {log.adminReason || '--'}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold border-t border-gray-200 sticky bottom-0 z-10">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Total Approved Hours:</td>
                      <td className="px-4 py-3 text-center font-extrabold text-sky-700">
                        {(() => {
                          const total = logs.reduce((acc: number, log: any) => {
                            if (log.status === 'APPROVED') {
                              const val = parseFloat(log.duration);
                              return acc + (isNaN(val) ? 0 : val);
                            }
                            return acc;
                          }, 0);
                          return total.toFixed(2);
                        })()} hrs
                      </td>
                      <td colSpan={3} className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Cancelled Classes Logs Modal ──────────────────────────────────────────────
const CancelledClassesLogsModal = ({ onClose, allTrainees }: { onClose: () => void; allTrainees?: any[] }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [exporting, setExporting] = useState(false);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [subject, setSubject] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [centerName, setCenterName] = useState('');
  const [reason, setReason] = useState('Personal Work');
  const [customReason, setCustomReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const CANCELLATION_REASONS = [
    'Personal Work',
    'Health Issues / Medical Leave',
    'Official Meeting / Training',
    'Holiday / Festival',
    'Technical Issues / Power Cut',
    'Other (Specify below)'
  ];

  useEffect(() => {
    fetchLogs();
  }, [search, month]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/classes-cancelled?search=${search}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingLog(null);
    setSelectedTraineeId('');
    setSubject('');
    setBatchNo('');
    setCenterName('');
    setReason('Personal Work');
    setCustomReason('');
    setRemarks('');
  };

  const handleStartEdit = (b: any) => {
    setEditingLog(b);
    setSelectedTraineeId(b.userId || '');
    setLogDate(parseInDate(b.date));
    setSubject(b.subject || '');
    setBatchNo(b.batchNo || '');
    setCenterName(b.centerName || '');
    
    // Check if the reason is one of the standard options
    if (CANCELLATION_REASONS.includes(b.reason)) {
      setReason(b.reason);
      setCustomReason('');
    } else {
      setReason('Other (Specify below)');
      setCustomReason(b.reason || '');
    }
    
    setRemarks(b.remarks || '');
    setShowAddForm(true);
  };

  const handleAddCancelledClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraineeId) return alert('Please select a trainee.');

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const reasonVal = reason.startsWith('Other') ? customReason.trim() : reason;
      if (!reasonVal) return alert('Please enter a cancellation reason.');

      if (editingLog) {
        await axios.put(`${API}/class-cancelled/${editingLog.id}`, {
          traineeId: Number(selectedTraineeId),
          date: logDate,
          subject: subject.trim(),
          batchNo: batchNo.trim(),
          centerName: centerName.trim(),
          reason: reasonVal,
          remarks: remarks.trim()
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Cancelled class updated successfully!');
      } else {
        await axios.post(`${API}/class-cancelled/log`, {
          traineeId: Number(selectedTraineeId),
          date: logDate,
          subject: subject.trim(),
          batchNo: batchNo.trim(),
          centerName: centerName.trim(),
          reason: reasonVal,
          remarks: remarks.trim()
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Cancelled class logged successfully!');
      }

      closeForm();
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save cancelled class');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/classes-cancelled/export?month=${exportMonth}&search=${search}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cancelled_Classes_${exportMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to export Cancelled Classes report');
    } finally {
      setExporting(false);
    }
  };

  const handleIndividualExport = async (teacherName: string, teacherPhone: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/classes-cancelled/export?month=${exportMonth}&search=${encodeURIComponent(teacherPhone)}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${teacherName.replace(/\s+/g, '_')}_Cancelled_Classes_${exportMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert(`Failed to export Cancelled Classes report for ${teacherName}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl p-6 relative max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-red-700 flex items-center gap-2 border-b pb-3">
          <CalendarX size={20} /> Teacher Cancelled Classes Logs
        </h2>

        {showAddForm ? (
          <form onSubmit={handleAddCancelledClass} className="space-y-4 text-xs overflow-y-auto max-h-[70vh] p-1 text-left">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide">
                {editingLog ? 'Edit Cancelled Class' : 'Log Cancelled Class on Behalf of Trainee'}
              </h3>
              <button 
                type="button" 
                onClick={closeForm}
                className="text-gray-500 hover:text-gray-800 font-bold"
              >
                Back to List
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Select Trainee</label>
                <select
                  required
                  disabled={!!editingLog}
                  value={selectedTraineeId}
                  onChange={e => setSelectedTraineeId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500 font-semibold"
                >
                  <option value="">-- Choose Trainee --</option>
                  {(allTrainees || []).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.empCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Date</label>
                <input 
                  type="date" 
                  required
                  value={logDate} 
                  onChange={e => setLogDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Center Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="Enter Center Name"
                  value={centerName} 
                  onChange={e => setCenterName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500 font-semibold" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Subject / Topic</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Java Classes"
                  value={subject} 
                  onChange={e => setSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Batch Code / No</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. BTC-999"
                  value={batchNo} 
                  onChange={e => setBatchNo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500 font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Cancellation Reason</label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500 font-semibold animate-fade-in"
                >
                  {CANCELLATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {reason.startsWith('Other') && (
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Specify Custom Reason</label>
                <input 
                  type="text" 
                  required
                  placeholder="Enter the specific reason for cancellation"
                  value={customReason} 
                  onChange={e => setCustomReason(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500 font-semibold" 
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Remarks / Additional Details</label>
              <textarea 
                placeholder="Enter remarks or additional details..."
                value={remarks} 
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500 font-semibold resize-none" 
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <button
                type="button"
                onClick={closeForm}
                className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded font-bold hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingLog ? '🚀 Update' : '🚀 Save'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Filter Controls */}
            <div className="flex flex-wrap items-end gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-150 text-xs">
              <div className="min-w-[160px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Filter Month</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="min-w-[160px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Search Teacher</label>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or ID..."
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="min-w-[160px] flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Export Month</label>
                <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
                  className="w-full border border-gray-355 rounded px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <button onClick={handleExport} disabled={exporting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded shadow transition-all active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer whitespace-nowrap">
                <Download size={14} /> {exporting ? 'Exporting...' : 'Export'}
              </button>
              <button onClick={() => setShowAddForm(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded shadow transition-all active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer whitespace-nowrap">
                ➕ Log Cancelled Class
              </button>
            </div>

            {/* Logs Table */}
            <div className="flex-1 overflow-y-auto min-h-[300px] border border-gray-150 rounded-lg">
              {loading ? (
                <p className="text-center py-10 text-gray-400">Loading logs...</p>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f8fafc] text-gray-700 font-bold border-b sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3">Teacher</th>
                      <th className="px-4 py-3">Date & Day</th>
                      <th className="px-4 py-3">Subject & Batch</th>
                      <th className="px-4 py-3">Center</th>
                      <th className="px-4 py-3">Cancellation Reasons / Remarks</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic">No class cancellation logs found.</td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-800">{log.user?.fullName}</div>
                            <div className="text-[10px] text-gray-500">{log.user?.identifier} • {log.user?.department}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-700">
                            <div>{new Date(log.date).toLocaleDateString('en-IN')}</div>
                            <div className="text-[10px] text-gray-400">{log.day}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-red-800">{log.subject}</div>
                            <div className="text-[10px] font-mono text-gray-500">Batch: {log.batchNo}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-600">{log.centerName}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-red-700 text-xs">{log.reason || 'Other reasons'}</div>
                            {log.remarks && <div className="text-[10px] text-gray-500 italic mt-0.5">"{log.remarks}"</div>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => handleStartEdit(log)}
                                className="bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-200 rounded p-1 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer animate-fade-in"
                                title="Edit cancelled class details"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => handleIndividualExport(log.user?.fullName, log.user?.identifier)}
                                className="bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-200 rounded px-2 py-1 inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer text-[10px] font-bold gap-1 animate-fade-in"
                                title={`Export monthly report for ${log.user?.fullName}`}
                              >
                                <Download size={12} /> Excel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Left NICTians Modal ───────────────────────────────────────────────────────────
interface LeftNICTiansModalProps {
  onClose: () => void;
  setViewOnboardingUser: (t: Trainee) => void;
  setEditUser: (t: Trainee) => void;
  setSlotsUser: (t: Trainee) => void;
  setResetUser: (t: Trainee) => void;
  setManualPunchUser: (t: Trainee) => void;
  setDirectLeaveUser: (t: Trainee) => void;
  setDeleteUser: (t: Trainee) => void;
  setViewDetailUser: (t: Trainee) => void;
  setIndividualReport: (t: Trainee) => void;
  setDisableUser: (t: Trainee) => void;
  hasPermission: (perm: string) => boolean;
}

const LeftNICTiansModal = ({
  onClose,
  setViewOnboardingUser,
  setEditUser,
  setSlotsUser,
  setResetUser,
  setManualPunchUser,
  setDirectLeaveUser,
  setDeleteUser,
  setViewDetailUser,
  setIndividualReport,
  setDisableUser,
  hasPermission
}: LeftNICTiansModalProps) => {
  const [leftUsers, setLeftUsers] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchLeftUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/left-users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeftUsers(res.data || []);
    } catch (err) {
      console.error('[LEFT USERS GET FETCH ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeftUsers();
  }, []);

  const handleReactivate = async (t: Trainee) => {
    if (!confirm(`Are you sure you want to reactivate ${t.name}?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/user/${t.id}/mark-left`, { hasLeft: false }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Successfully reactivated ${t.name}.`);
      fetchLeftUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reactivate employee.');
    }
  };

  const filteredUsers = leftUsers.filter(u => {
    const q = search.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.empCode && u.empCode.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl p-6 relative max-h-[90vh] flex flex-col text-left">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-rose-700 flex items-center gap-2 border-b pb-3">
          <UserX size={20} /> Left NICTians Management
        </h2>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search Left NICTians by Name, Code, Email or Dept..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full md:max-w-md border border-gray-300 rounded px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-rose-500 font-medium text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto border rounded">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading left employees...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 italic">No left employees found.</div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-100 text-gray-700 font-bold border-b sticky top-0">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-700">{t.empCode}</td>
                    <td className="px-4 py-3 font-bold text-rose-950">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600">{t.email || '--'}</td>
                    <td className="px-4 py-3 text-gray-600">{t.department || '--'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {hasPermission('VIEW_PROFILE') && (
                          <button onClick={() => setViewOnboardingUser(t)} className="text-purple-600 hover:text-purple-800 transition-colors" title="View Onboarding Profile">
                            <User size={14} />
                          </button>
                        )}
                        {hasPermission('EDIT_USER') && (
                          <button onClick={() => setEditUser(t)} className="text-emerald-600 hover:text-emerald-800 transition-colors" title="Edit User Info">
                            <Edit size={14} />
                          </button>
                        )}
                        {hasPermission('UPDATE_SLOTS') && (
                          <button onClick={() => setSlotsUser(t)} className="text-green-600 hover:text-green-800 transition-colors" title="Update Slots">
                            <Clock size={14} />
                          </button>
                        )}
                        {hasPermission('RESET_PASSWORD') && (
                          <button onClick={() => setResetUser(t)} className="text-yellow-600 hover:text-yellow-800 transition-colors" title="Reset Password">
                            <Key size={14} />
                          </button>
                        )}
                        {hasPermission('MANUAL_ATTENDANCE') && (
                          <button onClick={() => setManualPunchUser(t)} className="text-orange-600 hover:text-orange-800 transition-colors" title="Manual Attendance">
                            <Clock size={14} />
                          </button>
                        )}
                        {hasPermission('DIRECT_LEAVE') && (
                          <button onClick={() => setDirectLeaveUser(t)} className="text-indigo-600 hover:text-indigo-800 transition-colors" title="Direct Leave">
                            <Calendar size={14} />
                          </button>
                        )}
                        {hasPermission('DELETE_USER') && (
                          <button onClick={() => setDeleteUser(t)} className="text-red-600 hover:text-red-800 transition-colors" title="Delete User">
                            <Trash2 size={14} />
                          </button>
                        )}
                        {hasPermission('VIEW_SLOT_STATUS') && (
                          <button onClick={() => setViewDetailUser(t)} className="text-pink-600 hover:text-pink-800 transition-colors" title="View Slot Statuses">
                            <Eye size={14} />
                          </button>
                        )}
                        {hasPermission('DOWNLOAD_REPORT') && (
                          <button onClick={() => setIndividualReport(t)} className="text-blue-600 hover:text-blue-800 transition-colors" title="Download Report">
                            <FileDown size={14} />
                          </button>
                        )}
                        {hasPermission('EDIT_USER') && (
                          <button
                            onClick={() => setDisableUser(t)}
                            className={`${t.isDisabled ? 'text-yellow-600 hover:text-yellow-800 font-bold' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
                            title={t.isDisabled ? 'Reactivate / View Disable Logs' : 'Temporarily Disable Account'}
                          >
                            <Ban size={14} />
                          </button>
                        )}
                        {hasPermission('EDIT_USER') && (
                          <button
                            onClick={() => handleReactivate(t)}
                            className="text-blue-600 hover:text-blue-800 transition-colors font-bold"
                            title="Reactivate Employee"
                          >
                            <UserCheck size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Salary Slips Modal ────────────────────────────────────────────────────────
interface SalarySlipsModalProps {
  onClose: () => void;
  hasPermission: (perm: string) => boolean;
}

const SalarySlipsModal = ({ onClose, hasPermission }: SalarySlipsModalProps) => {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [trainees, setTrainees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewTrainee, setPreviewTrainee] = useState<any | null>(null);
  const [activePayslipUser, setActivePayslipUser] = useState<any | null>(null);

  // Editing state
  const [editingTrainee, setEditingTrainee] = useState<any | null>(null);
  const [editBaseSalary, setEditBaseSalary] = useState('');
  const [editPersonalLateRate, setEditPersonalLateRate] = useState('');
  const [editPersonalEarlyRate, setEditPersonalEarlyRate] = useState('');
  const [editPersonalPaidLeavesLimit, setEditPersonalPaidLeavesLimit] = useState('');
  const [editPersonalExtraClassRate, setEditPersonalExtraClassRate] = useState('');
  const [editPersonalOtherCenterClassRate, setEditPersonalOtherCenterClassRate] = useState('');
  const [editPersonalCollegeVisitRate, setEditPersonalCollegeVisitRate] = useState('');
  const [editTdsOverridePercent, setEditTdsOverridePercent] = useState('');
  const [editOtherAdditions, setEditOtherAdditions] = useState('');
  const [editOtherDeductions, setEditOtherDeductions] = useState('');
  const [editPersonalLateDeductionType, setEditPersonalLateDeductionType] = useState('');
  const [editPersonalLateIntervalValue, setEditPersonalLateIntervalValue] = useState('');
  const [editPersonalEarlyDeductionType, setEditPersonalEarlyDeductionType] = useState('');
  const [editPersonalEarlyIntervalValue, setEditPersonalEarlyIntervalValue] = useState('');
  const [editPersonalWorkingHoursOverride, setEditPersonalWorkingHoursOverride] = useState('');
  const [editPersonalConveyanceAllowance, setEditPersonalConveyanceAllowance] = useState('');
  const [editPersonalFoodAllowance, setEditPersonalFoodAllowance] = useState('');
  const [editPersonalAllowPayslipView, setEditPersonalAllowPayslipView] = useState(true);
  const [saving, setSaving] = useState(false);

  // Global rates state
  const [showGlobalRates, setShowGlobalRates] = useState(false);
  const [globalLateRate, setGlobalLateRate] = useState(30);
  const [globalLateDeductionType, setGlobalLateDeductionType] = useState('instance');
  const [globalLateIntervalValue, setGlobalLateIntervalValue] = useState(15);
  const [globalEarlyRate, setGlobalEarlyRate] = useState(30);
  const [globalEarlyDeductionType, setGlobalEarlyDeductionType] = useState('instance');
  const [globalEarlyIntervalValue, setGlobalEarlyIntervalValue] = useState(15);
  const [globalPaidLeavesLimit, setGlobalPaidLeavesLimit] = useState(0);
  const [globalExtraClassRate, setGlobalExtraClassRate] = useState(0);
  const [globalOtherCenterClassRate, setGlobalOtherCenterClassRate] = useState(0);
  const [globalCollegeVisitRate, setGlobalCollegeVisitRate] = useState(0);
  const [globalAllowPayslipsView, setGlobalAllowPayslipsView] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);

  // Fetch trainees list
  const fetchTraineesList = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [listRes, settingsRes] = await Promise.all([
        axios.get(`${API}/reports/payslip/list?month=${month}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setTrainees(listRes.data);
      if (settingsRes.data) {
        setGlobalLateRate(settingsRes.data.lateRate !== undefined ? settingsRes.data.lateRate : 30);
        setGlobalLateDeductionType(settingsRes.data.lateDeductionType !== undefined ? settingsRes.data.lateDeductionType : 'instance');
        setGlobalLateIntervalValue(settingsRes.data.lateIntervalValue !== undefined ? settingsRes.data.lateIntervalValue : 15);
        setGlobalEarlyRate(settingsRes.data.earlyRate !== undefined ? settingsRes.data.earlyRate : 30);
        setGlobalEarlyDeductionType(settingsRes.data.earlyDeductionType !== undefined ? settingsRes.data.earlyDeductionType : 'instance');
        setGlobalEarlyIntervalValue(settingsRes.data.earlyIntervalValue !== undefined ? settingsRes.data.earlyIntervalValue : 15);
        setGlobalPaidLeavesLimit(settingsRes.data.paidLeavesLimit !== undefined ? settingsRes.data.paidLeavesLimit : 0);
        setGlobalExtraClassRate(settingsRes.data.extraClassRate !== undefined ? settingsRes.data.extraClassRate : 0);
        setGlobalOtherCenterClassRate(settingsRes.data.otherCenterClassRate !== undefined ? settingsRes.data.otherCenterClassRate : 0);
        setGlobalCollegeVisitRate(settingsRes.data.collegeVisitRate !== undefined ? settingsRes.data.collegeVisitRate : 0);
        setGlobalAllowPayslipsView(settingsRes.data.allowPayslipsView !== undefined ? settingsRes.data.allowPayslipsView : true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraineesList();
  }, [month]);

  // Handle individual export
  const handleExportIndividual = async (userId: number, fullName: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/payslip/export/${userId}?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PaySlip_${fullName.replace(/\s+/g, '_')}_${month}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert("Download failed");
    }
  };

  // Handle export all slips
  const handleExportAll = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/payslip/export-all?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SalarySlips_Report_${month}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert("Export failed");
    }
  };

  // Handle printing/PDF of all payslips in bulk
  const handlePrintAllPayslips = () => {
    if (filteredTrainees.length === 0) return;

    // Generate simple number to words in English (Indian numbering system)
    const inWords = (num: number): string => {
      const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
      const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
      
      if ((num = Math.floor(num)) === 0) return 'zero';
      
      const g = (n: number): string => {
        if (n < 20) return a[n];
        const digit = n % 10;
        return b[Math.floor(n / 10)] + (digit !== 0 ? '-' + a[digit] : '');
      };
      
      const convert = (n: number): string => {
        let str = '';
        if (n >= 10000000) {
          str += convert(Math.floor(n / 10000000)) + ' crore ';
          n %= 10000000;
        }
        if (n >= 100000) {
          str += convert(Math.floor(n / 100000)) + ' lakh ';
          n %= 100000;
        }
        if (n >= 1000) {
          str += convert(Math.floor(n / 1000)) + ' thousand ';
          n %= 1000;
        }
        if (n >= 100) {
          str += g(Math.floor(n / 100)) + ' hundred ';
          n %= 100;
        }
        if (n > 0) {
          if (str !== '') str += 'and ';
          str += g(n);
        }
        return str;
      };
      
      const res = convert(num).trim();
      return res.charAt(0).toUpperCase() + res.slice(1) + ' Rupees Only';
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to download/print the payslips.");
      return;
    }

    let slipsHtml = '';
    filteredTrainees.forEach((t, index) => {
      slipsHtml += generateIndividualPayslipHtmlString(t, month, inWords);
      if (index < filteredTrainees.length - 1) {
        slipsHtml += '<div class="page-break"></div>';
      }
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>SalarySlips_${month}</title>
          <style>${sharedPayslipStyles}</style>
        </head>
        <body>
          <div class="print-btn-container">
            <button class="btn-print" onclick="window.print()">Print All Payslips / Save PDF</button>
          </div>
          ${slipsHtml}
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => { window.print(); }, 500);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // handlePrintPayslip moved to global scope for reuse

  // Save updated salary variables
  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrainee) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/trainees/${editingTrainee.id}/salary`, {
        baseSalary: parseFloat(editBaseSalary) || 0,
        lateRate: editPersonalLateRate !== '' ? parseFloat(editPersonalLateRate) : null,
        earlyRate: editPersonalEarlyRate !== '' ? parseFloat(editPersonalEarlyRate) : null,
        paidLeavesLimit: editPersonalPaidLeavesLimit !== '' ? parseFloat(editPersonalPaidLeavesLimit) : null,
        extraClassRate: editPersonalExtraClassRate !== '' ? parseFloat(editPersonalExtraClassRate) : null,
        otherCenterClassRate: editPersonalOtherCenterClassRate !== '' ? parseFloat(editPersonalOtherCenterClassRate) : null,
        collegeVisitRate: editPersonalCollegeVisitRate !== '' ? parseFloat(editPersonalCollegeVisitRate) : null,
        tdsRate: editTdsOverridePercent !== '' ? parseFloat(editTdsOverridePercent) : null,
        otherAdditions: editOtherAdditions !== '' ? parseFloat(editOtherAdditions) : 0,
        otherDeductions: editOtherDeductions !== '' ? parseFloat(editOtherDeductions) : 0,
        lateDeductionType: editPersonalLateDeductionType !== '' ? editPersonalLateDeductionType : null,
        lateIntervalValue: editPersonalLateIntervalValue !== '' ? parseInt(editPersonalLateIntervalValue) : null,
        earlyDeductionType: editPersonalEarlyDeductionType !== '' ? editPersonalEarlyDeductionType : null,
        earlyIntervalValue: editPersonalEarlyIntervalValue !== '' ? parseInt(editPersonalEarlyIntervalValue) : null,
        conveyanceAllowance: editPersonalConveyanceAllowance !== '' ? parseFloat(editPersonalConveyanceAllowance) : 0,
        foodAllowance: editPersonalFoodAllowance !== '' ? parseFloat(editPersonalFoodAllowance) : 0,
        workingHoursOverride: editPersonalWorkingHoursOverride !== '' ? parseFloat(editPersonalWorkingHoursOverride) : null,
        allowPayslipView: editPersonalAllowPayslipView
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Salary settings updated successfully!");
      setEditingTrainee(null);
      fetchTraineesList();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update salary settings");
    } finally {
      setSaving(false);
    }
  };

  const totalSpent = trainees.reduce((sum, t) => sum + (t.netTakeHome || 0), 0);

  // Save global rates
  const handleSaveGlobalRates = async () => {
    setSavingGlobal(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/settings`, {
        lateRate: globalLateRate,
        lateDeductionType: globalLateDeductionType,
        lateIntervalValue: globalLateIntervalValue,
        earlyRate: globalEarlyRate,
        earlyDeductionType: globalEarlyDeductionType,
        earlyIntervalValue: globalEarlyIntervalValue,
        paidLeavesLimit: globalPaidLeavesLimit,
        extraClassRate: globalExtraClassRate,
        otherCenterClassRate: globalOtherCenterClassRate,
        collegeVisitRate: globalCollegeVisitRate,
        allowPayslipsView: globalAllowPayslipsView
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Global payroll and rate settings updated!');
      fetchTraineesList(); // Refresh to recalculate with new rates
    } catch (err) {
      alert('Failed to update global rates');
    } finally {
      setSavingGlobal(false);
    }
  };

  const filteredTrainees = trainees.filter(t => 
    t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.empCode && t.empCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 text-gray-950 rounded-2xl shadow-2xl w-full max-w-[96vw] max-h-[95vh] overflow-hidden flex flex-col relative transition-all">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💵</span>
            <div>
              <h2 className="text-xl font-bold tracking-wide text-emerald-700">Salary Slips & Payroll Management</h2>
              <p className="text-xs text-gray-500">View real-time auto-generated payroll statements and configure employee base parameters</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Top Control Bar & Stats */}
        <div className="px-6 pt-6 pb-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            
            {/* Stat: Total Spent */}
            <div className="p-4 rounded-xl border border-emerald-150 bg-emerald-50/30 flex flex-col justify-center shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Total Spent / Net Payout (This Month)</span>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">₹ {totalSpent.toLocaleString('en-IN')}</div>
            </div>

            {/* Selector: Select Month */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/30 flex flex-col justify-center">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Select Month</label>
              <input 
                type="month" 
                value={month} 
                onChange={(e) => setMonth(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg py-1 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 font-semibold text-xs w-full"
              />
            </div>

            {/* Actions: Excel Export, PDF Export & Global Rates */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/30 flex flex-col justify-center gap-2">
              <button 
                onClick={handleExportAll}
                disabled={filteredTrainees.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <FileSpreadsheet size={14} />
                Export Monthly Report (Excel)
              </button>
              <button 
                onClick={handlePrintAllPayslips}
                disabled={filteredTrainees.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <FileDown size={14} />
                Download All Payslips (PDF)
              </button>
              <button 
                onClick={() => setShowGlobalRates(!showGlobalRates)}
                className={`w-full ${showGlobalRates ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm font-semibold' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-250 font-semibold'} transition-colors py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer`}
              >
                <Settings size={14} />
                {showGlobalRates ? 'Hide' : 'Show'} Global Deduction Rates
              </button>
            </div>

          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search employee by name or registration number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg py-2 pl-10 pr-4 text-xs text-gray-808 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
            />
          </div>

          {/* Global Deduction Rates Panel */}
          {showGlobalRates && (
            <div className="bg-amber-50/30 border border-amber-200 rounded-xl p-4 mt-3 mb-1">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-700 mb-3 flex items-center gap-1.5">
                🌐 Global / Common Payroll & Rate Settings (applies to all employees unless overridden personally)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Column 1: Teacher Payslips Visibility */}
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between space-y-2.5">
                  <div>
                    <h5 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">🔒 Teacher Payslips Visibility</h5>
                    <label className="relative inline-flex items-center cursor-pointer mt-3">
                      <input 
                        type="checkbox" 
                        checked={globalAllowPayslipsView} 
                        onChange={e => setGlobalAllowPayslipsView(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                      <span className="ml-2 text-xs font-bold text-gray-700">
                        {globalAllowPayslipsView ? 'Visible to Teachers' : 'Hidden from Teachers'}
                      </span>
                    </label>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-2">Allows or blocks payslips globally from being viewed on the Teacher dashboard.</p>
                </div>

                {/* Column 2: Class Rates */}
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm space-y-2.5">
                  <h5 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">🏫 Class Rates</h5>
                  <div>
                    <label className="block text-[8px] font-bold text-gray-500 uppercase mb-1">Extra Class Rate (₹/hour)</label>
                    <input type="number" value={globalExtraClassRate} onChange={e => setGlobalExtraClassRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-lg py-1.5 px-2.5 text-xs text-gray-808 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-gray-500 uppercase mb-1">Other Center Class Rate (₹/hour)</label>
                    <input type="number" value={globalOtherCenterClassRate} onChange={e => setGlobalOtherCenterClassRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-lg py-1.5 px-2.5 text-xs text-gray-808 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-teal-750 uppercase mb-1">🏛️ College Visit Rate (₹/hour)</label>
                    <input type="number" value={globalCollegeVisitRate} onChange={e => setGlobalCollegeVisitRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-teal-200 rounded-lg py-1.5 px-2.5 text-xs text-gray-808 focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold" />
                  </div>
                </div>

                {/* Column 3: Paid Leaves & Actions */}
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between space-y-2.5">
                  <div className="space-y-2.5">
                    <h5 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">📅 Leaves</h5>
                    <div>
                      <label className="block text-[8px] font-bold text-gray-500 uppercase mb-1">Paid Leaves (Days)</label>
                      <input type="number" value={globalPaidLeavesLimit} onChange={e => setGlobalPaidLeavesLimit(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-gray-300 rounded-lg py-1.5 px-2.5 text-xs text-gray-808 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveGlobalRates}
                    disabled={savingGlobal}
                    className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2 px-3 rounded-lg text-xs font-bold transition-colors mt-auto shadow"
                  >
                    {savingGlobal ? 'Saving Settings...' : 'Save Settings'}
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-gray-400 mt-2 italic">* Paid Leaves limit specifies the default number of paid leaves allowed per month. Exceeding leaves are deducted as Unpaid Approved Leaves.</p>
            </div>
          )}
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
            {loading ? (
              <div className="h-48 flex justify-center items-center text-xs text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl animate-spin">🔄</span>
                  <span>Calculating payroll statistics...</span>
                </div>
              </div>
            ) : filteredTrainees.length === 0 ? (
              <div className="h-48 flex flex-col justify-center items-center text-xs text-gray-400">
                <span className="text-4xl mb-2">📭</span>
                <span>No employees matching the criteria found.</span>
              </div>
            ) : (
              <table className="w-full min-w-[1350px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase font-bold text-[9px] tracking-wider border-b border-gray-200">
                    <th className="py-3 px-4">Employee / Teacher</th>
                    <th className="py-3 px-4 text-right">Professional Fee</th>
                    <th className="py-3 px-4 text-right">Conveyance</th>
                    <th className="py-3 px-4 text-right">Food</th>
                    <th className="py-3 px-4 text-right">Other Additions</th>
                    <th className="py-3 px-4 text-center">College Visits</th>
                    <th className="py-3 px-4 text-center">Extra Classes</th>
                    <th className="py-3 px-4 text-center">Other Center Classes</th>
                    <th className="py-3 px-4 text-center">Late Penalty</th>
                    <th className="py-3 px-4 text-center">Early Penalty</th>
                    <th className="py-3 px-4 text-center">Absent Penalty</th>
                    <th className="py-3 px-4 text-right">TDS</th>
                    <th className="py-3 px-4 text-right">Other Deductions</th>
                    <th className="py-3 px-4 text-right font-bold border-l border-gray-200">Net Takehome</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTrainees.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{t.fullName}</div>
                        <div className="text-[10px] text-gray-500">{t.empCode || t.id}</div>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        ₹{(t.professionalFee || 0).toLocaleString('en-IN')}
                        <span className="text-gray-400 text-[9px] block">TDS base</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        ₹{(t.conveyance || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        ₹{(t.food || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        ₹{(t.otherAdditions || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {(t.collegeVisitHours || 0) > 0 ? (
                          <>
                            <span className="font-medium text-teal-700">{(t.collegeVisitHours || 0).toFixed(1)}h × ₹{t.collegeVisitRate || 0}/h</span>
                            <span className="text-emerald-700 text-[10px] block font-bold">= ₹{(t.collegeVisitEarnings || 0).toLocaleString('en-IN')}</span>
                          </>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {(t.extraClassesHours || 0) > 0 ? (
                          <>
                            <span className="font-medium text-blue-700">{(t.extraClassesHours || 0).toFixed(1)}h × ₹{t.extraClassRate || 0}/h</span>
                            <span className="text-emerald-700 text-[10px] block font-bold">= ₹{(t.extraClassEarnings || 0).toLocaleString('en-IN')}</span>
                            <span className="text-gray-400 text-[9px] block">({t.extraClassesCount || 0} classes)</span>
                          </>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {(t.otherCenterClassesHours || 0) > 0 ? (
                          <>
                            <span className="font-medium text-purple-700">{(t.otherCenterClassesHours || 0).toFixed(1)}h × ₹{t.otherCenterClassRate || 0}/h</span>
                            <span className="text-emerald-700 text-[10px] block font-bold">= ₹{(t.otherCenterClassEarnings || 0).toLocaleString('en-IN')}</span>
                            <span className="text-gray-400 text-[9px] block">({t.otherCenterClassesCount || 0} classes)</span>
                            {t.otherCenterClassesBreakdown && (
                              <span className="text-purple-700 text-[8px] block font-semibold mt-0.5">({t.otherCenterClassesBreakdown})</span>
                            )}
                          </>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-gray-700 font-medium">{t.lateInstances} times</span>
                        {t.totalLateMinutes > 0 && (
                          <span className="text-gray-500 text-[10px] block">({t.totalLateMinutes}m late)</span>
                        )}
                        {t.lateDeduction > 0 && <span className="text-red-650 text-[10px] block">-₹{t.lateDeduction}</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-gray-700 font-medium">{t.earlyInstances} times</span>
                        {t.totalEarlyMinutes > 0 && (
                          <span className="text-gray-500 text-[10px] block">({t.totalEarlyMinutes}m early)</span>
                        )}
                        {t.earlyDeduction > 0 && <span className="text-red-650 text-[10px] block">-₹{t.earlyDeduction}</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-gray-700 font-medium">{t.absentDays} days</span>
                        {t.absentDeduction > 0 && <span className="text-red-650 text-[10px] block">-₹{t.absentDeduction}</span>}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">
                        ₹{(t.tdsDeduction || 0).toLocaleString('en-IN')}
                        <span className="text-[10px] text-gray-400 block">({t.tdsPercentage}%)</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        ₹{(t.otherDeductions || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-extrabold text-sm border-l border-gray-200">
                        ₹{(t.netTakeHome || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center items-center gap-3">
                           <button 
                            onClick={() => {
                              setActivePayslipUser({
                                id: t.id,
                                name: t.fullName,
                                month: month
                              });
                            }}
                            className="text-amber-600 hover:text-amber-800 transition-colors cursor-pointer"
                            title="Manage Monthly Pay Slip"
                          >
                            <Settings size={15} />
                          </button>

                          <button 
                            onClick={() => setPreviewTrainee(t)}
                            className="text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer"
                            title="Preview Pay Slip"
                          >
                            <Eye size={15} />
                          </button>

                          <button 
                            onClick={() => handleExportIndividual(t.id, t.fullName)}
                            className="text-teal-600 hover:text-teal-800 transition-colors cursor-pointer"
                            title="Download Pay Slip (Excel)"
                          >
                            <FileDown size={15} />
                          </button>
                          <button 
                            onClick={() => handlePrintPayslip(t, month)}
                            className="text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                            title="Print Pay Slip"
                          >
                            <Printer size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Inline Dialog popup for editing salary */}
        {editingTrainee && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
            <div className="bg-white border border-gray-200 text-gray-950 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex justify-between items-center bg-[#0f766e] text-white px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Settings className="text-teal-200" size={22} />
                    Configure Salary Settings
                  </h2>
                  <p className="text-xs text-teal-100 font-medium mt-0.5">Configure salary settings for: {editingTrainee.fullName}</p>
                </div>
                <button 
                  onClick={() => setEditingTrainee(null)}
                  className="p-1.5 rounded-full hover:bg-[#115e59] text-teal-100 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveSalary} className="overflow-y-auto p-6 space-y-6 flex-1 bg-slate-50 flex flex-col justify-between">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card 1: Earnings & Allowances */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-[#0f766e] border-b pb-2 text-sm flex items-center gap-2">
                      💰 Earnings &amp; Allowances
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Professional Fee / Base Salary (₹)
                        </label>
                        <input 
                          type="number" 
                          value={editBaseSalary}
                          onChange={(e) => setEditBaseSalary(e.target.value)}
                          placeholder="0"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Conveyance Allowance (₹)
                        </label>
                        <input 
                          type="number" 
                          value={editPersonalConveyanceAllowance}
                          onChange={(e) => setEditPersonalConveyanceAllowance(e.target.value)}
                          placeholder="0"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Food Allowance (₹)
                        </label>
                        <input 
                          type="number" 
                          value={editPersonalFoodAllowance}
                          onChange={(e) => setEditPersonalFoodAllowance(e.target.value)}
                          placeholder="0"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                        />
                      </div>
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium italic">
                        ⚠️ TDS is calculated on all earnings (Professional Fee, Classes, and Additions) except Conveyance and Food allowances.
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Personal Overrides & Visibility */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-[#0f766e] border-b pb-2 text-sm flex items-center gap-2">
                      ⚡ Personal Overrides &amp; Visibility
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Daily Working Hours Override
                        </label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={editPersonalWorkingHoursOverride}
                          onChange={(e) => setEditPersonalWorkingHoursOverride(e.target.value)}
                          placeholder="Auto (Slots)"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                        />
                        <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                          0 = disable penalty, blank = slot timing
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Paid Leaves (Days)
                        </label>
                        <input 
                          type="number" 
                          value={editPersonalPaidLeavesLimit}
                          onChange={(e) => setEditPersonalPaidLeavesLimit(e.target.value)}
                          placeholder="Global"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                        />
                        <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                          Leaves Taken: <span className="font-bold text-blue-750">{editingTrainee.approvedLeavesCount || 0} days</span>
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 border rounded-lg border-gray-200 flex items-center justify-between mt-4">
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                          Payslip Visibility
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={editPersonalAllowPayslipView} 
                            onChange={e => setEditPersonalAllowPayslipView(e.target.checked)} 
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0f766e]"></div>
                          <span className="ml-2 text-xs font-bold text-gray-700">
                            {editPersonalAllowPayslipView ? 'Allowed' : 'Blocked'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Class Rate Overrides (₹/HR) */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-[#0f766e] border-b pb-2 text-sm flex items-center gap-2">
                      ✨ Class Rate Overrides (₹/HR)
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Extra Class Rate
                        </label>
                        <input 
                          type="number" 
                          value={editPersonalExtraClassRate}
                          onChange={(e) => setEditPersonalExtraClassRate(e.target.value)}
                          placeholder="Global"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                        />
                        <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                          Month hours: <span className="font-bold text-gray-700">{Math.floor(editingTrainee.extraClassesHours || 0)}h {Math.round(((editingTrainee.extraClassesHours || 0) % 1) * 60)}m</span>
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Other Center Rate
                        </label>
                        <input 
                          type="number" 
                          value={editPersonalOtherCenterClassRate}
                          onChange={(e) => setEditPersonalOtherCenterClassRate(e.target.value)}
                          placeholder="Global"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                        />
                        <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                          Month hours: <span className="font-bold text-gray-700">{Math.floor(editingTrainee.otherCenterClassesHours || 0)}h {Math.round(((editingTrainee.otherCenterClassesHours || 0) % 1) * 60)}m</span>
                        </span>
                        {editingTrainee.otherCenterClassesBreakdown && (
                          <div className="mt-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5">
                            <span className="text-[9px] font-bold text-purple-800 uppercase tracking-wider block mb-1">Center-wise Breakdown</span>
                            {editingTrainee.otherCenterClassesBreakdown.split(', ').map((entry: string, i: number) => (
                              <div key={i} className="text-[10px] text-purple-700 font-semibold flex items-center gap-1">
                                <span className="text-purple-400">●</span> {entry}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          College Visit Rate
                        </label>
                        <input 
                          type="number" 
                          value={editPersonalCollegeVisitRate}
                          onChange={(e) => setEditPersonalCollegeVisitRate(e.target.value)}
                          placeholder="Global"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                        />
                        <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                          Month hours: <span className="font-bold text-gray-700">{Math.floor(editingTrainee.collegeVisitHours || 0)}h {Math.round(((editingTrainee.collegeVisitHours || 0) % 1) * 60)}m</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Adjustments & TDS */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-red-700 border-b pb-2 text-sm flex items-center gap-2">
                      💸 Deductions &amp; TDS
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          TDS (%)
                        </label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={editTdsOverridePercent}
                          onChange={(e) => setEditTdsOverridePercent(e.target.value)}
                          placeholder="Global (10%)"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 border-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Baseline Additions (₹)
                        </label>
                        <input 
                          type="number" 
                          value={editOtherAdditions}
                          onChange={(e) => setEditOtherAdditions(e.target.value)}
                          placeholder="0"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Baseline Deductions (₹)
                        </label>
                        <input 
                          type="number" 
                          value={editOtherDeductions}
                          onChange={(e) => setEditOtherDeductions(e.target.value)}
                          placeholder="0"
                          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 border-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Section */}
                <div className="bg-[#0f766e]/5 border border-[#0f766e]/20 p-5 rounded-xl flex flex-wrap justify-between items-center gap-4 mt-6">
                  <button 
                    type="button"
                    onClick={() => {
                      setEditPersonalWorkingHoursOverride('');
                      setEditPersonalConveyanceAllowance('0');
                      setEditPersonalFoodAllowance('0');
                      setEditPersonalAllowPayslipView(true);
                      setEditPersonalPaidLeavesLimit('');
                      setEditTdsOverridePercent('');
                      setEditOtherAdditions('0');
                      setEditOtherDeductions('0');
                    }}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
                  >
                    Clear All Overrides
                  </button>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setEditingTrainee(null)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={saving}
                      className="bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                          Saving...
                        </>
                      ) : (
                        "Save Baseline Settings"
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {previewTrainee && (
        <AdminTraineePayslipPreviewModal 
          userId={previewTrainee.id}
          month={month}
          onClose={() => setPreviewTrainee(null)}
        />
      )}
      {activePayslipUser && (
        <ManagePayslipModal 
          userId={activePayslipUser.id}
          name={activePayslipUser.name}
          month={activePayslipUser.month}
          onClose={() => setActivePayslipUser(null)}
          onSuccess={() => {
            setActivePayslipUser(null);
            fetchTraineesList();
          }}
          hasPermission={hasPermission}
        />
      )}
    </div>
  );
};

// ── My Payslips Modal for Supervisors ───────────────────────────────────────
interface MyPayslipsModalProps {
  onClose: () => void;
}

const MyPayslipsModal = ({ onClose }: MyPayslipsModalProps) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayslip = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const baseApi = API.replace('/admin', '');
      const res = await axios.get(`${baseApi}/salary-slips/my-slip?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch payslip details.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintMyPayslip = () => {
    if (!data) return;

    const inWords = (num: number): string => {
      const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
      const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
      
      if ((num = Math.floor(num)) === 0) return 'zero';
      
      const g = (n: number): string => {
        if (n < 20) return a[n];
        const digit = n % 10;
        return b[Math.floor(n / 10)] + (digit !== 0 ? '-' + a[digit] : '');
      };
      
      const convert = (n: number): string => {
        let str = '';
        if (n >= 10000000) {
          str += convert(Math.floor(n / 10000000)) + ' crore ';
          n %= 10000000;
        }
        if (n >= 100000) {
          str += convert(Math.floor(n / 100000)) + ' lakh ';
          n %= 100000;
        }
        if (n >= 1000) {
          str += convert(Math.floor(n / 1000)) + ' thousand ';
          n %= 1000;
        }
        if (n >= 100) {
          str += g(Math.floor(n / 100)) + ' hundred ';
          n %= 100;
        }
        if (n > 0) {
          if (str !== '') str += 'and ';
          str += g(n);
        }
        return str;
      };
      
      const res = convert(num).trim();
      return res.charAt(0).toUpperCase() + res.slice(1) + ' Rupees Only';
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to download/print the payslip.");
      return;
    }

    const tMapped = data.storedSlip 
      ? { ...data.user, ...data.salaryData, ...data.storedSlip } 
      : { ...data.user, ...data.salaryData };

    printWindow.document.write(`
      <html>
        <head>
          <title>Payslip_${data.user.fullName}_${selectedMonth}</title>
          <style>${sharedPayslipStyles}</style>
        </head>
        <body>
          <div class="print-btn-container">
            <button class="btn-print" onclick="window.print()">Print Payslip / Save PDF</button>
          </div>
          ${generateIndividualPayslipHtmlString(tMapped, selectedMonth, inWords)}
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => { window.print(); }, 500);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    fetchPayslip();
  }, [selectedMonth]);

  const grossEarnings = data?.storedSlip
    ? (data.storedSlip.basicSalary + data.storedSlip.hra + data.storedSlip.conveyance + data.storedSlip.specialAllowance + data.storedSlip.otherAllowance)
    : (data?.salaryData?.grossEarnings || 0);

  const grossDeductions = data?.storedSlip
    ? (data.storedSlip.pf + data.storedSlip.professionalTax + data.storedSlip.esi + data.storedSlip.tds + data.storedSlip.otherDeductions)
    : (data?.salaryData?.totalDeductions || 0);

  const netTakeHome = data?.storedSlip
    ? data.storedSlip.netSalary
    : (data?.salaryData?.netTakeHome || 0);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white text-gray-900 rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="flex justify-between items-center bg-blue-700 text-white px-6 py-4">
          <h2 className="text-lg font-bold tracking-wide">📄 My Pay Slip</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Month:</label>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border-2 border-blue-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
          {data && (
            <button
              onClick={handlePrintMyPayslip}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors shadow"
            >
              <FileDown size={18} />
              Download Pay Slip
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-100 flex justify-center">
          {loading ? (
            <div className="flex justify-center items-center py-16 w-full">
              <div className="animate-spin rounded-full h-10 w-10 border-t-3 border-b-3 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-2 border-red-300 text-red-700 p-5 rounded-lg text-center font-semibold text-base w-full">
              ⚠️ {error}
            </div>
          ) : data ? (
            <OnScreenPayslipCard data={data} month={selectedMonth} />
          ) : (
            <div className="text-center py-16 text-gray-500 text-base font-medium w-full">
              No payslip details available for this month.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Admin Trainee Payslip Preview Modal ───────────────────────────────────────
interface AdminTraineePayslipPreviewModalProps {
  userId: number;
  month: string;
  onClose: () => void;
}

const AdminTraineePayslipPreviewModal = ({ userId, month, onClose }: AdminTraineePayslipPreviewModalProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayslip = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/payslip/single/${userId}?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch payslip details.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintMyPayslip = () => {
    if (!data) return;

    const inWords = (num: number): string => {
      const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
      const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
      
      if ((num = Math.floor(num)) === 0) return 'zero';
      
      const g = (n: number): string => {
        if (n < 20) return a[n];
        const digit = n % 10;
        return b[Math.floor(n / 10)] + (digit !== 0 ? '-' + a[digit] : '');
      };
      
      const convert = (n: number): string => {
        let str = '';
        if (n >= 10000000) {
          str += convert(Math.floor(n / 10000000)) + ' crore ';
          n %= 10000000;
        }
        if (n >= 100000) {
          str += convert(Math.floor(n / 100000)) + ' lakh ';
          n %= 100000;
        }
        if (n >= 1000) {
          str += convert(Math.floor(n / 1000)) + ' thousand ';
          n %= 1000;
        }
        if (n >= 100) {
          str += g(Math.floor(n / 100)) + ' hundred ';
          n %= 100;
        }
        if (n > 0) {
          if (str !== '') str += 'and ';
          str += g(n);
        }
        return str;
      };
      
      const res = convert(num).trim();
      return res.charAt(0).toUpperCase() + res.slice(1) + ' Rupees Only';
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to download/print the payslip.");
      return;
    }

    const tMapped = data.storedSlip 
      ? { ...data.user, ...data.salaryData, ...data.storedSlip } 
      : { ...data.user, ...data.salaryData };

    printWindow.document.write(`
      <html>
        <head>
          <title>Payslip_${data.user.fullName}_${month}</title>
          <style>${sharedPayslipStyles}</style>
        </head>
        <body>
          <div class="print-btn-container">
            <button class="btn-print" onclick="window.print()">Print Payslip / Save PDF</button>
          </div>
          ${generateIndividualPayslipHtmlString(tMapped, month, inWords)}
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => { window.print(); }, 500);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    fetchPayslip();
  }, [userId, month]);

  const grossEarnings = data?.storedSlip
    ? (data.storedSlip.basicSalary + data.storedSlip.hra + data.storedSlip.conveyance + data.storedSlip.specialAllowance + data.storedSlip.otherAllowance)
    : (data?.salaryData?.grossEarnings || 0);

  const grossDeductions = data?.storedSlip
    ? (data.storedSlip.pf + data.storedSlip.professionalTax + data.storedSlip.esi + data.storedSlip.tds + data.storedSlip.otherDeductions)
    : (data?.salaryData?.totalDeductions || 0);

  const netTakeHome = data?.storedSlip
    ? data.storedSlip.netSalary
    : (data?.salaryData?.netTakeHome || 0);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white text-gray-900 rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="flex justify-between items-center bg-blue-700 text-white px-6 py-4">
          <h2 className="text-lg font-bold tracking-wide">📄 Pay Slip Preview</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Month: <span className="font-bold text-blue-900">{month}</span></span>
          </div>
          {data && (
            <button
              onClick={handlePrintMyPayslip}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors shadow"
            >
              <FileDown size={18} />
              Print Pay Slip (PDF)
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-100 flex justify-center">
          {loading ? (
            <div className="flex justify-center items-center py-16 w-full">
              <div className="animate-spin rounded-full h-10 w-10 border-t-3 border-b-3 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-2 border-red-300 text-red-700 p-5 rounded-lg text-center font-semibold text-base w-full">
              ⚠️ {error}
            </div>
          ) : data ? (
            <OnScreenPayslipCard data={data} month={month} />
          ) : (
            <div className="text-center py-16 text-gray-500 text-base font-medium w-full">
              No payslip data available for this month.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ManagePayslipModal = ({
  userId,
  name,
  month,
  onClose,
  onSuccess,
  hasPermission
}: {
  userId: number;
  name: string;
  month: string;
  onClose: () => void;
  onSuccess: () => void;
  hasPermission: (perm: string) => boolean;
}) => {
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calcData, setCalcData] = useState<any>(null);
  const [storedSlip, setStoredSlip] = useState<any>(null);

  // Editable fields
  const [basicSalary, setBasicSalary] = useState('0');
  const [conveyance, setConveyance] = useState('0');
  const [food, setFood] = useState('0');
  const [otherAllowance, setOtherAllowance] = useState('0'); // Additions
  const [otherDeductions, setOtherDeductions] = useState('0'); // Deductions
  const [tdsRate, setTdsRate] = useState('10'); // TDS percentage override
  const [lateDeductionOverride, setLateDeductionOverride] = useState('');
  const [earlyDeductionOverride, setEarlyDeductionOverride] = useState('');
  const [absentDeductionOverride, setAbsentDeductionOverride] = useState('');
  
  // Baseline settings fields
  const [workingHoursOverride, setWorkingHoursOverride] = useState('');
  const [paidLeavesLimit, setPaidLeavesLimit] = useState('');
  const [extraClassRate, setExtraClassRate] = useState('');
  const [otherCenterClassRate, setOtherCenterClassRate] = useState('');
  const [collegeVisitRate, setCollegeVisitRate] = useState('');
  const [allowPayslipView, setAllowPayslipView] = useState(true);
  const [updateBaseline, setUpdateBaseline] = useState(false);

  const fetchPayslipDetails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/payslip/single/${userId}?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCalcData(res.data);
      
      // Initialize baseline settings fields
      setWorkingHoursOverride(res.data.personalWorkingHoursOverride !== null && res.data.personalWorkingHoursOverride !== undefined ? String(res.data.personalWorkingHoursOverride) : '');
      setPaidLeavesLimit(res.data.personalPaidLeavesLimit !== null && res.data.personalPaidLeavesLimit !== undefined ? String(res.data.personalPaidLeavesLimit) : '');
      setExtraClassRate(res.data.personalExtraClassRate !== null && res.data.personalExtraClassRate !== undefined ? String(res.data.personalExtraClassRate) : '');
      setOtherCenterClassRate(res.data.personalOtherCenterClassRate !== null && res.data.personalOtherCenterClassRate !== undefined ? String(res.data.personalOtherCenterClassRate) : '');
      setCollegeVisitRate(res.data.personalCollegeVisitRate !== null && res.data.personalCollegeVisitRate !== undefined ? String(res.data.personalCollegeVisitRate) : '');
      setAllowPayslipView(res.data.personalAllowPayslipView ?? true);
      setTdsRate(String(res.data.personalTdsRate ?? 10));

      if (res.data.storedSlip) {
        const slip = res.data.storedSlip;
        setStoredSlip(slip);
        setBasicSalary(String(slip.basicSalary || 0));
        setConveyance(String(slip.conveyance || 0));
        setFood(String(slip.food || 0));
        setOtherAllowance(String(slip.otherAllowance || 0));
        setOtherDeductions(String(slip.otherDeductions || 0));
        setLateDeductionOverride(slip.lateDeduction !== null && slip.lateDeduction !== undefined ? String(slip.lateDeduction) : '0');
        setEarlyDeductionOverride(slip.earlyDeduction !== null && slip.earlyDeduction !== undefined ? String(slip.earlyDeduction) : '0');
        setAbsentDeductionOverride(slip.absentDeduction !== null && slip.absentDeduction !== undefined ? String(slip.absentDeduction) : '0');
      } else {
        setStoredSlip(null);
        setBasicSalary(String(res.data.baseSalary || 0));
        setConveyance(String(res.data.personalConveyanceAllowance || 0));
        setFood(String(res.data.personalFoodAllowance || 0));
        setOtherAllowance(String(res.data.otherAdditions || 0));
        setOtherDeductions(String(res.data.otherDeductions || 0));
        setLateDeductionOverride('');
        setEarlyDeductionOverride('');
        setAbsentDeductionOverride('');
      }
    } catch (e) {
      alert("Failed to load payslip data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayslipDetails();
  }, [userId, selectedMonth]);

  // Live dynamic calculations
  const hrsExtra = parseFloat(calcData?.extraClassesHours) || 0;
  const hrsOther = parseFloat(calcData?.otherCenterClassesHours) || 0;
  const hrsCollege = parseFloat(calcData?.collegeVisitHours) || 0;

  const rateExtra = extraClassRate !== '' ? (parseFloat(extraClassRate) || 0) : (parseFloat(calcData?.extraClassRate) || 0);
  const rateOther = otherCenterClassRate !== '' ? (parseFloat(otherCenterClassRate) || 0) : (parseFloat(calcData?.otherCenterClassRate) || 0);
  const rateCollege = collegeVisitRate !== '' ? (parseFloat(collegeVisitRate) || 0) : (parseFloat(calcData?.collegeVisitRate) || 0);

  const extraClassEarnings = hrsExtra * rateExtra;
  const otherCenterClassEarnings = hrsOther * rateOther;
  const collegeVisitEarnings = hrsCollege * rateCollege;

  const basicVal = parseFloat(basicSalary) || 0;
  const conveyanceVal = parseFloat(conveyance) || 0;
  const foodVal = parseFloat(food) || 0;
  const additionsVal = parseFloat(otherAllowance) || 0;
  const deductionsVal = parseFloat(otherDeductions) || 0;
  const tdsPercent = parseFloat(tdsRate) || 0;

  const taxableIncome = basicVal + extraClassEarnings + otherCenterClassEarnings + collegeVisitEarnings + additionsVal;
  const tdsVal = Math.round(taxableIncome * (tdsPercent / 100.0));

  const grossEarnings = basicVal + conveyanceVal + foodVal + additionsVal + extraClassEarnings + otherCenterClassEarnings + collegeVisitEarnings;

  const [y, m] = selectedMonth.split('-').map(Number);
  const daysInMonth = (y && m) ? new Date(y, m, 0).getDate() : 30;
  const dailyRate = daysInMonth > 0 ? (basicVal / daysInMonth) : 0;
  const absentDays = calcData?.salaryData?.absentDays || 0;
  const autoAbsentDeduction = Math.round(absentDays * dailyRate);

  const limitPaidLeaves = paidLeavesLimit !== '' ? (parseFloat(paidLeavesLimit) || 0) : (calcData?.salaryData?.personalPaidLeavesLimit ?? 0);
  const carryForwardBalance = calcData?.salaryData?.carryForwardBalance || 0;
  const totalAvailablePaidLeaves = limitPaidLeaves + carryForwardBalance;
  const approvedLeavesCount = calcData?.salaryData?.approvedLeavesCount || 0;
  const unpaidApprovedLeaves = Math.max(0, approvedLeavesCount - totalAvailablePaidLeaves);
  const unpaidApprovedLeavesDeduction = Math.round(unpaidApprovedLeaves * dailyRate);
  const paidLeavesUsed = Math.min(approvedLeavesCount, totalAvailablePaidLeaves);

  const dailyHours = workingHoursOverride !== '' ? (parseFloat(workingHoursOverride) || 0) : (calcData?.salaryData?.workingHours || 0);
  let autoLateDeduction = 0;
  let autoEarlyDeduction = 0;
  if (dailyHours > 0) {
    const perMinuteRate = basicVal / (daysInMonth * dailyHours * 60);
    autoLateDeduction = Math.round((calcData?.salaryData?.totalLateMinutes || 0) * perMinuteRate);
    autoEarlyDeduction = Math.round((calcData?.salaryData?.totalEarlyMinutes || 0) * perMinuteRate);
  }

  const resolvedLateDeduction = lateDeductionOverride !== '' ? (parseFloat(lateDeductionOverride) || 0) : autoLateDeduction;
  const resolvedEarlyDeduction = earlyDeductionOverride !== '' ? (parseFloat(earlyDeductionOverride) || 0) : autoEarlyDeduction;
  const resolvedAbsentDeduction = absentDeductionOverride !== '' ? (parseFloat(absentDeductionOverride) || 0) : autoAbsentDeduction;

  const totalDeductions = deductionsVal + tdsVal + resolvedAbsentDeduction + unpaidApprovedLeavesDeduction + resolvedLateDeduction + resolvedEarlyDeduction;
  const previewNetSalary = grossEarnings - totalDeductions;

  const handleClearFields = () => {
    setBasicSalary('0');
    setConveyance('0');
    setFood('0');
    setOtherAllowance('0');
    setOtherDeductions('0');
    setTdsRate('0');
    setWorkingHoursOverride('');
    setPaidLeavesLimit('');
    setExtraClassRate('');
    setOtherCenterClassRate('');
    setCollegeVisitRate('');
    setLateDeductionOverride('');
    setEarlyDeductionOverride('');
    setAbsentDeductionOverride('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // 1. Save user baseline settings in database
      if (updateBaseline) {
        await axios.put(`${API}/trainees/${userId}/salary`, {
          baseSalary: basicVal,
          paidLeavesLimit: paidLeavesLimit !== '' ? parseFloat(paidLeavesLimit) : null,
          extraClassRate: extraClassRate !== '' ? parseFloat(extraClassRate) : null,
          otherCenterClassRate: otherCenterClassRate !== '' ? parseFloat(otherCenterClassRate) : null,
          collegeVisitRate: collegeVisitRate !== '' ? parseFloat(collegeVisitRate) : null,
          tdsRate: tdsRate !== '' ? parseFloat(tdsRate) : null,
          otherAdditions: additionsVal,
          otherDeductions: deductionsVal,
          conveyanceAllowance: conveyanceVal,
          foodAllowance: foodVal,
          workingHoursOverride: workingHoursOverride !== '' ? parseFloat(workingHoursOverride) : null,
          allowPayslipView: allowPayslipView
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // 2. Save manual monthly overrides in database
      await axios.post(`${API}/salary-slips`, {
        userId,
        month: selectedMonth,
        basicSalary: basicVal,
        hra: 0,
        conveyance: conveyanceVal,
        food: foodVal,
        specialAllowance: 0,
        otherAllowance: additionsVal,
        pf: 0,
        professionalTax: 0,
        esi: 0,
        tds: tdsVal, // Store computed flat TDS amount
        otherDeductions: deductionsVal,
        lateDeduction: resolvedLateDeduction,
        earlyDeduction: resolvedEarlyDeduction,
        absentDeduction: resolvedAbsentDeduction
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (updateBaseline) {
        alert("Monthly overrides and baseline settings saved successfully!");
      } else {
        alert("Monthly overrides saved successfully!");
      }
      onSuccess(); // Close modal and refresh parent
    } catch (e: any) {
      const errMsg = e.response?.data?.error || e.response?.data?.message || e.message || "Failed to save salary settings and overrides";
      alert(`Error: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async () => {
    if (!storedSlip) return;
    if (!confirm("Are you sure you want to unlock this payslip? This will delete manual overrides and revert to automatic calculations based on attendance and baseline settings.")) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/salary-slips/${storedSlip.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Payslip unlocked successfully. Automatic calculations restored.");
      onSuccess();
    } catch (e: any) {
      const errMsg = e.response?.data?.error || e.response?.data?.message || e.message || "Failed to unlock payslip";
      alert(`Error: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/reports/payslip/export/${userId}?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PaySlip_${name.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert("Excel download failed");
    }
  };

  const handlePrintPDF = () => {
    if (!calcData) return;
    const tMapped = storedSlip
      ? { ...calcData.user, ...calcData.salaryData, ...storedSlip }
      : { ...calcData.user, ...calcData.salaryData };
    handlePrintPayslip(tMapped, selectedMonth);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
      <div className="bg-white border border-gray-200 text-gray-950 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center bg-[#0f766e] text-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Banknote className="text-teal-200" size={22} />
              Manage Monthly Payslip
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-teal-100 font-medium">{name} — Month:</span>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-[#115e59] text-white border border-teal-500 rounded px-2.5 py-0.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-300 cursor-pointer"
              />
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-[#115e59] text-teal-100 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 flex-1">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0f766e]"></div>
          </div>
        ) : (
          <div className="overflow-y-auto p-6 space-y-6 flex-1 bg-slate-50">
            {/* Status Badge */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-600">Calculations Mode:</span>
                {storedSlip ? (
                  <span className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                    🔒 Locked (Manual Overrides Active)
                  </span>
                ) : (
                  <span className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    ⚙️ Automatic (Attendance Calculations Active)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <FileSpreadsheet size={15} /> Download Excel
                </button>
                <button
                  onClick={handlePrintPDF}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Printer size={15} /> Print PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Earnings & Allowances */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-extrabold text-[#0f766e] border-b pb-2 text-sm flex items-center gap-2">
                  💰 Earnings &amp; Allowances
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Professional Fee / Base Salary (₹)
                    </label>
                    <input
                      type="number"
                      value={basicSalary}
                      onChange={(e) => setBasicSalary(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Conveyance Allowance (₹)
                    </label>
                    <input
                      type="number"
                      value={conveyance}
                      onChange={(e) => setConveyance(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Food Allowance (₹)
                    </label>
                    <input
                      type="number"
                      value={food}
                      onChange={(e) => setFood(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Additions / Other Allowance (₹)
                    </label>
                    <input
                      type="number"
                      value={otherAllowance}
                      onChange={(e) => setOtherAllowance(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                    />
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium italic">
                    ⚠️ TDS is calculated on all earnings (Professional Fee, Classes, and Additions) except Conveyance and Food allowances.
                  </div>
                </div>
              </div>

              {/* Card 2: Personal Overrides & Visibility */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-extrabold text-[#0f766e] border-b pb-2 text-sm flex items-center gap-2">
                  ⚡ Personal Overrides &amp; Visibility
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Daily Working Hours Override
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={workingHoursOverride}
                      onChange={(e) => setWorkingHoursOverride(e.target.value)}
                      placeholder="Auto (Slots)"
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                    />
                    <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                      0 = disable penalty, blank = slot timing
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Paid Leaves (Days)
                    </label>
                    <input
                      type="number"
                      value={paidLeavesLimit}
                      onChange={(e) => setPaidLeavesLimit(e.target.value)}
                      placeholder="Global"
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                    />
                    <div className="text-[11px] text-gray-600 mt-2 space-y-1 bg-slate-50 border border-gray-200 p-2.5 rounded-lg select-none font-medium">
                      <div>Total Leaves Taken: <span className="font-bold text-slate-800">{approvedLeavesCount} days</span></div>
                      <div>Paid Leaves: <span className="font-bold text-blue-700">{paidLeavesUsed} days</span> {carryForwardBalance > 0 && <span className="text-[10px] text-gray-500 font-normal">(incl. {carryForwardBalance}d carry-forward)</span>}</div>
                      <div>Loss of Pay (LOP): <span className="font-bold text-red-650">{unpaidApprovedLeaves} days</span></div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border rounded-lg border-gray-200 flex items-center justify-between mt-4">
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Payslip Visibility
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={allowPayslipView} 
                        onChange={e => setAllowPayslipView(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0f766e]"></div>
                      <span className="ml-2 text-xs font-bold text-gray-700">
                        {allowPayslipView ? 'Allowed' : 'Blocked'}
                      </span>
                    </label>
                  </div>

                  <div className="p-3 bg-slate-50 border rounded-lg border-gray-200 mt-4 space-y-2">
                    <span className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                      ⏱️ Late Arrivals &amp; Early Checkouts
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 font-medium">
                      <div>Late Instances: <span className="font-bold text-amber-700">{calcData?.salaryData?.lateInstances || 0} times</span></div>
                      <div>Total Late: <span className="font-bold text-amber-700">{calcData?.salaryData?.totalLateMinutes || 0} mins</span></div>
                      <div>Early Departures: <span className="font-bold text-amber-700">{calcData?.salaryData?.earlyInstances || 0} times</span></div>
                      <div>Total Early: <span className="font-bold text-amber-700">{calcData?.salaryData?.totalEarlyMinutes || 0} mins</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Class Rate Overrides (₹/HR) */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-extrabold text-[#0f766e] border-b pb-2 text-sm flex items-center gap-2">
                  ✨ Class Rate Overrides (₹/HR)
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Extra Class Rate
                    </label>
                    <input
                      type="number"
                      value={extraClassRate}
                      onChange={(e) => setExtraClassRate(e.target.value)}
                      placeholder="Global"
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                    />
                    <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                      Month hours: <span className="font-bold text-gray-700">{Math.floor(calcData?.extraClassesHours || 0)}h {Math.round(((calcData?.extraClassesHours || 0) % 1) * 60)}m</span>
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Other Center Rate
                    </label>
                    <input
                      type="number"
                      value={otherCenterClassRate}
                      onChange={(e) => setOtherCenterClassRate(e.target.value)}
                      placeholder="Global"
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                    />
                    <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                      Month hours: <span className="font-bold text-gray-700">{Math.floor(calcData?.otherCenterClassesHours || 0)}h {Math.round(((calcData?.otherCenterClassesHours || 0) % 1) * 60)}m</span>
                    </span>
                    {calcData?.otherCenterClassesBreakdown && (
                      <div className="mt-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-[9px] font-bold text-purple-800 uppercase tracking-wider block mb-1">Center-wise Breakdown</span>
                        {calcData.otherCenterClassesBreakdown.split(', ').map((entry: string, i: number) => (
                          <div key={i} className="text-[10px] text-purple-700 font-semibold flex items-center gap-1">
                            <span className="text-purple-400">●</span> {entry}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      College Visit Rate
                    </label>
                    <input
                      type="number"
                      value={collegeVisitRate}
                      onChange={(e) => setCollegeVisitRate(e.target.value)}
                      placeholder="Global"
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border-gray-300"
                    />
                    <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                      Month hours: <span className="font-bold text-gray-700">{Math.floor(calcData?.collegeVisitHours || 0)}h {Math.round(((calcData?.collegeVisitHours || 0) % 1) * 60)}m</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Deductions & TDS */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-extrabold text-red-700 border-b pb-2 text-sm flex items-center gap-2">
                  💸 Deductions &amp; TDS
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      TDS (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tdsRate}
                      onChange={(e) => setTdsRate(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 border-gray-300"
                    />
                    <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                      Calculated TDS: <span className="font-bold text-red-750">₹{tdsVal.toLocaleString('en-IN')}</span>
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Late Arrival Penalty (₹)
                    </label>
                    <input
                      type="number"
                      value={lateDeductionOverride}
                      onChange={(e) => setLateDeductionOverride(e.target.value)}
                      placeholder={`Auto: ₹${autoLateDeduction}`}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 border-gray-300"
                    />
                    <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                      Timing-based auto-calculated: <span className="font-bold text-red-750">₹{autoLateDeduction}</span>
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Early Departure Penalty (₹)
                    </label>
                    <input
                      type="number"
                      value={earlyDeductionOverride}
                      onChange={(e) => setEarlyDeductionOverride(e.target.value)}
                      placeholder={`Auto: ₹${autoEarlyDeduction}`}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 border-gray-300"
                    />
                    <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                      Timing-based auto-calculated: <span className="font-bold text-red-750">₹{autoEarlyDeduction}</span>
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Absenteeism Penalty (₹)
                    </label>
                    <input
                      type="number"
                      value={absentDeductionOverride}
                      onChange={(e) => setAbsentDeductionOverride(e.target.value)}
                      placeholder={`Auto: ₹${autoAbsentDeduction}`}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 border-gray-300"
                    />
                    <span className="text-[10px] text-gray-500 block mt-1 font-medium select-none">
                      Days-based auto-calculated: <span className="font-bold text-red-750">₹{autoAbsentDeduction}</span>
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Deductions / Other Deductions (₹)
                    </label>
                    <input
                      type="number"
                      value={otherDeductions}
                      onChange={(e) => setOtherDeductions(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 border-gray-300"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 border rounded-lg border-gray-200 mt-4 space-y-2">
                    <span className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                      ℹ️ Attendance Metrics Reference
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 font-medium">
                      <div>Absent Days: <span className="font-bold text-red-650">{calcData?.salaryData?.absentDays || 0} days</span></div>
                      <div>Approved Leaves: <span className="font-bold text-blue-700">{calcData?.salaryData?.approvedLeavesCount || 0} days</span></div>
                      <div>Late Penalty: <span className="font-bold text-red-650">₹{autoLateDeduction}</span></div>
                      <div>Early Penalty: <span className="font-bold text-red-650">₹{autoEarlyDeduction}</span></div>
                      <div>Extra Class Pay: <span className="font-bold text-emerald-700">₹{extraClassEarnings.toLocaleString('en-IN')}</span></div>
                      <div>College Visit Pay: <span className="font-bold text-emerald-700">₹{collegeVisitEarnings.toLocaleString('en-IN')}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Summary */}
            <div className="bg-[#0f766e]/5 border border-[#0f766e]/20 p-5 rounded-xl flex flex-wrap justify-between items-center gap-4">
              <div>
                <span className="block text-xs font-bold text-[#0f766e] uppercase tracking-wider">
                  Nett Take Home (Preview)
                </span>
                <span className="text-2xl font-black text-gray-900 mt-1 block">
                  ₹{previewNetSalary.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 select-none">
                  <input 
                    type="checkbox" 
                    checked={updateBaseline} 
                    onChange={(e) => setUpdateBaseline(e.target.checked)} 
                    className="h-4 w-4 text-[#0f766e] focus:ring-teal-500 border-gray-300 rounded cursor-pointer"
                  />
                  Update Trainee Baseline Profile
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClearFields}
                    className="bg-red-50 hover:bg-red-100 text-red-750 border border-red-200 text-sm font-extrabold px-5 py-2.5 rounded-xl shadow-sm transition-all"
                  >
                    Clear Fields
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#0f766e] hover:bg-[#115e59] text-white text-sm font-black px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                    ) : (
                      "Save & Lock Overrides"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// force redeploy commit comment
export default AdminDashboard;
