import React, { useState } from 'react';
import {
  X,
  Sliders,
  Clock,
  DollarSign,
  Car,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Calendar,
  ShieldAlert,
  Info,
} from 'lucide-react';
import SystemSelect from '@/components/ui/SystemSelect';
import { updateOwnerPublicLot } from '../api/publicParkingApi';
import type { PublicParkingLot, CreatePublicParkingLotInput } from '../types';

interface ConfigurePublicParkingModalProps {
  lot: PublicParkingLot;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedLot: PublicParkingLot) => void;
}

export const ConfigurePublicParkingModal: React.FC<ConfigurePublicParkingModalProps> = ({
  lot,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'pricing' | 'hours' | 'general'>('pricing');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state initialized from current lot
  const [lotName, setLotName] = useState(lot.lotName);
  const [totalCapacity, setTotalCapacity] = useState(lot.totalCapacity);
  const [operatingType, setOperatingType] = useState<number>(
    lot.operatingType === 'Unlimited24Hours' || lot.operatingType === 1 ? 1 : 2
  );
  const [openingTime, setOpeningTime] = useState(lot.openingTime || '07:00');
  const [closingTime, setClosingTime] = useState(lot.closingTime || '23:00');
  const [hourlyRate, setHourlyRate] = useState(lot.hourlyRate);
  const [dailyCapRate, setDailyCapRate] = useState<number | null>(lot.dailyCapRate ?? null);
  const [flatRatePerEntry, setFlatRatePerEntry] = useState<number | null>(lot.flatRatePerEntry ?? null);
  const [overnightSurcharge, setOvernightSurcharge] = useState<number | null>(
    lot.overnightSurcharge ?? 30.0
  );
  const [initialGraceMinutes, setInitialGraceMinutes] = useState(lot.initialGraceMinutes ?? 15);
  const [exitGraceMinutes, setExitGraceMinutes] = useState(lot.exitGraceMinutes ?? 15);
  const [isActive, setIsActive] = useState(lot.isActive ?? true);
  const [description, setDescription] = useState(lot.description || '');
  const [nearestStationName, setNearestStationName] = useState(lot.nearestStationName || '');
  const [distanceToStation, setDistanceToStation] = useState<number | null>(
    lot.distanceToStation ?? null
  );

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotName.trim()) {
      setError('Facility name cannot be empty.');
      return;
    }
    if (totalCapacity <= 0) {
      setError('Total capacity must be at least 1 bay.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload: Partial<CreatePublicParkingLotInput> = {
      lotName: lotName.trim(),
      totalCapacity,
      operatingType,
      openingTime: operatingType === 2 ? openingTime : undefined,
      closingTime: operatingType === 2 ? closingTime : undefined,
      hourlyRate,
      dailyCapRate: dailyCapRate && dailyCapRate > 0 ? dailyCapRate : null,
      flatRatePerEntry: flatRatePerEntry && flatRatePerEntry > 0 ? flatRatePerEntry : null,
      overnightSurcharge: overnightSurcharge && overnightSurcharge > 0 ? overnightSurcharge : null,
      initialGraceMinutes,
      exitGraceMinutes,
      isActive,
      description: description.trim() || undefined,
      nearestStationName: nearestStationName.trim() || undefined,
      distanceToStation: distanceToStation && distanceToStation > 0 ? distanceToStation : null,
    };

    try {
      const updated = await updateOwnerPublicLot(lot.publicParkingLotId, payload);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update facility configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1400] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Configure Facility Details
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 font-semibold">
                  PUB-{lot.publicParkingLotId}
                </span>
              </div>
              <p className="text-xs text-neutral-500 truncate max-w-sm sm:max-w-md">
                {lot.lotName} • Adjust tariffs, operating hours, and bay standards
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-black/[0.04] dark:border-white/[0.06] bg-neutral-50/50 dark:bg-neutral-900/30">
          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'pricing'
                ? 'border-[#0071e3] text-[#0071e3] dark:text-[#3894FF]'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Pricing & Tariffs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hours')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'hours'
                ? 'border-[#0071e3] text-[#0071e3] dark:text-[#3894FF]'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Date, Time & Hours</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'border-[#0071e3] text-[#0071e3] dark:text-[#3894FF]'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Capacity & Facility Info</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: Pricing & Tariffs */}
          {activeTab === 'pricing' && (
            <div className="space-y-4 animate-in fade-in duration-150 text-xs">
              <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 text-[#0071e3] mt-0.5" />
                <span>
                  Configured rates take effect immediately for new vehicle entries. Barrier gate ALPR will calculate final ticket totals based on these exact tariffs.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1.5 text-neutral-800 dark:text-neutral-200">
                    Standard Hourly Rate (RM) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-mono text-neutral-400 font-semibold">RM</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="100"
                      required
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 pl-11 pr-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                    />
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">Billed every 60 minutes parked</span>
                </div>

                <div>
                  <label className="block font-semibold mb-1.5 text-neutral-800 dark:text-neutral-200">
                    Daily Maximum Cap (RM) <span className="text-neutral-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-mono text-neutral-400 font-semibold">RM</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={dailyCapRate ?? ''}
                      onChange={(e) =>
                        setDailyCapRate(e.target.value ? parseFloat(e.target.value) : null)
                      }
                      placeholder="e.g. 20.00 (Max daily limit)"
                      className="w-full h-10 pl-11 pr-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                    />
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">Capped fee per 24-hour cycle</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block font-semibold mb-1.5 text-neutral-800 dark:text-neutral-200">
                    Flat Rate per Entry (RM) <span className="text-neutral-400 font-normal">(Event/Special)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-mono text-neutral-400 font-semibold">RM</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={flatRatePerEntry ?? ''}
                      onChange={(e) =>
                        setFlatRatePerEntry(e.target.value ? parseFloat(e.target.value) : null)
                      }
                      placeholder="Leave blank for hourly billing"
                      className="w-full h-10 pl-11 pr-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                    />
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">
                    Fixed one-time charge regardless of duration
                  </span>
                </div>

                <div>
                  <label className="block font-semibold mb-1.5 text-neutral-800 dark:text-neutral-200">
                    Overnight Surcharge (RM)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-mono text-neutral-400 font-semibold">RM</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={overnightSurcharge ?? ''}
                      onChange={(e) =>
                        setOvernightSurcharge(e.target.value ? parseFloat(e.target.value) : null)
                      }
                      placeholder="e.g. 30.00"
                      className="w-full h-10 pl-11 pr-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                    />
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">
                    Applied if parked across midnight or past closing
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                  Grace Periods & Free Allowances
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                      Drop-off Free Grace Window (Minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={initialGraceMinutes}
                      onChange={(e) => setInitialGraceMinutes(parseInt(e.target.value) || 0)}
                      className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                    />
                    <span className="text-[10px] text-neutral-400 mt-1 block">
                      Free drop-off / pickup before billing starts (Default: 15m)
                    </span>
                  </div>

                  <div>
                    <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                      Exit Grace Window After Payment (Minutes)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={exitGraceMinutes}
                      onChange={(e) => setExitGraceMinutes(parseInt(e.target.value) || 15)}
                      className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                    />
                    <span className="text-[10px] text-neutral-400 mt-1 block">
                      Time allowed to drive to barrier gate after paying
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Date, Time & Hours */}
          {activeTab === 'hours' && (
            <div className="space-y-4 animate-in fade-in duration-150 text-xs">
              <div>
                <label className="block font-semibold mb-1.5 text-neutral-800 dark:text-neutral-200">
                  Operating Hours Mode <span className="text-red-500">*</span>
                </label>
                <SystemSelect
                  value={operatingType === 1 ? 'unlimited' : 'limited'}
                  onChange={(e) => {
                    const isUnlim = e.target.value === 'unlimited';
                    setOperatingType(isUnlim ? 1 : 2);
                  }}
                  options={[
                    { value: 'unlimited', label: '24 Hours / 7 Days Unlimited' },
                    { value: 'limited', label: 'Specific Daily Operating Hours' },
                  ]}
                  placeholder="Select operating hours mode"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Choose whether this facility is accessible round the clock or has daily lock-in hours
                </span>
              </div>

              {operatingType === 2 && (
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 font-semibold">
                    <Clock className="w-4 h-4 text-[#0071e3]" />
                    <span>Daily Operating Window</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                        Opening Time
                      </label>
                      <input
                        type="time"
                        value={openingTime}
                        onChange={(e) => setOpeningTime(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:border-[#0071e3] outline-none text-neutral-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
                        Closing Time
                      </label>
                      <input
                        type="time"
                        value={closingTime}
                        onChange={(e) => setClosingTime(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:border-[#0071e3] outline-none text-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    Vehicles remaining parked past {closingTime} will incur the overnight surcharge when exiting next day.
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                  Operational Availability Status
                </h4>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/60">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-neutral-900 dark:text-white">
                      {isActive ? 'Facility Active & Accepting Drive-Ins' : 'Facility Temporarily Suspended'}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {isActive
                        ? 'Commuters can see live available bays and enter through the barrier gate.'
                        : 'Temporarily closes the barrier gate to incoming vehicles for maintenance.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {isActive ? 'Active' : 'Closed'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Capacity & Facility Info */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-in fade-in duration-150 text-xs">
              <div>
                <label className="block font-semibold mb-1.5 text-neutral-800 dark:text-neutral-200">
                  Public Parking Facility Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lotName}
                  onChange={(e) => setLotName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none text-neutral-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1.5 text-neutral-800 dark:text-neutral-200">
                  Total Bay Capacity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  required
                  value={totalCapacity}
                  onChange={(e) => setTotalCapacity(parseInt(e.target.value) || 1)}
                  className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Total drive-in parking bays physically demarcated on site
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1.5 text-neutral-800 dark:text-neutral-200">
                    Linked Transit Station Name <span className="text-neutral-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={nearestStationName}
                    onChange={(e) => setNearestStationName(e.target.value)}
                    placeholder="e.g. TAMAN MELATI"
                    className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none text-neutral-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1.5 text-neutral-800 dark:text-neutral-200">
                    Direct Walking Distance (Meters)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    value={distanceToStation ?? ''}
                    onChange={(e) =>
                      setDistanceToStation(e.target.value ? parseInt(e.target.value) : null)
                    }
                    placeholder="e.g. 76"
                    className="w-full h-10 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1.5 text-neutral-800 dark:text-neutral-200">
                  Facility Description & Commuter Notes <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe amenities (e.g. Covered bays, EV charging stations, CCTV monitored, direct covered walkway to station entrance)..."
                  className="w-full p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none text-neutral-900 dark:text-white resize-none"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 text-[11px] text-neutral-500 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-neutral-700 dark:text-neutral-300">Pinned Location</p>
                  <p>{lot.address}</p>
                  <p className="font-mono mt-0.5 text-neutral-400">
                    Lat: {lot.latitude.toFixed(6)}, Lon: {lot.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="h-10 px-6 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
