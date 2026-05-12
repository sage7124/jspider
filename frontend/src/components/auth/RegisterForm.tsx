import React, { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uzbobbzbbkqzgtjemayu.supabase.co';
const supabaseAnonKey = 'sb_publishable_r0jMviNey66U0tDDtyScEQ_CRmZg-Rr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    <div className="w-full mt-1">
      <div className="flex flex-wrap gap-1 bg-gray-50 min-h-[36px] p-1.5 border rounded border-gray-200">
        {items.length === 0 ? (
          <span className="text-gray-400 text-xs italic self-center px-1">None added yet (type & press Enter)</span>
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
          placeholder={placeholder}
          className="w-full mt-1 px-3 py-1.5 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
        />
      )}
    </div>
  );
};

const RegisterForm: React.FC<{ onBackToLogin?: () => void }> = ({ onBackToLogin }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    department: '',
    photoUrl: '',
    officeTimings: '',
    dateOfJoining: '',
    aadhaarNumber: '',
    aadhaarPhotoUrl: '',
    panNumber: '',
    panPhotoUrl: '',
    bankName: '',
    bankAccountNo: '',
    bankIfscCode: '',
    bankBranchName: '',
    emergencyContactName: '',
    emergencyContactMobile: '',
    fatherName: '',
    motherName: '',
    presentAddress: '',
    permanentAddress: '',
    educationCompleted: '',
    subClassification: ''
  });

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [educations, setEducations] = useState<string[]>([]);
  const [classifications, setClassifications] = useState<string[]>([]);

  React.useEffect(() => {
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
    fetchDropdowns();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setFormData(prev => ({
      ...prev,
      [e.target.name]: val
    }));
  };

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
      const fileName = `register_${fieldName}_${Date.now()}.${fileExt}`;
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

      setFormData(prev => ({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // ONLY Require Step 1 for overall submission (Photo is now optional!)
    if (!formData.fullName || !formData.email || !formData.mobile || !formData.password || !formData.fatherName || !formData.motherName) {
      setError('Please complete Step 1 fully (excluding photo) before submitting.');
      return;
    }

    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/auth/register`, formData);
      setSuccess(true);
      setStep(1);
      setFormData({
        fullName: '', email: '', mobile: '', password: '', department: '',
        photoUrl: '', officeTimings: '', dateOfJoining: '', aadhaarNumber: '', aadhaarPhotoUrl: '',
        panNumber: '', panPhotoUrl: '', bankName: '', bankAccountNo: '', bankIfscCode: '',
        bankBranchName: '', emergencyContactName: '', emergencyContactMobile: '', fatherName: '',
        motherName: '', presentAddress: '', permanentAddress: '', educationCompleted: '', subClassification: ''
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.fullName || !formData.email || !formData.mobile || !formData.password || !formData.fatherName || !formData.motherName) {
        setError('Please fill in all required Step 1 fields (Full Name, Credentials, Parent details).');
        return;
      }
    }
    // Rest of steps are now OPTIONAL as per user instruction! Users can navigate freely.
    setError('');
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 max-w-2xl mx-auto relative">
      
      {/* Back to Login Action Bar */}
      {onBackToLogin && (
        <div className="flex justify-start mb-4 pb-2 border-b border-gray-50">
          <button 
            type="button" 
            onClick={onBackToLogin}
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-blue-600 hover:text-blue-800 transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Login
          </button>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-8 px-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <React.Fragment key={s}>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                step === s ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                step > s ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {step > s ? <Check size={14} /> : s}
              </div>
            </div>
            {s < 5 && <div className={`flex-1 h-0.5 mx-2 ${step > s ? 'bg-green-500' : 'bg-gray-100'}`} />}
          </React.Fragment>
        ))}
      </div>

      {error && <div className="text-red-500 text-xs font-bold mb-4 p-2 bg-red-50 rounded text-center">{error}</div>}
      {success && <div className="text-green-700 text-sm font-bold mb-4 p-3 bg-green-50 rounded text-center">🎉 Registration successful! Please wait for Admin approval.</div>}

      <form onSubmit={handleSubmit} className="space-y-4 text-left">

        {/* STEP 1: Account & Personal */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-1">Step 1: Account Credentials & Personal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Full Name with Initials *</label>
                <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Email ID *</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Mobile Number *</label>
                <input type="tel" name="mobile" value={formData.mobile} onChange={handleNumericChange} required inputMode="numeric" pattern="[0-9]*"
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 mb-1">Create Password *</label>
                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-gray-400">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Father's Name *</label>
                <input type="text" name="fatherName" value={formData.fatherName} onChange={handleChange} required
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Mother's Name *</label>
                <input type="text" name="motherName" value={formData.motherName} onChange={handleChange} required
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Profile Photo (Optional)</label>
                <div className="flex gap-2 items-center">
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'photoUrl')} disabled={uploadingField === 'photoUrl'} className="hidden" id="reg-photo-input" />
                  <label htmlFor="reg-photo-input" className={`flex-1 border-2 border-dashed rounded px-3 py-2 text-xs font-bold text-center cursor-pointer transition-all ${
                    uploadingField === 'photoUrl' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse' :
                    formData.photoUrl ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}>
                    {uploadingField === 'photoUrl' ? '⏳ Uploading...' : formData.photoUrl ? '✅ Photo Uploaded' : '📁 Upload Photo (Optional)'}
                  </label>
                  {formData.photoUrl && (
                    <a href={formData.photoUrl} target="_blank" rel="noreferrer" className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded px-2.5 py-2 text-xs font-bold whitespace-nowrap">
                      👁️ View
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Onboarding details */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-1">Step 2: Onboarding & Address Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Date of Joining (Optional)</label>
                <input type="date" name="dateOfJoining" value={formData.dateOfJoining} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Office Timings with Cycle (Optional)</label>
                <textarea name="officeTimings" value={formData.officeTimings} onChange={handleChange} placeholder="e.g. 9 AM - 5 PM Shift A" rows={2}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Education Completed (Optional)</label>
                <ChipInput 
                  value={formData.educationCompleted} 
                  onChange={(val) => setFormData(prev => ({ ...prev, educationCompleted: val }))} 
                  placeholder="Type degree (e.g. B.Tech) & press Enter" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Subjects / Modules (Optional)</label>
                <ChipInput 
                  value={formData.subClassification} 
                  onChange={(val) => setFormData(prev => ({ ...prev, subClassification: val }))} 
                  placeholder="Type module (e.g. Java) & press Enter" 
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Present Address (Optional)</label>
                <textarea name="presentAddress" value={formData.presentAddress} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Permanent Address (Optional)</label>
                <textarea name="permanentAddress" value={formData.permanentAddress} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Identification Documents */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-1">Step 3: Document Verification</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Aadhaar Number (Optional)</label>
                <input type="text" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleNumericChange} placeholder="e.g. 12-digit number" inputMode="numeric" pattern="[0-9]*"
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Aadhaar Document (Optional)</label>
                <div className="flex gap-2 items-center">
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'aadhaarPhotoUrl')} disabled={uploadingField === 'aadhaarPhotoUrl'} className="hidden" id="reg-aadhaar-input" />
                  <label htmlFor="reg-aadhaar-input" className={`flex-1 border-2 border-dashed rounded px-3 py-2 text-xs font-bold text-center cursor-pointer transition-all ${
                    uploadingField === 'aadhaarPhotoUrl' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse' :
                    formData.aadhaarPhotoUrl ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}>
                    {uploadingField === 'aadhaarPhotoUrl' ? '⏳ Uploading...' : formData.aadhaarPhotoUrl ? '✅ Uploaded' : '📁 Upload Aadhaar'}
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">PAN Number (Optional)</label>
                <input type="text" name="panNumber" value={formData.panNumber} onChange={handleChange} placeholder="e.g. ABCDE1234F"
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">PAN Document (Optional)</label>
                <div className="flex gap-2 items-center">
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'panPhotoUrl')} disabled={uploadingField === 'panPhotoUrl'} className="hidden" id="reg-pan-input" />
                  <label htmlFor="reg-pan-input" className={`flex-1 border-2 border-dashed rounded px-3 py-2 text-xs font-bold text-center cursor-pointer transition-all ${
                    uploadingField === 'panPhotoUrl' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse' :
                    formData.panPhotoUrl ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}>
                    {uploadingField === 'panPhotoUrl' ? '⏳ Uploading...' : formData.panPhotoUrl ? '✅ Uploaded' : '📁 Upload PAN'}
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Bank Details */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-1">Step 4: Bank Account Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Bank Name (Optional)</label>
                <input type="text" name="bankName" value={formData.bankName} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Bank Account Number (Optional)</label>
                <input type="text" name="bankAccountNo" value={formData.bankAccountNo} onChange={handleNumericChange} inputMode="numeric" pattern="[0-9]*"
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Bank IFSC Code (Optional)</label>
                <input type="text" name="bankIfscCode" value={formData.bankIfscCode} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Bank Branch Name (Optional)</label>
                <input type="text" name="bankBranchName" value={formData.bankBranchName} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Emergency contacts */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-1">Step 5: Emergency Contacts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Emergency Contact Name (Optional)</label>
                <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Emergency Contact Mobile (Optional)</label>
                <input type="text" name="emergencyContactMobile" value={formData.emergencyContactMobile} onChange={handleNumericChange} inputMode="numeric" pattern="[0-9]*"
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}

        {/* Form controls */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t mt-6 justify-between items-center">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
            {step > 1 && (
              <button type="button" onClick={prevStep}
                className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded font-bold text-xs transition-all active:scale-95 shadow-sm">
                <ArrowLeft size={14} /> Back
              </button>
            )}
            
            {step < 5 && (
              <button type="button" onClick={nextStep}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-2.5 rounded font-bold text-xs transition-all active:scale-95 shadow-sm">
                Next Step <ArrowRight size={14} />
              </button>
            )}
          </div>
          
          <button type="submit" disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#2E7D32] hover:bg-green-800 text-white px-6 py-2.5 rounded font-black text-xs uppercase transition-all active:scale-95 disabled:opacity-50 shadow-md">
            {loading ? 'SUBMITTING...' : '✅ FINISH REGISTRATION NOW'}
          </button>
        </div>

      </form>
    </div>
  );
};

export default RegisterForm;
