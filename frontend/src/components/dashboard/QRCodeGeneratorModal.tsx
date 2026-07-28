import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { X, RefreshCw, Download, Printer, Copy, Check, QrCode, Users, Calendar, Phone, GraduationCap, Sparkles, Edit, Trash2, Search, ArrowUpDown, MapPin, User, Save, FileSpreadsheet, Filter } from 'lucide-react';

const getApiBase = () => {
  let envUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  envUrl = envUrl.trim();
  if (envUrl.endsWith('/')) envUrl = envUrl.slice(0, -1);
  if (!envUrl.endsWith('/api')) envUrl = `${envUrl}/api`;
  return envUrl;
};
const API_BASE = getApiBase();

interface QRCodeGeneratorModalProps {
  onClose: () => void;
}

interface EditInquiryModalProps {
  inquiry: any;
  onClose: () => void;
  onSave: () => void;
}

function EditInquiryModal({ inquiry, onClose, onSave }: EditInquiryModalProps) {
  const [name, setName] = useState(inquiry.name || '');
  const [mobile, setMobile] = useState(inquiry.mobile || '');
  const [qualification, setQualification] = useState(inquiry.educationQualification || '');
  const [nictPreference, setNictPreference] = useState(inquiry.nictPreference || 'NICT Jayanagar Center');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nictPreferenceOptions = [
    'NICT Jayanagar Center',
    'NICT Hanumanthanagar Center'
  ];

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || !qualification.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const authToken = localStorage.getItem('token');
      await axios.put(`${API_BASE}/admin/qr-inquiries/${inquiry.id}`, {
        name: name.trim(),
        mobile: mobile.trim(),
        educationQualification: qualification.trim(),
        nictPreference: nictPreference.trim()
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update inquiry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl p-6 text-slate-100 animate-fadeIn">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Edit size={18} className="text-blue-400" />
            <h3 className="text-base font-bold text-white">Edit Inquiry ({inquiry.id})</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Candidate Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-9 pr-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                required
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-9 pr-3 text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Qualification / Course</label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-9 pr-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">NICT Preference Center</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={nictPreference}
                onChange={(e) => setNictPreference(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-9 pr-3 text-white focus:outline-none focus:border-blue-500 appearance-none"
              >
                {nictPreferenceOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save size={14} /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function QRCodeGeneratorModal({ onClose }: QRCodeGeneratorModalProps) {
  const [activeTab, setActiveTab] = useState<'qr' | 'inquiries'>('qr');
  const [token, setToken] = useState<string>('NICT_STATIC_QR_1001');
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const [inquiries, setInquiries] = useState<any[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState<boolean>(false);
  const [inquiriesSearch, setInquiriesSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  const [editingInquiry, setEditingInquiry] = useState<any | null>(null);

  // Target URL encoded in the QR code
  const targetUrl = `${window.location.origin}/scan-qr?code=${encodeURIComponent(token)}`;

  const fetchToken = async () => {
    setLoading(true);
    try {
      const authToken = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/admin/static-qr`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.data && res.data.token) {
        setToken(res.data.token);
        setUpdatedAt(res.data.updatedAt || '');
      }
    } catch (err) {
      console.warn('Failed to fetch admin static QR, using default:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInquiries = async () => {
    setInquiriesLoading(true);
    try {
      const authToken = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/admin/qr-inquiries`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (Array.isArray(res.data)) {
        setInquiries(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch inquiries:', err);
    } finally {
      setInquiriesLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
    fetchInquiries();
  }, []);

  const handleRegenerate = async () => {
    const confirmRegen = window.confirm(
      'Are you sure you want to REGENERATE the static QR Code?\n\nThe previous static QR Code will no longer match the new token.'
    );
    if (!confirmRegen) return;

    setRegenerating(true);
    try {
      const authToken = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE}/admin/static-qr/regenerate`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.data && res.data.qrData) {
        setToken(res.data.qrData.token);
        setUpdatedAt(res.data.qrData.updatedAt || '');
      }
    } catch (err) {
      alert('Failed to regenerate QR code');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const svgElement = document.getElementById('static-qr-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 100, 100, 800, 800);
      }
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `NICT_Static_QR_${token}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrintQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>NICT Static QR Code Print</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 40px;
              color: #1e293b;
              margin: 0;
            }
            .header-banner {
              background: #1976D2;
              color: #ffffff;
              padding: 24px;
              border-radius: 12px;
              margin-bottom: 30px;
            }
            .header-banner h1 {
              margin: 0 0 8px 0;
              font-size: 28px;
            }
            .header-banner p {
              margin: 0;
              font-size: 16px;
              opacity: 0.9;
            }
            .qr-card {
              border: 3px solid #1976D2;
              border-radius: 16px;
              padding: 30px;
              display: inline-block;
              background: #ffffff;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
              margin-bottom: 30px;
            }
            .qr-title {
              font-size: 22px;
              font-weight: bold;
              color: #0f172a;
              margin-bottom: 20px;
            }
            .instructions {
              font-size: 16px;
              line-height: 1.6;
              color: #334155;
              max-width: 500px;
              margin: 0 auto 30px auto;
            }
            .instructions ol {
              text-align: left;
              display: inline-block;
            }
            .footer-text {
              font-size: 12px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
            }
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <h1>NICT COMPUTER EDUCATION</h1>
            <p>Official Candidate Inquiry & Educational Verification</p>
          </div>

          <div class="qr-card">
            <div class="qr-title">SCAN TO SUBMIT DETAILS</div>
            <div id="print-qr-target"></div>
            <div style="margin-top: 15px; font-size: 12px; font-weight: bold; color: #64748b;">
              Static Token: ${token}
            </div>
          </div>

          <div class="instructions">
            <strong>How to scan:</strong>
            <ol>
              <li>Open your smartphone camera or QR scanner app.</li>
              <li>Point camera at the QR code above.</li>
              <li>Tap the link pop-up to enter your details.</li>
            </ol>
          </div>

          <div class="footer-text">
            NICT Computer Education • Printed on ${new Date().toLocaleDateString('en-IN')}
          </div>

          <script>
            window.onload = function() {
              const svgData = \`${document.getElementById('static-qr-svg')?.outerHTML || ''}\`;
              document.getElementById('print-qr-target').innerHTML = svgData;
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handleDeleteInquiry = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete inquiry for "${name}" (${id})?`)) {
      return;
    }
    try {
      const authToken = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/admin/qr-inquiries/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      fetchInquiries();
    } catch (err) {
      alert('Failed to delete inquiry');
    }
  };

  // Unique months extracted from inquiries list
  const availableMonths = Array.from(
    new Set(
      inquiries.map((inq) =>
        new Date(inq.submittedAt).toLocaleString('en-US', { month: 'long', year: 'numeric' })
      )
    )
  );

  // Export to Excel handler
  const handleExportExcel = async (filterMonth: string = selectedMonth) => {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Scanned QR Inquiries');

      // Filter records by month if specific month selected
      let exportData = [...inquiries];
      if (filterMonth !== 'ALL') {
        exportData = exportData.filter((inq) => {
          const m = new Date(inq.submittedAt).toLocaleString('en-US', { month: 'long', year: 'numeric' });
          return m === filterMonth;
        });
      }

      if (exportData.length === 0) {
        alert(`No inquiry records found for ${filterMonth === 'ALL' ? 'the entire period' : filterMonth}.`);
        return;
      }

      // Title Banner
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'NICT COMPUTER EDUCATION - SCANNED QR INQUIRIES REPORT';
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;

      // Report Info Subtitle
      worksheet.mergeCells('A2:H2');
      const infoCell = worksheet.getCell('A2');
      const reportMonthLabel = filterMonth === 'ALL' ? 'All Months (Complete Export)' : filterMonth;
      infoCell.value = `Report Period: ${reportMonthLabel}  |  Total Records: ${exportData.length}  |  Generated On: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
      infoCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF334155' } };
      infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 25;

      worksheet.addRow([]); // Empty Row 3

      // Headers Row 4
      const headers = [
        'Ref ID',
        'Name',
        'Mobile Number',
        'Qualification / Course',
        'NICT Preference Center',
        'Submission Month',
        'Date & Time of Submission',
        'Verification Status'
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 28;

      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Dark Slate
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      // Data Rows
      exportData.forEach((inq, idx) => {
        const subDate = new Date(inq.submittedAt);
        const monthYearStr = subDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const fullDateTimeStr = subDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        const row = worksheet.addRow([
          inq.id || 'N/A',
          inq.name || 'N/A',
          inq.mobile || 'N/A',
          inq.educationQualification || 'N/A',
          inq.nictPreference || 'NICT Jayanagar Center',
          monthYearStr,
          fullDateTimeStr,
          'Verified via QR Scan'
        ]);

        row.height = 22;

        const isEven = idx % 2 === 0;
        const bgHex = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        row.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      // Auto Column Widths
      worksheet.columns.forEach((column) => {
        let maxLen = 15;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const val = cell.value ? cell.value.toString() : '';
          if (val.length > maxLen) maxLen = val.length;
        });
        column.width = Math.min(Math.max(maxLen + 4, 15), 45);
      });

      // Save Excel File
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cleanMonthName = filterMonth === 'ALL' ? 'All_Months' : filterMonth.replace(/\s+/g, '_');
      link.href = url;
      link.download = `NICT_Scanned_Inquiries_Report_${cleanMonthName}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel Export Error:', err);
      alert('Failed to generate Excel report');
    }
  };

  const filteredInquiries = inquiries
    .filter((inq) => {
      // Month Filter
      if (selectedMonth !== 'ALL') {
        const m = new Date(inq.submittedAt).toLocaleString('en-US', { month: 'long', year: 'numeric' });
        if (m !== selectedMonth) return false;
      }
      // Search Filter
      const q = inquiriesSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        inq.name?.toLowerCase().includes(q) ||
        inq.mobile?.toLowerCase().includes(q) ||
        inq.educationQualification?.toLowerCase().includes(q) ||
        inq.nictPreference?.toLowerCase().includes(q) ||
        inq.id?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      }
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      // default newest
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {editingInquiry && (
        <EditInquiryModal
          inquiry={editingInquiry}
          onClose={() => setEditingInquiry(null)}
          onSave={fetchInquiries}
        />
      )}

      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-fadeIn text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl">
              <QrCode size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Static QR Code Generator</h2>
              <p className="text-xs text-slate-400">Admin Static QR Code for Candidate Inquiry & Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'qr'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode size={16} /> QR Code Display
          </button>
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'inquiries'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={16} /> Scanned Inquiries ({inquiries.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'qr' ? (
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start justify-center">
              {/* QR Code Container */}
              <div className="flex flex-col items-center">
                <div className="bg-white p-6 rounded-2xl shadow-xl border-4 border-blue-600/30 flex items-center justify-center">
                  <QRCodeSVG
                    id="static-qr-svg"
                    value={targetUrl}
                    size={260}
                    level="M"
                    includeMargin={true}
                  />
                </div>
                <span className="mt-3 text-xs font-mono font-medium text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
                  Token: {token}
                </span>
                {updatedAt && (
                  <span className="mt-1 text-[11px] text-slate-500">
                    Updated: {new Date(updatedAt).toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              {/* Controls & Instructions */}
              <div className="flex-1 space-y-5 w-full">
                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Public Scan URL (Encoded in QR)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={targetUrl}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs font-mono text-blue-300 focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="flex items-center justify-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold py-3 px-3 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={15} className={regenerating ? 'animate-spin' : ''} />
                    Regenerate
                  </button>

                  <button
                    onClick={handleDownloadQR}
                    className="flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold py-3 px-3 rounded-xl transition-all cursor-pointer"
                  >
                    <Download size={15} />
                    Download PNG
                  </button>

                  <button
                    onClick={handlePrintQR}
                    className="flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold py-3 px-3 rounded-xl transition-all cursor-pointer"
                  >
                    <Printer size={15} />
                    Print QR Code
                  </button>
                </div>

                {/* Info Note */}
                <div className="p-4 bg-blue-950/40 border border-blue-800/40 rounded-xl text-xs text-blue-200 space-y-1">
                  <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                    <Sparkles size={14} /> Static QR Code Guarantee
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    This QR code will remain <strong className="text-white">static and unchanged</strong> across refreshes and logins until you explicitly click <strong>Regenerate</strong>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Inquiries Table Tab */
            <div className="space-y-4">
              {/* Toolbar Row 1: Search, Month Filter, Sort */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                {/* Search Bar */}
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, mobile, course..."
                    value={inquiriesSearch}
                    onChange={(e) => setInquiriesSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Filters & Actions */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
                  {/* Filter Month Dropdown */}
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5">
                    <Filter size={14} className="text-blue-400" />
                    <span className="text-[11px] text-slate-400 font-semibold uppercase">Month:</span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-slate-900">All Months (Complete)</option>
                      {availableMonths.map((m, idx) => (
                        <option key={idx} value={m} className="bg-slate-900">{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sort By Dropdown */}
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5">
                    <ArrowUpDown size={14} className="text-slate-400" />
                    <span className="text-[11px] text-slate-400 font-semibold uppercase">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e: any) => setSortBy(e.target.value)}
                      className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="newest" className="bg-slate-900">Date (Newest First)</option>
                      <option value="oldest" className="bg-slate-900">Date (Oldest First)</option>
                      <option value="name" className="bg-slate-900">Name (A-Z)</option>
                    </select>
                  </div>

                  {/* Refresh List Button */}
                  <button
                    onClick={fetchInquiries}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw size={13} className={inquiriesLoading ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>
              </div>

              {/* Excel Download Banner Row */}
              <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-300">
                  <FileSpreadsheet size={18} className="text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold">Excel Report Download Options</span>
                    <p className="text-slate-400 text-[11px]">
                      Download styled Excel reports showing candidate details, submission months, and verification logs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleExportExcel(selectedMonth)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3.5 rounded-lg shadow-md transition-all cursor-pointer text-xs"
                  >
                    <Download size={14} />
                    Export {selectedMonth === 'ALL' ? 'Selected Month' : selectedMonth} (.xlsx)
                  </button>

                  <button
                    onClick={() => handleExportExcel('ALL')}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3.5 rounded-lg shadow-md transition-all cursor-pointer text-xs"
                  >
                    <FileSpreadsheet size={14} />
                    Download All Records (.xlsx)
                  </button>
                </div>
              </div>

              {/* Table List */}
              {filteredInquiries.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                  <Users size={36} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-400 text-sm font-medium">No inquiries found</p>
                  <p className="text-slate-500 text-xs mt-1">
                    {inquiriesSearch || selectedMonth !== 'ALL'
                      ? 'No candidate matches your search or month filter.'
                      : 'Candidates scanning the static QR code will appear here in real-time.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-3">Ref ID</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Mobile Number</th>
                        <th className="p-3">Qualification / Course</th>
                        <th className="p-3">NICT Preference</th>
                        <th className="p-3">Submission Month</th>
                        <th className="p-3">Date & Time</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {filteredInquiries.map((inq) => {
                        const monthLabel = new Date(inq.submittedAt).toLocaleString('en-US', { month: 'short', year: 'numeric' });
                        return (
                          <tr key={inq.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{inq.id}</td>
                            <td className="p-3 font-semibold text-white">{inq.name}</td>
                            <td className="p-3 font-mono">{inq.mobile}</td>
                            <td className="p-3 text-slate-300 font-medium">{inq.educationQualification}</td>
                            <td className="p-3 text-blue-300 font-medium">{inq.nictPreference || 'NICT Jayanagar Center'}</td>
                            <td className="p-3 text-emerald-400 font-medium">{monthLabel}</td>
                            <td className="p-3 text-slate-400">
                              {new Date(inq.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setEditingInquiry(inq)}
                                  className="p-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Inquiry"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteInquiry(inq.id, inq.name)}
                                  className="p-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Inquiry"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
