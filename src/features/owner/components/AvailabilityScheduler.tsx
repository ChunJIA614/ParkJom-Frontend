import React, { useState, useMemo, useRef } from 'react';
import { Clock, Ban, ShieldAlert, Wifi, Info, Image, UploadCloud, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  onConfigParking?: (parkingSpotId: string, formData: FormData) => Promise<{ success: boolean; message?: string }>;
}

const dayTypeMapping: Record<string, number> = {
  Everyday: 0,
  Weekdays: 1,
  Weekends: 2,
  Custom: 3,
};

export default function AvailabilityScheduler({ 
  bays, 
  scheduleBlocks, 
  onAddBlock, 
  onRemoveBlock, 
  onBlockAll,
  onConfigParking,
}: AvailabilitySchedulerProps) {
  const [selectedBayId, setSelectedBayId] = useState(bays[0]?.id || '1');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [rate, setRate] = useState('2.00');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Config parking API fields
  const [dateType, setDateType] = useState('Everyday');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [parkingImage, setParkingImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum <= 0) {
      alert('Please configure a valid hourly rate.');
      return;
    }

    if (!effectiveFrom || !effectiveUntil) {
      alert('Please select both effective start and end dates.');
      return;
    }

    if (new Date(effectiveUntil) < new Date(effectiveFrom)) {
      alert('Effective Until date must be after Effective From date.');
      return;
    }

    // Call backend API if provided
    if (onConfigParking && activeBay) {
      setIsSubmitting(true);
      try {
        // Extract numeric parkingSpotId from bay id (e.g. "b-15" → "15")
        const spotId = activeBay.id.replace(/^b-/, '');

        const formData = new FormData();
        if (parkingImage) formData.append('parkingImage', parkingImage);
        formData.append('dayType', dayTypeMapping[dateType].toString());
        formData.append('startTime', startTime + ':00');
        formData.append('endTime', endTime + ':00');
        formData.append('hourlyRate', rateNum.toString());
        formData.append('effectiveFrom', effectiveFrom);
        formData.append('effectiveUntil', effectiveUntil);

        const result = await onConfigParking(spotId, formData);
        if (result.success) {
          showToast(`Parking configured! Rate: RM ${rate}/hr · ${dateType} · ${effectiveFrom} → ${effectiveUntil}`);
          setParkingImage(null);
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

  const activeBay = bays.find(b => b.id === selectedBayId) || bays[0];

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
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm shadow-sm"
          >
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Parking Availability Configuration</h1>
        <p className="text-slate-500 text-xs mt-1 leading-normal">
          Configure your parking spot availability with a date range, schedule type, time window, and hourly rate.
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
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                >
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
                  value={dateType}
                  onChange={(e) => setDateType(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                >
                  <option value="Everyday">Everyday</option>
                  <option value="Weekdays">Weekdays Only</option>
                  <option value="Weekends">Weekends Only</option>
                  <option value="Custom">Custom Range</option>
                </select>
              </div>

              {/* Effective Date Range */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase font-mono tracking-wider">Effective Date Range</label>
                <div className="grid grid-cols-2 gap-3">
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
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-3">
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

              {/* Hourly Rate */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase font-mono tracking-wider">Hourly Rate (RM)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono text-xs">RM</span>
                  <input
                    type="number"
                    step="0.10"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full pl-9 pr-12 py-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono font-bold"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-medium font-mono">/hr</span>
                </div>
              </div>

              {/* Parking Image Upload */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase font-mono tracking-wider">Parking Photo (optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setParkingImage(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 text-xs border border-dashed border-slate-300 rounded-lg px-3 py-3 hover:border-blue-400 hover:bg-blue-50/30 transition-all text-slate-500"
                >
                  {parkingImage ? (
                    <>
                      <Image className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600 font-medium truncate">{parkingImage.name}</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 text-slate-400" />
                      <span>Upload parking spot photo</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold text-xs py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 shadow disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">Configuring...</span>
                  ) : (
                    <>Save Configuration</>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Schedule Type</span>
                <span className="text-slate-800 font-bold">{dateType}</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Hourly Rate</span>
                <span className="text-emerald-600 font-bold">RM {rate}/hr</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Time Window</span>
                <span className="text-slate-800 font-mono font-bold">{startTime} — {endTime}</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Date Range</span>
                <span className="text-slate-800 font-mono text-xs">
                  {effectiveFrom ? effectiveFrom : '—'} → {effectiveUntil ? effectiveUntil : '—'}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-700">
              <Info className="w-4 h-4 inline-block mr-1 text-blue-500" />
              Configuration is saved to the backend and will be immediately applied to your parking spot. Commuters will see updated availability within seconds.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
