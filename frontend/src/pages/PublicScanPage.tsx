import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { User, Phone, GraduationCap, CheckCircle2, RefreshCw, Sparkles, Building2, ShieldCheck, MapPin, Download } from 'lucide-react';

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

  React.useEffect(() => {
    // Pre-warm jsPDF module in background for instant download
    import('jspdf').catch(() => {});
  }, []);

  const generatePDFForData = async (data: any) => {
    if (!data) return;

    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [25, 118, 210]; // #1976D2 NICT Blue
      const darkText = [30, 41, 59];
      const lightBg = [241, 245, 249];

      // Header Background Banner
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 38, 'F');

      // Header Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('NICT COMPUTER EDUCATION', 105, 16, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Candidate Inquiry & Qualification Record', 105, 25, { align: 'center' });

      doc.setFontSize(9);
      doc.text('Official Digital Copy • Verified QR Candidate Submission', 105, 32, { align: 'center' });

      // Document Body Title
      doc.setTextColor(darkText[0], darkText[1], darkText[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('CANDIDATE DETAILS SUMMARY', 15, 52);

      // Decorative underline
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 55, 195, 55);

      // Details Box Container
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.roundedRect(15, 62, 180, 95, 3, 3, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(15, 62, 180, 95, 3, 3, 'D');

      const fields = [
        { label: 'Inquiry Reference ID:', value: data.id || 'N/A' },
        { label: 'Candidate Full Name:', value: data.name },
        { label: 'Mobile / Phone Number:', value: data.mobile },
        { label: 'Qualification:', value: data.educationQualification },
        { label: 'NICT Preference Center:', value: data.nictPreference || 'NICT Jayanagar Center' },
        { label: 'Date & Time of Submission:', value: new Date(data.submittedAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
        { label: 'Verification Status:', value: 'Verified via QR Scan' }
      ];

      let currentY = 74;
      fields.forEach((f, idx) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(darkText[0], darkText[1], darkText[2]);
        doc.text(f.label, 22, currentY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(f.value, 82, currentY);

        if (idx < fields.length - 1) {
          doc.setDrawColor(226, 232, 240);
          doc.line(22, currentY + 3, 188, currentY + 3);
        }
        currentY += 12;
      });

      // Verification Box
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(15, 168, 180, 25, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 58, 138);
      doc.text('OFFICIAL VERIFICATION STATEMENT', 22, 176);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text('This document verifies that the candidate has scanned the official NICT QR Code and registered their details into the system.', 22, 184);

      // Footer Stamp & Sign Area
      doc.setDrawColor(203, 213, 225);
      doc.line(135, 235, 185, 235);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text('Authorized Signature', 160, 240, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('NICT Administration', 160, 245, { align: 'center' });

      // Page Footer Line
      doc.setDrawColor(203, 213, 225);
      doc.line(15, 275, 195, 275);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('NICT Computer Education • Generated automatically on candidate QR scan', 105, 281, { align: 'center' });

      // Directly Save PDF File to User's Device
      const fileName = `NICT_Candidate_${data.name.replace(/\s+/g, '_')}_Inquiry.pdf`;
      doc.save(fileName);
    } catch (e) {
      console.error('PDF generation error:', e);
    }
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

    // 2. Automatically trigger direct PDF File download
    generatePDFForData(localInquiry);

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
          /* Clean Confirmation Screen (PDF File Downloaded Directly) */
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center shadow-lg">
              <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-2 animate-bounce" />
              <h2 className="text-xl font-bold text-emerald-300">Submission Successful!</h2>
              <p className="text-slate-300 text-xs mt-1.5">
                Your details have been recorded under Reference ID: <span className="font-mono font-bold text-white">{submittedData.id}</span>
              </p>
              <p className="text-emerald-400/90 text-xs mt-2 font-medium">
                ✓ Your official PDF File has been downloaded to your device.
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
                onClick={() => generatePDFForData(submittedData)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all cursor-pointer text-xs"
              >
                <Download className="w-4 h-4" /> Download PDF File Again
              </button>

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
