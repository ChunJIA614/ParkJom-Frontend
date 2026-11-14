import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Car,
  Clock,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Check,
  Shield,
  Layers,
  Settings,
  ArrowUpRight,
  LogOut,
  LogIn,
  UploadCloud,
  FileText,
  FileCheck,
  Search,
  MapPin,
  Train,
  Camera,
  Radio,
  Trash2,
  X,
  ExternalLink,
  Compass,
  Sliders,
} from 'lucide-react';
import {
  fetchOwnerPublicLots,
  createOwnerPublicLot,
  fetchOwnerLotSessions,
  recordPublicEntry,
  recordPublicExit,
  deletePublicLot,
  uploadPublicParkingPhoto,
  updateOwnerPublicLot,
} from '../api/publicParkingApi';
import type { PublicParkingLot, PublicParkingSession, CreatePublicParkingLotInput } from '../types';
import { DEFAULT_PUBLIC_PARKING_PHOTO, getPublicLotPhotoUrl } from '../types';
import { AppleCapacityBadge } from './AppleCapacityBadge';
import { AppleScannerView } from './AppleScannerView';
import { RegisterPublicParkingView } from './RegisterPublicParkingView';
import { ConfigurePublicParkingModal } from './ConfigurePublicParkingModal';
import SystemSelect from '@/components/ui/SystemSelect';

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf']);

