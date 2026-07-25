import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { X, RefreshCw, Download, Printer, Copy, Check, QrCode, Users, Calendar, Phone, GraduationCap, Sparkles, Building2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface QRCodeGeneratorModalProps {
  onClose: () => void;
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

  const printRef = useRef<HTMLDivElement>(null);

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
              <li>Tap the link pop-up to enter your <strong>Name, Phone Number & Educational Qualification</strong>.</li>
              <li>Download your submission details as a PDF!</li>
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

  const filteredInquiries = inquiries.filter((inq) => {
    const q = inquiriesSearch.toLowerCase();
    return (
      inq.name?.toLowerCase().includes(q) ||
      inq.mobile?.toLowerCase().includes(q) ||
      inq.educationQualification?.toLowerCase().includes(q) ||
      inq.nictPreference?.toLowerCase().includes(q) ||
      inq.id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-fadeIn text-slate-100">
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
                    size={220}
                    level="H"
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
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <input
                  type="text"
                  placeholder="Search by candidate name, phone, education, or preference..."
                  value={inquiriesSearch}
                  onChange={(e) => setInquiriesSearch(e.target.value)}
                  className="w-full sm:w-80 bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={fetchInquiries}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2 px-3 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} className={inquiriesLoading ? 'animate-spin' : ''} /> Refresh List
                </button>
              </div>

              {filteredInquiries.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                  <Users size={36} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-400 text-sm font-medium">No inquiries scanned yet</p>
                  <p className="text-slate-500 text-xs mt-1">Candidates scanning the static QR code will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-3">Ref ID</th>
                        <th className="p-3">Candidate Name</th>
                        <th className="p-3">Mobile Number</th>
                        <th className="p-3">Education Qualification</th>
                        <th className="p-3">NICT Preference</th>
                        <th className="p-3">Date & Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {filteredInquiries.map((inq, idx) => (
                        <tr key={inq.id || idx} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-400">{inq.id}</td>
                          <td className="p-3 font-semibold text-white">{inq.name}</td>
                          <td className="p-3 font-mono">{inq.mobile}</td>
                          <td className="p-3 text-slate-300">{inq.educationQualification}</td>
                          <td className="p-3 text-blue-300 font-medium">{inq.nictPreference || 'NICT Jayanagar Center'}</td>
                          <td className="p-3 text-slate-400">
                            {new Date(inq.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </td>
                        </tr>
                      ))}
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
