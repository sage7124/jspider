import React, { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uzbobbzbbkqzgtjemayu.supabase.co';
const supabaseAnonKey = 'sb_publishable_r0jMviNey66U0tDDtyScEQ_CRmZg-Rr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const RegisterForm: React.FC = () => {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
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
    // Validate Step 1 required fields
    if (step === 1) {
      if (!formData.fullName || !formData.email || !formData.mobile || !formData.password) {
        setError('Please fill in all required fields.');
        return;
      }
    }
    setError('');
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 max-w-2xl mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-6">
        {[1, 2, 3, 4].map((s) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                step === s ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                step > s ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {step > s ? <Check size={14} /> : s}
              </div>
              <span className={`text-xs font-bold hidden sm:inline ${step === s ? 'text-blue-600' : 'text-gray-400'}`}>
                {s === 1 ? 'Personal' : s === 2 ? 'Onboarding' : s === 3 ? 'Documents' : 'Bank & Emergency'}
              </span>
            </div>
            {s < 4 && <div className={`flex-1 h-0.5 mx-2 ${step > s ? 'bg-green-500' : 'bg-gray-100'}`} />}
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
                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} required
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Department / Domain</label>
                <input type="text" name="department" value={formData.department} onChange={handleChange} placeholder="e.g. Web Dev"
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
                <label className="block text-xs font-bold text-gray-500 mb-1">Father's Name</label>
                <input type="text" name="fatherName" value={formData.fatherName} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Mother's Name</label>
                <input type="text" name="motherName" value={formData.motherName} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Profile Photo</label>
                <div className="flex gap-2 items-center">
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'photoUrl')} disabled={uploadingField === 'photoUrl'} className="hidden" id="reg-photo-input" />
                  <label htmlFor="reg-photo-input" className={`flex-1 border-2 border-dashed rounded px-3 py-2 text-xs font-bold text-center cursor-pointer transition-all ${
                    uploadingField === 'photoUrl' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse' :
                    formData.photoUrl ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}>
                    {uploadingField === 'photoUrl' ? '⏳ Uploading...' : formData.photoUrl ? '✅ Uploaded successfully' : '📁 Upload Photo (<1MB)'}
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
                <label className="block text-xs font-bold text-gray-500 mb-1">Date of Joining (DDMMYYYY)</label>
                <input type="text" name="dateOfJoining" value={formData.dateOfJoining} onChange={handleChange} placeholder="e.g. 01052026"
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Office Timings with Cycle</label>
                <input type="text" name="officeTimings" value={formData.officeTimings} onChange={handleChange} placeholder="e.g. 9 AM - 5 PM Shift A"
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Education Completed</label>
                <select name="educationCompleted" value={formData.educationCompleted} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Education</option>
                  <option value="Undergraduate">Undergraduate</option>
                  <option value="Postgraduate">Postgraduate</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Doctorate">Doctorate</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Sub Classification</label>
                <select name="subClassification" value={formData.subClassification} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Classification</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Temporary">Temporary</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Present Address</label>
                <textarea name="presentAddress" value={formData.presentAddress} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Permanent Address</label>
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
                <label className="block text-xs font-bold text-gray-500 mb-1">Aadhaar Number</label>
                <input type="text" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} placeholder="e.g. 12-digit number"
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Aadhaar Document</label>
                <div className="flex gap-2 items-center">
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'aadhaarPhotoUrl')} disabled={uploadingField === 'aadhaarPhotoUrl'} className="hidden" id="reg-aadhaar-input" />
                  <label htmlFor="reg-aadhaar-input" className={`flex-1 border-2 border-dashed rounded px-3 py-2 text-xs font-bold text-center cursor-pointer transition-all ${
                    uploadingField === 'aadhaarPhotoUrl' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse' :
                    formData.aadhaarPhotoUrl ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}>
                    {uploadingField === 'aadhaarPhotoUrl' ? '⏳ Uploading...' : formData.aadhaarPhotoUrl ? '✅ Uploaded successfully' : '📁 Upload Aadhaar (<1MB)'}
                  </label>
                  {formData.aadhaarPhotoUrl && (
                    <a href={formData.aadhaarPhotoUrl} target="_blank" rel="noreferrer" className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded px-2.5 py-2 text-xs font-bold whitespace-nowrap">
                      👁️ View
                    </a>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">PAN Number</label>
                <input type="text" name="panNumber" value={formData.panNumber} onChange={handleChange} placeholder="e.g. ABCDE1234F"
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">PAN Document</label>
                <div className="flex gap-2 items-center">
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'panPhotoUrl')} disabled={uploadingField === 'panPhotoUrl'} className="hidden" id="reg-pan-input" />
                  <label htmlFor="reg-pan-input" className={`flex-1 border-2 border-dashed rounded px-3 py-2 text-xs font-bold text-center cursor-pointer transition-all ${
                    uploadingField === 'panPhotoUrl' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse' :
                    formData.panPhotoUrl ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}>
                    {uploadingField === 'panPhotoUrl' ? '⏳ Uploading...' : formData.panPhotoUrl ? '✅ Uploaded successfully' : '📁 Upload PAN (<1MB)'}
                  </label>
                  {formData.panPhotoUrl && (
                    <a href={formData.panPhotoUrl} target="_blank" rel="noreferrer" className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded px-2.5 py-2 text-xs font-bold whitespace-nowrap">
                      👁️ View
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Bank & Emergency contacts */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-1">Step 4: Bank Account & Emergency Contacts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Bank Name</label>
                <input type="text" name="bankName" value={formData.bankName} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Bank Account Number</label>
                <input type="text" name="bankAccountNo" value={formData.bankAccountNo} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Bank IFSC Code</label>
                <input type="text" name="bankIfscCode" value={formData.bankIfscCode} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Bank Branch Name</label>
                <input type="text" name="bankBranchName" value={formData.bankBranchName} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Emergency Contact Name</label>
                <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Emergency Contact Mobile</label>
                <input type="text" name="emergencyContactMobile" value={formData.emergencyContactMobile} onChange={handleChange}
                  className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}

        {/* Form controls */}
        <div className="flex gap-4 pt-4 border-t mt-6 justify-between">
          {step > 1 && (
            <button type="button" onClick={prevStep}
              className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded font-bold text-xs transition-all active:scale-95">
              <ArrowLeft size={14} /> Back
            </button>
          )}
          
          {step < 4 ? (
            <button type="button" onClick={nextStep}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-bold text-xs ml-auto transition-all active:scale-95 shadow-sm">
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 bg-[#1976D2] hover:bg-blue-700 text-white px-6 py-2.5 rounded font-bold text-xs ml-auto transition-all active:scale-95 disabled:opacity-50 shadow-md">
              {loading ? 'SUBMITTING...' : 'SUBMIT REGISTRATION'}
            </button>
          )}
        </div>

      </form>
    </div>
  );
};

export default RegisterForm;
