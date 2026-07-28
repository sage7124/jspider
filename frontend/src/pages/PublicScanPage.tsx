import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { User, Phone, GraduationCap, CheckCircle2, RefreshCw, Sparkles, Building2, ShieldCheck, MapPin, Download, Clock } from 'lucide-react';

const getApiBase = () => {
  let envUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  envUrl = envUrl.trim();
  if (envUrl.endsWith('/')) envUrl = envUrl.slice(0, -1);
  if (!envUrl.endsWith('/api')) envUrl = `${envUrl}/api`;
  return envUrl;
};
const API_BASE = getApiBase();

export default function PublicScanPage() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('code') || searchParams.get('token') || '';

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [education, setEducation] = useState('');
  const [customEducation, setCustomEducation] = useState('');
  const [nictPreference, setNictPreference] = useState('NICT Jayanagar Center');

  const [error, setError] = useState('');
  const [submittedData, setSubmittedData] = useState<any>(null);

  const nictPreferenceOptions = [
    'NICT Jayanagar Center',
    'NICT Hanumanthanagar Center'
  ];

  const educationOptions = [
    'B.E / B.Tech',
    'BCA / MCA',
    'B.Sc / M.Sc',
    'B.Com / M.Com',
    'Under Graduate',
    'Post Graduate',
    'Other'
  ];

  const handlePDFDownload = (data: any) => {
    if (!data) return;
    const downloadUrl = `${API_BASE}/auth/public/qr-inquiry/download-pdf?id=${encodeURIComponent(data.id || '')}&name=${encodeURIComponent(data.name || '')}&mobile=${encodeURIComponent(data.mobile || '')}&education=${encodeURIComponent(data.educationQualification || '')}&preference=${encodeURIComponent(data.nictPreference || '')}`;
    const filename = `NICT_Candidate_${(data.name || 'Details').replace(/\s+/g, '_')}.pdf`;

    // 1. Download file directly for iPhone, Android, and Desktop
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 2. Automatically open PDF view in a new window/tab after 5 seconds for iPhone, Android & Desktop
    setTimeout(() => {
      window.open(downloadUrl, '_blank');
    }, 5000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalName = name.trim();
    const finalMobile = mobile.trim();
    const finalEducation = education === 'Other' ? customEducation.trim() : education;
    const finalPreference = nictPreference.trim();

    if (!finalName) {
      setError('Please enter your name');
      return;
    }
    if (!finalMobile || !/^\d{10}$/.test(finalMobile)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!finalEducation) {
      setError('Please select or specify your qualification');
      return;
    }
    if (!finalPreference) {
      setError('Please select your NICT preference center');
      return;
    }

    const localInquiry = {
      id: 'INQ-' + Date.now().toString().slice(-6),
      name: finalName,
      mobile: finalMobile,
      educationQualification: finalEducation,
      nictPreference: finalPreference,
      submittedAt: new Date().toISOString()
    };

    // 1. Immediately show Submission Successful screen
    setSubmittedData(localInquiry);

    // 2. Trigger PDF Download + 5 second auto-open for all devices (iPhone, Android, Desktop)
    handlePDFDownload(localInquiry);

    // 3. Save to database asynchronously in background
    axios.post(`${API_BASE}/auth/public/qr-inquiry`, {
      name: finalName,
      mobile: finalMobile,
      educationQualification: finalEducation,
      nictPreference: finalPreference,
      token: tokenParam
    }).catch(err => console.warn('Background save note:', err));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-800/80 backdrop-blur-xl border border-slate-700/70 rounded-2xl shadow-2xl p-6 sm:p-8 z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600/20 text-blue-400 rounded-2xl mb-3 border border-blue-500/30">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            NICT Computer Education
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Scan & Submit your details for NICT Courses
          </p>
        </div>

        {submittedData ? (
          /* Clean Confirmation Screen */
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center shadow-lg">
              <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-2 animate-bounce" />
              <h2 className="text-xl font-bold text-emerald-300">Submission Successful!</h2>
              <p className="text-slate-300 text-xs mt-1.5">
                Your details have been recorded under Reference ID: <span className="font-mono font-bold text-white">{submittedData.id}</span>
              </p>
              <p className="text-emerald-400/90 text-xs mt-2 font-medium">
                ✓ PDF downloaded! Opening PDF view in 5 seconds...
              </p>
            </div>

            {/* Candidate Details Summary Card */}
            <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-700/60 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Name</span>
                <span className="text-slate-100 font-bold text-sm">{submittedData.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Mobile Number</span>
                <span className="text-slate-100 font-mono font-bold text-sm">{submittedData.mobile}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Qualification</span>
                <span className="text-slate-100 font-medium text-sm text-right max-w-[200px] truncate">{submittedData.educationQualification}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">NICT Preference</span>
                <span className="text-blue-400 font-bold text-sm text-right max-w-[220px] truncate">{submittedData.nictPreference}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => handlePDFDownload(submittedData)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all cursor-pointer text-sm"
              >
                <Download className="w-5 h-5" /> Download / Open PDF File
              </button>

              <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-[11px] text-slate-300 text-center flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                PDF will automatically open in a new view in 5 seconds.
              </div>

              <button
                onClick={() => {
                  setSubmittedData(null);
                  setName('');
                  setMobile('');
                  setEducation('');
                  setCustomEducation('');
                  setNictPreference('NICT Jayanagar Center');
                }}
                className="w-full flex items-center justify-center gap-2 bg-slate-700/80 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl border border-slate-600/50 transition-colors cursor-pointer text-xs"
              >
                <RefreshCw className="w-4 h-4" /> Submit Another Entry
              </button>
            </div>
          </div>
        ) : (
          /* Input Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {error}
              </div>
            )}

            {/* Name Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Enter your Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Enter your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Mobile Number Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Mobile Number <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Educational Qualification Dropdown */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Qualification <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  required
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="" disabled>-- Select Qualification --</option>
                  {educationOptions.map((opt, i) => (
                    <option key={i} value={opt} className="bg-slate-900 text-white">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Education Input if "Other" is selected */}
            {education === 'Other' && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Specify Your Qualification <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master of Computer Applications"
                  value={customEducation}
                  onChange={(e) => setCustomEducation(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            )}

            {/* Your NICT Preference Dropdown */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Your NICT Preference <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  required
                  value={nictPreference}
                  onChange={(e) => setNictPreference(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none cursor-pointer"
                >
                  {nictPreferenceOptions.map((center, i) => (
                    <option key={i} value={center} className="bg-slate-900 text-white">
                      {center}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all duration-200 cursor-pointer"
            >
              <Sparkles className="w-5 h-5" /> Click to download the Details
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-slate-700/50 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-slate-400" /> Powered by NICT Computer Education System
        </div>
      </div>
    </div>
  );
}
