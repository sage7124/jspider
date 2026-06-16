import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Clock, Send, Lock, X, Settings, Info, Mail, AlertCircle, BookOpen, CalendarX, FileDown } from 'lucide-react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uzbobbzbbkqzgtjemayu.supabase.co';
const supabaseAnonKey = 'sb_publishable_r0jMviNey66U0tDDtyScEQ_CRmZg-Rr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper functions for time conversion and calculation
const convert24to12 = (time24: string): string => {
  if (!time24) return '';
  const [hoursStr, minutesStr] = time24.split(':');
  let hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursFormatted = hours < 10 ? `0${hours}` : hours;
  const minutesFormatted = minutes < 10 ? `0${minutes}` : minutes;
  return `${hoursFormatted}:${minutesFormatted} ${ampm}`;
};

const calculateDuration = (fromStr: string, toStr: string): number => {
  if (!fromStr || !toStr) return 0;
  const [fromH, fromM] = fromStr.split(':').map(Number);
  const [toH, toM] = toStr.split(':').map(Number);
  
  let fromMinutes = fromH * 60 + fromM;
  let toMinutes = toH * 60 + toM;
  
  if (toMinutes < fromMinutes) {
    // If toTime is less than fromTime, assume it crosses midnight (e.g. 11 PM to 1 AM)
    toMinutes += 24 * 60;
  }
  
  const diffMinutes = toMinutes - fromMinutes;
  const hours = diffMinutes / 60;
  return parseFloat(hours.toFixed(2));
};

const calculateDuration12h = (
  hFrom: string, mFrom: string, pFrom: string,
  hTo: string, mTo: string, pTo: string
): number => {
  let hourFrom = parseInt(hFrom);
  let minFrom = parseInt(mFrom);
  let hourTo = parseInt(hTo);
  let minTo = parseInt(mTo);
  
  if (pFrom === 'PM' && hourFrom !== 12) hourFrom += 12;
  if (pFrom === 'AM' && hourFrom === 12) hourFrom = 0;
  
  if (pTo === 'PM' && hourTo !== 12) hourTo += 12;
  if (pTo === 'AM' && hourTo === 12) hourTo = 0;
  
  let fromMinutes = hourFrom * 60 + minFrom;
  let toMinutes = hourTo * 60 + minTo;
  
  if (toMinutes < fromMinutes) {
    toMinutes += 24 * 60; // assume it crosses midnight
  }
  
  const diffMinutes = toMinutes - fromMinutes;
  return parseFloat((diffMinutes / 60).toFixed(2));
};

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