// Haversine formula to compute meters between coordinates
function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const OwnerPublicParkingManager: React.FC = () => {
  const [lots, setLots] = useState<PublicParkingLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<PublicParkingLot | null>(null);
  const [activeSessions, setActiveSessions] = useState<PublicParkingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View mode: 'overview' or 'register'
  const [viewMode, setViewMode] = useState<'overview' | 'register'>('overview');
  const [scannerMode, setScannerMode] = useState<'entry' | 'exit' | null>(null);

  // Lot Deletion & Photo Management state
  const [deletingLot, setDeletingLot] = useState<PublicParkingLot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Dropdown selector state
  const [isLotDropdownOpen, setIsLotDropdownOpen] = useState(false);
  const [isConfigureModalOpen, setIsConfigureModalOpen] = useState(false);
  const lotDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (lotDropdownRef.current && !lotDropdownRef.current.contains(event.target as Node)) {
        setIsLotDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsLotDropdownOpen(false);
      }
    }
    if (isLotDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLotDropdownOpen]);

  const handleDeleteConfirm = async () => {
    if (!deletingLot) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      await deletePublicLot(deletingLot.publicParkingLotId);
      const remaining = lots.filter((l) => l.publicParkingLotId !== deletingLot.publicParkingLotId);
      setLots(remaining);
      setSelectedLot(remaining.length > 0 ? remaining[0] : null);
      setDeletingLot(null);
      setFeedback({ tone: 'success', message: `Public parking lot "${deletingLot.lotName}" deleted successfully.` });
    } catch (err) {
      setFeedback({ tone: 'danger', message: err instanceof Error ? err.message : 'Failed to delete public parking lot' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLot) return;
    setIsUploadingPhoto(true);
    setFeedback(null);
    try {
      const photoUrl = await uploadPublicParkingPhoto(file);
      const updated = await updateOwnerPublicLot(selectedLot.publicParkingLotId, {
        facilityPhotoUrl: photoUrl,
      });
      setSelectedLot(updated);
      setLots((prev) => prev.map((l) => (l.publicParkingLotId === updated.publicParkingLotId ? updated : l)));
      setFeedback({ tone: 'success', message: 'Facility photo updated successfully!' });
    } catch (err) {
      setFeedback({ tone: 'danger', message: err instanceof Error ? err.message : 'Failed to upload photo' });
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const loadLots = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOwnerPublicLots();
      setLots(data);
      if (data.length > 0) {
        if (!selectedLot || !data.some((l) => l.publicParkingLotId === selectedLot.publicParkingLotId)) {
          setSelectedLot(data[0]);
        } else {
          const fresh = data.find((l) => l.publicParkingLotId === selectedLot.publicParkingLotId);
          if (fresh) setSelectedLot(fresh);
        }
      } else {
        setSelectedLot(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load public parking lots');
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async (lotId: number) => {
    try {
      const sessions = await fetchOwnerLotSessions(lotId);
      setActiveSessions(sessions);
    } catch {
      setActiveSessions([]);
    }
  };

  useEffect(() => {
    void loadLots();
  }, []);

  useEffect(() => {
    if (selectedLot) {
      void loadSessions(selectedLot.publicParkingLotId);
      const interval = setInterval(() => {
        void loadSessions(selectedLot.publicParkingLotId);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [selectedLot?.publicParkingLotId]);

  const handleScanAction = async (plate: string) => {
    if (!selectedLot || !scannerMode) return;
    setLoading(true);
    setError(null);
    try {
      if (scannerMode === 'entry') {
        await recordPublicEntry(selectedLot.publicParkingLotId, plate);
      } else {
        await recordPublicExit(selectedLot.publicParkingLotId, plate);
      }
      setScannerMode(null);
      void loadLots();
      void loadSessions(selectedLot.publicParkingLotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scanner action failed');
    } finally {
      setLoading(false);
    }
  };

  const isSelectedApproved =
    selectedLot?.verificationStatus === 2 ||
    selectedLot?.verificationStatus === 'Approved';

  const isSelectedPending =
    !selectedLot?.verificationStatus ||
    selectedLot?.verificationStatus === 1 ||
    selectedLot?.verificationStatus === 'Pending';

  if (viewMode === 'register') {
    return (
      <RegisterPublicParkingView
        onBack={() => setViewMode('overview')}
        onSuccess={(created) => {
          setLots((prev) => [created, ...prev]);
          setSelectedLot(created);
          setViewMode('overview');
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="relative z-30 rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-[#0071e3]/10 text-[#0071e3]">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white">
                Public Parking Areas & Drive-In Facilities
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Commercial drive-in facilities with live bay counts and barrier gate control.
              </p>
            </div>
          </div>
        </div>

        {/* Top Control Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {lots.length > 0 && selectedLot && (
            <div className="relative" ref={lotDropdownRef}>
              <button
                type="button"
                id="owner-public-lot-selector"
                aria-haspopup="listbox"
                aria-expanded={isLotDropdownOpen}
                onClick={() => setIsLotDropdownOpen((prev) => !prev)}
                className={`h-10 px-3.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/10 border border-black/[0.06] dark:border-white/10 text-xs font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
                  isLotDropdownOpen ? 'ring-2 ring-[#0071e3]/30 border-[#0071e3]' : ''
                }`}
                title="Switch managed public facility"
              >
                <Car className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
                <span className="max-w-[130px] sm:max-w-[190px] truncate">{selectedLot.lotName}</span>
                {isSelectedApproved ? (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {selectedLot.availableSpaces}/{selectedLot.totalCapacity}
                  </span>
                ) : isSelectedPending ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                    Pending
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 shrink-0">
                    Rejected
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 shrink-0 ${
                    isLotDropdownOpen ? 'rotate-180 text-[#0071e3]' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isLotDropdownOpen && (
                <div
                  role="listbox"
                  aria-labelledby="owner-public-lot-selector"
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] z-50 rounded-2xl bg-white/98 dark:bg-[#18181C] border border-black/[0.08] dark:border-white/15 p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 space-y-1"
                >
                  <div className="px-3 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
                    <span>Switch Facility</span>
                    <span>{lots.length} Registered</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto no-scrollbar space-y-1 py-1">
                    {lots.map((lot) => {
                      const isSelected = selectedLot.publicParkingLotId === lot.publicParkingLotId;
                      const isApproved = lot.verificationStatus === 2 || lot.verificationStatus === 'Approved';
                      const isPending = !lot.verificationStatus || lot.verificationStatus === 1 || lot.verificationStatus === 'Pending';

                      return (
                        <button
                          key={lot.publicParkingLotId}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSelectedLot(lot);
                            setIsLotDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-xl text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#0071e3]/10 text-[#0071e3] dark:text-[#3894FF] font-semibold border border-[#0071e3]/20 shadow-2xs'
                              : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[#1d1d1f] dark:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-[#0071e3] text-white'
                                  : 'bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-400'
                              }`}
                            >
                              <Car className="w-3.5 h-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate leading-tight">
                                {lot.lotName}
                              </p>
                              <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                                {lot.nearestStationName
                                  ? `Near ${lot.nearestStationName}`
                                  : lot.address}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isApproved ? (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200/80">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {lot.availableSpaces}/{lot.totalCapacity}
                              </span>
                            ) : isPending ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200">
                                Pending
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200">
                                Rejected
                              </span>
                            )}

                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#3894FF] shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsLotDropdownOpen(false);
                        setViewMode('register');
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-[#0071e3] hover:bg-[#0071e3]/10 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Register Another Facility</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void loadLots()}
            className="h-10 px-3.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-black/[0.06] dark:border-white/10"
            title="Refresh lots and live capacity"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('register')}
            className="h-10 px-4 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white font-medium text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Facility</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state when fetching lots */}
      {loading && lots.length === 0 && (
        <div className="rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-12 sm:p-16 text-center shadow-sm backdrop-blur-xl flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#0071e3]" />
          <p className="text-xs text-neutral-500 font-medium">Loading public parking facilities...</p>
        </div>
      )}

      {/* Empty State when no registered public parking */}
      {!loading && lots.length === 0 && (
        <div className="rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-12 sm:p-16 shadow-sm backdrop-blur-xl text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-neutral-100 dark:bg-neutral-800/80 flex items-center justify-center text-neutral-400 dark:text-neutral-500 shadow-inner">
            <Layers className="w-8 h-8 opacity-60" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-lg font-bold tracking-tight text-[#1d1d1f] dark:text-white">
              No registered public parking yet
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Add your first parking area to set capacity, hourly rates, and connect barrier gates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('register')}
            className="mt-2 h-10 px-5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white font-medium text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Facility</span>
          </button>
        </div>
      )}

      {/* Action Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-medium border animate-in fade-in duration-150 ${
            feedback.tone === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Lot Dashboard */}
      {selectedLot && (
        <div className="relative z-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Live Status & Active Vehicles */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Occupancy Gauge Card */}
            <div className="rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm backdrop-blur-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white">
                      {selectedLot.lotName}
                    </h3>
                    {isSelectedApproved ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified & Approved</span>
                      </span>
                    ) : isSelectedPending ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pending Admin Verification</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Rejected</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                    <span>{selectedLot.address}</span>
                  </p>
                </div>

                {/* Right: Apple Status & Action Pill Segment */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <AppleCapacityBadge
                    available={selectedLot.availableSpaces}
                    total={selectedLot.totalCapacity}
                    size="md"
                    showPercent
                  />

                  {/* Unified Apple Action Pill Group */}
                  <div className="inline-flex items-center p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/10 gap-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setIsConfigureModalOpen(true)}
                      className="h-8 px-3 rounded-full bg-white dark:bg-[#2c2c2e] hover:bg-black/[0.02] dark:hover:bg-white/[0.08] text-[#1d1d1f] dark:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border border-black/[0.04] dark:border-white/[0.08] whitespace-nowrap active:scale-98"
                      title="Configure tariffs, pricing, operating hours, and capacity"
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#0071e3]" />
                      <span>Configure</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="h-8 px-3 rounded-full text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                      title="Change facility photo"
                    >
                      {isUploadingPhoto ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0071e3]" />
                      ) : (
                        <Camera className="w-3.5 h-3.5 text-neutral-500" />
                      )}
                      <span>{isUploadingPhoto ? 'Uploading…' : 'Photo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingLot(selectedLot)}
                      className="h-8 px-2.5 rounded-full text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 text-xs font-medium flex items-center justify-center transition-all cursor-pointer"
                      title="Delete this facility"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Facility Photo Preview */}
              <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 shadow-xs">
                <img
                  src={getPublicLotPhotoUrl(selectedLot.facilityPhotoUrl)}
                  alt={selectedLot.lotName}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== DEFAULT_PUBLIC_PARKING_PHOTO) {
                      target.src = DEFAULT_PUBLIC_PARKING_PHOTO;
                    }
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/75 text-white backdrop-blur-md border border-white/15 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-[#0071e3]" />
                  <span>Public Facility Preview</span>
                </div>
              </div>

              {/* Nearest transit link info & Pinned Coordinates */}
              {selectedLot.nearestStationName && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <Train className="w-4 h-4 text-[#0071e3]" />
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      Transit Station: <strong className="text-neutral-900 dark:text-white">{selectedLot.nearestStationName}</strong>
                    </span>
                    {selectedLot.distanceToStation && (
                      <span className="text-neutral-400 text-[11px]">
                        ({selectedLot.distanceToStation}m direct)
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10.5px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 shrink-0">
                    <Compass className="w-3.5 h-3.5 text-[#0071e3]" />
                    <span>Lat {selectedLot.latitude.toFixed(4)}, Lon {selectedLot.longitude.toFixed(4)}</span>
                  </div>
                </div>
              )}

              {/* Progress Bar & Live Status (Only active when Approved by Admin) */}
              {isSelectedApproved ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-neutral-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#0071e3]" />
                        <span>Live Occupancy Status</span>
                      </span>
                      <span>
                        {selectedLot.occupiedSpaces} of {selectedLot.totalCapacity} Bays Taken (
                        {Math.round((selectedLot.occupiedSpaces / selectedLot.totalCapacity) * 100)}%)
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          selectedLot.availableSpaces <= 0
                            ? 'bg-[#ff3b30]'
                            : selectedLot.availableSpaces <= 3
                            ? 'bg-[#ff9500]'
                            : 'bg-[#34c759]'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            (selectedLot.occupiedSpaces / selectedLot.totalCapacity) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* IoT Live Status & Barrier Gate Bar */}
                  <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                        <Radio className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#1d1d1f] dark:text-white">
                            IoT Barrier Gate Online & Connected
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            MQTT LIVE
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500">
                          Device UUID: {selectedLot.iotDeviceUuid || 'IOT-GATE-' + selectedLot.publicParkingLotId} • Broadcasting real-time spaces
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Live to Public</span>
                      </span>
                    </div>
                  </div>

                  {/* Quick Gate Scanner Actions */}
                  <div className="pt-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setScannerMode('entry')}
                      className="flex-1 h-11 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-98 text-white font-medium text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Scan Vehicle Entry</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScannerMode('exit')}
                      className="flex-1 h-11 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 active:scale-98 font-medium text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Scan Vehicle Exit</span>
                    </button>
                  </div>
                </>
              ) : isSelectedPending ? (
                /* Verification in progress card when pending admin review */
                <div className="rounded-2xl p-5 bg-amber-500/10 border border-amber-500/20 text-xs space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                          Pending Admin Verification
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          Under Review
                        </span>
                      </div>
                      <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                        This facility is currently under review by ParkJom administrators. Once approved, the IoT barrier gate will activate automatically and live availability will begin streaming to commuters.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-amber-500/15 flex flex-wrap gap-4 text-[11px] text-amber-900/70 dark:text-amber-300/70 font-medium">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Submitted Document: {selectedLot.verificationDocumentType || 'Commercial Parking License'}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>IoT Gate will activate on approval</span>
                    </span>
                  </div>
                </div>
              ) : (
                /* Rejection card */
                <div className="rounded-2xl p-5 bg-rose-500/10 border border-rose-500/20 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Application Rejected by Admin</span>
                  </div>
                  <p className="text-rose-600/90 dark:text-rose-400/90 leading-relaxed">
                    Reason: {selectedLot.adminReviewNotes || 'The submitted documents or photos did not meet compliance requirements.'}
                  </p>
                </div>
              )}
            </div>

            {/* Currently Parked Vehicles Table (Only shown when approved) */}
            {isSelectedApproved && (
              <div className="rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold tracking-tight text-[#1d1d1f] dark:text-white">
                    Currently Parked Vehicles
                  </h4>
                  <p className="text-xs text-neutral-500">Live active sessions awaiting exit</p>
                </div>
                <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800">
                  {activeSessions.length} Vehicles
                </span>
              </div>

              {activeSessions.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 space-y-2">
                  <Car className="w-8 h-8 mx-auto opacity-30" />
                  <p className="text-xs">No vehicles currently parked in this lot.</p>
                </div>
              ) : (
                <div className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                  {activeSessions.map((session) => (
                    <div
                      key={session.publicParkingSessionId}
                      className="py-3.5 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-xl bg-black dark:bg-neutral-800 text-white font-mono text-sm font-bold tracking-wider">
                          {session.carPlateNumber}
                        </span>
                        <div>
                          <span className="text-xs font-mono text-neutral-400">
                            #{session.sessionCode}
                          </span>
                          <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              In:{' '}
                              {new Date(session.entryTimeUtc).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-sm font-bold">
                          RM {session.totalAmount.toFixed(2)}
                        </span>
                        <div className="mt-0.5">
                          {session.isPaid ? (
                            <span className="text-[10px] font-semibold text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded-full">
                              Paid
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                              Parked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>

          {/* Right Col: Lot Settings & Verification Inspector */}
          <div className="space-y-6">
            <div className="rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-neutral-400" />
                  <h4 className="text-sm font-bold tracking-tight text-[#1d1d1f] dark:text-white">
                    Facility Tariffs & Standards
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfigureModalOpen(true)}
                  className="text-xs font-semibold text-[#0071e3] hover:underline flex items-center gap-1 cursor-pointer"
                  title="Configure prices and hours"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure</span>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <span className="text-neutral-500">Operating Mode</span>
                  <span className="font-semibold text-[#1d1d1f] dark:text-white">
                    {selectedLot.operatingType === 1 || selectedLot.operatingType === 'Unlimited24Hours'
                      ? '24/7 Unlimited'
                      : `${selectedLot.openingTime} - ${selectedLot.closingTime}`}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <span className="text-neutral-500">Hourly Rate</span>
                  <span className="font-mono font-semibold text-[#1d1d1f] dark:text-white">
                    {selectedLot.flatRatePerEntry
                      ? `Flat RM ${selectedLot.flatRatePerEntry.toFixed(2)}/entry`
                      : `RM ${selectedLot.hourlyRate.toFixed(2)}/hr`}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <span className="text-neutral-500">Daily Cap Max</span>
                  <span className="font-mono font-semibold text-[#1d1d1f] dark:text-white">
                    {selectedLot.dailyCapRate ? `RM ${selectedLot.dailyCapRate.toFixed(2)}` : 'None'}
                  </span>
                </div>

                {Boolean(selectedLot.overnightSurcharge && selectedLot.overnightSurcharge > 0) && (
                  <div className="flex justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-neutral-500">Overnight Surcharge</span>
                    <span className="font-mono font-semibold text-[#ff9500]">
                      RM {selectedLot.overnightSurcharge?.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <span className="text-neutral-500">Drop-off Free Grace</span>
                  <span className="font-semibold text-[#1d1d1f] dark:text-white">
                    {selectedLot.initialGraceMinutes} mins
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <span className="text-neutral-500">Exit Window After Pay</span>
                  <span className="font-semibold text-[#1d1d1f] dark:text-white">
                    {selectedLot.exitGraceMinutes} mins
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsConfigureModalOpen(true)}
                    className="w-full h-9 rounded-xl bg-[#0071e3]/10 hover:bg-[#0071e3]/15 text-[#0071e3] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Configure Tariffs & Hours</span>
                  </button>
                </div>

                {/* Verification Document Details */}
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-neutral-400 block mb-1.5 uppercase tracking-wider">
                    Verification Standard
                  </span>
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Document Type:</span>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {selectedLot.verificationDocumentType || 'Commercial Parking License'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Status:</span>
                      <span className="font-semibold">
                        {isSelectedApproved
                          ? 'Approved'
                          : isSelectedPending
                          ? 'Under Admin Review'
                          : 'Rejected'}
                      </span>
                    </div>
                    {selectedLot.adminReviewNotes && (
                      <p className="text-[11px] text-neutral-500 pt-1 border-t border-black/5 dark:border-white/5">
                        Admin Note: {selectedLot.adminReviewNotes}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Public Payment Link Preview (Only when approved) */}
              {isSelectedApproved && (
                <div className="pt-2">
                  <a
                    href={`/public-pay?lot=${selectedLot.publicParkingLotId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>Open Commuter Drive-Out Screen</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input for Facility Photo Upload */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Owner Delete Facility Confirmation Modal */}
      {deletingLot && (
        <div className="fixed inset-0 z-[1500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Delete Public Parking Lot?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete <strong>{deletingLot.lotName}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-neutral-500">Facility:</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{deletingLot.lotName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Address:</span>
                <span className="truncate max-w-[200px] text-neutral-800 dark:text-neutral-200">{deletingLot.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Total Bays:</span>
                <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{deletingLot.totalCapacity} bays</span>
              </div>
            </div>

            <p className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-xl border border-rose-200 dark:border-rose-500/20">
              This action cannot be undone. All active sessions, tariffs, and transit map listings for this facility will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLot(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/15 text-neutral-800 dark:text-white text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting…' : 'Delete Facility'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Facility Configuration Modal */}
      {isConfigureModalOpen && selectedLot && (
        <ConfigurePublicParkingModal
          lot={selectedLot}
          isOpen={isConfigureModalOpen}
          onClose={() => setIsConfigureModalOpen(false)}
          onUpdated={(updatedLot) => {
            setSelectedLot(updatedLot);
            setLots((prev) =>
              prev.map((l) =>
                l.publicParkingLotId === updatedLot.publicParkingLotId ? updatedLot : l
              )
            );
            setFeedback({
              tone: 'success',
              message: `Facility "${updatedLot.lotName}" configuration updated successfully!`,
            });
          }}
        />
      )}

      {/* ─── Optical Scanner Modal (Portaled to document.body) ─── */}
      {scannerMode &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[1500] flex flex-col bg-black/95 text-white backdrop-blur-2xl select-none animate-in fade-in duration-200">
            <AppleScannerView
              title={scannerMode === 'entry' ? 'Scan Vehicle Check-In' : 'Scan Vehicle Check-Out'}
              subtitle={`Lot: ${selectedLot?.lotName ?? ''}`}
              onScanPlate={handleScanAction}
              onClose={() => setScannerMode(null)}
            />
          </div>,
          document.body
        )}
    </div>
  );
};
