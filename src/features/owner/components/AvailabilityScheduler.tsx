import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Ban, ShieldAlert, Wifi, Info, Image, UploadCloud, Check } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ParkingBay } from '../types';

interface ScheduleBlockDisplay {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  rate: number;
}

interface AvailabilitySchedulerProps {
  bays: ParkingBay[];
  scheduleBlocks: ScheduleBlockDisplay[];
  onAddBlock: (block: { dayOfWeek: number; startTime: string; endTime: string; rate: number }) => void;
  onRemoveBlock: (id: string) => void;
  onBlockAll: () => void;
  onConfigParking?: (formData: FormData) => Promise<{ success: boolean; message?: string; parkingSpotId?: number }>;
}

type DayType = 'Everyday' | 'Weekday' | 'Weekend';

export default function AvailabilityScheduler({ 
  bays, 
  scheduleBlocks, 
  onAddBlock, 
  onRemoveBlock, 
  onBlockAll,
  onConfigParking,
}: AvailabilitySchedulerProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedBayId, setSelectedBayId] = useState(bays[0]?.id || '');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [monthlyRate, setMonthlyRate] = useState('100.00');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Config parking API fields
  const [dayType, setDayType] = useState<DayType>('Everyday');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [parkingImages, setParkingImages] = useState<File[]>([]);
  const [parkingImageError, setParkingImageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeBay = bays.find((bay) => bay.id === selectedBayId) || bays[0];
  const isUpdatingExistingConfiguration = Boolean(activeBay && activeBay.monthlyRate > 0);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleParkingImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const invalidFile = files.find((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const allowedExtension = extension === 'jpg' || extension === 'jpeg' || extension === 'png';
      const allowedMimeType = !file.type || file.type === 'image/jpeg' || file.type === 'image/png';
      return !allowedExtension || !allowedMimeType;
    });

    if (invalidFile) {
      setParkingImageError('Parking photos must be JPG, JPEG, or PNG files.');
      return;
    }

    setParkingImages(files);
    setParkingImageError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeBay?.isPublished) {
      alert('Unpublish this parking spot before changing its configuration.');
      return;
    }
    if (!startTime || !endTime) {
      alert('Please select valid start and end times.');
      return;
    }

    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);

    if (startMinutes >= endMinutes) {
      alert('Error: End time must be after the start time.');
      return;
    }

    const monthlyRateNum = Number(monthlyRate);
    if (!Number.isFinite(monthlyRateNum) || monthlyRateNum <= 0) {
      alert('Please enter a valid monthly rental rate.');
      return;
    }

    if (!effectiveFrom) {
      alert('Please select the date when availability starts.');
      return;
    }

    if (effectiveUntil && new Date(effectiveUntil) < new Date(effectiveFrom)) {
      alert('Effective Until date must be after Effective From date.');
      return;
    }

    if (parkingImages.length === 0 && !isUpdatingExistingConfiguration) {
      setParkingImageError('Upload at least one parking photo.');
      return;
    }

    // Call backend API if provided
    if (onConfigParking && activeBay) {
      setIsSubmitting(true);
      try {
        const spotId = String(activeBay.parkingSpotId);

        const formData = new FormData();
        formData.append('parkingSpotId', spotId);
        parkingImages.forEach((image) => formData.append('parkingImage', image));
        formData.append('dayType', dayType);
        formData.append('startTime', startTime + ':00');
        formData.append('endTime', endTime + ':00');
        formData.append('effectiveFrom', effectiveFrom);
        if (effectiveUntil) formData.append('effectiveUntil', effectiveUntil);
        formData.append('monthlyRate', monthlyRateNum.toFixed(2));

        const result = await onConfigParking(formData);
        if (result.success) {
          showToast(result.message || `Parking spot #${result.parkingSpotId ?? spotId} configured successfully.`);
          setParkingImages([]);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          alert(result.message || 'Failed to save the parking configuration.');
        }
      } catch {
        alert('Failed to configure parking.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBayChange = (bayId: string) => {
    setSelectedBayId(bayId);
  };

  useEffect(() => {
    if (bays.length > 0 && !bays.some((bay) => bay.id === selectedBayId)) {
      setSelectedBayId(bays[0].id);
    }
  }, [bays, selectedBayId]);

  useEffect(() => {
    if (!activeBay) return;
    setStartTime('08:00');
    setEndTime('18:00');
    setMonthlyRate(activeBay.monthlyRate > 0 ? activeBay.monthlyRate.toFixed(2) : '100.00');
    setDayType('Everyday');
    setEffectiveFrom('');
    setEffectiveUntil('');
    setParkingImages([]);
    setParkingImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [activeBay?.parkingSpotId]);

  const dayStats = useMemo(() => {
    const total = scheduleBlocks.length;
    const daysCovered = new Set(scheduleBlocks.map(b => b.dayOfWeek)).size;
    return { total, daysCovered };
  }, [scheduleBlocks]);

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4 }}
            transition={prefersReducedMotion
              ? { duration: 0.12, ease: 'linear' }
              : { type: 'spring', bounce: 0, duration: 0.32 }}
            role="status"
            aria-live="polite"
            className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm shadow-sm"
          >
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Configure Parking</h1>
        <p className="text-slate-500 text-xs mt-1 leading-normal">
          Add or update photos, availability, and pricing while your parking spot is unpublished.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Configurator Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Clock className="w-4 h-4 text-blue-600" />
              Availability Configuration
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Parking Bay Select */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase font-mono tracking-wider">Select Parking Spot</label>
                <select
                  value={selectedBayId}
                  onChange={(e) => handleBayChange(e.target.value)}
                  disabled={bays.length === 0}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                >
                  {bays.length === 0 && <option value="">No unpublished parking spots</option>}
                  {bays.map((bay) => (
                    <option key={bay.id} value={bay.id}>
                      {bay.bayNumber} ({bay.propertyName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase font-mono tracking-wider">Schedule Type</label>
                <select
                  value={dayType}
                  onChange={(e) => setDayType(e.target.value as DayType)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                >
                  <option value="Everyday">Everyday</option>
                  <option value="Weekday">Weekdays Only</option>
                  <option value="Weekend">Weekends Only</option>
                </select>
              </div>

              {/* Effective Date Range */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase font-mono tracking-wider">Effective Date Range</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[9px] text-slate-500 mb-0.5">From</span>
                    <input
                      type="date"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                      required
                    />
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-500 mb-0.5">Until</span>
                    <input
                      type="date"
                      value={effectiveUntil}
                      onChange={(e) => setEffectiveUntil(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                    />
                    <span className="mt-1 block text-[9px] text-slate-400">Optional — leave blank for no end date</span>
                  </div>
                </div>
              </div>

              {/* Time Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase font-mono tracking-wider">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase font-mono tracking-wider">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Monthly Rate */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase font-mono tracking-wider">Monthly Rate (RM)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono text-xs">RM</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={monthlyRate}
                    onChange={(e) => setMonthlyRate(e.target.value)}
                    className="w-full pl-9 pr-12 py-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono font-bold"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-medium font-mono">/month</span>
                </div>
              </div>

              {/* Parking Image Upload */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase font-mono tracking-wider">
                  Parking Photos
                  {isUpdatingExistingConfiguration && <span className="ml-2 normal-case tracking-normal text-slate-400">Optional when updating</span>}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  multiple
                  onChange={handleParkingImageChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 text-xs border border-dashed border-slate-300 rounded-lg px-3 py-3 hover:border-blue-400 hover:bg-blue-50/30 transition-all text-slate-500"
                >
                  {parkingImages.length > 0 ? (
                    <>
                      <Image className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600 font-medium truncate">
                        {parkingImages.length === 1 ? parkingImages[0].name : `${parkingImages.length} photos selected`}
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 text-slate-400" />
                      <span>{isUpdatingExistingConfiguration ? 'Upload only if you want to add new photos' : 'Upload one or more parking spot photos'}</span>
                    </>
                  )}
                </button>
                {parkingImageError && <p role="alert" className="mt-1.5 text-[10px] font-semibold text-rose-600">{parkingImageError}</p>}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !activeBay}
                  className="w-full bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold text-xs py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 shadow disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">{isUpdatingExistingConfiguration ? 'Updating...' : 'Configuring...'}</span>
                  ) : (
                    <>{isUpdatingExistingConfiguration ? 'Update Configuration' : 'Save Configuration'}</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const confirmBlock = window.confirm('Are you sure you want to block all scheduled availability?\n\nThis will raise physical smart bollards and deny all incoming commuter reservations immediately.');
                    if (confirmBlock) {
                      onBlockAll();
                      showToast('All dates blocked. ESP32 bollards raised.');
                    }
                  }}
                  className="w-full border border-rose-200 hover:border-rose-300 text-rose-700 bg-rose-50/20 hover:bg-rose-50/50 font-bold text-xs py-2.5 rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Block All Dates
                </button>
              </div>
            </form>
          </div>

          {/* Legal Compliance card */}
          <div className="bg-[#0f172a] text-slate-300 p-5 rounded-2xl border border-slate-800 space-y-3 shadow-sm">
            <h3 className="text-white text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Strata Act Actuation
            </h3>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">
              Under Section 59 of the <strong>Malaysia Strata Management Act (SMA 2013)</strong>, property owners are fully legally authorized to manage access permissions on their assigned accessory parcels. Scheduled slots automatically generate time-restricted access key tokens.
            </p>
            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 border-t border-slate-800 pt-2 mt-2">
              <Wifi className="w-3 h-3 text-blue-400" />
              <span>Edge Sync Status: 100% Consistent</span>
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Configuration Summary</h2>
              <p className="text-slate-400 text-[10px] mt-0.5">
                {activeBay ? `${activeBay.bayNumber} · ${activeBay.propertyName}` : 'Select a parking spot'}
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Schedule Type</span>
                <span className="text-slate-800 font-bold">{dayType}</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Monthly Rate</span>
                <span className="text-emerald-600 font-bold">RM {monthlyRate}/month</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Time Window</span>
                <span className="text-slate-800 font-mono font-bold">{startTime} — {endTime}</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Date Range</span>
                <span className="text-slate-800 font-mono text-xs">
                  {effectiveFrom ? effectiveFrom : '—'} → {effectiveUntil || 'No end date'}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Parking Photos</span>
              <span className="text-slate-800 font-bold">
                {parkingImages.length > 0
                  ? `${parkingImages.length} selected`
                  : isUpdatingExistingConfiguration ? 'Keeping existing photos' : 'At least one required'}
              </span>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-700">
              <Info className="w-4 h-4 inline-block mr-1 text-blue-500" />
              You can return and update this configuration whenever the spot is unpublished. Publish it only when the information is ready for commuters.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