const WheelTimePicker = ({
  hour,
  minute,
  period,
  onChange,
  onReset,
  themeColor = 'purple'
}: {
  hour: string;
  minute: string;
  period: string;
  onChange: (h: string, m: string, p: string) => void;
  onReset: () => void;
  themeColor: 'purple' | 'emerald' | 'sky';
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll active items into view
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      setTimeout(() => {
        const activeElements = popoverRef.current?.querySelectorAll('.active-time-item');
        activeElements?.forEach(el => {
          el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
        });
      }, 50);
    }
  }, [isOpen, hour, minute, period]);

  const handleResetClick = () => {
    onReset();
  };

  const hoursList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutesList = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  const periodsList = ['AM', 'PM'];

  const themeClasses = {
    purple: {
      border: 'border-purple-100 hover:border-purple-300',
      activeBorder: 'border-purple-400 bg-white',
      text: 'text-purple-700',
      bg: 'bg-purple-100',
      checkBg: 'bg-blue-600 hover:bg-blue-700',
      iconColor: 'text-purple-400',
      accentColor: 'text-purple-700 bg-purple-50 font-black scale-110 shadow-sm border border-purple-100'
    },
    emerald: {
      border: 'border-emerald-100 hover:border-emerald-300',
      activeBorder: 'border-emerald-400 bg-white',
      text: 'text-emerald-700',
      bg: 'bg-emerald-100',
      checkBg: 'bg-blue-600 hover:bg-blue-700',
      iconColor: 'text-emerald-400',
      accentColor: 'text-emerald-700 bg-emerald-50 font-black scale-110 shadow-sm border border-emerald-100'
    },
    sky: {
      border: 'border-sky-100 hover:border-sky-300',
      activeBorder: 'border-sky-400 bg-white',
      text: 'text-sky-700',
      bg: 'bg-sky-100',
      checkBg: 'bg-blue-600 hover:bg-blue-700',
      iconColor: 'text-sky-400',
      accentColor: 'text-sky-700 bg-sky-50 font-black scale-110 shadow-sm border border-sky-100'
    }
  }[themeColor];

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <div 
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border ${isOpen ? themeClasses.activeBorder : themeClasses.border} rounded-lg p-2.5 bg-gray-50/50 flex items-center justify-between gap-1 text-xs font-bold text-gray-800 transition-all shadow-inner cursor-pointer`}
      >
        <div className="flex items-center gap-1">
          <Clock size={14} className={`${themeClasses.iconColor} mr-1.5`} />
          <span className="font-bold text-gray-800">{`${hour}:${minute} ${period}`}</span>
        </div>
        <span className="text-[10px] text-gray-400">▼</span>
      </div>

      {/* Popover */}
      {isOpen && (
        <div 
          ref={popoverRef}
          className="absolute left-1/2 -translate-x-1/2 mt-2 p-4 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[60] flex flex-col gap-3 select-none animate-in fade-in slide-in-from-top-2 duration-150 w-[240px]"
        >
          {/* Picker columns */}
          <div className="relative flex justify-around h-40 bg-gray-50/50 rounded-xl overflow-hidden py-1 border border-gray-100">
            {/* Highlighted middle overlay */}
            <div className="absolute inset-x-0 top-[62px] h-[36px] bg-gray-200/40 pointer-events-none border-y border-gray-200/50 z-10"></div>
            
            {/* Hours Column */}
            <div className="w-1/3 overflow-y-auto scrollbar-none text-center z-20 flex flex-col gap-1 py-14">
              {hoursList.map(h => {
                const isActive = hour === h;
                return (
                  <div 
                    key={h}
                    onClick={() => onChange(h, minute, period)}
                    className={`py-1 cursor-pointer transition-all text-xs font-bold rounded-md ${isActive ? `${themeClasses.accentColor} active-time-item` : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                  >
                    {h}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center text-gray-400 font-bold text-xs z-20">:</div>

            {/* Minutes Column */}
            <div className="w-1/3 overflow-y-auto scrollbar-none text-center z-20 flex flex-col gap-1 py-14">
              {minutesList.map(m => {
                const isActive = minute === m;
                return (
                  <div 
                    key={m}
                    onClick={() => onChange(hour, m, period)}
                    className={`py-1 cursor-pointer transition-all text-xs font-bold rounded-md ${isActive ? `${themeClasses.accentColor} active-time-item` : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                  >
                    {m}
                  </div>
                );
              })}
            </div>

            {/* Periods Column */}
            <div className="w-1/4 overflow-y-auto scrollbar-none text-center z-20 flex flex-col gap-1 py-14">
              {periodsList.map(p => {
                const isActive = period === p;
                return (
                  <div 
                    key={p}
                    onClick={() => onChange(hour, minute, p)}
                    className={`py-1.5 cursor-pointer transition-all text-xs font-bold rounded-md ${isActive ? `${themeClasses.accentColor} active-time-item` : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                  >
                    {p}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t pt-3 border-gray-100">
            <button
              type="button"
              onClick={handleResetClick}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`px-4 py-1.5 ${themeClasses.checkBg} text-white text-xs font-bold rounded-lg shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center`}
            >
              Done
            </button>
          </div>
        </div>
      )}
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
  const [showPayslipsModal, setShowPayslipsModal] = useState(false);
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
  const [breakType, setBreakType] = useState<'NORMAL' | 'COLLEGE_VISIT'>('NORMAL');
  const [collegeName, setCollegeName] = useState('');
  const [subject, setSubject] = useState('');
  const [bookletNo, setBookletNo] = useState('');
  const [topicsCovered, setTopicsCovered] = useState('');
  const [conveyance, setConveyance] = useState('');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [visitHourFrom, setVisitHourFrom] = useState('09');
  const [visitMinFrom, setVisitMinFrom] = useState('00');
  const [visitPeriodFrom, setVisitPeriodFrom] = useState('AM');
  const [visitHourTo, setVisitHourTo] = useState('06');
  const [visitMinTo, setVisitMinTo] = useState('00');
  const [visitPeriodTo, setVisitPeriodTo] = useState('PM');

  // Extra Classes States
  const [extraSubject, setExtraSubject] = useState('');
  const [extraBatchNo, setExtraBatchNo] = useState('');
  const [extraHourFrom, setExtraHourFrom] = useState('10');
  const [extraMinFrom, setExtraMinFrom] = useState('00');
  const [extraPeriodFrom, setExtraPeriodFrom] = useState('AM');
  const [extraHourTo, setExtraHourTo] = useState('11');
  const [extraMinTo, setExtraMinTo] = useState('30');
  const [extraPeriodTo, setExtraPeriodTo] = useState('AM');
  const [extraNoOfStudents, setExtraNoOfStudents] = useState('');
  const [extraCenterName, setExtraCenterName] = useState('');
  const [extraRemarks, setExtraRemarks] = useState('');
  const [extraClasses, setExtraClasses] = useState<any[]>([]);
  const [showExtraClassModal, setShowExtraClassModal] = useState(false);
  const [submittingExtraClass, setSubmittingExtraClass] = useState(false);
  const [extraClassMode, setExtraClassMode] = useState('OFFLINE');

  // Other Center Classes States
  const [otherCenterSubject, setOtherCenterSubject] = useState('');
  const [otherCenterBatchNo, setOtherCenterBatchNo] = useState('');
  const [otherCenterHourFrom, setOtherCenterHourFrom] = useState('10');
  const [otherCenterMinFrom, setOtherCenterMinFrom] = useState('00');
  const [otherCenterPeriodFrom, setOtherCenterPeriodFrom] = useState('AM');
  const [otherCenterHourTo, setOtherCenterHourTo] = useState('11');
  const [otherCenterMinTo, setOtherCenterMinTo] = useState('30');
  const [otherCenterPeriodTo, setOtherCenterPeriodTo] = useState('AM');
  const [otherCenterNoOfStudents, setOtherCenterNoOfStudents] = useState('');
  const [otherCenterCenterName, setOtherCenterCenterName] = useState('');
  const [otherCenterRemarks, setOtherCenterRemarks] = useState('');
  const [otherCenterClasses, setOtherCenterClasses] = useState<any[]>([]);
  const [showOtherCenterClassModal, setShowOtherCenterClassModal] = useState(false);
  const [submittingOtherCenterClass, setSubmittingOtherCenterClass] = useState(false);
  const [otherCenterClassMode, setOtherCenterClassMode] = useState('OFFLINE');

  // Class Cancelled States
  const [cancelSubject, setCancelSubject] = useState('');
  const [cancelBatchNo, setCancelBatchNo] = useState('');
  const [cancelCenterName, setCancelCenterName] = useState('');
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [cancelReason, setCancelReason] = useState('Students Absent');
  const [cancelledClasses, setCancelledClasses] = useState<any[]>([]);
  const [showClassCancelledModal, setShowClassCancelledModal] = useState(false);
  const [submittingClassCancelled, setSubmittingClassCancelled] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchLeaveStatus();
    fetchHistory();
    fetchReportData();
    fetchHolidays();
    fetchNotices();
    fetchProfile();
    fetchDropdowns();
    fetchExtraClassHistory();
    fetchClassCancelledHistory();
    fetchOtherCenterClassHistory();
    
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

  const fetchExtraClassHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/attendance/extra-class/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExtraClasses(res.data.extraClassLogs || []);
    } catch (err) { console.error('Failed to fetch extra class history', err); }
  };

  const fetchClassCancelledHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/attendance/class-cancelled/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCancelledClasses(res.data.classCancelledLogs || []);
    } catch (err) { console.error('Failed to fetch class cancellation history', err); }
  };

  const fetchOtherCenterClassHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/attendance/other-center-class/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOtherCenterClasses(res.data.otherCenterClassLogs || []);
    } catch (err) { console.error('Failed to fetch other center class history', err); }
  };

  const handleLogOtherCenterClass = async () => {
    if (!otherCenterSubject.trim() || !otherCenterBatchNo.trim() || !otherCenterHourFrom || !otherCenterMinFrom || !otherCenterHourTo || !otherCenterMinTo || !otherCenterNoOfStudents.trim() || !otherCenterCenterName.trim() || !otherCenterClassMode) {
      alert('Please fill out all mandatory fields for Other Center Class.');
      return;
    }

    const durationVal = calculateDuration12h(
      otherCenterHourFrom, otherCenterMinFrom, otherCenterPeriodFrom,
      otherCenterHourTo, otherCenterMinTo, otherCenterPeriodTo
    );
    if (durationVal <= 0) {
      alert('End Time must be after Start Time.');
      return;
    }

    const studentsVal = parseInt(otherCenterNoOfStudents);
    if (isNaN(studentsVal) || studentsVal < 0) {
      alert('Number of students must be a valid positive integer.');
      return;
    }

    const startTimeFormatted = `${otherCenterHourFrom}:${otherCenterMinFrom} ${otherCenterPeriodFrom}`;
    const endTimeFormatted = `${otherCenterHourTo}:${otherCenterMinTo} ${otherCenterPeriodTo}`;

    try {
      setSubmittingOtherCenterClass(true);
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.post(`${API_URL}/api/attendance/other-center-class/apply`, {
        subject: otherCenterSubject.trim(),
        batchNo: otherCenterBatchNo.trim(),
        duration: durationVal,
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
        noOfStudents: studentsVal,
        centerName: otherCenterCenterName.trim(),
        remarks: otherCenterRemarks.trim() || undefined,
        classMode: otherCenterClassMode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(res.data?.message || 'Other center class log submitted successfully!');
      fetchOtherCenterClassHistory();
      setShowOtherCenterClassModal(false);
      
      // Reset form
      setOtherCenterSubject('');
      setOtherCenterBatchNo('');
      setOtherCenterHourFrom('10');
      setOtherCenterMinFrom('00');
      setOtherCenterPeriodFrom('AM');
      setOtherCenterHourTo('11');
      setOtherCenterMinTo('30');
      setOtherCenterPeriodTo('AM');
      setOtherCenterNoOfStudents('');
      setOtherCenterCenterName('');
      setOtherCenterRemarks('');
      setOtherCenterClassMode('OFFLINE');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit other center class log');
    } finally {
      setSubmittingOtherCenterClass(false);
    }
  };

  const handleLogExtraClass = async () => {
    if (!extraSubject.trim() || !extraBatchNo.trim() || !extraHourFrom || !extraMinFrom || !extraHourTo || !extraMinTo || !extraNoOfStudents.trim() || !extraCenterName.trim() || !extraClassMode) {
      alert('Please fill out all mandatory fields for Extra Class.');
      return;
    }

    const durationVal = calculateDuration12h(
      extraHourFrom, extraMinFrom, extraPeriodFrom,
      extraHourTo, extraMinTo, extraPeriodTo
    );
    if (durationVal <= 0) {
      alert('End Time must be after Start Time.');
      return;
    }

    const studentsVal = parseInt(extraNoOfStudents);
    if (isNaN(studentsVal) || studentsVal < 0) {
      alert('Number of students must be a valid positive integer.');
      return;
    }

    const startTimeFormatted = `${extraHourFrom}:${extraMinFrom} ${extraPeriodFrom}`;
    const endTimeFormatted = `${extraHourTo}:${extraMinTo} ${extraPeriodTo}`;

    try {
      setSubmittingExtraClass(true);
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.post(`${API_URL}/api/attendance/extra-class/apply`, {
        subject: extraSubject.trim(),
        batchNo: extraBatchNo.trim(),
        duration: durationVal,
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
        noOfStudents: studentsVal,
        centerName: extraCenterName.trim(),
        remarks: extraRemarks.trim() || undefined,
        classMode: extraClassMode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(res.data?.message || 'Extra class log submitted successfully!');
      fetchExtraClassHistory();
      setShowExtraClassModal(false);
      
      // Reset form
      setExtraSubject('');
      setExtraBatchNo('');
      setExtraHourFrom('10');
      setExtraMinFrom('00');
      setExtraPeriodFrom('AM');
      setExtraHourTo('11');
      setExtraMinTo('30');
      setExtraPeriodTo('AM');
      setExtraNoOfStudents('');
      setExtraCenterName('');
      setExtraRemarks('');
      setExtraClassMode('OFFLINE');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit extra class log');
    } finally {
      setSubmittingExtraClass(false);
    }
  };

  const handleLogClassCancelled = async () => {
    if (!cancelSubject.trim() || !cancelBatchNo.trim() || !cancelCenterName.trim()) {
      alert('Please fill out all mandatory fields for Class Cancellation.');
      return;
    }

    try {
      setSubmittingClassCancelled(true);
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.post(`${API_URL}/api/attendance/class-cancelled/apply`, {
        subject: cancelSubject.trim(),
        batchNo: cancelBatchNo.trim(),
        centerName: cancelCenterName.trim(),
        reason: cancelReason,
        remarks: cancelRemarks.trim() || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(res.data?.message || 'Class cancellation logged successfully!');
      fetchClassCancelledHistory();
      setShowClassCancelledModal(false);

      // Reset form
      setCancelSubject('');
      setCancelBatchNo('');
      setCancelCenterName('');
      setCancelRemarks('');
      setCancelReason('Students Absent');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit class cancellation log');
    } finally {
      setSubmittingClassCancelled(false);
    }
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

      const updatedProfile = {
        ...profile,
        [fieldName]: publicUrl
      };
      setProfile(updatedProfile);

      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.put(`${API_URL}/api/auth/profile`, updatedProfile, {
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

  const handleBreakOut = async () => {
    if (breakType === 'COLLEGE_VISIT') {
      if (!bookletNo.trim() || !collegeName.trim() || !subject.trim() || !topicsCovered.trim()) {
        alert('All fields except Conveyance Details (Booklet No, College Name, Subject, Topics Covered) are required for a College Visit.');
        return;
      }
    } else {
      if (!breakReason.trim()) {
        alert('Reason for break is required.');
        return;
      }
    }

    const formattedFromTime = breakType === 'COLLEGE_VISIT'
      ? `${visitHourFrom}:${visitMinFrom} ${visitPeriodFrom}`
      : undefined;
    const formattedToTime = breakType === 'COLLEGE_VISIT'
      ? `${visitHourTo}:${visitMinTo} ${visitPeriodTo}`
      : undefined;

    try {
      setStartingBreak(true);
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.post(`${API_URL}/api/attendance/break/out`, {
        type: breakType,
        bookletNo: breakType === 'COLLEGE_VISIT' ? bookletNo.trim() : undefined,
        collegeName: breakType === 'COLLEGE_VISIT' ? collegeName.trim() : undefined,
        subject: breakType === 'COLLEGE_VISIT' ? subject.trim() : undefined,
        topicsCovered: breakType === 'COLLEGE_VISIT' ? topicsCovered.trim() : undefined,
        conveyance: breakType === 'COLLEGE_VISIT' ? conveyance.trim() : undefined,
        fromTime: formattedFromTime,
        toTime: formattedToTime,
        reason: breakType === 'NORMAL' ? breakReason.trim() : undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data?.message || 'Break started successfully!');
      fetchStatus();
      setShowBreakReasonModal(false);
      setBreakReason('');
      setBookletNo('');
      setCollegeName('');
      setSubject('');
      setTopicsCovered('');
      setConveyance('');
      setFromTime('');
      setToTime('');
      setVisitHourFrom('09');
      setVisitMinFrom('00');
      setVisitPeriodFrom('AM');
      setVisitHourTo('06');
      setVisitMinTo('00');
      setVisitPeriodTo('PM');
      setBreakType('NORMAL');
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

  if (profile?.hasLeft) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center z-[9999] p-6 text-center select-none">
        <div className="bg-[#1e293b]/80 backdrop-blur-md rounded-2xl border border-red-500/20 max-w-md w-full p-8 shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
            <span className="text-red-500 text-3xl font-bold">⚠️</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-wider">Access Revoked</h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-6 font-semibold">
            You have left the institute. Your account is closed and you no longer have access to this portal.
          </p>
          <div className="w-full h-[1px] bg-gray-800 mb-6" />
          <button
            onClick={() => {
              localStorage.removeItem('token');
              window.location.reload();
            }}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:scale-95 transition-all text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-red-900/20 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (profile?.isDisabled) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center z-[9999] p-6 text-center select-none">
        <div className="bg-[#1e293b]/80 backdrop-blur-md rounded-2xl border border-yellow-500/20 max-w-md w-full p-8 shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6 border border-yellow-500/20 animate-pulse">
            <span className="text-yellow-500 text-3xl font-bold">⚠️</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-wider">Account Disabled</h2>
          <h3 className="text-yellow-400 font-extrabold text-sm mb-4 uppercase tracking-widest">Contact Admin As Soon As Possible</h3>
          
          <div className="bg-[#0f172a]/80 rounded-xl p-4 border border-yellow-500/10 mb-6 text-left w-full">
            <p className="text-[10px] font-black text-yellow-500 mb-1 uppercase tracking-wide">Message from Admin:</p>
            <p className="text-gray-200 text-xs font-semibold leading-relaxed whitespace-pre-wrap">
              {profile.disableReason || 'No details provided. Please contact the administrator.'}
            </p>
          </div>
          
          <div className="w-full h-[1px] bg-gray-800 mb-6" />
          <button
            onClick={() => {
              localStorage.removeItem('token');
              window.location.reload();
            }}
            className="w-full py-3.5 bg-yellow-600 hover:bg-yellow-700 active:scale-95 transition-all text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-yellow-900/20 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

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
          <button onClick={() => setShowPayslipsModal(true)}
            className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            💵 My Payslips
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

      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Card 1: Normal Break Details */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-amber-100 hover:shadow-lg transition-all flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-amber-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
                <Clock className="text-amber-600 animate-pulse" size={22} />
                Break Details
              </h3>

              {status?.breakPending && !(status.pendingBreak?.reason && status.pendingBreak.reason.startsWith('College Visit:')) ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-col items-center justify-center gap-3 text-center">
                    <Clock className="text-yellow-600 animate-pulse text-yellow-500" size={24} />
                    <div>
                      <p className="font-extrabold text-yellow-900 text-sm">⏳ BREAK REQUEST PENDING</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Your request to go on break (Reason: <span className="italic">"{status.pendingBreak?.reason || '--'}"</span>) is pending supervisor approval.
                      </p>
                    </div>
                    <p className="text-[10px] text-yellow-600 font-semibold">Please wait until a supervisor or admin approves your request.</p>
                  </div>
                </div>
              ) : status?.currentlyOnBreak && !(status.activeBreak?.bookletNo !== null || (status.activeBreak?.reason && status.activeBreak.reason.startsWith('College Visit:'))) ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-amber-900 text-sm">
                        ⚠️ YOU ARE CURRENTLY ON BREAK
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Departed at: <span className="font-semibold">{status.activeBreak?.breakOut ? new Date(status.activeBreak.breakOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleBreakIn()}
                      disabled={endingBreak}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-3 rounded-lg text-xs uppercase tracking-wider shadow-lg hover:shadow-amber-200 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer w-full"
                    >
                      {endingBreak ? 'Verifying...' : '👋 Arrived Inside Premises (Break In)'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Completed Normal Breaks List */}
                  {status?.completedBreaks && status.completedBreaks.filter((b: any) => !(b.bookletNo !== null || (b.reason && b.reason.startsWith('College Visit:')))).length > 0 && (
                    <div className="border border-gray-100 rounded overflow-hidden text-xs bg-white">
                      <div className="bg-gray-50/50 px-3 py-1.5 font-bold text-gray-500 uppercase border-b text-[10px] tracking-wider">Today's Breaks Log</div>
                      <div className="divide-y divide-gray-100">
                        {status.completedBreaks
                          .filter((b: any) => !(b.bookletNo !== null || (b.reason && b.reason.startsWith('College Visit:'))))
                          .map((b: any, index: number) => {
                            const outTime = new Date(b.breakOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const inTime = b.breakIn ? new Date(b.breakIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
                            const dur = b.breakIn ? Math.round((new Date(b.breakIn).getTime() - new Date(b.breakOut).getTime()) / (1000 * 60)) : null;

                            return (
                              <div key={b.id} className="p-3 flex flex-col gap-1 hover:bg-gray-50/50 transition-colors">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-semibold text-gray-600">Break {index + 1}</span>
                                  <span className="text-gray-800 font-mono">{outTime} - {inTime}</span>
                                  <span className="font-extrabold text-amber-700">{dur !== null ? `${dur} mins` : 'On Break'}</span>
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

                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-150 text-xs">
                    <span className="text-gray-500 font-semibold uppercase tracking-wider">Normal Breaks Count:</span>
                    <span className={`font-black px-2.5 py-1 rounded-full ${status.completedBreaks.filter((b: any) => !(b.bookletNo !== null || (b.reason && b.reason.startsWith('College Visit:')))).length >= 4 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {status.completedBreaks.filter((b: any) => !(b.bookletNo !== null || (b.reason && b.reason.startsWith('College Visit:')))).length} / 4
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!(status?.breakPending && !(status.pendingBreak?.reason && status.pendingBreak.reason.startsWith('College Visit:'))) && 
             !(status?.currentlyOnBreak && !(status.activeBreak?.bookletNo !== null || (status.activeBreak?.reason && status.activeBreak.reason.startsWith('College Visit:')))) && (
              <div className="pt-4">
                {status.completedBreaks.filter((b: any) => !(b.bookletNo !== null || (b.reason && b.reason.startsWith('College Visit:')))).length < 4 ? (
                  <button
                    onClick={() => {
                      setBreakType('NORMAL');
                      setShowBreakReasonModal(true);
                    }}
                    disabled={startingBreak || status?.status !== 'IN' || status?.currentlyOnBreak}
                    className={`w-full font-black py-4 rounded-xl text-xs uppercase tracking-wider transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                      status?.status !== 'IN' || status?.currentlyOnBreak
                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                    title={status?.status !== 'IN' ? 'You must punch in first to take a normal break' : status?.currentlyOnBreak ? 'You are currently on an active break/visit' : ''}
                  >
                    {startingBreak ? 'Processing...' : '☕ Start Normal Break'}
                  </button>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center text-xs font-bold text-red-700">
                    🚫 Maximum 4 breaks reached for today. No further breaks are allowed.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 2: College Visit Details */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-purple-100 hover:shadow-lg transition-all flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-purple-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
                <Clock className="text-purple-600 animate-pulse" size={22} />
                College Visit Details
              </h3>

              {status?.currentlyOnBreak && (status.activeBreak?.bookletNo !== null || (status.activeBreak?.reason && status.activeBreak.reason.startsWith('College Visit:'))) ? (
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg flex flex-col justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-purple-900 text-sm">
                        🎓 YOU ARE CURRENTLY ON COLLEGE VISIT
                      </p>
                      <p className="text-xs text-purple-700 mt-1">
                        Departed at: <span className="font-semibold">{status.activeBreak?.breakOut ? new Date(status.activeBreak.breakOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                      </p>
                      <div className="text-[10px] text-purple-600 bg-white/60 p-2.5 rounded border border-purple-100/50 mt-2 space-y-1">
                        <p><span className="font-bold">Booklet No:</span> {status.activeBreak?.bookletNo || '--'}</p>
                        <p><span className="font-bold">College:</span> {status.activeBreak?.collegeName || '--'}</p>
                        <p><span className="font-bold">Subject:</span> {status.activeBreak?.subject || '--'}</p>
                        {status.activeBreak?.topicsCovered && <p><span className="font-bold">Topics:</span> {status.activeBreak.topicsCovered}</p>}
                        {status.activeBreak?.conveyance && <p><span className="font-bold">Conveyance:</span> {status.activeBreak.conveyance}</p>}
                        {status.activeBreak?.fromTime && status.activeBreak?.toTime ? (
                          <p><span className="font-bold">Planned Timings:</span> {status.activeBreak.fromTime} - {status.activeBreak.toTime}</p>
                        ) : (
                          status.activeBreak?.numberOfHours && <p><span className="font-bold">Planned Hours:</span> {status.activeBreak.numberOfHours} hrs</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleBreakIn()}
                      disabled={endingBreak}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-black px-6 py-3 rounded-lg text-xs uppercase tracking-wider shadow-lg hover:shadow-purple-200 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer w-full"
                    >
                      {endingBreak ? 'Verifying...' : '👋 End College Visit'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Completed College Visits List */}
                  {status?.completedBreaks && status.completedBreaks.filter((b: any) => b.bookletNo !== null || (b.reason && b.reason.startsWith('College Visit:'))).length > 0 && (
                    <div className="border border-gray-100 rounded overflow-hidden text-xs bg-white">
                      <div className="bg-gray-50/50 px-3 py-1.5 font-bold text-gray-500 uppercase border-b text-[10px] tracking-wider">Today's College Visits Log</div>
                      <div className="divide-y divide-gray-100">
                        {status.completedBreaks
                          .filter((b: any) => b.bookletNo !== null || (b.reason && b.reason.startsWith('College Visit:')))
                          .map((b: any, index: number) => {
                            return (
                              <div key={b.id} className="p-3 flex flex-col gap-1 hover:bg-gray-50/50 transition-colors">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-semibold text-gray-600 flex items-center gap-1.5">
                                    Visit {index + 1}
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider ${
                                      b.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                      b.status === 'APPROVED' ? 'bg-green-100 text-green-800 border border-green-250' :
                                      'bg-red-100 text-red-800 border border-red-200'
                                    }`}>
                                      {b.status}
                                    </span>
                                  </span>
                                  <span className="text-gray-800 font-mono">{b.fromTime || '--'} - {b.toTime || '--'}</span>
                                  <span className="font-extrabold text-purple-700">{b.numberOfHours ? `${b.numberOfHours} hrs` : '--'}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded border border-gray-150 mt-1 space-y-0.5">
                                  <p><span className="font-bold text-gray-600">College:</span> {b.collegeName || '--'} ({b.subject || '--'})</p>
                                  <p><span className="font-bold text-gray-600">Booklet No:</span> {b.bookletNo || '--'}</p>
                                  {b.topicsCovered && <p><span className="font-bold text-gray-600">Topics Covered:</span> {b.topicsCovered}</p>}
                                  {b.conveyance && <p><span className="font-bold text-gray-600">Conveyance:</span> {b.conveyance}</p>}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-150 text-xs">
                    <span className="text-gray-500 font-semibold uppercase tracking-wider">College Visits Count:</span>
                    <span className="font-black px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                      {status.completedBreaks.filter((b: any) => b.bookletNo !== null || (b.reason && b.reason.startsWith('College Visit:'))).length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                onClick={() => {
                  setBreakType('COLLEGE_VISIT');
                  setShowBreakReasonModal(true);
                }}
                disabled={startingBreak}
                className="w-full font-black py-4 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs uppercase tracking-wider transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                {startingBreak ? 'Processing...' : '🎓 Log College Visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Card 3: Extra Classes Taken */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-emerald-100 hover:shadow-lg transition-all flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-emerald-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
                <BookOpen className="text-emerald-600 animate-pulse" size={22} />
                Extra Classes Taken
              </h3>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {extraClasses.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 text-xs">No extra classes logged yet.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {extraClasses.map((ec: any) => (
                      <div key={ec.id} className="py-2.5 space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-700">{ec.subject}</span>
                          <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${
                            ec.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            ec.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700 animate-pulse'
                          }`}>
                            {ec.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 space-y-0.5 font-medium bg-gray-50/50 p-2 rounded border border-gray-100">
                          <p><span className="font-bold text-gray-600">Batch:</span> {ec.batchNo} | <span className="font-bold text-gray-600">Mode:</span> {ec.classMode || 'OFFLINE'} | <span className="font-bold text-gray-600">Students:</span> {ec.noOfStudents}</p>
                          <p><span className="font-bold text-gray-600">Center:</span> {ec.centerName}</p>
                          <p><span className="font-bold text-gray-600">Time:</span> {ec.startTime} - {ec.endTime} ({ec.duration} hrs)</p>
                          <p><span className="font-bold text-gray-600">Date:</span> {new Date(ec.date).toLocaleDateString('en-IN')} ({ec.day})</p>
                          {ec.remarks && <p><span className="font-bold text-gray-600">Remarks:</span> {ec.remarks}</p>}
                          {ec.adminReason && (
                            <p className="mt-1 pt-1 border-t border-gray-200 text-purple-700 font-semibold">
                              <span className="font-bold text-gray-700">Reason:</span> {ec.adminReason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Classes Cancelled */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-red-100 hover:shadow-lg transition-all flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-red-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
                <CalendarX className="text-red-600 animate-pulse" size={22} />
                Classes Cancelled
              </h3>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {cancelledClasses.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 text-xs">No cancelled classes logged yet.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {cancelledClasses.map((cc: any) => (
                      <div key={cc.id} className="py-2.5 space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-700">{cc.subject}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{new Date(cc.date).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 space-y-0.5 font-medium bg-gray-50/50 p-2 rounded border border-gray-100">
                          <p><span className="font-bold text-gray-600">Batch:</span> {cc.batchNo} | <span className="font-bold text-gray-600">Day:</span> {cc.day}</p>
                          <p><span className="font-bold text-gray-600">Center:</span> {cc.centerName}</p>
                          <p><span className="font-bold text-gray-600">Reason:</span> {cc.reason || 'Other reasons'}</p>
                          {cc.remarks && <p><span className="font-bold text-gray-600">Remarks:</span> {cc.remarks}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="pt-4">
              <button
                onClick={() => setShowClassCancelledModal(true)}
                className="w-full font-black py-4 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-xl text-xs uppercase tracking-wider transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                ➕ Log Class Cancelled
              </button>
            </div>
          </div>

          {/* Card 5: Other Center Classes */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-sky-100 hover:shadow-lg transition-all flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-sky-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
                <BookOpen className="text-sky-600 animate-pulse" size={22} />
                Other Center Classes
              </h3>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {otherCenterClasses.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 text-xs">No other center classes logged yet.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {otherCenterClasses.map((oc: any) => (
                      <div key={oc.id} className="py-2.5 space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-700">{oc.subject}</span>
                          <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${
                            oc.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            oc.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700 animate-pulse'
                          }`}>
                            {oc.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 space-y-0.5 font-medium bg-gray-50/50 p-2 rounded border border-gray-100">
                          <p><span className="font-bold text-gray-600">Batch:</span> {oc.batchNo} | <span className="font-bold text-gray-600">Mode:</span> {oc.classMode || 'OFFLINE'} | <span className="font-bold text-gray-600">Students:</span> {oc.noOfStudents}</p>
                          <p><span className="font-bold text-gray-600">Center:</span> {oc.centerName}</p>
                          <p><span className="font-bold text-gray-600">Time:</span> {oc.startTime} - {oc.endTime} ({oc.duration} hrs)</p>
                          <p><span className="font-bold text-gray-600">Date:</span> {new Date(oc.date).toLocaleDateString('en-IN')} ({oc.day})</p>
                          {oc.remarks && <p><span className="font-bold text-gray-600">Remarks:</span> {oc.remarks}</p>}
                          {oc.adminReason && (
                            <p className="mt-1 pt-1 border-t border-gray-200 text-purple-700 font-semibold">
                              <span className="font-bold text-gray-700">Reason:</span> {oc.adminReason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setShowOtherCenterClassModal(true)}
                className="w-full font-black py-4 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs uppercase tracking-wider transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                ➕ Log Other Center Class
              </button>
            </div>
          </div>
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

      {/* My Payslips Modal */}
      {showPayslipsModal && (
        <TraineePayslipsModal onClose={() => setShowPayslipsModal(false)} />
      )}

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

      {/* College Visit Report */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b flex flex-wrap justify-between items-center gap-4 bg-gray-50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="text-emerald-600" /> College Visit Report
            <span className="ml-2 text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              {reportData?.collegeVisits?.length || 0} Logs
            </span>
          </h2>
          <div className="flex gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1">MONTH</label>
              <select value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium text-gray-750">
                {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1">YEAR</label>
              <select value={reportYear} onChange={e => setReportYear(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium text-gray-750">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto w-full">
          {loadingReport ? (
            <div className="flex items-center justify-center p-8 text-gray-500 font-medium">Loading report data...</div>
          ) : !reportData || !reportData.collegeVisits || reportData.collegeVisits.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-gray-500 font-medium text-xs">No college visits logged for this month</div>
          ) : (
            <table className="w-full text-sm text-left min-w-[1000px]">
              <thead className="bg-[#00796B] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Day</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Booklet No</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">College Name</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Subject</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Topics Covered</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Conveyance</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Timings</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Duration</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {reportData.collegeVisits.map((log: any, i: number) => {
                  const dateObj = new Date(log.date);
                  const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  return (
                    <tr key={log.id || i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium whitespace-nowrap border-r">{dateStr}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{dayStr}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.bookletNo || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.collegeName || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.subject || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 border-r max-w-xs truncate" title={log.topicsCovered}>{log.topicsCovered || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.conveyance || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.fromTime && log.toTime ? `${log.fromTime} - ${log.toTime}` : '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r font-bold text-emerald-700">{log.numberOfHours ? `${log.numberOfHours} hrs` : '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                          log.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                          log.status === 'APPROVED' ? 'bg-green-100 text-green-800 border border-green-200' :
                          'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-right text-gray-700">Total Approved Duration:</td>
                  <td className="px-4 py-3 font-extrabold text-emerald-700">
                    {(() => {
                      const total = reportData.collegeVisits.reduce((acc: number, log: any) => {
                        if (log.status !== 'APPROVED') return acc;
                        const val = parseFloat(log.numberOfHours);
                        return acc + (isNaN(val) ? 0 : val);
                      }, 0);
                      return total.toFixed(2);
                    })()} hrs
                  </td>
                  <td className="px-4 py-3 border-l"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Break Details Report */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b flex flex-wrap justify-between items-center gap-4 bg-gray-50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="text-blue-600" /> Break Details Report
            <span className="ml-2 text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
              {reportData?.breaks?.length || 0} Logs
            </span>
          </h2>
          <div className="flex gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1">MONTH</label>
              <select value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium text-gray-750">
                {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1">YEAR</label>
              <select value={reportYear} onChange={e => setReportYear(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium text-gray-750">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto w-full">
          {loadingReport ? (
            <div className="flex items-center justify-center p-8 text-gray-500 font-medium">Loading report data...</div>
          ) : !reportData || !reportData.breaks || reportData.breaks.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-gray-500 font-medium text-xs">No breaks logged for this month</div>
          ) : (
            <table className="w-full text-sm text-left min-w-[1000px]">
              <thead className="bg-[#1976D2] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Day</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Out Time</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">In Time</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Duration</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Reason</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {reportData.breaks.map((log: any, i: number) => {
                  const dateObj = new Date(log.date);
                  const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  
                  const outTime = new Date(log.breakOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const inTime = log.breakIn ? new Date(log.breakIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
                  const dur = log.breakIn ? Math.round((new Date(log.breakIn).getTime() - new Date(log.breakOut).getTime()) / 60000) : null;
                  
                  return (
                    <tr key={log.id || i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium whitespace-nowrap border-r">{dateStr}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{dayStr}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{outTime}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{inTime}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r font-bold text-blue-700">{dur !== null ? `${dur} mins` : 'On Break'}</td>
                      <td className="px-4 py-2 text-gray-600 border-r">{log.reason || '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Total Duration:</td>
                  <td className="px-4 py-3 font-extrabold text-blue-700">
                    {(() => {
                      const totalMin = reportData.breaks.reduce((acc: number, log: any) => {
                        const dur = log.breakIn ? Math.round((new Date(log.breakIn).getTime() - new Date(log.breakOut).getTime()) / 60000) : 0;
                        return acc + dur;
                      }, 0);
                      if (totalMin >= 60) {
                        return `${Math.floor(totalMin / 60)} hrs ${totalMin % 60} mins (${totalMin} mins)`;
                      }
                      return `${totalMin} mins`;
                    })()}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Class Cancelled Report */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b flex flex-wrap justify-between items-center gap-4 bg-gray-50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarX className="text-red-600" /> Class Cancelled Report
            <span className="ml-2 text-xs font-bold bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full">
              {reportData?.classesCancelled?.length || 0} Logs
            </span>
          </h2>
          <div className="flex gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1">MONTH</label>
              <select value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium text-gray-750">
                {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1">YEAR</label>
              <select value={reportYear} onChange={e => setReportYear(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium text-gray-750">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto w-full">
          {loadingReport ? (
            <div className="flex items-center justify-center p-8 text-gray-500 font-medium">Loading report data...</div>
          ) : !reportData || !reportData.classesCancelled || reportData.classesCancelled.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-gray-500 font-medium text-xs">No cancelled classes logged for this month</div>
          ) : (
            <table className="w-full text-sm text-left min-w-[1000px]">
              <thead className="bg-[#D32F2F] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Day</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Subject</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Batch No</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Center Name</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Reason</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Remarks</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {reportData.classesCancelled.map((log: any, i: number) => {
                  const dateObj = new Date(log.date);
                  const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  return (
                    <tr key={log.id || i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium whitespace-nowrap border-r">{dateStr}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{dayStr}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.subject || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.batchNo || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.centerName || '--'}</td>
                      <td className="px-4 py-2 font-bold text-red-700 whitespace-nowrap border-r">{log.reason || 'Other reasons'}</td>
                      <td className="px-4 py-2 text-gray-600 border-r italic">{log.remarks ? `"${log.remarks}"` : '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Extra Class Taken Report */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b flex flex-wrap justify-between items-center gap-4 bg-gray-50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="text-indigo-600" /> Extra Class Taken Report
            <span className="ml-2 text-xs font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
              {reportData?.extraClasses?.length || 0} Logs
            </span>
          </h2>
          <div className="flex gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1">MONTH</label>
              <select value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium text-gray-750">
                {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1">YEAR</label>
              <select value={reportYear} onChange={e => setReportYear(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium text-gray-750">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto w-full">
          {loadingReport ? (
            <div className="flex items-center justify-center p-8 text-gray-500 font-medium">Loading report data...</div>
          ) : !reportData || !reportData.extraClasses || reportData.extraClasses.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-gray-500 font-medium text-xs">No extra classes logged for this month</div>
          ) : (
            <table className="w-full text-sm text-left min-w-[1100px]">
              <thead className="bg-[#303F9F] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Day</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Subject</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Batch No</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Timings</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Duration</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Students</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Center</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">Status</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Supervisor Remark</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Remarks</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {reportData.extraClasses.map((log: any, i: number) => {
                  const dateObj = new Date(log.date);
                  const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  const dayStr = log.day || dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  return (
                    <tr key={log.id || i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium whitespace-nowrap border-r">{dateStr}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{dayStr}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.subject || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.batchNo || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.startTime && log.endTime ? `${log.startTime} - ${log.endTime}` : '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r font-bold text-indigo-700">{log.duration ? `${log.duration} hrs` : '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r text-center">{log.noOfStudents ?? '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.centerName || '--'}</td>
                      <td className="px-4 py-2 border-r text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          log.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 border-r italic">{log.adminReason || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 border-r">{log.remarks || '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-gray-700">Total Approved Hours:</td>
                  <td className="px-4 py-3 font-extrabold text-indigo-700">
                    {(() => {
                      const total = reportData.extraClasses.reduce((acc: number, log: any) => {
                        if (log.status === 'APPROVED') {
                          const val = parseFloat(log.duration);
                          return acc + (isNaN(val) ? 0 : val);
                        }
                        return acc;
                      }, 0);
                      return total.toFixed(2);
                    })()} hrs
                  </td>
                  <td colSpan={5} className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Other Center Class Taken Report */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b flex flex-wrap justify-between items-center gap-4 bg-gray-50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="text-sky-600" /> Other Center Class Taken Report
            <span className="ml-2 text-xs font-bold bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full">
              {reportData?.otherCenterClasses?.length || 0} Logs
            </span>
          </h2>
          <div className="flex gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1">MONTH</label>
              <select value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium text-gray-750">
                {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1">YEAR</label>
              <select value={reportYear} onChange={e => setReportYear(e.target.value)} className="border rounded px-3 py-1.5 outline-none font-medium text-gray-750">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto w-full">
          {loadingReport ? (
            <div className="flex items-center justify-center p-8 text-gray-500 font-medium">Loading report data...</div>
          ) : !reportData || !reportData.otherCenterClasses || reportData.otherCenterClasses.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-gray-500 font-medium text-xs">No other center classes logged for this month</div>
          ) : (
            <table className="w-full text-sm text-left min-w-[1100px]">
              <thead className="bg-[#0288D1] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Day</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Subject</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Batch No</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Timings</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Duration</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Students</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Center</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">Status</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Supervisor Remark</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Remarks</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {reportData.otherCenterClasses.map((log: any, i: number) => {
                  const dateObj = new Date(log.date);
                  const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  const dayStr = log.day || dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  return (
                    <tr key={log.id || i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium whitespace-nowrap border-r">{dateStr}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{dayStr}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.subject || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.batchNo || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.startTime && log.endTime ? `${log.startTime} - ${log.endTime}` : '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r font-bold text-sky-700">{log.duration ? `${log.duration} hrs` : '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r text-center">{log.noOfStudents ?? '--'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap border-r">{log.centerName || '--'}</td>
                      <td className="px-4 py-2 border-r text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          log.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 border-r italic">{log.adminReason || '--'}</td>
                      <td className="px-4 py-2 text-gray-600 border-r">{log.remarks || '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-gray-700">Total Approved Hours:</td>
                  <td className="px-4 py-3 font-extrabold text-sky-700">
                    {(() => {
                      const total = reportData.otherCenterClasses.reduce((acc: number, log: any) => {
                        if (log.status === 'APPROVED') {
                          const val = parseFloat(log.duration);
                          return acc + (isNaN(val) ? 0 : val);
                        }
                        return acc;
                      }, 0);
                      return total.toFixed(2);
                    })()} hrs
                  </td>
                  <td colSpan={5} className="px-4 py-3"></td>
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
                setBookletNo('');
                setCollegeName('');
                setSubject('');
                setTopicsCovered('');
                setConveyance('');
                setFromTime('');
                setToTime('');
                setVisitHourFrom('09');
                setVisitMinFrom('00');
                setVisitPeriodFrom('AM');
                setVisitHourTo('06');
                setVisitMinTo('00');
                setVisitPeriodTo('PM');
                setBreakType('NORMAL');
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-purple-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
              {breakType === 'COLLEGE_VISIT' ? (
                <><Clock size={20} className="animate-pulse" /> College visit details</>
              ) : (
                <><Clock size={20} className="animate-pulse" /> Start Normal Break</>
              )}
            </h3>
            <div className="space-y-4 text-left overflow-y-auto max-h-[70vh] pr-1">
              {breakType === 'NORMAL' ? (
                <div>
                  <label className="block text-[10px] font-black text-purple-700 mb-2 uppercase tracking-wide">
                    Reason for Break
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={breakReason}
                    onChange={(e) => setBreakReason(e.target.value)}
                    className="w-full border border-purple-100 rounded-lg p-3 text-xs outline-none focus:border-purple-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                    placeholder="Enter the reason for taking a break (e.g., Lunch, Tea Break)..."
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-purple-700 mb-1 uppercase tracking-wide">
                      NICT College Attendance Booklet number
                    </label>
                    <input
                      type="text"
                      required
                      value={bookletNo}
                      onChange={(e) => setBookletNo(e.target.value)}
                      className="w-full border border-purple-100 rounded-lg p-2.5 text-xs outline-none focus:border-purple-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                      placeholder="e.g. B-9988"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-purple-700 mb-1 uppercase tracking-wide">
                      College Name
                    </label>
                    <input
                      type="text"
                      required
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      className="w-full border border-purple-100 rounded-lg p-2.5 text-xs outline-none focus:border-purple-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                      placeholder="e.g. RV College of Engineering"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-purple-700 mb-1 uppercase tracking-wide">
                      Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full border border-purple-100 rounded-lg p-2.5 text-xs outline-none focus:border-purple-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                      placeholder="e.g. Placement Drive, Guest Lecture"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-purple-700 mb-1 uppercase tracking-wide">
                      Topics Covered
                    </label>
                    <input
                      type="text"
                      required
                      value={topicsCovered}
                      onChange={(e) => setTopicsCovered(e.target.value)}
                      className="w-full border border-purple-100 rounded-lg p-2.5 text-xs outline-none focus:border-purple-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                      placeholder="e.g. SQL Optimization, Java OOPs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-purple-700 mb-1 uppercase tracking-wide">
                      Conveyance Details (Optional)
                    </label>
                    <input
                      type="text"
                      value={conveyance}
                      onChange={(e) => setConveyance(e.target.value)}
                      className="w-full border border-purple-100 rounded-lg p-2.5 text-xs outline-none focus:border-purple-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                      placeholder="e.g. Cab / Auto / Two Wheeler (KM: 24)"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Clock Picker: From Time */}
                    <div>
                      <label className="block text-[10px] font-black text-purple-700 mb-1 uppercase tracking-wide">From Time</label>
                      <WheelTimePicker
                        hour={visitHourFrom}
                        minute={visitMinFrom}
                        period={visitPeriodFrom}
                        onChange={(h, m, p) => {
                          setVisitHourFrom(h);
                          setVisitMinFrom(m);
                          setVisitPeriodFrom(p);
                        }}
                        onReset={() => {
                          setVisitHourFrom('09');
                          setVisitMinFrom('00');
                          setVisitPeriodFrom('AM');
                        }}
                        themeColor="purple"
                      />
                    </div>

                    {/* Clock Picker: To Time */}
                    <div>
                      <label className="block text-[10px] font-black text-purple-700 mb-1 uppercase tracking-wide">To Time</label>
                      <WheelTimePicker
                        hour={visitHourTo}
                        minute={visitMinTo}
                        period={visitPeriodTo}
                        onChange={(h, m, p) => {
                          setVisitHourTo(h);
                          setVisitMinTo(m);
                          setVisitPeriodTo(p);
                        }}
                        onReset={() => {
                          setVisitHourTo('06');
                          setVisitMinTo('00');
                          setVisitPeriodTo('PM');
                        }}
                        themeColor="purple"
                      />
                    </div>
                  </div>
                </div>
              )}
 
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBreakReasonModal(false);
                    setBreakReason('');
                    setBookletNo('');
                    setCollegeName('');
                    setSubject('');
                    setTopicsCovered('');
                    setConveyance('');
                    setFromTime('');
                    setToTime('');
                    setVisitHourFrom('09');
                    setVisitMinFrom('00');
                    setVisitPeriodFrom('AM');
                    setVisitHourTo('06');
                    setVisitMinTo('00');
                    setVisitPeriodTo('PM');
                    setBreakType('NORMAL');
                  }}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-bold tracking-wider text-xs uppercase shadow-sm hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    startingBreak || 
                    (breakType === 'NORMAL' && !breakReason.trim()) || 
                    (breakType === 'COLLEGE_VISIT' && (
                      !bookletNo.trim() || 
                      !collegeName.trim() || 
                      !subject.trim() || 
                      !topicsCovered.trim()
                    ))
                  }
                  onClick={() => handleBreakOut()}
                  className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-black tracking-widest text-xs uppercase shadow-lg shadow-purple-100 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {startingBreak ? 'Processing...' : '🚀 Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Extra Class Modal */}
      {showExtraClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowExtraClassModal(false);
                setExtraSubject('');
                setExtraBatchNo('');
                setExtraHourFrom('10');
                setExtraMinFrom('00');
                setExtraPeriodFrom('AM');
                setExtraHourTo('11');
                setExtraMinTo('30');
                setExtraPeriodTo('AM');
                setExtraNoOfStudents('');
                setExtraCenterName('');
                setExtraRemarks('');
                setExtraClassMode('OFFLINE');
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-lg font-black text-emerald-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
              <BookOpen size={20} className="animate-pulse" /> Log Extra Class
            </h3>

            <div className="space-y-3 text-left overflow-y-auto max-h-[70vh] pr-1">
              <div>
                <label className="block text-[10px] font-black text-emerald-700 mb-1 uppercase tracking-wide">Subject / Topic</label>
                <input
                  type="text"
                  required
                  value={extraSubject}
                  onChange={(e) => setExtraSubject(e.target.value)}
                  className="w-full border border-emerald-100 rounded-lg p-2.5 text-xs outline-none focus:border-emerald-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                  placeholder="e.g. JavaScript Async / Tally Prime"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-emerald-700 mb-1 uppercase tracking-wide">Batch Code / No</label>
                  <input
                    type="text"
                    required
                    value={extraBatchNo}
                    onChange={(e) => setExtraBatchNo(e.target.value)}
                    className="w-full border border-emerald-100 rounded-lg p-2.5 text-xs outline-none focus:border-emerald-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                    placeholder="e.g. B-125"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-emerald-700 mb-1 uppercase tracking-wide">No of Students Attended</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={extraNoOfStudents}
                    onChange={(e) => setExtraNoOfStudents(e.target.value)}
                    className="w-full border border-emerald-100 rounded-lg p-2.5 text-xs outline-none focus:border-emerald-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                    placeholder="e.g. 25"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-emerald-700 mb-1 uppercase tracking-wide">NICT Center Name</label>
                  <input
                    type="text"
                    required
                    value={extraCenterName}
                    onChange={(e) => setExtraCenterName(e.target.value)}
                    className="w-full border border-emerald-100 rounded-lg p-2.5 text-xs outline-none focus:border-emerald-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                    placeholder="e.g. Rajajinagar"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-emerald-700 mb-1 uppercase tracking-wide">Class Mode</label>
                  <select
                    value={extraClassMode}
                    onChange={(e) => setExtraClassMode(e.target.value)}
                    className="w-full border border-emerald-100 rounded-lg p-2.5 text-xs outline-none focus:border-emerald-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner"
                  >
                    <option value="OFFLINE">Offline</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Clock Picker: From Time */}
                <div>
                  <label className="block text-[10px] font-black text-emerald-700 mb-1 uppercase tracking-wide">Start Time</label>
                  <WheelTimePicker
                    hour={extraHourFrom}
                    minute={extraMinFrom}
                    period={extraPeriodFrom}
                    onChange={(h, m, p) => {
                      setExtraHourFrom(h);
                      setExtraMinFrom(m);
                      setExtraPeriodFrom(p);
                    }}
                    onReset={() => {
                      setExtraHourFrom('10');
                      setExtraMinFrom('00');
                      setExtraPeriodFrom('AM');
                    }}
                    themeColor="emerald"
                  />
                </div>

                {/* Clock Picker: To Time */}
                <div>
                  <label className="block text-[10px] font-black text-emerald-700 mb-1 uppercase tracking-wide">End Time</label>
                  <WheelTimePicker
                    hour={extraHourTo}
                    minute={extraMinTo}
                    period={extraPeriodTo}
                    onChange={(h, m, p) => {
                      setExtraHourTo(h);
                      setExtraMinTo(m);
                      setExtraPeriodTo(p);
                    }}
                    onReset={() => {
                      setExtraHourTo('11');
                      setExtraMinTo('30');
                      setExtraPeriodTo('AM');
                    }}
                    themeColor="emerald"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-emerald-700 mb-1 uppercase tracking-wide">Remarks / Details (Optional)</label>
                <textarea
                  value={extraRemarks}
                  onChange={(e) => setExtraRemarks(e.target.value)}
                  className="w-full border border-emerald-100 rounded-lg p-2.5 text-xs outline-none focus:border-emerald-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400 resize-none h-20"
                  placeholder="Enter additional details..."
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-4 border-t mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowExtraClassModal(false);
                  setExtraSubject('');
                  setExtraBatchNo('');
                  setExtraHourFrom('10');
                  setExtraMinFrom('00');
                  setExtraPeriodFrom('AM');
                  setExtraHourTo('11');
                  setExtraMinTo('30');
                  setExtraPeriodTo('AM');
                  setExtraNoOfStudents('');
                  setExtraCenterName('');
                  setExtraRemarks('');
                  setExtraClassMode('OFFLINE');
                }}
                className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-bold tracking-wider text-xs uppercase shadow-sm hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  submittingExtraClass ||
                  !extraSubject.trim() ||
                  !extraBatchNo.trim() ||
                  !extraNoOfStudents.trim() ||
                  !extraCenterName.trim()
                }
                onClick={handleLogExtraClass}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black tracking-widest text-xs uppercase shadow-lg shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {submittingExtraClass ? 'Saving...' : '🚀 Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Other Center Class Modal */}
      {showOtherCenterClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowOtherCenterClassModal(false);
                setOtherCenterSubject('');
                setOtherCenterBatchNo('');
                setOtherCenterHourFrom('10');
                setOtherCenterMinFrom('00');
                setOtherCenterPeriodFrom('AM');
                setOtherCenterHourTo('11');
                setOtherCenterMinTo('30');
                setOtherCenterPeriodTo('AM');
                setOtherCenterNoOfStudents('');
                setOtherCenterCenterName('');
                setOtherCenterRemarks('');
                setOtherCenterClassMode('OFFLINE');
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-lg font-black text-sky-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
              <BookOpen size={20} className="animate-pulse" /> Log Other Center Class
            </h3>

            <div className="space-y-3 text-left overflow-y-auto max-h-[70vh] pr-1">
              <div>
                <label className="block text-[10px] font-black text-sky-700 mb-1 uppercase tracking-wide">Subject / Topic</label>
                <input
                  type="text"
                  required
                  value={otherCenterSubject}
                  onChange={(e) => setOtherCenterSubject(e.target.value)}
                  className="w-full border border-sky-100 rounded-lg p-2.5 text-xs outline-none focus:border-sky-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                  placeholder="e.g. JavaScript Async / Tally Prime"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-sky-700 mb-1 uppercase tracking-wide">Batch Code / No</label>
                  <input
                    type="text"
                    required
                    value={otherCenterBatchNo}
                    onChange={(e) => setOtherCenterBatchNo(e.target.value)}
                    className="w-full border border-sky-100 rounded-lg p-2.5 text-xs outline-none focus:border-sky-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                    placeholder="e.g. B-125"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-sky-700 mb-1 uppercase tracking-wide">No of Students Attended</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={otherCenterNoOfStudents}
                    onChange={(e) => setOtherCenterNoOfStudents(e.target.value)}
                    className="w-full border border-sky-100 rounded-lg p-2.5 text-xs outline-none focus:border-sky-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                    placeholder="e.g. 25"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-sky-700 mb-1 uppercase tracking-wide">NICT Center Name</label>
                  <input
                    type="text"
                    required
                    value={otherCenterCenterName}
                    onChange={(e) => setOtherCenterCenterName(e.target.value)}
                    className="w-full border border-sky-100 rounded-lg p-2.5 text-xs outline-none focus:border-sky-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                    placeholder="e.g. Rajajinagar"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-sky-700 mb-1 uppercase tracking-wide">Class Mode</label>
                  <select
                    value={otherCenterClassMode}
                    onChange={(e) => setOtherCenterClassMode(e.target.value)}
                    className="w-full border border-sky-100 rounded-lg p-2.5 text-xs outline-none focus:border-sky-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner"
                  >
                    <option value="OFFLINE">Offline</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Clock Picker: From Time */}
                <div>
                  <label className="block text-[10px] font-black text-sky-700 mb-1 uppercase tracking-wide">Start Time</label>
                  <WheelTimePicker
                    hour={otherCenterHourFrom}
                    minute={otherCenterMinFrom}
                    period={otherCenterPeriodFrom}
                    onChange={(h, m, p) => {
                      setOtherCenterHourFrom(h);
                      setOtherCenterMinFrom(m);
                      setOtherCenterPeriodFrom(p);
                    }}
                    onReset={() => {
                      setOtherCenterHourFrom('10');
                      setOtherCenterMinFrom('00');
                      setOtherCenterPeriodFrom('AM');
                    }}
                    themeColor="sky"
                  />
                </div>

                {/* Clock Picker: To Time */}
                <div>
                  <label className="block text-[10px] font-black text-sky-700 mb-1 uppercase tracking-wide">End Time</label>
                  <WheelTimePicker
                    hour={otherCenterHourTo}
                    minute={otherCenterMinTo}
                    period={otherCenterPeriodTo}
                    onChange={(h, m, p) => {
                      setOtherCenterHourTo(h);
                      setOtherCenterMinTo(m);
                      setOtherCenterPeriodTo(p);
                    }}
                    onReset={() => {
                      setOtherCenterHourTo('11');
                      setOtherCenterMinTo('30');
                      setOtherCenterPeriodTo('AM');
                    }}
                    themeColor="sky"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-sky-700 mb-1 uppercase tracking-wide">Remarks / Details (Optional)</label>
                <textarea
                  value={otherCenterRemarks}
                  onChange={(e) => setOtherCenterRemarks(e.target.value)}
                  className="w-full border border-sky-100 rounded-lg p-2.5 text-xs outline-none focus:border-sky-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400 resize-none h-20"
                  placeholder="Enter additional details..."
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-4 border-t mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowOtherCenterClassModal(false);
                  setOtherCenterSubject('');
                  setOtherCenterBatchNo('');
                  setOtherCenterHourFrom('10');
                  setOtherCenterMinFrom('00');
                  setOtherCenterPeriodFrom('AM');
                  setOtherCenterHourTo('11');
                  setOtherCenterMinTo('30');
                  setOtherCenterPeriodTo('AM');
                  setOtherCenterNoOfStudents('');
                  setOtherCenterCenterName('');
                  setOtherCenterRemarks('');
                  setOtherCenterClassMode('OFFLINE');
                }}
                className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-bold tracking-wider text-xs uppercase shadow-sm hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  submittingOtherCenterClass ||
                  !otherCenterSubject.trim() ||
                  !otherCenterBatchNo.trim() ||
                  !otherCenterNoOfStudents.trim() ||
                  !otherCenterCenterName.trim()
                }
                onClick={handleLogOtherCenterClass}
                className="flex-[2] bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-xl font-black tracking-widest text-xs uppercase shadow-lg shadow-sky-100 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {submittingOtherCenterClass ? 'Saving...' : '🚀 Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Cancelled Modal */}
      {showClassCancelledModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowClassCancelledModal(false);
                setCancelSubject('');
                setCancelBatchNo('');
                setCancelCenterName('');
                setCancelRemarks('');
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-lg font-black text-red-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
              <CalendarX size={20} className="animate-pulse" /> Log Class Cancelled
            </h3>

            <div className="space-y-3 text-left overflow-y-auto max-h-[70vh] pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-red-700 mb-1 uppercase tracking-wide">Date</label>
                  <input type="text" readOnly value={new Date().toLocaleDateString('en-IN')} className="w-full border border-red-100 rounded-lg p-2.5 text-xs bg-gray-100 font-bold text-gray-500 shadow-inner" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-red-700 mb-1 uppercase tracking-wide">Day</label>
                  <input type="text" readOnly value={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]} className="w-full border border-red-100 rounded-lg p-2.5 text-xs bg-gray-100 font-bold text-gray-500 shadow-inner" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-red-700 mb-1 uppercase tracking-wide">Subject</label>
                <input
                  type="text"
                  required
                  value={cancelSubject}
                  onChange={(e) => setCancelSubject(e.target.value)}
                  className="w-full border border-red-100 rounded-lg p-2.5 text-xs outline-none focus:border-red-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                  placeholder="e.g. Java Programming"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-red-700 mb-1 uppercase tracking-wide">Batch No</label>
                  <input
                    type="text"
                    required
                    value={cancelBatchNo}
                    onChange={(e) => setCancelBatchNo(e.target.value)}
                    className="w-full border border-red-100 rounded-lg p-2.5 text-xs outline-none focus:border-red-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                    placeholder="e.g. B-125"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-red-700 mb-1 uppercase tracking-wide">NICT Center Name</label>
                  <input
                    type="text"
                    required
                    value={cancelCenterName}
                    onChange={(e) => setCancelCenterName(e.target.value)}
                    className="w-full border border-red-100 rounded-lg p-2.5 text-xs outline-none focus:border-red-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400"
                    placeholder="e.g. Rajajinagar Center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-red-700 mb-1 uppercase tracking-wide">Reason for Cancellation</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-red-100 rounded-lg p-2.5 text-xs outline-none focus:border-red-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner"
                >
                  <option value="Students Absent">Students Absent</option>
                  <option value="Faculty Cancelled Class">Faculty Cancelled Class</option>
                  <option value="Faculty at College">Faculty at College</option>
                  <option value="Other reasons">Other reasons</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-red-700 mb-1 uppercase tracking-wide">Remarks if any (Optional)</label>
                <textarea
                  value={cancelRemarks}
                  onChange={(e) => setCancelRemarks(e.target.value)}
                  className="w-full border border-red-100 rounded-lg p-2.5 text-xs outline-none focus:border-red-400 bg-gray-50/50 font-bold focus:bg-white transition-all shadow-inner placeholder-gray-400 resize-none h-20"
                  placeholder="Enter details..."
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-4 border-t mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowClassCancelledModal(false);
                  setCancelSubject('');
                  setCancelBatchNo('');
                  setCancelCenterName('');
                  setCancelRemarks('');
                  setCancelReason('Students Absent');
                }}
                className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-bold tracking-wider text-xs uppercase shadow-sm hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  submittingClassCancelled ||
                  !cancelSubject.trim() ||
                  !cancelBatchNo.trim() ||
                  !cancelCenterName.trim()
                }
                onClick={handleLogClassCancelled}
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-black tracking-widest text-xs uppercase shadow-lg shadow-red-100 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {submittingClassCancelled ? 'Saving...' : '🚀 Save'}
              </button>
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

// ── Trainee Payslips Modal ──────────────────────────────────────────────────
interface TraineePayslipsModalProps {
  onClose: () => void;
}

const TraineePayslipsModal = ({ onClose }: TraineePayslipsModalProps) => {
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
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/salary-slips/my-slip?month=${selectedMonth}`, {
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

    const formattedMonth = new Date(selectedMonth + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to download/print the payslip.");
      return;
    }

    const grossEarnings = data.salaryData.grossEarnings;
    const grossDeductions = data.salaryData.totalDeductions;
    const netTakeHome = data.salaryData.netTakeHome;

    printWindow.document.write(`
      <html>
        <head>
          <title>Payslip_${data.user.fullName}_${selectedMonth}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 40px;
              font-size: 13px;
              line-height: 1.5;
              background-color: #ffffff;
            }
            .payslip-container {
              max-width: 800px;
              margin: 0 auto;
              border: 1px solid #e2e8f0;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
              position: relative;
            }
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-30deg);
              font-size: 80px;
              font-weight: 800;
              color: rgba(226, 232, 240, 0.3);
              white-space: nowrap;
              user-select: none;
              pointer-events: none;
              letter-spacing: 5px;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            }
            .logo-text {
              font-size: 24px;
              font-weight: 800;
              color: #f59e0b;
              letter-spacing: -0.5px;
              margin: 0;
            }
            .logo-sub {
              font-size: 10px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-top: 2px;
            }
            .title-section {
              text-align: right;
            }
            .payslip-title {
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
              margin: 0;
            }
            .payslip-period {
              font-size: 12px;
              color: #64748b;
              margin-top: 4px;
              font-weight: 500;
            }
            .emp-info-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
            }
            .emp-info-table td {
              padding: 10px 15px;
              border-bottom: 1px solid #f1f5f9;
            }
            .emp-info-table tr:last-child td {
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #64748b;
              font-size: 11px;
              text-transform: uppercase;
              width: 25%;
            }
            .info-value {
              font-weight: 500;
              color: #0f172a;
              width: 25%;
            }
            .main-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              border: 1px solid #cbd5e1;
            }
            .main-table th {
              background-color: #0f172a;
              color: #ffffff;
              font-weight: 600;
              text-transform: uppercase;
              font-size: 11px;
              letter-spacing: 0.5px;
              padding: 10px 15px;
              text-align: left;
            }
            .main-table td {
              padding: 12px 15px;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: top;
            }
            .main-table tr:last-child td {
              border-bottom: none;
            }
            .col-50 {
              width: 50%;
            }
            .border-right {
              border-right: 1px solid #cbd5e1;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .item-name {
              color: #475569;
            }
            .item-value {
              font-weight: 600;
              color: #0f172a;
            }
            .item-value.deduction {
              color: #dc2626;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-weight: 700;
              border-top: 1px dashed #cbd5e1;
              padding-top: 10px;
              margin-top: 10px;
            }
            .net-box {
              background-color: #ecfdf5;
              border: 1px solid #a7f3d0;
              padding: 15px;
              border-radius: 6px;
              margin-bottom: 35px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .net-label {
              font-size: 14px;
              font-weight: 700;
              color: #065f46;
            }
            .net-amount {
              font-size: 20px;
              font-weight: 800;
              color: #047857;
            }
            .words-row {
              font-size: 11px;
              color: #64748b;
              font-style: italic;
              margin-top: -25px;
              margin-bottom: 35px;
              padding-left: 5px;
            }
            .footer-section {
              margin-top: 50px;
              width: 100%;
              border-collapse: collapse;
            }
            .footer-section td {
              text-align: center;
              width: 50%;
            }
            .signature-line {
              width: 200px;
              border-bottom: 1px solid #94a3b8;
              margin: 0 auto 10px auto;
            }
            .signature-title {
              font-size: 11px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
            }
            .print-btn-container {
              text-align: center;
              margin-bottom: 20px;
            }
            .btn-print {
              background-color: #0f172a;
              color: white;
              border: none;
              padding: 10px 20px;
              font-size: 14px;
              font-weight: 600;
              border-radius: 6px;
              cursor: pointer;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              transition: background-color 0.2s;
            }
            .btn-print:hover {
              background-color: #1e293b;
            }
            @media print {
              .print-btn-container {
                display: none;
              }
              body {
                padding: 0;
              }
              .payslip-container {
                border: none;
                box-shadow: none;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-btn-container">
            <button class="btn-print" onclick="window.print()">Print Payslip / Save PDF</button>
          </div>
          <div class="payslip-container">
            <div class="watermark">NICT</div>
            
            <table class="header-table">
              <tr>
                <td>
                  <h1 class="logo-text">NICT</h1>
                  <div class="logo-sub">Institute Payroll System</div>
                </td>
                <td class="title-section">
                  <h2 class="payslip-title">Salary Slip</h2>
                  <div class="payslip-period">For the month of ${formattedMonth}</div>
                </td>
              </tr>
            </table>

            <table class="emp-info-table">
              <tr>
                <td class="info-label">Employee Name</td>
                <td class="info-value">${data.user.fullName}</td>
                <td class="info-label">Employee ID</td>
                <td class="info-value">${data.user.identifier}</td>
              </tr>
              <tr>
                <td class="info-label">Designation</td>
                <td class="info-value">${data.user.role}</td>
                <td class="info-label">Email</td>
                <td class="info-value">${data.user.email}</td>
              </tr>
              <tr>
                <td class="info-label">Bank Name</td>
                <td class="info-value">${data.user.bankName || 'N/A'}</td>
                <td class="info-label">Account Number</td>
                <td class="info-value">${data.user.bankAccountNo || 'N/A'}</td>
              </tr>
              <tr>
                <td class="info-label">IFSC Code</td>
                <td class="info-value">${data.user.bankIfscCode || 'N/A'}</td>
                <td class="info-label">Branch</td>
                <td class="info-value">${data.user.bankBranchName || 'N/A'}</td>
              </tr>
            </table>

            <table class="main-table">
              <thead>
                <tr>
                  <th class="col-50 border-right">Earnings Breakup</th>
                  <th class="col-50">Deductions Breakup</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="col-50 border-right">
                    <div class="item-row">
                      <span class="item-name">Basic Salary</span>
                      <span class="item-value">\u20b9${data.salaryData.basicSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ${(data.salaryData.collegeVisitEarnings || 0) > 0 ? `
                    <div class="item-row">
                      <span class="item-name">College Visits (${(data.salaryData.collegeVisitHours || 0).toFixed(2)}h × ₹${data.salaryData.collegeVisitRate || 0}/h)</span>
                      <span class="item-value">\u20b9${(data.salaryData.collegeVisitEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    ${(data.salaryData.extraClassEarnings || 0) > 0 ? `
                    <div class="item-row">
                      <span class="item-name">Extra Classes (${(data.salaryData.extraClassesHours || 0).toFixed(2)}h × ₹${data.salaryData.extraClassRate || 0}/h)</span>
                      <span class="item-value">\u20b9${(data.salaryData.extraClassEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    ${(data.salaryData.otherCenterClassEarnings || 0) > 0 ? `
                    <div class="item-row">
                      <span class="item-name">Other Center Classes (${(data.salaryData.otherCenterClassesHours || 0).toFixed(2)}h × ₹${data.salaryData.otherCenterClassRate || 0}/h)</span>
                      <span class="item-value">\u20b9${(data.salaryData.otherCenterClassEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    ${data.salaryData.additions > 0 ? `
                    <div class="item-row">
                      <span class="item-name">Arrears/Additions</span>
                      <span class="item-value">\u20b9${data.salaryData.additions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                  </td>
                  <td class="col-50">
                    ${data.salaryData.lateDeduction > 0 ? `
                    <div class="item-row">
                      <span class="item-name">Late Arrival Penalty (${data.salaryData.lateInstances} times, ${data.salaryData.totalLateMinutes} mins)</span>
                      <span class="item-value deduction">\u20b9${data.salaryData.lateDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    ${data.salaryData.earlyDeduction > 0 ? `
                    <div class="item-row">
                      <span class="item-name">Early Departure Penalty (${data.salaryData.earlyInstances} times, ${data.salaryData.totalEarlyMinutes} mins)</span>
                      <span class="item-value deduction">\u20b9${data.salaryData.earlyDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    ${data.salaryData.absentDeduction > 0 ? `
                    <div class="item-row">
                      <span class="item-name">Absence Deduction (${data.salaryData.absentDays} days)</span>
                      <span class="item-value deduction">\u20b9${data.salaryData.absentDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    ${data.salaryData.otherDeductions > 0 ? `
                    <div class="item-row">
                      <span class="item-name">Other Deductions</span>
                      <span class="item-value deduction">\u20b9${data.salaryData.otherDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    ${data.salaryData.tdsDeduction > 0 ? `
                    <div class="item-row">
                      <span class="item-name">TDS Deduction (${data.salaryData.tdsPercentage}%)</span>
                      <span class="item-value deduction">\u20b9${data.salaryData.tdsDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    ${data.salaryData.totalDeductions === 0 ? `
                    <div class="item-row">
                      <span class="item-name" style="color: #94a3b8; font-style: italic;">No deductions this month</span>
                      <span class="item-value">\u20b90.00</span>
                    </div>
                    ` : ''}
                  </td>
                </tr>
                <tr>
                  <td class="col-50 border-right">
                    <div class="total-row">
                      <span>Gross Earnings</span>
                      <span>\u20b9${grossEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </td>
                  <td class="col-50">
                    <div class="total-row">
                      <span>Total Deductions</span>
                      <span style="color: #dc2626;">\u20b9${grossDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="net-box">
              <span class="net-label">Net Payable Salary</span>
              <span class="net-amount">\u20b9${netTakeHome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div class="words-row">
              <strong>Amount in Words:</strong> ${inWords(netTakeHome)}
            </div>

            <table class="footer-section">
              <tr>
                <td>
                  <div class="signature-line"></div>
                  <div class="signature-title">Authorized Signatory</div>
                </td>
                <td>
                  <div class="signature-line"></div>
                  <div class="signature-title">Employee Signature</div>
                </td>
              </tr>
            </table>
          </div>
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-700 p-4">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            💵 My Payslips
          </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Month Picker / Toolbar */}
        <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400 font-medium">Select Month:</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          {data && (
            <button
              onClick={handlePrintMyPayslip}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <FileDown size={16} />
              <span>Download PDF</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-700/50 text-red-200 p-4 rounded-lg text-center font-medium">
              ⚠️ {error}
            </div>
          ) : data ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 max-w-3xl mx-auto shadow-lg space-y-6">
              {/* Slip header */}
              <div className="border-b border-slate-800 pb-4 text-center">
                <h3 className="text-xl font-bold text-emerald-400">NICT</h3>
                <p className="text-sm text-slate-400 mt-1 uppercase tracking-wider font-semibold">Salary Slip</p>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300 border-b border-slate-800 pb-6">
                <div><span className="text-slate-500 font-medium">Name:</span> <strong className="text-slate-100">{data.user.fullName}</strong></div>
                <div><span className="text-slate-500 font-medium">Employee ID:</span> <strong className="text-slate-100">{data.user.identifier}</strong></div>
                <div><span className="text-slate-500 font-medium">Role:</span> <strong className="text-slate-100">{data.user.role}</strong></div>
                <div><span className="text-slate-500 font-medium">Email:</span> <strong className="text-slate-100">{data.user.email}</strong></div>
                <div><span className="text-slate-500 font-medium">Bank Name:</span> <strong className="text-slate-100">{data.user.bankName || 'N/A'}</strong></div>
                <div><span className="text-slate-500 font-medium">Account Number:</span> <strong className="text-slate-100">{data.user.bankAccountNo || 'N/A'}</strong></div>
                <div><span className="text-slate-500 font-medium">IFSC Code:</span> <strong className="text-slate-100">{data.user.bankIfscCode || 'N/A'}</strong></div>
                <div><span className="text-slate-500 font-medium">Branch:</span> <strong className="text-slate-100">{data.user.bankBranchName || 'N/A'}</strong></div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Earnings */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Earnings</h4>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        <tr>
                          <td className="p-3">Basic Salary</td>
                          <td className="p-3 text-right">₹{data.salaryData.professionalFee.toFixed(2)}</td>
                        </tr>
                        {(data.salaryData.collegeVisitEarnings || 0) > 0 && (
                          <tr>
                            <td className="p-3">
                              College Visits
                              <span className="text-slate-500 block text-[10px]">
                                {(data.salaryData.collegeVisitHours || 0).toFixed(2)}h × ₹{data.salaryData.collegeVisitRate || 0}/h
                              </span>
                            </td>
                            <td className="p-3 text-right">₹{(data.salaryData.collegeVisitEarnings || 0).toFixed(2)}</td>
                          </tr>
                        )}
                        {(data.salaryData.extraClassEarnings || 0) > 0 && (
                          <tr>
                            <td className="p-3">
                              Extra Classes
                              <span className="text-slate-500 block text-[10px]">
                                {(data.salaryData.extraClassesHours || 0).toFixed(2)}h × ₹{data.salaryData.extraClassRate || 0}/h
                              </span>
                            </td>
                            <td className="p-3 text-right">₹{(data.salaryData.extraClassEarnings || 0).toFixed(2)}</td>
                          </tr>
                        )}
                        {(data.salaryData.otherCenterClassEarnings || 0) > 0 && (
                          <tr>
                            <td className="p-3">
                              Other Center Classes
                              <span className="text-slate-500 block text-[10px]">
                                {(data.salaryData.otherCenterClassesHours || 0).toFixed(2)}h × ₹{data.salaryData.otherCenterClassRate || 0}/h
                              </span>
                            </td>
                            <td className="p-3 text-right">₹{(data.salaryData.otherCenterClassEarnings || 0).toFixed(2)}</td>
                          </tr>
                        )}
                        {data.salaryData.otherAdditions > 0 && (
                          <tr>
                            <td className="p-3">Arrears/Additions</td>
                            <td className="p-3 text-right">₹{data.salaryData.otherAdditions.toFixed(2)}</td>
                          </tr>
                        )}
                        <tr className="bg-slate-900/50 font-bold text-emerald-400">
                          <td className="p-3">Total Earnings (A)</td>
                          <td className="p-3 text-right">₹{data.salaryData.grossEarnings.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Deductions */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Deductions</h4>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        <tr>
                          <td className="p-3">Late Arrival ({data.salaryData.lateInstances} inst., {data.salaryData.totalLateMinutes} mins)</td>
                          <td className="p-3 text-right">₹{data.salaryData.lateDeduction.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="p-3">Early Departure ({data.salaryData.earlyInstances} inst., {data.salaryData.totalEarlyMinutes} mins)</td>
                          <td className="p-3 text-right">₹{data.salaryData.earlyDeduction.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="p-3">Absent ({data.salaryData.absentDays} days)</td>
                          <td className="p-3 text-right">₹{data.salaryData.absentDeduction.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="p-3">Other Deductions</td>
                          <td className="p-3 text-right">₹{data.salaryData.otherDeductions.toFixed(2)}</td>
                        </tr>
                        {data.salaryData.tdsDeduction > 0 && (
                          <tr>
                            <td className="p-3">TDS Deduction ({data.salaryData.tdsPercentage ?? 10}%)</td>
                            <td className="p-3 text-right">₹{data.salaryData.tdsDeduction.toFixed(2)}</td>
                          </tr>
                        )}
                        <tr className="bg-slate-900/50 font-bold text-red-400">
                          <td className="p-3">Total Deductions (B)</td>
                          <td className="p-3 text-right">₹{data.salaryData.totalDeductions.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Net Salary Banner */}
              <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Net Payable Salary</h4>
                  <p className="text-xs text-slate-400 mt-1">Total Earnings (A) minus Total Deductions (B)</p>
                </div>
                <div className="text-xl font-extrabold text-emerald-300">
                  ₹{data.salaryData.netTakeHome.toFixed(2)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              No payslip details available for this month.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TraineeDashboard;
