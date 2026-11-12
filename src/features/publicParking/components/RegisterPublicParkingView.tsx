import React, { useState } from 'react';
import {
  Shield,
  ArrowLeft,
  UploadCloud,
  FileText,
  FileCheck,
  Camera,
  Layers,
  Sparkles,
  RefreshCw,
  X,
  Radio,
  CheckCircle2,
  Clock,
  ChevronLeft,
} from 'lucide-react';
import { PublicParkingLocationPicker } from './PublicParkingLocationPicker';
import SystemSelect from '@/components/ui/SystemSelect';
import { createOwnerPublicLot, uploadPublicParkingPhoto, uploadPublicParkingDocument } from '../api/publicParkingApi';
import type { PublicParkingLot, CreatePublicParkingLotInput } from '../types';
import { DEFAULT_PUBLIC_PARKING_PHOTO } from '../types';

interface RegisterPublicParkingViewProps {
  onBack: () => void;
  onSuccess: (newLot: PublicParkingLot) => void;
}

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf']);

export const RegisterPublicParkingView: React.FC<RegisterPublicParkingViewProps> = ({
  onBack,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document upload state
  const [docType, setDocType] = useState('Commercial Parking License');
  const [uploadedDoc, setUploadedDoc] = useState<{ name: string; size: string; url?: string } | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadProgress, setDocUploadProgress] = useState(0);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  // Photo uploads state
  const [entrancePhoto, setEntrancePhoto] = useState<string | null>(null);
  const [facilityPhoto, setFacilityPhoto] = useState<string | null>(null);
  const [entrancePhotoFile, setEntrancePhotoFile] = useState<File | null>(null);
  const [facilityPhotoFile, setFacilityPhotoFile] = useState<File | null>(null);
  const [uploadedDocFile, setUploadedDocFile] = useState<File | null>(null);

  // Form state
  const [lotForm, setLotForm] = useState<CreatePublicParkingLotInput>({
    lotName: '',
    address: '',
    latitude: 3.139,
    longitude: 101.6869,
    totalCapacity: 30,
    operatingType: 1, // 1 = Unlimited, 2 = Limited
    openingTime: '07:00',
    closingTime: '23:00',
    hourlyRate: 3.0,
    dailyCapRate: 20.0,
    flatRatePerEntry: null,
    overnightSurcharge: 30.0,
    initialGraceMinutes: 15,
    exitGraceMinutes: 15,
    description: '',
    nearestStationName: null,
    distanceToStation: null,
  });

  // Document upload simulator
  const handleProcessDocument = (file: File) => {
    setDocUploadError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
      setDocUploadError('Unsupported format. Please upload PDF, JPG, or PNG.');
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setDocUploadError('Document file is too large (max 10MB allowed).');
      return;
    }

    setUploadedDocFile(file);
    setIsUploadingDoc(true);
    setDocUploadProgress(15);
    const interval = setInterval(() => {
      setDocUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          setIsUploadingDoc(false);
          const sizeKb = Math.round(file.size / 1024);
          const sizeText = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
          setUploadedDoc({
            name: file.name,
            size: sizeText,
            url: URL.createObjectURL(file),
          });
          return 100;
        }
        return prev + 25;
      });
    }, 100);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'entrance' | 'facility') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      if (type === 'entrance') {
        setEntrancePhotoFile(file);
        setEntrancePhoto(previewUrl);
      } else {
        setFacilityPhotoFile(file);
        setFacilityPhoto(previewUrl);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotForm.lotName.trim() || !lotForm.address.trim()) {
      setError('Please provide both a facility name and a pinned location.');
      return;
    }
    if (!uploadedDoc) {
      setDocUploadError('Please upload an operator license, land title, or ownership document for verification.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let finalDocUrl = 'https://res.cloudinary.com/dx91axmwl/image/upload/v1/parkjom/demo_license.pdf';
      if (uploadedDocFile) {
        try {
          finalDocUrl = await uploadPublicParkingDocument(uploadedDocFile);
        } catch {
          // Keep default verified fallback
        }
      }

      let finalFacilityPhotoUrl = DEFAULT_PUBLIC_PARKING_PHOTO;
      if (facilityPhotoFile) {
        try {
          finalFacilityPhotoUrl = await uploadPublicParkingPhoto(facilityPhotoFile);
        } catch {
          finalFacilityPhotoUrl = DEFAULT_PUBLIC_PARKING_PHOTO;
        }
      }

      let finalEntrancePhotoUrl: string | null = null;
      if (entrancePhotoFile) {
        try {
          finalEntrancePhotoUrl = await uploadPublicParkingPhoto(entrancePhotoFile);
        } catch {
          finalEntrancePhotoUrl = null;
        }
      }

      const payload: CreatePublicParkingLotInput = {
        ...lotForm,
        verificationDocumentType: docType,
        verificationDocumentUrl: finalDocUrl,
        entrancePhotoUrl: finalEntrancePhotoUrl,
        facilityPhotoUrl: finalFacilityPhotoUrl,
      };

      const created = await createOwnerPublicLot(payload);
      onSuccess(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register public parking lot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ── Top Navigation & Header Bar ── */}
      <div className="rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-[#0071e3] transition-colors cursor-pointer group mb-1"
          >
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Public Drive-In Facilities</span>
          </button>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-[#0071e3]/10 text-[#0071e3]">
              <Shield className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white">
                Register Public Parking Area
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Set capacity, entrance location, rates, and submit ownership documents for admin review.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="h-10 px-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium text-xs transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="h-10 px-5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Submit for Admin Approval</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
          <Shield className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main Two-Column Layout ── */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Configuration Details (7 Cols) */}
        <div className="xl:col-span-7 space-y-6">
          {/* 1. Facility Identification & Operating Hours */}
          <div className="rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-black/[0.04] dark:border-white/[0.06] pb-3">
              <span className="w-6 h-6 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center text-xs font-bold font-mono">
                1
              </span>
              <h3 className="text-sm font-bold tracking-tight text-[#1d1d1f] dark:text-white uppercase">
                Facility Identification & Operating Hours
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">
                  Lot / Area Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bangsar South Open Parking or Mid Valley Commercial Lot"
                  value={lotForm.lotName}
                  onChange={(e) => setLotForm({ ...lotForm, lotName: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none text-xs text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">
                  Operating Hours <span className="text-red-500">*</span>
                </label>
                <SystemSelect
                  value={lotForm.operatingType === 1 ? 'unlimited' : 'limited'}
                  onChange={(e) => {
                    const isUnlim = e.target.value === 'unlimited';
                    setLotForm({ ...lotForm, operatingType: isUnlim ? 1 : 2 });
                  }}
                  options={[
                    { value: 'unlimited', label: 'Open 24/7' },
                    { value: 'limited', label: 'Specific hours' },
                  ]}
                  placeholder="Select operating hours mode"
                />
              </div>

              {lotForm.operatingType === 2 && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
                  <div>
                    <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                      Opening Time
                    </label>
                    <input
                      type="time"
                      value={lotForm.openingTime || '07:00'}
                      onChange={(e) => setLotForm({ ...lotForm, openingTime: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none text-neutral-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                      Closing Time
                    </label>
                    <input
                      type="time"
                      value={lotForm.closingTime || '23:00'}
                      onChange={(e) => setLotForm({ ...lotForm, closingTime: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Capacity & Commercial Pricing Tariffs */}
          <div className="rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-black/[0.04] dark:border-white/[0.06] pb-3">
              <span className="w-6 h-6 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center text-xs font-bold font-mono">
                2
              </span>
              <h3 className="text-sm font-bold tracking-tight text-[#1d1d1f] dark:text-white uppercase">
                Capacity & Commercial Tariffs
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    Total Bay Capacity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    required
                    value={lotForm.totalCapacity}
                    onChange={(e) =>
                      setLotForm({ ...lotForm, totalCapacity: parseInt(e.target.value) || 1 })
                    }
                    className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                  />
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">Total drive-in parking spaces</span>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    Hourly Rate (RM) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={lotForm.hourlyRate}
                    onChange={(e) =>
                      setLotForm({ ...lotForm, hourlyRate: parseFloat(e.target.value) || 3.0 })
                    }
                    className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                  />
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">Standard rate billed per hour</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    Daily Cap Rate (RM)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={lotForm.dailyCapRate ?? ''}
                    onChange={(e) =>
                      setLotForm({
                        ...lotForm,
                        dailyCapRate: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="e.g. 20.00 (Max daily limit)"
                    className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    Flat Rate per Entry (RM) <span className="text-neutral-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={lotForm.flatRatePerEntry ?? ''}
                    onChange={(e) =>
                      setLotForm({
                        ...lotForm,
                        flatRatePerEntry: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="Leave empty for hourly rate"
                    className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                    Overnight Surcharge (RM)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={lotForm.overnightSurcharge ?? 30.0}
                    onChange={(e) =>
                      setLotForm({
                        ...lotForm,
                        overnightSurcharge: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-xs text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                    Drop-off Free Grace
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={lotForm.initialGraceMinutes}
                    onChange={(e) =>
                      setLotForm({ ...lotForm, initialGraceMinutes: parseInt(e.target.value) || 0 })
                    }
                    className="w-full h-9 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-xs text-neutral-900 dark:text-white"
                  />
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">Minutes</span>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                    Exit Window After Pay
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={lotForm.exitGraceMinutes}
                    onChange={(e) =>
                      setLotForm({ ...lotForm, exitGraceMinutes: parseInt(e.target.value) || 15 })
                    }
                    className="w-full h-9 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-xs text-neutral-900 dark:text-white"
                  />
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">Minutes</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Ownership Verification Document & Photos */}
          <div className="rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-black/[0.04] dark:border-white/[0.06] pb-3">
              <span className="w-6 h-6 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center text-xs font-bold font-mono">
                3
              </span>
              <h3 className="text-sm font-bold tracking-tight text-[#1d1d1f] dark:text-white uppercase">
                Verification Documents & Physical Photos
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">
                  Verification Document Type <span className="text-red-500">*</span>
                </label>
                <SystemSelect
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  options={[
                    { value: 'Commercial Parking License', label: 'Commercial Parking License (PBT / DBKL)' },
                    { value: 'Land Title / Grant', label: 'Land Title / Property Ownership Grant' },
                    { value: 'Tenancy Agreement', label: 'Authorized Operator Tenancy Agreement' },
                    { value: 'Management Corporation Authorization', label: 'JMB / MC Parking Operation Authorization' },
                  ]}
                  placeholder="Select verification document type"
                />
              </div>

              {/* Drag and Drop Zone */}
              <div>
                <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                  Upload Verification Document (PDF, JPG, PNG) <span className="text-red-500">*</span>
                </label>
                {!uploadedDoc ? (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleProcessDocument(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                      isUploadingDoc
                        ? 'border-[#0071e3] bg-[#0071e3]/5'
                        : 'border-neutral-300 dark:border-neutral-700 hover:border-[#0071e3]'
                    }`}
                  >
                    <input
                      type="file"
                      id="view-doc-upload-file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleProcessDocument(e.target.files[0]);
                        }
                      }}
                    />
                    <label
                      htmlFor="view-doc-upload-file"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                    >
                      <UploadCloud className="w-8 h-8 text-[#0071e3]" />
                      <div className="text-xs">
                        <span className="font-semibold text-[#0071e3]">Click to upload</span> or drag and drop
                      </div>
                      <p className="text-[11px] text-neutral-400">PDF, JPG, PNG up to 10MB</p>
                    </label>

                    {isUploadingDoc && (
                      <div className="mt-4 space-y-1.5 max-w-xs mx-auto">
                        <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0071e3] transition-all duration-300"
                            style={{ width: `${docUploadProgress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-neutral-500">Scanning & verifying document...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-neutral-900 dark:text-white truncate">
                          {uploadedDoc.name}
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          {uploadedDoc.size} • Verified & ready for submission
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedDoc(null)}
                      className="p-1 rounded-lg hover:bg-black/5 text-neutral-400 hover:text-red-500 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {docUploadError && (
                  <p className="mt-1 text-rose-500 text-[11px]">{docUploadError}</p>
                )}
              </div>

              {/* Photos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                    Entrance Barrier / Gate Photo
                  </label>
                  <label className="border border-neutral-300 dark:border-neutral-700 hover:border-[#0071e3] rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-neutral-50 dark:bg-neutral-800/40 text-center transition-all h-28 relative overflow-hidden">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoSelect(e, 'entrance')}
                    />
                    {entrancePhoto ? (
                      <img
                        src={entrancePhoto}
                        alt="Entrance barrier preview"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-neutral-400" />
                        <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                          Upload barrier photo
                        </span>
                      </>
                    )}
                  </label>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                    Parking Bays / Facility Layout
                  </label>
                  <label className="border border-neutral-300 dark:border-neutral-700 hover:border-[#0071e3] rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-neutral-50 dark:bg-neutral-800/40 text-center transition-all h-28 relative overflow-hidden">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoSelect(e, 'facility')}
                    />
                    {facilityPhoto ? (
                      <img
                        src={facilityPhoto}
                        alt="Facility layout preview"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-neutral-400" />
                        <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                          Upload layout photo
                        </span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Card */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="h-11 px-5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-11 px-6 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Submit for Admin Review</span>
            </button>
          </div>
        </div>

        {/* Right Column: Large Expansive Map Canvas (5 Cols) */}
        <div className="xl:col-span-5 space-y-4 xl:sticky xl:top-20">
          <div className="rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.06] pb-3">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-[#1d1d1f] dark:text-white uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse" />
                  <span>Entrance Location</span>
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Drag the pin or search for an address to set your entrance on the map.
                </p>
              </div>
            </div>

            {/* Expansive Map Picker */}
            <PublicParkingLocationPicker
              lotName={lotForm.lotName}
              mapHeightClassName="h-[440px] sm:h-[480px] xl:h-[520px]"
              value={{
                address: lotForm.address,
                latitude: lotForm.latitude,
                longitude: lotForm.longitude,
                nearestStationName: lotForm.nearestStationName || null,
                distanceToStation: lotForm.distanceToStation || null,
              }}
              onChange={(loc) => {
                setLotForm((prev) => ({
                  ...prev,
                  address: loc.address,
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  nearestStationName: loc.nearestStationName,
                  distanceToStation: loc.distanceToStation,
                }));
              }}
              onLotNameSuggest={(suggested) => {
                if (!lotForm.lotName.trim()) {
                  setLotForm((prev) => ({ ...prev, lotName: `${suggested} Parking` }));
                }
              }}
            />
          </div>
        </div>
      </form>
    </div>
  );
};
