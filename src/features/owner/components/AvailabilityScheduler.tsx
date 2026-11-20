import { Popover } from '@base-ui/react/popover';
import SystemSelect from '@/components/ui/SystemSelect';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CalendarDays,
  CalendarRange,
  Car,
  Check,
  CheckCircle2,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  FileText,
  GripVertical,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  Umbrella,
  Accessibility,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { showAlert, showConfirm } from '@/components/common/ModalProvider';
import {
  closeParkingAvailabilityDates,
  createParkingAvailabilityRules,
  deleteParkingImage,
  getOwnerAvailabilityCalendar,
  updateParkingConfiguration,
  updateParkingImageOrder,
  updateParkingPublication,
  uploadParkingImages,
} from '../api/parkingApi';
import type {
  Booking,
  ParkingActionResult,
  ParkingBay,
  ParkingAvailabilityCalendarHours,
  ParkingAvailabilityCalendarResponse,
  ParkingAvailabilityRulesResponse,
  ParkingConfigurationPayload,
  ParkingConfigurationResponse,
  ParkingImagesResponse,
  ParkingSpotImage,
} from '../types';
import { computeClientSpotRecommendation } from '../api/dynamicPricingApi';
import AiPricingAdvisorCard from './AiPricingAdvisorCard';
import AvailabilityRangeEditor, { type AvailabilityRangeDraft } from './AvailabilityRangeEditor';

/**
 * Local owner parking workspace storage.  The shape is deliberately JSON
 * friendly so it can later be replaced by the owner API without changing the
 * timetable's UI model.
 */
export const OWNER_PARKING_WORKSPACE_STORAGE_KEY = 'parkjom_owner_parking_workspace_v1';

export type ParkingDayStatus = 'available' | 'unavailable' | 'booked';

export interface OwnerParkingBooking {
  id?: string;
  commuterName?: string;
  commuterPhone?: string;
  vehicle?: string;
  bookedAt?: string;
}

export interface OwnerParkingDay {
  status: ParkingDayStatus;
  configuredHours?: ParkingAvailabilityCalendarHours[];
  booking?: OwnerParkingBooking;
  ownerOverride?: 'closed';
}

export interface OwnerParkingSetup {
  photos: string[];
  images: ParkingSpotImage[];
  description: string;
  accessInstructions: string;
  dailyRate: number | null;
  monthlyRate: number | null;
  hasEvCharging: boolean;
  evChargingSpeed: string;
  isCovered: boolean;
  isHandicapAccessible: boolean;
  hasCctv: boolean;
  published: boolean;
  updatedAt?: string;
}

export interface OwnerParkingWorkspaceSpot {
  setup: OwnerParkingSetup;
  days: Record<string, OwnerParkingDay>;
}

export interface OwnerParkingWorkspace {
  version: 1;
  spots: Record<string, OwnerParkingWorkspaceSpot>;
}

export interface AvailabilitySchedulerProps {
  bays: ParkingBay[];
  initialParkingSpotId?: number;
  initialSection?: 'setup' | 'timetable';
  rangeEditorOpen: boolean;
  onOpenRangeEditor: (parkingSpotId: number) => void;
  onCloseRangeEditor: () => void;
  onScheduleChange?: () => void;
  bookings?: Booking[];
  onDeleteParking?: (parkingSpotId: number) => Promise<ParkingActionResult>;
}

const MAX_PHOTOS = 6;
const MAX_BULK_DAYS = 366;
const DEFAULT_RANGE_HOURS = { fromTime: '09:00', toTime: '19:00' };
const SETUP_STEPS = ['Photos', 'Description', 'Pricing', 'Review', 'Publish'] as const;
type SetupStep = 1 | 2 | 3 | 4 | 5;

function newRangeDraft(date: string): AvailabilityRangeDraft {
  return { start: date, end: date, ...DEFAULT_RANGE_HOURS, dayPattern: 'Weekdays', status: 'available' };
}

const statusMeta: Record<ParkingDayStatus, {
  label: string;
  shortLabel: string;
  icon: typeof CheckCircle2;
  cell: string;
  badge: string;
  dot: string;
}> = {
  available: {
    label: 'Available for booking',
    shortLabel: 'Open',
    icon: CheckCircle2,
    cell: 'text-emerald-700',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  unavailable: {
    label: 'Not available for booking',
    shortLabel: 'Closed',
    icon: Ban,
    cell: 'text-slate-500',
    badge: 'border-slate-200 bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
  },
  booked: {
    label: 'Booked by commuter',
    shortLabel: 'Booked',
    icon: Lock,
    cell: 'text-blue-700',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
  },
};

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normaliseStatus(value: unknown): ParkingDayStatus {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'available' || status === 'open' || status === 'active') return 'available';
  if (status === 'booked' || status === 'reserved' || status === 'occupied') return 'booked';
  return 'unavailable';
}

function normaliseBooking(value: unknown): OwnerParkingBooking | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  return {
    id: typeof candidate.id === 'string' ? candidate.id : undefined,
    commuterName: typeof candidate.commuterName === 'string' ? candidate.commuterName : undefined,
    commuterPhone: typeof candidate.commuterPhone === 'string' ? candidate.commuterPhone : undefined,
    vehicle: typeof candidate.vehicle === 'string' ? candidate.vehicle : undefined,
    bookedAt: typeof candidate.bookedAt === 'string' ? candidate.bookedAt : undefined,
  };
}

function normaliseConfiguredHours(value: unknown): ParkingAvailabilityCalendarHours[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    return typeof candidate.from === 'string' && typeof candidate.to === 'string'
      ? [{ from: candidate.from, to: candidate.to }]
      : [];
  });
}

function normaliseParkingImage(value: unknown): ParkingSpotImage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const parkingSpotImageId = safeNumber(candidate.parkingSpotImageId);
  const mediaFileId = safeNumber(candidate.mediaFileId);
  const displayOrder = safeNumber(candidate.displayOrder);
  if (
    parkingSpotImageId === null
    || mediaFileId === null
    || displayOrder === null
    || typeof candidate.secureUrl !== 'string'
    || !candidate.secureUrl.trim()
  ) return null;
  return {
    parkingSpotImageId,
    mediaFileId,
    secureUrl: candidate.secureUrl,
    originalFileName: typeof candidate.originalFileName === 'string' ? candidate.originalFileName : '',
    displayOrder,
    isPrimary: Boolean(candidate.isPrimary),
  };
}

function normaliseParkingImages(images: unknown[]): ParkingSpotImage[] {
  return images
    .map(normaliseParkingImage)
    .filter((image): image is ParkingSpotImage => image !== null)
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .slice(0, MAX_PHOTOS);
}

function setupFromBay(bay?: ParkingBay): OwnerParkingSetup {
  const images = normaliseParkingImages(bay?.images ?? []);
  const dailyRate = safeNumber(bay?.dailyRate);
  const monthlyRate = safeNumber(bay?.monthlyRate);
  return {
    photos: images.map((image) => image.secureUrl),
    images,
    description: bay?.configurationDescription ?? '',
    accessInstructions: '',
    dailyRate: dailyRate !== null && dailyRate > 0 ? dailyRate : null,
    monthlyRate: monthlyRate !== null && monthlyRate > 0 ? monthlyRate : null,
    hasEvCharging: Boolean(bay?.hasEvCharging),
    evChargingSpeed: typeof bay?.evChargingSpeed === 'string' ? bay.evChargingSpeed : '',
    isCovered: Boolean(bay?.isCovered),
    isHandicapAccessible: Boolean(bay?.isHandicapAccessible),
    hasCctv: Boolean(bay?.hasCctv),
    published: Boolean(bay?.isPublished),
  };
}

function seedDaysFromBay(bay?: ParkingBay): Record<string, OwnerParkingDay> {
  if (!bay) return {};
  const status = String(bay.availabilityStatus ?? '').trim().toLowerCase();
  if (status !== 'reserved' && status !== 'occupied' && status !== 'booked') return {};
  const date = localDateKey();
  return {
    [date]: {
      status: 'booked',
      booking: {
        id: `mock-${bay.parkingSpotId}-${date}`,
        commuterName: 'Current commuter booking',
        vehicle: 'Booking details from backend',
      },
    },
  };
}

function normaliseSetup(value: unknown, bay?: ParkingBay): OwnerParkingSetup {
  const fallback = setupFromBay(bay);
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Record<string, unknown>;
  const photos = bay?.images === undefined && Array.isArray(candidate.photos)
    ? candidate.photos.filter((photo): photo is string => typeof photo === 'string').slice(0, MAX_PHOTOS)
    : fallback.photos;
  const images = bay?.images === undefined && Array.isArray(candidate.images)
    ? normaliseParkingImages(candidate.images)
    : fallback.images;
  return {
    photos,
    images,
    description: bay?.configurationDescription !== undefined
      ? fallback.description
      : typeof candidate.description === 'string' ? candidate.description : fallback.description,
    accessInstructions: typeof candidate.accessInstructions === 'string'
      ? candidate.accessInstructions
      : fallback.accessInstructions,
    dailyRate: bay
      ? fallback.dailyRate
      : candidate.dailyRate === undefined ? fallback.dailyRate : safeNumber(candidate.dailyRate),
    monthlyRate: bay
      ? fallback.monthlyRate
      : candidate.monthlyRate === undefined ? fallback.monthlyRate : safeNumber(candidate.monthlyRate),
    hasEvCharging: bay && typeof bay.hasEvCharging === 'boolean'
      ? bay.hasEvCharging
      : typeof candidate.hasEvCharging === 'boolean' ? candidate.hasEvCharging : fallback.hasEvCharging,
    evChargingSpeed: bay?.evChargingSpeed !== undefined
      ? fallback.evChargingSpeed
      : typeof candidate.evChargingSpeed === 'string' ? candidate.evChargingSpeed : fallback.evChargingSpeed,
    isCovered: bay && typeof bay.isCovered === 'boolean'
      ? bay.isCovered
      : typeof candidate.isCovered === 'boolean' ? candidate.isCovered : fallback.isCovered,
    isHandicapAccessible: bay && typeof bay.isHandicapAccessible === 'boolean'
      ? bay.isHandicapAccessible
      : typeof candidate.isHandicapAccessible === 'boolean' ? candidate.isHandicapAccessible : fallback.isHandicapAccessible,
    hasCctv: bay && typeof bay.hasCctv === 'boolean'
      ? bay.hasCctv
      : typeof candidate.hasCctv === 'boolean' ? candidate.hasCctv : fallback.hasCctv,
    published: bay
      ? Boolean(bay.isPublished)
      : typeof candidate.published === 'boolean' ? candidate.published : fallback.published,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
  };
}

function normaliseSpot(value: unknown, bay?: ParkingBay): OwnerParkingWorkspaceSpot {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawDays = candidate.days && typeof candidate.days === 'object'
    ? candidate.days as Record<string, unknown>
    : {};
  const days: Record<string, OwnerParkingDay> = {};
  Object.entries(rawDays).forEach(([date, rawDay]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !rawDay || typeof rawDay !== 'object') return;
    const day = rawDay as Record<string, unknown>;
    const dayStatus = normaliseStatus(day.status);
    days[date] = {
      status: dayStatus,
      configuredHours: normaliseConfiguredHours(day.configuredHours),
      booking: dayStatus === 'booked' ? normaliseBooking(day.booking) : undefined,
      ownerOverride: day.ownerOverride === 'closed' ? 'closed' : undefined,
    };
  });
  const seeded = seedDaysFromBay(bay);
  Object.entries(seeded).forEach(([date, day]) => {
    if (!days[date] || days[date].status !== 'booked') days[date] = day;
  });
  return { setup: normaliseSetup(candidate.setup, bay), days };
}

function rawWorkspace(): OwnerParkingWorkspace {
  if (typeof window === 'undefined') return { version: 1, spots: {} };
  try {
    const saved = window.localStorage.getItem(OWNER_PARKING_WORKSPACE_STORAGE_KEY);
    if (!saved) return { version: 1, spots: {} };
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return { version: 1, spots: {} };
    const candidate = parsed as Record<string, unknown>;
    const rawSpots = candidate.spots && typeof candidate.spots === 'object'
      ? candidate.spots as Record<string, unknown>
      : {};
    const spots: Record<string, OwnerParkingWorkspaceSpot> = {};
    Object.entries(rawSpots).forEach(([id, value]) => {
      if (/^\d+$/.test(id)) spots[id] = normaliseSpot(value);
    });
    return { version: 1, spots };
  } catch {
    return { version: 1, spots: {} };
  }
}

function mergeWorkspaceWithBays(workspace: OwnerParkingWorkspace, bays: ParkingBay[]): OwnerParkingWorkspace {
  const spots = { ...workspace.spots };
  bays.forEach((bay) => {
    const id = String(bay.parkingSpotId);
    const existing = spots[id];
    spots[id] = normaliseSpot(existing, bay);
  });
  return { version: 1, spots };
}

/** Read the persisted workspace, optionally adding the current bays as defaults. */
export function getOwnerParkingWorkspace(bays: ParkingBay[] = []): OwnerParkingWorkspace {
  return mergeWorkspaceWithBays(rawWorkspace(), bays);
}

/** Return a persisted day status for dashboard summaries. Unspecified days are unavailable by default. */
export function getStoredParkingDayStatus(
  parkingSpotId: number,
  date: string = localDateKey(),
): ParkingDayStatus {
  const workspace = getOwnerParkingWorkspace();
  return workspace.spots[String(parkingSpotId)]?.days[date]?.status ?? 'unavailable';
}

export function getStoredParkingDay(
  parkingSpotId: number,
  date: string = localDateKey(),
): OwnerParkingDay {
  const workspace = getOwnerParkingWorkspace();
  return workspace.spots[String(parkingSpotId)]?.days[date] ?? { status: 'unavailable' };
}

/** Local calendar key; intentionally avoids UTC conversion around midnight. */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function dateKeyIsPast(key: string): boolean {
  return key < localDateKey();
}

function dateMatchesDayPattern(key: string, dayPattern: string): boolean {
  const day = dateFromKey(key).getDay();
  const normalized = dayPattern.trim().toLowerCase().replace(/\s+/g, '');
  if (normalized === 'weekdays' || normalized === 'weekday') return day >= 1 && day <= 5;
  if (normalized === 'weekends' || normalized === 'weekend') return day === 0 || day === 6;
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  if (normalized === dayNames[day] || normalized === `${dayNames[day]}s`) return true;
  if (dayNames.some((name) => normalized === name || normalized === `${name}s`)) return false;
  return true;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function inclusiveDateKeys(start: string, end: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return [];
  const first = dateFromKey(start);
  const last = dateFromKey(end);
  if (localDateKey(first) !== start || localDateKey(last) !== end || first > last) return [];
  const result: string[] = [];
  let cursor = first;
  while (cursor.getTime() <= last.getTime() && result.length <= MAX_BULK_DAYS) {
    result.push(localDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return result;
}

function formatLongDate(key: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateFromKey(key));
}

function formatShortDate(key: string): string {
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short' }).format(dateFromKey(key));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read image'));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToImageFile(dataUrl: string, index: number): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Invalid image preview data.');
  const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1] || 'jpg';
  return new File([blob], `parking-image-${index + 1}.${extension}`, { type: blob.type });
}

function validPhoto(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'webp'].includes(extension)
    && (!file.type || ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
}

function bayLabel(bay: ParkingBay): string {
  return `${bay.bayNumber || bay.parkingLabel || `Spot #${bay.parkingSpotId}`} · ${bay.propertyName || `Property #${bay.propertyId}`}`;
}

function ParkingSectionHeading({ title, description, headingRef }: {
  title: string;
  description: string;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="space-y-1">
      <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="text-lg font-bold tracking-tight text-slate-950 dark:text-white sm:text-xl">{title}</h2>
      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm">{description}</p>
    </div>
  );
}

function SaveTick({ message }: { message: string }) {
  return (
    <span role="status" className="inline-flex size-7 shrink-0 items-center justify-center text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="size-4" aria-hidden="true" />
      <span className="sr-only">{message}</span>
    </span>
  );
}

function statusFor(spot: OwnerParkingWorkspaceSpot | undefined, date: string): OwnerParkingDay {
  return spot?.days[date] ?? { status: 'unavailable' };
}

function setupFromSpot(spot: OwnerParkingWorkspaceSpot | undefined, bay?: ParkingBay): OwnerParkingSetup {
  return spot?.setup ?? setupFromBay(bay);
}

function toSetupForm(setup: OwnerParkingSetup) {
  const { images, published, updatedAt, dailyRate, monthlyRate, ...fields } = setup;
  return {
    ...fields,
    dailyRate: dailyRate === null ? '' : String(dailyRate),
    monthlyRate: monthlyRate === null ? '' : String(monthlyRate),
  };
}

function toConfigurationPayload(setup: OwnerParkingSetup): ParkingConfigurationPayload {
  return {
    description: setup.description.trim(),
    dailyRate: setup.dailyRate ?? 0,
    monthlyRate: setup.monthlyRate ?? 0,
    hasEvCharging: setup.hasEvCharging,
    evChargingSpeed: setup.hasEvCharging ? setup.evChargingSpeed : null,
    isCovered: setup.isCovered,
    isHandicapAccessible: setup.isHandicapAccessible,
    hasCctv: setup.hasCctv,
  };
}

function rateText(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `RM ${value.toFixed(2)}`;
}

function hasInvalidRates(rates: Pick<OwnerParkingSetup, 'dailyRate' | 'monthlyRate'>, saved: OwnerParkingSetup): boolean {
  return (['dailyRate', 'monthlyRate'] as const).some((field) => {
    const rate = rates[field];
    return rate !== null && (!Number.isFinite(rate) || rate <= 0 || (rate < 1 && rate !== saved[field]));
  });
}

function setupCompletion(setup: OwnerParkingSetup, saved: OwnerParkingSetup): { complete: boolean; issues: string[] } {
  const issues: string[] = [];
  const hasInvalidRate = hasInvalidRates(setup, saved);
  if (setup.photos.length === 0) issues.push('Add at least one parking photo.');
  if (!setup.description.trim()) issues.push('Add a short parking description.');
  if (hasInvalidRate) issues.push('Enter a valid positive rate.');
  if (!hasInvalidRate && (setup.dailyRate ?? 0) <= 0 && (setup.monthlyRate ?? 0) <= 0) issues.push('Set a daily or monthly rate.');
  return { complete: issues.length === 0, issues };
}

const calmMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.8 },
};

export default function AvailabilityScheduler({
  bays,
  initialParkingSpotId,
  initialSection = 'setup',
  rangeEditorOpen,
  onOpenRangeEditor,
  onCloseRangeEditor,
  onScheduleChange,
  bookings = [],
  onDeleteParking,
}: AvailabilitySchedulerProps) {
  const { user } = useAuth();
  const todayKey = localDateKey();
  const [workspace, setWorkspace] = useState<OwnerParkingWorkspace>(() => getOwnerParkingWorkspace(bays));
  const [selectedBayId, setSelectedBayId] = useState<string>(() => {
    const preferred = initialParkingSpotId && bays.find((bay) => bay.parkingSpotId === initialParkingSpotId);
    return String(preferred?.parkingSpotId ?? bays[0]?.parkingSpotId ?? '');
  });
  const [section, setSection] = useState<'setup' | 'timetable'>(initialSection);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = dateFromKey(todayKey);
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [setupStep, setSetupStep] = useState<SetupStep>(1);
  const [completedSetupSteps, setCompletedSetupSteps] = useState<Set<SetupStep>>(() => new Set());
  const [setupDraft, setSetupDraft] = useState<Partial<ReturnType<typeof toSetupForm>>>({});
  const [pendingPhotoCount, setPendingPhotoCount] = useState(0);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSaving, setSetupSaving] = useState(false);
  const savedConfigurations = useRef(new Map<number, { sourceUpdatedAt: string; payload: ParkingConfigurationPayload }>());
  const [imagesUploading, setImagesUploading] = useState(false);
  const [imagesReordering, setImagesReordering] = useState(false);
  const [imageDeletingId, setImageDeletingId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const [rangeDraft, setRangeDraft] = useState(() => newRangeDraft(todayKey));
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarTimeZone, setCalendarTimeZone] = useState('Asia/Kuala_Lumpur');
  const [daySaving, setDaySaving] = useState(false);
  const [dayMessage, setDayMessage] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [deletingSpot, setDeletingSpot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const pendingImageFilesRef = useRef<Map<string, File>>(new Map());
  const calendarRequestRef = useRef(0);
  const timetableHeadingRef = useRef<HTMLHeadingElement>(null);
  const wasRangeEditorOpen = useRef(rangeEditorOpen);
  const prefersReducedMotion = useReducedMotion();

  const activeBay = rangeEditorOpen && initialParkingSpotId
    ? bays.find((bay) => bay.parkingSpotId === initialParkingSpotId)
    : bays.find((bay) => String(bay.parkingSpotId) === selectedBayId) ?? bays[0];
  const activeSpotId = activeBay ? String(activeBay.parkingSpotId) : '';
  const activeSpot = activeSpotId ? workspace.spots[activeSpotId] : undefined;
  const activeSetup = setupFromSpot(activeSpot, activeBay);
  const setupForm = { ...toSetupForm(activeSetup), ...setupDraft };
  const aiPricingRecommendation = useMemo(() => {
    if (!activeBay || section !== 'setup' || setupStep !== 3 || rangeEditorOpen) return null;
    const candidateDaily = setupForm.dailyRate ? Number(setupForm.dailyRate) : null;
    return computeClientSpotRecommendation(
      activeBay,
      candidateDaily && Number.isFinite(candidateDaily) && candidateDaily > 0 ? candidateDaily : null,
    );
  }, [activeBay, section, setupStep, rangeEditorOpen, setupForm.dailyRate]);
  const displayedMonth = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`;
  const setupBusy = setupSaving
    || imagesUploading
    || imagesReordering
    || imageDeletingId !== null
    || publishing
    || availabilitySaving
    || daySaving;

  useEffect(() => {
    setWorkspace((current) => mergeWorkspaceWithBays(current, bays));
  }, [bays]);

  useEffect(() => {
    if (bays.length === 0) {
      setSelectedBayId('');
      return;
    }
    const preferred = initialParkingSpotId && bays.find((bay) => bay.parkingSpotId === initialParkingSpotId);
    const preferredId = String(preferred?.parkingSpotId ?? bays[0].parkingSpotId);
    if (!bays.some((bay) => String(bay.parkingSpotId) === selectedBayId)) setSelectedBayId(preferredId);
  }, [bays, initialParkingSpotId, selectedBayId]);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useLayoutEffect(() => {
    if (wasRangeEditorOpen.current && !rangeEditorOpen) timetableHeadingRef.current?.focus({ preventScroll: true });
    wasRangeEditorOpen.current = rangeEditorOpen;
  }, [rangeEditorOpen]);

  useEffect(() => {
    if (!selectedBayId) return;
    setSetupDraft({});
    setSetupStep(1);
    setCompletedSetupSteps(new Set());
    setSetupMessage(null);
    setSetupError(null);
    setPendingPhotoCount(0);
    setSelectedPhotoIndex(null);
    setDraggedPhotoIndex(null);
    setSelectedDate(todayKey);
    setRangeDraft(newRangeDraft(todayKey));
    setBulkMessage(null);
    setBulkError(null);
    setCalendarError(null);
    setDaySaving(false);
    setDayMessage(null);
    setDayError(null);
  }, [selectedBayId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(OWNER_PARKING_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // Storage can be unavailable in private browsing; the in-memory editor still works.
    }
  }, [workspace]);

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  const notifyChange = useCallback(() => {
    onScheduleChange?.();
  }, [onScheduleChange]);

  const updateWorkspace = useCallback((updater: (current: OwnerParkingWorkspace) => OwnerParkingWorkspace) => {
    setWorkspace(updater);
    notifyChange();
  }, [notifyChange]);

  const fetchAvailabilityCalendar = useCallback(async (month = displayedMonth) => {
    const parkingSpotId = activeBay?.parkingSpotId;
    const token = user?.token ?? '';
    if (!parkingSpotId || !activeSpotId) return;
    if (!token) {
      setCalendarLoading(false);
      setCalendarError('Your owner session is missing an authorization token.');
      return;
    }

    const requestId = calendarRequestRef.current + 1;
    calendarRequestRef.current = requestId;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const response = await getOwnerAvailabilityCalendar(token, parkingSpotId, month);
      const body = await response.json().catch(() => null) as ParkingAvailabilityCalendarResponse | null;
      if (!response.ok || !body?.success || !Array.isArray(body.days)) {
        throw new Error(body?.message || `Unable to retrieve the availability calendar (${response.status}).`);
      }
      if (calendarRequestRef.current !== requestId) return;

      setWorkspace((current) => {
        const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
        const days = { ...spot.days };
        Object.keys(days).forEach((date) => {
          if (date.startsWith(`${body.month}-`)) delete days[date];
        });
        body.days.forEach((day) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !day.date.startsWith(`${body.month}-`)) return;
          const status = normaliseStatus(day.status);
          days[day.date] = {
            status,
            configuredHours: normaliseConfiguredHours(day.configuredHours),
          };
        });
        return {
          ...current,
          spots: { ...current.spots, [activeSpotId]: { ...spot, days } },
        };
      });

      if (calendarRequestRef.current === requestId) {
        setCalendarTimeZone(body.timeZone || 'Asia/Kuala_Lumpur');
      }
    } catch (error) {
      if (calendarRequestRef.current === requestId) {
        setCalendarError(error instanceof Error ? error.message : 'Unable to retrieve the availability calendar.');
      }
    } finally {
      if (calendarRequestRef.current === requestId) setCalendarLoading(false);
    }
  }, [activeBay, activeSpotId, displayedMonth, user?.token]);

  useEffect(() => {
    if (section === 'timetable') void fetchAvailabilityCalendar();
  }, [fetchAvailabilityCalendar, section]);

  const replaceSetupForm = <K extends keyof typeof setupForm>(field: K, value: (typeof setupForm)[K]) => {
    setSetupDraft((current) => ({ ...current, [field]: value }));
    setSetupMessage(null);
    setSetupError(null);
  };

  const replaceRate = (field: 'dailyRate' | 'monthlyRate', value: string) => {
    if (!/^\d*(?:\.\d{0,2})?$/.test(value)) return;
    replaceSetupForm(field, value);
  };

  const adjustRate = (field: 'dailyRate' | 'monthlyRate', amount: number) => {
    const currentValue = Number(setupForm[field]);
    const baseValue = Number.isFinite(currentValue) && currentValue >= 1 ? currentValue : 0;
    const nextValue = Math.max(1, Number((baseValue + amount).toFixed(2)));
    replaceSetupForm(field, String(nextValue));
  };

  const addPhotoFiles = async (files: File[]) => {
    if (!activeSpotId || files.length === 0) return;
    const invalid = files.find((file) => !validPhoto(file));
    if (invalid) {
      setSetupError('Photos must be JPG, JPEG, PNG, or WEBP images.');
      return;
    }
    const available = Math.max(0, MAX_PHOTOS - setupForm.photos.length);
    if (available === 0) {
      setSetupError(`You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const selected = files.slice(0, available);
    const objectUrls = selected.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      return url;
    });
    setSetupDraft((current) => ({
      ...current,
      photos: [...(current.photos ?? activeSetup.photos), ...objectUrls].slice(0, MAX_PHOTOS),
    }));
    setPendingPhotoCount((count) => count + selected.length);
    setSetupError(files.length > selected.length ? `Only ${MAX_PHOTOS} photos can be kept; extra files were skipped.` : null);

    try {
      const dataUrls = await Promise.all(selected.map((file) => fileToDataUrl(file)));
      const replacements = new Map(objectUrls.map((url, index) => [url, dataUrls[index]]));
      dataUrls.forEach((dataUrl, index) => pendingImageFilesRef.current.set(dataUrl, selected[index]));
      setSetupDraft((current) => current.photos ? {
        ...current,
        photos: current.photos.map((photo) => replacements.get(photo) ?? photo),
      } : current);
      objectUrls.forEach((url) => {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(url);
      });
    } catch {
      setSetupError('One or more photos could not be read. Please try again.');
      setSetupDraft((current) => current.photos ? {
        ...current,
        photos: current.photos.filter((photo) => !objectUrls.includes(photo)),
      } : current);
      objectUrls.forEach((url) => {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(url);
      });
    } finally {
      setPendingPhotoCount((count) => Math.max(0, count - selected.length));
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void addPhotoFiles(files);
  };

  const handlePhotoFileDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (setupBusy) return;
    void addPhotoFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const removePhoto = (index: number) => {
    if (!activeSpotId) return;
    const photo = setupForm.photos[index];
    if (photo) {
      pendingImageFilesRef.current.delete(photo);
      if (objectUrlsRef.current.delete(photo)) URL.revokeObjectURL(photo);
    }
    setSetupDraft((current) => ({
      ...current,
      photos: setupForm.photos.filter((_, itemIndex) => itemIndex !== index),
    }));
    setSelectedPhotoIndex(null);
  };

  const swapPhotos = async (fromIndex: number, toIndex: number) => {
    if (!activeSpotId || fromIndex === toIndex || setupBusy) return;
    const photos = setupForm.photos;
    const sourceUrl = photos[fromIndex];
    const targetUrl = photos[toIndex];
    if (!sourceUrl || !targetUrl) return;

    const sourceImage = activeSetup.images.find((image) => image.secureUrl === sourceUrl);
    const targetImage = activeSetup.images.find((image) => image.secureUrl === targetUrl);
    if (sourceImage && targetImage) {
      const orderedImages = [...activeSetup.images];
      const source = orderedImages.indexOf(sourceImage);
      const target = orderedImages.indexOf(targetImage);
      [orderedImages[source], orderedImages[target]] = [targetImage, sourceImage];
      await saveImageOrder(orderedImages);
      return;
    }

    const reordered = [...photos];
    [reordered[fromIndex], reordered[toIndex]] = [reordered[toIndex], reordered[fromIndex]];
    setSetupDraft((current) => ({ ...current, photos: reordered }));
    setSetupMessage('Photo order updated.');
    setSetupError(null);
  };

  const handlePhotoTap = (index: number) => {
    if (selectedPhotoIndex === null) {
      setSelectedPhotoIndex(index);
      return;
    }
    if (selectedPhotoIndex === index) {
      setSelectedPhotoIndex(null);
      return;
    }
    void swapPhotos(selectedPhotoIndex, index);
    setSelectedPhotoIndex(null);
  };

  const persistSetup = (
    publish: boolean,
    updatedAt = new Date().toISOString(),
    successMessage = publish ? 'Parking listing published. Choose open dates in Availability.' : 'Draft saved.',
  ): boolean => {
    if (!activeSpotId) return false;
    if (pendingPhotoCount > 0) {
      setSetupError('Please wait for the photo previews to finish loading.');
      return false;
    }
    const daily = setupForm.dailyRate.trim() === '' ? null : Number(setupForm.dailyRate);
    const monthly = setupForm.monthlyRate.trim() === '' ? null : Number(setupForm.monthlyRate);
    if (hasInvalidRates({ dailyRate: daily, monthlyRate: monthly }, activeSetup)) {
      setSetupError('Each new or changed rate must be at least RM 1.');
      return false;
    }
    const nextSetup: OwnerParkingSetup = {
      photos: setupForm.photos.filter((photo) => photo.trim().length > 0).slice(0, MAX_PHOTOS),
      images: activeSetup.images.filter((image) => setupForm.photos.includes(image.secureUrl)),
      description: setupForm.description.trim(),
      accessInstructions: setupForm.accessInstructions.trim(),
      dailyRate: daily !== null && daily > 0 ? daily : null,
      monthlyRate: monthly !== null && monthly > 0 ? monthly : null,
      hasEvCharging: setupForm.hasEvCharging,
      evChargingSpeed: setupForm.evChargingSpeed,
      isCovered: setupForm.isCovered,
      isHandicapAccessible: setupForm.isHandicapAccessible,
      hasCctv: setupForm.hasCctv,
      published: publish ? true : activeSetup.published,
      updatedAt,
    };
    updateWorkspace((current) => {
      const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
      return {
        ...current,
        spots: {
          ...current.spots,
          [activeSpotId]: { ...spot, setup: nextSetup },
        },
      };
    });
    setSetupDraft({});
    setSetupMessage(successMessage);
    setSetupError(null);
    return true;
  };

  const hasConfigurationChanges = (bay: ParkingBay, payload: ParkingConfigurationPayload): boolean => {
    const saved = savedConfigurations.current.get(bay.parkingSpotId);
    // Use the acknowledged save until a newer spot snapshot arrives from the API.
    const baseline = saved && saved.sourceUpdatedAt === bay.updatedAt
      ? saved.payload
      : bay.configurationDescription !== undefined ? toConfigurationPayload(setupFromBay(bay)) : null;
    return baseline === null || JSON.stringify(payload) !== JSON.stringify(baseline);
  };

  const saveConfiguration = async (payload: ParkingConfigurationPayload): Promise<boolean> => {
    if (!activeBay) return false;
    if (pendingPhotoCount > 0) {
      setSetupError('Please wait for the photo previews to finish loading.');
      return false;
    }

    const token = user?.token ?? '';
    if (!token) {
      setSetupError('Your owner session is missing an authorization token.');
      return false;
    }

    setSetupSaving(true);
    setSetupMessage(null);
    setSetupError(null);
    try {
      const response = await updateParkingConfiguration(token, activeBay.parkingSpotId, payload);
      const body = await response.json().catch(() => null) as ParkingConfigurationResponse | null;
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || `Unable to save parking configuration (${response.status}).`);
      }

      savedConfigurations.current.set(activeBay.parkingSpotId, { sourceUpdatedAt: activeBay.updatedAt, payload });
      return persistSetup(false, body.updatedAt, body.message);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Unable to save parking configuration.');
      return false;
    } finally {
      setSetupSaving(false);
    }
  };

  const applyServerImages = (images: ParkingSpotImage[], message: string, uploadedPhotos: string[] = []) => {
    const orderedImages = normaliseParkingImages(images);
    const secureUrls = orderedImages.map((image) => image.secureUrl);

    updateWorkspace((current) => {
      const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
      return {
        ...current,
        spots: {
          ...current.spots,
          [activeSpotId]: {
            ...spot,
            setup: { ...spot.setup, photos: secureUrls, images: orderedImages },
          },
        },
      };
    });
    setSetupDraft(({ photos, ...fields }) => {
      const pendingPhotos = photos?.filter((photo) => (
        (photo.startsWith('data:image/') || photo.startsWith('blob:')) && !uploadedPhotos.includes(photo)
      )) ?? [];
      return pendingPhotos.length ? { ...fields, photos: [...secureUrls, ...pendingPhotos] } : fields;
    });
    setSetupMessage(message);
  };

  const hasNewPhotos = setupForm.photos.some((photo) => photo.startsWith('data:image/'));

  const uploadImages = async (): Promise<boolean> => {
    if (!activeBay) return false;
    const localImages = setupForm.photos.filter((photo) => photo.startsWith('data:image/'));
    if (localImages.length === 0) return true;

    const token = user?.token ?? '';
    if (!token) {
      setSetupError('Your owner session is missing an authorization token.');
      return false;
    }

    setImagesUploading(true);
    setSetupMessage(null);
    setSetupError(null);
    try {
      const imageFiles = await Promise.all(localImages.map((dataUrl, index) => (
        pendingImageFilesRef.current.get(dataUrl) ?? dataUrlToImageFile(dataUrl, index)
      )));
      const response = await uploadParkingImages(token, activeBay.parkingSpotId, imageFiles);
      const body = await response.json().catch(() => null) as ParkingImagesResponse | null;
      if (!response.ok || !body?.success || !Array.isArray(body.data)) {
        throw new Error(body?.message || `Unable to upload parking images (${response.status}).`);
      }

      localImages.forEach((dataUrl) => pendingImageFilesRef.current.delete(dataUrl));
      applyServerImages(body.data, body.message, localImages);
      return true;
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Unable to upload parking images.');
      return false;
    } finally {
      setImagesUploading(false);
    }
  };

  const saveImageOrder = async (images: ParkingSpotImage[]) => {
    if (!activeBay) return;
    const token = user?.token ?? '';
    if (!token) {
      setSetupError('Your owner session is missing an authorization token.');
      return;
    }

    setImagesReordering(true);
    setSetupMessage(null);
    setSetupError(null);
    try {
      const response = await updateParkingImageOrder(
        token,
        activeBay.parkingSpotId,
        images.map((image, index) => ({
          imageFileId: image.parkingSpotImageId,
          displayOrder: index + 1,
          isPrimary: index === 0,
        })),
      );
      const body = await response.json().catch(() => null) as ParkingImagesResponse | null;
      if (!response.ok || !body?.success || !Array.isArray(body.data)) {
        throw new Error(body?.message || `Unable to update the parking image (${response.status}).`);
      }

      applyServerImages(body.data, body.message);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Unable to update the parking image.');
    } finally {
      setImagesReordering(false);
    }
  };

  const deleteImage = async (image: ParkingSpotImage) => {
    if (!activeBay) return;
    const confirmed = await showConfirm({
      title: 'Delete Image',
      message: `Delete ${image.originalFileName || 'this listing image'}? This cannot be undone.`,
      confirmText: 'Delete Image',
      cancelText: 'Cancel',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;

    const token = user?.token ?? '';
    if (!token) {
      setSetupError('Your owner session is missing an authorization token.');
      return;
    }

    setImageDeletingId(image.parkingSpotImageId);
    setSetupMessage(null);
    setSetupError(null);
    try {
      const response = await deleteParkingImage(
        token,
        activeBay.parkingSpotId,
        image.parkingSpotImageId,
      );
      const body = await response.json().catch(() => null) as ParkingImagesResponse | null;
      if (!response.ok || !body?.success || !Array.isArray(body.data)) {
        throw new Error(body?.message || `Unable to delete the parking image (${response.status}).`);
      }

      applyServerImages(body.data, body.message);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Unable to delete the parking image.');
    } finally {
      setImageDeletingId(null);
    }
  };

  const currentSetupCandidate = (): OwnerParkingSetup => ({
    photos: setupForm.photos,
    images: activeSetup.images,
    description: setupForm.description,
    accessInstructions: setupForm.accessInstructions,
    dailyRate: setupForm.dailyRate.trim() === '' ? null : Number(setupForm.dailyRate),
    monthlyRate: setupForm.monthlyRate.trim() === '' ? null : Number(setupForm.monthlyRate),
    hasEvCharging: setupForm.hasEvCharging,
    evChargingSpeed: setupForm.evChargingSpeed,
    isCovered: setupForm.isCovered,
    isHandicapAccessible: setupForm.isHandicapAccessible,
    hasCctv: setupForm.hasCctv,
    published: activeSetup.published,
  });

  const markSetupStepComplete = (step: SetupStep) => {
    setCompletedSetupSteps((current) => current.has(step) ? current : new Set(current).add(step));
  };

  const continueFromPhotos = async (allowSave: boolean) => {
    if (setupForm.photos.length === 0) {
      setSetupError('Add at least one clear parking photo to continue.');
      return;
    }
    if (hasNewPhotos && (!allowSave || !(await uploadImages()))) return;
    setSetupError(null);
    markSetupStepComplete(1);
    setSetupStep(2);
  };

  const continueFromDescription = () => {
    if (!setupForm.description.trim()) {
      setSetupError('Add a short parking description to continue.');
      return;
    }
    setSetupError(null);
    markSetupStepComplete(2);
    setSetupStep(3);
  };

  const continueFromPricing = async (allowSave: boolean) => {
    const candidate = currentSetupCandidate();
    if (hasInvalidRates(candidate, activeSetup)) {
      setSetupError('Each new or changed rate must be at least RM 1.');
      return;
    }
    if ((candidate.dailyRate ?? 0) <= 0 && (candidate.monthlyRate ?? 0) <= 0) {
      setSetupError('Set a daily or monthly rate to continue.');
      return;
    }
    if (!activeBay) return;
    const payload = toConfigurationPayload(candidate);
    const needsSave = hasConfigurationChanges(activeBay, payload);
    if (needsSave && (!allowSave || !(await saveConfiguration(payload)))) return;
    if (!needsSave) setSetupMessage(null);

    setSetupError(null);
    markSetupStepComplete(3);
    setSetupStep(4);
  };

  const continueToPublish = () => {
    const completion = setupCompletion(currentSetupCandidate(), activeSetup);
    if (!completion.complete) {
      setSetupError(completion.issues.join(' '));
      return;
    }
    setSetupError(null);
    markSetupStepComplete(4);
    setSetupStep(5);
  };

  const handlePublish = async () => {
    if (!activeBay) return;
    const completion = setupCompletion(currentSetupCandidate(), activeSetup);
    if (!completion.complete) {
      setSetupError(completion.issues.join(' '));
      return;
    }
    const token = user?.token ?? '';
    if (!token) {
      setSetupError('Your owner session is missing an authorization token.');
      return;
    }

    setPublishing(true);
    setSetupMessage(null);
    setSetupError(null);
    try {
      const response = await updateParkingPublication(token, activeBay.parkingSpotId, true);
      const body = await response.json().catch(() => null) as {
        success?: boolean;
        message?: string;
        isPublished?: boolean;
      } | null;
      if (!response.ok || body?.success !== true || body.isPublished === false) {
        const missingReqs = (body as any)?.missingRequirements;
        const missing = Array.isArray(missingReqs) && missingReqs.length > 0
          ? ' (Missing: ' + missingReqs.join(', ') + ')'
          : '';
        throw new Error((body?.message ? body.message + missing : null) || 'Unable to publish the parking listing (' + response.status + ').');
      }
      persistSetup(true, new Date().toISOString(), body.message || 'Parking listing published. Choose open dates in Availability.');
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Unable to publish the parking listing.');
    } finally {
      setPublishing(false);
    }
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setDayMessage(null);
    setDayError(null);
  };

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + offset, 1);
    const selectedDay = dateFromKey(selectedDate).getDate();
    const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    setMonthCursor(nextMonth);
    setSelectedDate(localDateKey(new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      Math.min(selectedDay, daysInNextMonth),
    )));
    setDayMessage(null);
    setDayError(null);
  };

  const goToCurrentMonth = () => {
    const currentMonth = dateFromKey(todayKey);
    setMonthCursor(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    setSelectedDate(todayKey);
    setDayMessage(null);
    setDayError(null);
  };

  const changeRangeDraft = (changes: Partial<AvailabilityRangeDraft>) => {
    setRangeDraft((current) => ({ ...current, ...changes }));
    setBulkError(null);
    setBulkMessage(null);
  };

  const bulkUpdate = async () => {
    if (!activeSpotId || !activeBay || availabilitySaving || bulkMessage || rangeDateError || rangeHoursError || rangeSelectionError) return;
    const token = user?.token;
    if (!token) {
      setBulkError('Your session has expired. Sign in again to save availability.');
      return;
    }

    const { status, start, end, fromTime, toTime, dayPattern } = rangeDraft;
    const opensDates = status === 'available';
    setAvailabilitySaving(true);
    setBulkError(null);
    try {
      const response = opensDates
        ? await createParkingAvailabilityRules(token, activeBay.parkingSpotId, {
            rules: [{ fromDate: start, toDate: end, fromTime, toTime, dayPattern }],
          })
        : await closeParkingAvailabilityDates(token, activeBay.parkingSpotId, { fromDate: start, toDate: end });
      const body = await response.json().catch(() => null) as (ParkingAvailabilityRulesResponse & {
        errors?: Record<string, string[]>;
        title?: string;
      }) | null;
      if (!response.ok || !body?.success || (opensDates && !Array.isArray(body.data))) {
        const detail = body?.message || Object.values(body?.errors ?? {}).flat().join(' ') || body?.title;
        throw new Error(detail || `Unable to save availability (${response.status}).`);
      }

      updateWorkspace((current) => {
        const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
        const days = { ...spot.days };
        matchingRangeDates.forEach((date) => {
          if (statusFor(spot, date).status !== 'booked') {
            days[date] = { ...days[date], status, ownerOverride: undefined };
          }
        });
        return { ...current, spots: { ...current.spots, [activeSpotId]: { ...spot, days } } };
      });
      setBulkMessage(body.message || (opensDates ? 'Opening hours saved.' : 'Dates closed.'));
      await fetchAvailabilityCalendar();
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Unable to save availability. Try again.');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const applySelectedDayStatus = async (nextStatus: 'available' | 'unavailable') => {
    if (!activeSpotId || !activeBay || availabilitySaving || daySaving) {
      return;
    }
    const currentDay = statusFor(workspace.spots[activeSpotId], selectedDate);
    if (currentDay.status === 'booked') {
      setDayError('Booked dates are locked until the booking is released by the backend.');
      setDayMessage(null);
      return;
    }
    if (currentDay.status === nextStatus) {
      setDayMessage(null);
      setDayError(null);
      return;
    }

    setDaySaving(true);
    setDayMessage(null);
    setDayError(null);
    try {
      const token = user?.token ?? '';
      if (!token) throw new Error('Your owner session is missing an authorization token.');

      if (nextStatus === 'available') {
        const cleanTime = (t: string | undefined, fallback: string) => {
          if (!t) return fallback;
          const match = t.trim().match(/^([01]\d|2[0-3]):[0-5]\d/);
          return match ? match[0] : fallback;
        };
        const ruleFrom = cleanTime(currentDay.configuredHours?.[0]?.from, rangeDraft.fromTime);
        const ruleTo = cleanTime(currentDay.configuredHours?.[0]?.to, rangeDraft.toTime);
        if (ruleFrom >= ruleTo) {
          throw new Error('Opening time must be earlier than closing time.');
        }

        const response = await createParkingAvailabilityRules(token, activeBay.parkingSpotId, {
          rules: [{
            fromDate: selectedDate,
            toDate: selectedDate,
            fromTime: ruleFrom,
            toTime: ruleTo,
            dayPattern: 'Everyday',
          }],
        });
        const rawBody = await response.json().catch(() => null);
        const body = rawBody as (ParkingAvailabilityRulesResponse & { errors?: Record<string, string[]>; title?: string }) | null;
        if (!response.ok || !body?.success || !Array.isArray(body.data)) {
          const detail = body?.message
            || (body?.errors ? Object.values(body.errors).flat().join(' ') : null)
            || body?.title;
          throw new Error(detail || `Unable to open this date (${response.status}).`);
        }
      } else {
        const response = await closeParkingAvailabilityDates(token, activeBay.parkingSpotId, {
          fromDate: selectedDate,
          toDate: selectedDate,
        });
        const rawBody = await response.json().catch(() => null);
        const body = rawBody as (ParkingAvailabilityRulesResponse & { errors?: Record<string, string[]>; title?: string }) | null;
        if (!response.ok || !body?.success) {
          const detail = body?.message
            || (body?.errors ? Object.values(body.errors).flat().join(' ') : null)
            || body?.title;
          throw new Error(detail || `Unable to close this date (${response.status}).`);
        }
      }

      updateWorkspace((current) => {
        const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
        const existingDay = statusFor(spot, selectedDate);
        const updatedDay: OwnerParkingDay = nextStatus === 'unavailable'
          ? { ...existingDay, status: 'unavailable', ownerOverride: undefined }
          : { ...existingDay, status: 'available', ownerOverride: undefined };
        return {
          ...current,
          spots: {
            ...current.spots,
            [activeSpotId]: { ...spot, days: { ...spot.days, [selectedDate]: updatedDay } },
          },
        };
      });
      setDayMessage(`${formatShortDate(selectedDate)} is now ${statusMeta[nextStatus].shortLabel.toLowerCase()}.`);
      await fetchAvailabilityCalendar();
    } catch (error) {
      setDayError(error instanceof Error ? error.message : `Unable to mark this date ${statusMeta[nextStatus].shortLabel.toLowerCase()}.`);
    } finally {
      setDaySaving(false);
    }
  };

  const calendarDays = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const numberOfDays = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    return Array.from({ length: numberOfDays }, (_, index) => addDays(first, index));
  }, [monthCursor]);

  const calendarStartOffset = monthCursor.getDay();

  const selectedDay = statusFor(activeSpot, selectedDate);
  const selectedDayMeta = statusMeta[selectedDay.status];
  const SelectedDayIcon = selectedDayMeta.icon;
  const selectedDayIsPast = dateKeyIsPast(selectedDate);
  const monthStats = useMemo(() => {
    let available = 0;
    let unavailable = 0;
    let booked = 0;
    calendarDays.forEach((day) => {
      const status = statusFor(activeSpot, localDateKey(day)).status;
      if (status === 'available') available += 1;
      if (status === 'unavailable') unavailable += 1;
      if (status === 'booked') booked += 1;
    });
    return { available, unavailable, booked };
  }, [activeSpot, calendarDays]);

  const rangeDates = useMemo(
    () => rangeEditorOpen ? inclusiveDateKeys(rangeDraft.start, rangeDraft.end) : [],
    [rangeEditorOpen, rangeDraft.start, rangeDraft.end],
  );
  let rangeDateError: string | null = null;
  if (!rangeDraft.start || !rangeDraft.end) rangeDateError = 'Enter a start date and an end date.';
  else if (rangeDraft.start > rangeDraft.end) rangeDateError = 'End date must be on or after the start date.';
  else if (rangeDates.length > MAX_BULK_DAYS) rangeDateError = `Choose a range of ${MAX_BULK_DAYS} days or fewer.`;
  else if (!rangeDates.length) rangeDateError = 'Enter valid dates.';

  const opensRangeDates = rangeDraft.status === 'available';
  const matchingRangeDates = rangeDateError ? [] : opensRangeDates
    ? rangeDates.filter((date) => dateMatchesDayPattern(date, rangeDraft.dayPattern))
    : rangeDates;
  let rangeHoursError: string | null = null;
  if (opensRangeDates) {
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!validTime.test(rangeDraft.fromTime) || !validTime.test(rangeDraft.toTime)) {
      rangeHoursError = 'Enter an opening time and a closing time.';
    } else if (rangeDraft.fromTime >= rangeDraft.toTime) {
      rangeHoursError = 'Closing time must be later than opening time.';
    }
  }

  let rangeSelectionError: string | null = null;
  if (!rangeDateError) {
    if (!matchingRangeDates.length) rangeSelectionError = 'This range has no weekdays. Choose other dates or select Every day.';
    else if (matchingRangeDates.every((date) => statusFor(activeSpot, date).status === 'booked')) rangeSelectionError = 'All selected dates are booked.';
  }

  if (!activeBay) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <CalendarDays className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
        <h2 className="mt-3 text-sm font-bold text-slate-800">{rangeEditorOpen ? 'Parking spot unavailable' : 'No parking spots to configure'}</h2>
        {rangeEditorOpen ? (
          <button type="button" onClick={onCloseRangeEditor} className="mt-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:underline focus-visible:outline-2 dark:text-blue-300">Back to timetable</button>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Register a parking spot first, then return here to add setup details and a timetable.</p>
        )}
      </div>
    );
  }

  if (rangeEditorOpen) {
    return (
      <AvailabilityRangeEditor
        spotLabel={bayLabel(activeBay)}
        timeZone={calendarTimeZone}
        draft={rangeDraft}
        matchingDays={matchingRangeDates.length}
        dateError={rangeDateError}
        hoursError={rangeHoursError}
        selectionError={rangeSelectionError}
        saveError={bulkError}
        savedMessage={bulkMessage}
        saving={availabilitySaving}
        onChange={changeRangeDraft}
        onBack={onCloseRangeEditor}
        onSave={() => void bulkUpdate()}
      />
    );
  }

  const setupPhotos = setupForm.photos;
  const setupCandidate = currentSetupCandidate();
  const setupIsComplete = setupCompletion(setupCandidate, activeSetup).complete;
  const publishedAndConfigured = activeSetup.published && activeBay.isConfigurationComplete === true;
  const completedSteps = (publishedAndConfigured ? 4 : completedSetupSteps.size) + Number(activeSetup.published);
  const advanceSetupStep = {
    1: continueFromPhotos,
    2: continueFromDescription,
    3: continueFromPricing,
    4: continueToPublish,
  };

  const nextStepRequiresSave = (setupStep === 1 && hasNewPhotos)
    || (setupStep === 3 && hasConfigurationChanges(activeBay, toConfigurationPayload(setupCandidate)));

  const openSetupStep = (step: SetupStep) => {
    if (setupBusy || pendingPhotoCount > 0) return;
    if (step < setupStep) {
      setSetupError(null);
      setSetupStep(step);
    } else if (setupStep < 5 && step === setupStep + 1 && !nextStepRequiresSave) {
      void advanceSetupStep[setupStep as Exclude<SetupStep, 5>](false);
    }
  };

  const setupNavigationBusy = setupBusy || pendingPhotoCount > 0;
  const isPublishStep = setupStep === 5;
  const showTimetableAction = isPublishStep && activeSetup.published;
  const SetupActionIcon = isPublishStep ? (showTimetableAction ? CalendarRange : Send) : ChevronRight;
  const setupActionLabel = {
    1: imagesUploading ? 'Uploading photos…' : hasNewPhotos ? 'Upload & continue' : 'Continue',
    2: 'Continue',
    3: setupSaving ? 'Saving…' : nextStepRequiresSave ? 'Save & review' : 'Review',
    4: 'Continue',
    5: showTimetableAction ? 'Set availability' : publishing ? 'Publishing…' : 'Publish listing',
  }[setupStep];

  const handleSetupAction = () => {
    if (showTimetableAction) setSection('timetable');
    else if (isPublishStep) void handlePublish();
    else void advanceSetupStep[setupStep as Exclude<SetupStep, 5>](true);
  };

  return (
    <div className="space-y-3 sm:space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div role="tablist" aria-label="Configure parking sections" className="grid h-10 shrink-0 self-end grid-cols-2 gap-1 rounded-xl bg-slate-200/65 p-1 sm:h-11 sm:order-2 sm:min-w-[190px] sm:self-start">
          <button id="parking-setup-tab" type="button" role="tab" aria-selected={section === 'setup'} aria-controls="parking-setup-panel" onClick={() => setSection('setup')} style={{ minHeight: 0 }} className={`h-8 rounded-lg px-3 text-xs font-bold transition-colors active:scale-[0.98] sm:h-9 ${section === 'setup' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" aria-hidden="true" /> Setup</span></button>
          <button id="parking-timetable-tab" type="button" role="tab" aria-selected={section === 'timetable'} aria-controls="parking-timetable-panel" onClick={() => setSection('timetable')} style={{ minHeight: 0 }} className={`h-8 rounded-lg px-3 text-xs font-bold transition-colors active:scale-[0.98] sm:h-9 ${section === 'timetable' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><span className="inline-flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5" aria-hidden="true" /> Timetable</span></button>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 sm:order-1">
          <div className="min-w-32 flex-1 sm:flex-none">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Editing parking spot</p>
            <p className="mt-0.5 break-words text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
              {activeBay.propertyName || `Property #${activeBay.propertyId}`} · {activeBay.parkingLabel || activeBay.bayNumber || `Spot #${activeBay.parkingSpotId}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SystemSelect
              value={selectedBayId}
              onChange={(event) => setSelectedBayId(event.target.value)}
              disabled={setupNavigationBusy || deletingSpot || bays.length < 2}
              triggerLabel="Change"
              menuMinWidth={260}
              className="min-h-11 px-4!"
              aria-label="Change parking spot"
            >
              {bays.map((bay) => <option key={bay.id || bay.parkingSpotId} value={String(bay.parkingSpotId)}>{bayLabel(bay)}</option>)}
            </SystemSelect>
            {onDeleteParking && activeBay && (() => {
              const activeCount = activeBay.activeBookingCount ?? 0;
              const hasActiveBooking = Boolean(
                activeBay.hasActiveBookings ||
                activeCount > 0 ||
                activeBay.availabilityStatus === 'Reserved' ||
                activeBay.availabilityStatus === 'Occupied' ||
                bookings.some((b) => (String(b.bayId) === String(activeBay.parkingSpotId) || String(b.bayId) === String(activeBay.id)) && ['Pending', 'Confirmed', 'Active', 'Upcoming'].includes(b.status))
              );
              return (
                <button
                  type="button"
                  disabled={deletingSpot || setupBusy || hasActiveBooking}
                  onClick={async () => {
                    if (hasActiveBooking) return;
                    const confirmed = await showConfirm({
                      title: 'Remove parking spot?',
                      message: `Are you sure you want to permanently remove "${bayLabel(activeBay)}" (Spot #${activeBay.parkingSpotId})? This spot will be unpublished and permanently removed from commuter search.`,
                      confirmText: 'Remove spot',
                      cancelText: 'Cancel',
                      variant: 'danger',
                      icon: 'warning',
                    });
                    if (!confirmed) return;
                    setDeletingSpot(true);
                    try {
                      const res = await onDeleteParking(activeBay.parkingSpotId);
                      if (!res.success) {
                        setSetupError(res.message);
                      } else {
                        await showAlert({
                          title: 'Parking Spot Removed',
                          message: res.message || `"${bayLabel(activeBay)}" (Spot #${activeBay.parkingSpotId}) has been removed successfully.`,
                          variant: 'success',
                          icon: 'success',
                          buttonText: 'Done',
                        });
                      }
                    } finally {
                      setDeletingSpot(false);
                    }
                  }}
                  title={hasActiveBooking ? `Cannot remove parking spot while an active or upcoming booking exists (${activeCount > 0 ? `${activeCount} booking(s)` : 'active reservation'})` : 'Remove this parking spot'}
                  className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-4 text-xs font-bold transition-colors ${
                    hasActiveBooking
                      ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500 cursor-not-allowed opacity-60'
                      : 'border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 cursor-pointer'
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{deletingSpot ? 'Removing…' : 'Remove'}</span>
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
      {section === 'setup' ? (
        <motion.section id="parking-setup-panel" role="tabpanel" aria-labelledby="parking-setup-tab" key="setup" className="overflow-hidden rounded-2xl border border-slate-200 bg-[var(--setup-surface)] shadow-sm [--setup-surface:white] dark:border-white/10 dark:[--setup-surface:#141417]" initial={prefersReducedMotion ? false : calmMotion.initial} animate={calmMotion.animate} exit={prefersReducedMotion ? undefined : calmMotion.exit} transition={prefersReducedMotion ? { duration: 0.15 } : calmMotion.transition}>
          <nav aria-label="Parking setup steps" className="bg-stone-100/80 px-2 pt-2 dark:bg-white/[0.035] sm:px-4 sm:pt-2.5">
            <div className="mb-1.5 flex justify-end px-1">
              <span className="text-[11px] font-medium tabular-nums text-stone-600 dark:text-stone-400">{completedSteps} of {SETUP_STEPS.length} complete</span>
            </div>
            <ol className="grid grid-cols-5 items-end gap-0.5 sm:gap-1.5">
              {SETUP_STEPS.map((label, index) => {
                const step = (index + 1) as SetupStep;
                const selected = setupStep === step;
                const complete = step === 5 ? activeSetup.published : publishedAndConfigured || completedSetupSteps.has(step);
                const saveRequired = step === setupStep + 1 && nextStepRequiresSave;
                const disabled = !selected && (step > setupStep + 1 || setupNavigationBusy || saveRequired);

                return (
                  <li key={label} className="min-w-0">
                    <button
                      type="button"
                      aria-current={selected ? 'step' : undefined}
                      disabled={disabled}
                      title={saveRequired ? 'Save your changes to continue' : undefined}
                      onClick={() => openSetupStep(step)}
                      className={`relative grid w-full min-w-0 grid-cols-[1fr_auto_1fr] content-center items-center gap-x-0.5 gap-y-0.5 rounded-t-lg border px-1 py-1.5 text-center focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-indigo-500 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-1.5 sm:px-2.5 sm:text-left ${selected
                        ? 'z-10 min-h-12 border-stone-200 border-b-0! bg-[var(--setup-surface)]! font-semibold text-indigo-950 shadow-none! transition-none! dark:border-white/10 dark:text-indigo-200'
                        : 'min-h-11 border-transparent! font-medium text-stone-600 enabled:hover:bg-white/65 dark:text-stone-300 dark:enabled:hover:bg-white/5'}`}>
                      <span className={`col-start-2 row-start-1 grid size-4 place-items-center rounded-md font-mono text-[10px] leading-none sm:col-start-1 sm:size-5 ${selected
                        ? 'bg-indigo-100 font-semibold text-indigo-800 dark:bg-indigo-400/20 dark:text-indigo-200'
                        : 'text-stone-500 dark:text-stone-400'}`} aria-hidden="true">
                        {step}
                      </span>
                      <span className="col-span-3 row-start-2 min-w-0 text-[10px] leading-tight sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:text-xs">
                        {label === 'Description' ? (
                          <><span className="sm:hidden">Details</span><span className="hidden sm:inline">Description</span></>
                        ) : label}
                      </span>
                      <Check
                        className={`col-start-3 row-start-1 size-3 justify-self-end text-emerald-700 dark:text-emerald-400 sm:size-3.5 ${complete ? '' : 'invisible'}`}
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                      <span className="sr-only">{complete ? ' complete' : ' incomplete'}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
            {setupError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] font-medium text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{setupError}</div>}

            {setupStep === 1 && (
              <motion.div key="photos-step" initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={prefersReducedMotion ? { duration: 0 } : calmMotion.transition} className="space-y-3 sm:space-y-5">
                <ParkingSectionHeading
                  title={activeSetup.images.length > 0 ? "Saved photos" : "Parking photos"}
                  description={activeSetup.images.length > 0 ? "Continue with your saved photos, or add and reorder photos here." : "Add a clear photo that helps commuters recognize the bay."}
                />
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={handlePhotoChange} className="hidden" />
                <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="Parking photo gallery">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handlePhotoFileDrop}
                    disabled={pendingPhotoCount > 0 || setupPhotos.length >= MAX_PHOTOS || setupBusy}
                    className="photo-upload-dropzone flex aspect-[4/3] min-w-0 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl p-1 text-center focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:gap-2 sm:p-3"
                  >
                    <span className="photo-upload-icon-circle grid size-6 shrink-0 place-items-center rounded-full sm:size-10">
                      <UploadCloud className="size-3.5 sm:size-5" aria-hidden="true" />
                    </span>
                    <span className="photo-upload-title text-[10px] leading-tight sm:text-sm">{setupPhotos.length >= MAX_PHOTOS ? 'Photo limit reached' : 'Add photos'}</span>
                    <span className="photo-upload-subtext text-[9px] tabular-nums leading-tight sm:text-[11px]">{setupPhotos.length}/{MAX_PHOTOS}</span>
                  </button>
                  {setupPhotos.map((photo, index) => {
                    const uploadedImage = activeSetup.images.find((image) => image.secureUrl === photo);
                    const selected = selectedPhotoIndex === index;
                    return (
                      <div
                        key={uploadedImage?.parkingSpotImageId ?? `${photo.slice(0, 24)}-${index}`}
                        role="button"
                        tabIndex={0}
                        draggable={!setupBusy}
                        aria-pressed={selected}
                        aria-label={`Parking photo ${index + 1}. ${selected ? 'Selected. Choose another photo to move it.' : 'Select to reorder.'}`}
                        onClick={() => handlePhotoTap(index)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handlePhotoTap(index); } }}
                        onDragStart={(event) => { setDraggedPhotoIndex(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); }}
                        onDragEnd={() => setDraggedPhotoIndex(null)}
                        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                        onDrop={(event) => { event.preventDefault(); const from = draggedPhotoIndex ?? Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) void swapPhotos(from, index); setDraggedPhotoIndex(null); setSelectedPhotoIndex(null); }}
                        className={`group relative aspect-[4/3] cursor-grab overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/5 shadow-sm outline-none transition ${selected ? 'ring-4 ring-blue-500/25 ring-offset-2' : 'ring-1 ring-black/5 dark:ring-white/10'} ${draggedPhotoIndex === index ? 'opacity-50' : ''}`}
                      >
                        <img src={photo} alt="" className="h-full w-full object-cover" draggable={false} />
                        <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm ${index === 0 ? 'bg-white text-slate-900' : 'bg-slate-950/70 text-white'}`}>{index === 0 ? 'Cover' : index + 1}</span>
                        <span className="absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-full bg-slate-950/65 text-white backdrop-blur"><GripVertical className="h-4 w-4" aria-hidden="true" /></span>
                        <button type="button" onClick={(event) => { event.stopPropagation(); if (uploadedImage) void deleteImage(uploadedImage); else removePhoto(index); }} disabled={setupBusy} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-slate-950/70 text-white backdrop-blur hover:bg-rose-600 disabled:opacity-50" aria-label={`Remove parking photo ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                        {imagesReordering && uploadedImage && <span className="absolute inset-0 grid place-items-center bg-slate-950/55 text-[11px] font-bold text-white">Reordering…</span>}
                        {imageDeletingId === uploadedImage?.parkingSpotImageId && <span className="absolute inset-0 grid place-items-center bg-rose-950/65 text-[11px] font-bold text-white">Removing…</span>}
                      </div>
                    );
                  })}
                </div>
                {setupPhotos.length > 1 && (
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <GripVertical className="size-3.5 shrink-0" aria-hidden="true" />
                    Drag to reorder, or tap two photos to swap them.
                  </p>
                )}
                {pendingPhotoCount > 0 && <p className="text-[11px] font-medium text-blue-600">Preparing photo preview…</p>}
              </motion.div>
            )}

            {setupStep === 2 && (
              <motion.div key="description-step" initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={prefersReducedMotion ? { duration: 0 } : calmMotion.transition} className="space-y-3 sm:space-y-5">
                <ParkingSectionHeading
                  title="Help commuters find your spot"
                  description="Tell them where to go. A floor number, nearby lift, or familiar landmark can make your bay easier to find."
                />
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-800 dark:text-slate-200">Description</span>
                  <textarea value={setupForm.description} onChange={(event) => replaceSetupForm('description', event.target.value)} rows={6} maxLength={500} placeholder="Covered bay on Level B2, beside the lift lobby. Enter through the visitor lane." className="w-full resize-none rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-blue-500 focus:bg-white dark:focus:bg-[#18181C] focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 sm:py-3.5" />
                                    <span className="mt-1.5 block text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">{setupForm.description.length}/500</span>
                </label>

                {/* Spot Amenities & Features */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/10">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Bay Amenities & Features</h4>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-[#A1A1AA]">
                      Tick the amenities provided at this bay so commuters can find and filter it on the search page.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Covered */}
                    <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      setupForm.isCovered
                        ? 'border-blue-500/80 bg-blue-50/50 dark:bg-blue-500/10 dark:border-blue-500/50'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] hover:border-slate-300 dark:hover:border-white/20'
                    }`}>
                      <input
                        type="checkbox"
                        checked={setupForm.isCovered}
                        onChange={(e) => replaceSetupForm('isCovered', e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                          <Umbrella className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          Covered / Indoor Bay
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-[#A1A1AA] mt-0.5">Sheltered from weather and direct sun</span>
                      </div>
                    </label>

                    {/* CCTV */}
                    <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      setupForm.hasCctv
                        ? 'border-blue-500/80 bg-blue-50/50 dark:bg-blue-500/10 dark:border-blue-500/50'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] hover:border-slate-300 dark:hover:border-white/20'
                    }`}>
                      <input
                        type="checkbox"
                        checked={setupForm.hasCctv}
                        onChange={(e) => replaceSetupForm('hasCctv', e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                          <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          24/7 CCTV & Security
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-[#A1A1AA] mt-0.5">Active premises video surveillance</span>
                      </div>
                    </label>

                    {/* Handicap Accessible */}
                    <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      setupForm.isHandicapAccessible
                        ? 'border-blue-500/80 bg-blue-50/50 dark:bg-blue-500/10 dark:border-blue-500/50'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] hover:border-slate-300 dark:hover:border-white/20'
                    }`}>
                      <input
                        type="checkbox"
                        checked={setupForm.isHandicapAccessible}
                        onChange={(e) => replaceSetupForm('isHandicapAccessible', e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                          <Accessibility className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          OKU / Handicap Accessible
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-[#A1A1AA] mt-0.5">Wider berth & step-free transit pathway</span>
                      </div>
                    </label>

                    {/* EV Charging */}
                    <div className={`p-3.5 rounded-2xl border transition-all ${
                      setupForm.hasEvCharging
                        ? 'border-blue-500/80 bg-blue-50/50 dark:bg-blue-500/10 dark:border-blue-500/50'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] hover:border-slate-300 dark:hover:border-white/20'
                    }`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={setupForm.hasEvCharging}
                          onChange={(e) => {
                            replaceSetupForm('hasEvCharging', e.target.checked);
                            if (e.target.checked && !setupForm.evChargingSpeed) {
                              replaceSetupForm('evChargingSpeed', 'Medium (7.4kW)');
                            }
                          }}
                          className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                            <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            EV Charging Point
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-[#A1A1AA] mt-0.5">Dedicated charger for electric vehicles</span>
                        </div>
                      </label>

                      {setupForm.hasEvCharging && (
                        <div className="mt-2.5 pt-2.5 border-t border-blue-200/60 dark:border-white/10">
                          <span className="block text-[10px] font-semibold text-slate-600 dark:text-[#A1A1AA] mb-1">Charging Speed</span>
                          <SystemSelect
                            value={setupForm.evChargingSpeed || 'Medium (7.4kW)'}
                            onChange={(e) => replaceSetupForm('evChargingSpeed', e.target.value)}
                            className="w-full text-xs"
                          >
                            <option value="Slow (3.7kW)">Slow (3.7kW - 3-pin Standard)</option>
                            <option value="Medium (7.4kW)">Medium (7.4kW - AC Wallbox)</option>
                            <option value="Fast (11kW / 22kW)">Fast (11kW / 22kW - 3-Phase AC)</option>
                            <option value="Rapid DC (50kW+)">Rapid DC (50kW+ DC Fast Charger)</option>
                          </SystemSelect>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {setupStep === 3 && (
              <motion.div key="pricing-step" initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={prefersReducedMotion ? { duration: 0 } : calmMotion.transition} className="space-y-3 sm:space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 basis-32">
                    <ParkingSectionHeading
                      title="Set your rates"
                      description="Choose what you’d like to charge per day, per month, or both. Leave a rate blank if you don’t offer it."
                    />
                  </div>
                  {aiPricingRecommendation && (
                    <AiPricingAdvisorCard
                      key={activeSpotId}
                      recommendation={aiPricingRecommendation}
                      onApplyRates={(daily, monthly) => {
                        replaceRate('dailyRate', String(daily));
                        replaceRate('monthlyRate', String(monthly));
                        setSetupMessage(null);
                      }}
                    />
                  )}
                </div>
                <div className="mx-auto grid w-full max-w-[25rem] grid-cols-1 gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <label htmlFor="owner-daily-rate" className="text-xs font-semibold text-slate-700 dark:text-slate-200">Daily rate</label>
                    <div className="mt-2 flex min-h-[3.75rem] min-w-0 w-full items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-1.5 focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-[#18181C] focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/40">
                      <span className="inline-flex h-10 shrink-0 items-center rounded-lg bg-blue-50 dark:bg-white/[0.06] px-3 text-sm font-bold text-blue-700 dark:text-blue-400">RM</span>
                      <input id="owner-daily-rate" type="text" size={1} inputMode="decimal" value={setupForm.dailyRate} onChange={(event) => replaceRate('dailyRate', event.target.value)} placeholder="0" aria-describedby="owner-daily-rate-unit" className="min-w-0 w-full flex-1 border-0 !border-0 bg-transparent !bg-transparent px-3 text-2xl font-bold text-slate-950 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:ring-0 focus:border-0 !shadow-none" />
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => adjustRate('dailyRate', -1)} disabled={!setupForm.dailyRate || Number(setupForm.dailyRate) <= 1 || setupBusy} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2C2C31] text-slate-600 dark:text-slate-300 hover:border-blue-200 hover:text-blue-700 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-35" aria-label="Decrease daily rate by RM 1" title="Decrease by RM 1"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => adjustRate('dailyRate', 1)} disabled={setupBusy} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Increase daily rate by RM 1" title="Increase by RM 1"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                      </div>
                    </div>
                    <p id="owner-daily-rate-unit" className="mt-2 text-[10px] text-slate-500 dark:text-[#A1A1AA]">Charged per booking day. Minimum RM 1.</p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="owner-monthly-rate" className="text-xs font-semibold text-slate-700 dark:text-slate-200">Monthly rate</label>
                      <Popover.Root>
                        <Popover.Trigger aria-label="How monthly pricing works" className="grid size-8 min-h-0! place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white">
                          <CircleHelp className="size-4" aria-hidden="true" />
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Positioner side="top" align="start" sideOffset={6} collisionPadding={12} className="z-[60]">
                            <Popover.Popup className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-[#202024]">
                              <Popover.Title className="text-xs font-semibold text-slate-900 dark:text-white">Monthly pricing</Popover.Title>
                              <Popover.Description className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                Bookings of 21 days or more automatically use your monthly rate.
                              </Popover.Description>
                            </Popover.Popup>
                          </Popover.Positioner>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                    <div className="mt-2 flex min-h-[3.75rem] min-w-0 w-full items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-1.5 focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-[#18181C] focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/40">
                      <span className="inline-flex h-10 shrink-0 items-center rounded-lg bg-blue-50 dark:bg-white/[0.06] px-3 text-sm font-bold text-blue-700 dark:text-blue-400">RM</span>
                      <input id="owner-monthly-rate" type="text" size={1} inputMode="decimal" value={setupForm.monthlyRate} onChange={(event) => replaceRate('monthlyRate', event.target.value)} placeholder="0" aria-describedby="owner-monthly-rate-unit" className="min-w-0 w-full flex-1 border-0 !border-0 bg-transparent !bg-transparent px-3 text-2xl font-bold text-slate-950 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:ring-0 focus:border-0 !shadow-none" />
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => adjustRate('monthlyRate', -1)} disabled={!setupForm.monthlyRate || Number(setupForm.monthlyRate) <= 1 || setupBusy} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2C2C31] text-slate-600 dark:text-slate-300 hover:border-blue-200 hover:text-blue-700 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-35" aria-label="Decrease monthly rate by RM 1" title="Decrease by RM 1"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => adjustRate('monthlyRate', 1)} disabled={setupBusy} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Increase monthly rate by RM 1" title="Increase by RM 1"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                      </div>
                    </div>
                    <p id="owner-monthly-rate-unit" className="mt-2 text-[10px] text-slate-500 dark:text-[#A1A1AA]">Charged for a monthly booking. Minimum RM 1.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {setupStep === 4 && (
              <motion.div key="review-step" initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={prefersReducedMotion ? { duration: 0 } : calmMotion.transition} className="space-y-3">
                <ParkingSectionHeading
                  title="Review your listing"
                  description="Check the photos, details, and rates commuters will see."
                />
                <div aria-label="Listing preview" className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#18181C]">
                  {setupPhotos[0] && <img src={setupPhotos[0]} alt="Parking listing cover" className="h-24 w-full object-cover sm:h-32" />}
                  <div className="space-y-2.5 p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">{activeBay.propertyName || `Property #${activeBay.propertyId}`}</p><h4 className="mt-0.5 text-sm font-bold text-slate-950 dark:text-white">{activeBay.parkingLabel || activeBay.bayNumber}</h4></div><span className="shrink-0 rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-[#A1A1AA]">{setupPhotos.length} photo{setupPhotos.length === 1 ? '' : 's'}</span></div>
                    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">{setupForm.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {setupForm.isCovered && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                          <Umbrella className="h-3 w-3" /> Covered bay
                        </span>
                      )}
                      {setupForm.hasCctv && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                          <ShieldCheck className="h-3 w-3" /> 24/7 CCTV
                        </span>
                      )}
                      {setupForm.isHandicapAccessible && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                          <Accessibility className="h-3 w-3" /> Handicap OKU
                        </span>
                      )}
                      {setupForm.hasEvCharging && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <Zap className="h-3 w-3" /> EV Charging ({setupForm.evChargingSpeed || 'Available'})
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-white/10 pt-2">
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Daily</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{setupForm.dailyRate ? `RM ${Number(setupForm.dailyRate).toFixed(2)}` : 'Not offered'}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Monthly</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{setupForm.monthlyRate ? `RM ${Number(setupForm.monthlyRate).toFixed(2)}` : 'Not offered'}</p></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {setupStep === 5 && (
              <motion.div key="publish-step" initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={prefersReducedMotion ? { duration: 0 } : calmMotion.transition} className="py-5 text-center sm:py-7">
                {activeSetup.published ? (
                  <div role="status" className="mx-auto max-w-sm">
                    <motion.div
                      initial={prefersReducedMotion ? false : { scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 21 }}
                      className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400"
                      aria-hidden="true"
                    >
                      <motion.svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <motion.path
                          d="m5 12 4.5 4.5L19 7"
                          initial={prefersReducedMotion ? false : { pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1, duration: 0.38, ease: 'easeOut' }}
                        />
                      </motion.svg>
                    </motion.div>
                    <div className="mt-3">
                      <ParkingSectionHeading
                        title="You're all set!"
                        description="Your parking listing is published. Set your availability so commuters can start booking."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-sm">
                    <ParkingSectionHeading
                      title="Ready to publish?"
                      description="Publish your listing, then choose which dates commuters can book."
                    />
                  </div>
                )}
              </motion.div>
            )}

            <footer aria-label="Setup navigation" className="flex flex-wrap items-start justify-between gap-2 border-t border-slate-100 pt-3 dark:border-white/10 sm:pt-4">
              {setupStep > 1 && (
                <button
                  type="button"
                  onClick={() => openSetupStep((setupStep - 1) as SetupStep)}
                  disabled={setupNavigationBusy}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-[#1C1C1E] dark:text-slate-200 dark:hover:bg-white/5"
                >
                  <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                  Back
                </button>
              )}
              <div className="ml-auto flex max-w-full flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  {setupMessage && !showTimetableAction && <SaveTick message={setupMessage} />}
                  <button
                    type="button"
                    onClick={handleSetupAction}
                    disabled={setupNavigationBusy || (setupStep >= 4 && !showTimetableAction && !setupIsComplete)}
                    className="workspace-button workspace-button--primary min-h-11! min-w-28"
                  >
                    {setupActionLabel}
                    <SetupActionIcon className="size-4 shrink-0" aria-hidden="true" />
                  </button>
                </div>
                {setupStep === 3 && (
                  <p className="text-right text-[11px] text-slate-500 dark:text-slate-400">Standard platform fee: 10% of booking total</p>
                )}
              </div>
            </footer>
          </div>

        </motion.section>
      ) : (
        <motion.section id="parking-timetable-panel" role="tabpanel" aria-labelledby="parking-timetable-tab" key="timetable" initial={prefersReducedMotion ? false : calmMotion.initial} animate={calmMotion.animate} exit={prefersReducedMotion ? undefined : calmMotion.exit} transition={prefersReducedMotion ? { duration: 0.15 } : calmMotion.transition} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <ParkingSectionHeading
              headingRef={timetableHeadingRef}
              title="Availability timetable"
              description="Select a day to view or change its availability."
            />
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="min-w-0 text-xs" aria-live="polite">
                {calendarLoading ? (
                  <span className="inline-flex items-center gap-2 font-semibold text-blue-700"><RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Loading {displayedMonth} availability…</span>
                ) : calendarError ? (
                  <span role="alert" className="inline-flex items-center gap-2 font-semibold text-rose-600"><AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />{calendarError}</span>
                ) : (
                  <span className="text-slate-500">Time zone: {calendarTimeZone}</span>
                )}
              </div>
              <button type="button" onClick={() => void fetchAvailabilityCalendar()} disabled={calendarLoading} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--workspace-text-secondary)] hover:bg-black/5 hover:text-[var(--workspace-text)] focus-visible:outline-2 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-white/10">
                <RefreshCw className={`size-3.5 ${calendarLoading ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" /> Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
             <div className="workspace-panel p-3 md:p-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => changeMonth(-1)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="View previous month" title="View previous month">
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <h3 className="min-w-36 text-center text-sm font-bold text-slate-900" aria-live="polite">{new Intl.DateTimeFormat('en-MY', { month: 'long', year: 'numeric' }).format(monthCursor)}</h3>
                    <button type="button" onClick={() => changeMonth(1)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="View next month" title="View next month">
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{monthStats.available} open</span><span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{monthStats.unavailable} closed</span><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{monthStats.booked} booked</span></div>
                </div>
                <button type="button" onClick={goToCurrentMonth} className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-[10px] font-bold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Today</button>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-0 text-center">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="border-b border-slate-200 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{day}</span>)}{Array.from({ length: calendarStartOffset }, (_, index) => <span key={`calendar-offset-${index}`} aria-hidden="true" />)}{calendarDays.map((day) => { const key = localDateKey(day); const dayState = statusFor(activeSpot, key); const meta = statusMeta[dayState.status]; const past = dateKeyIsPast(key); const selected = key === selectedDate; const locked = dayState.status === 'booked'; return <button key={key} type="button" onClick={() => selectDate(key)} disabled={false} aria-selected={selected} aria-current={key === todayKey ? 'date' : undefined} className={`group relative flex min-h-14 flex-col items-center justify-start gap-1.5 border-0 bg-transparent px-0.5 py-2 sm:px-1 text-center transition-colors duration-150 hover:bg-slate-50/70 active:bg-slate-100/80 disabled:hover:bg-transparent focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:min-h-[86px] ${past ? 'cursor-default' : ''}`} aria-label={`${formatLongDate(key)}: ${meta.label}${locked ? ', locked' : ''}`} title={`${formatLongDate(key)} · ${meta.label}${locked ? ' · booked dates cannot be changed' : ' · select to inspect'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors ${selected ? 'bg-primary text-primary-foreground' : key === todayKey ? 'ring-1 ring-inset ring-primary text-primary' : 'text-slate-800'} ${past && !selected && key !== todayKey ? 'text-slate-300' : ''}`}>{day.getDate()}</span><span className={`mt-auto flex min-h-4 max-w-full items-center justify-center gap-1 text-[0.6875rem]! font-semibold leading-none sm:text-xs! ${meta.cell} ${past ? 'opacity-55' : ''}`}><span className={`hidden h-1.5 w-1.5 shrink-0 rounded-full sm:block ${meta.dot}`} aria-hidden="true" /><span className="truncate">{meta.shortLabel}</span>{locked && <Lock className="hidden h-2.5 w-2.5 shrink-0 sm:block" aria-hidden="true" />}</span></button>; })}</div>
              <div className="mt-3 flex justify-end border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const date = selectedDate < todayKey ? todayKey : selectedDate;
                    changeRangeDraft(newRangeDraft(date));
                    onOpenRangeEditor(activeBay.parkingSpotId);
                  }}
                  disabled={setupBusy || deletingSpot}
                  className="inline-flex min-h-11! items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-primary hover:bg-[var(--parkjom-action-soft)] disabled:opacity-50"
                >
                  <CalendarRange className="size-4" aria-hidden="true" /> Edit date range
                </button>
              </div>
            </div>

             <aside className="workspace-panel space-y-4 p-4 md:sticky md:top-28 md:self-start md:p-5">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected day</p><h3 className="mt-1 text-sm font-bold text-slate-900">{formatLongDate(selectedDate)}</h3></div>
              <div className={`rounded-2xl border p-4 ${selectedDayMeta.badge}`} aria-live="polite"><div className="flex items-center gap-2"><SelectedDayIcon className="h-4 w-4" aria-hidden="true" /><span className="text-xs font-bold">{selectedDay.status === 'booked' ? 'Booked · locked' : selectedDayMeta.label}</span>{daySaving && <RefreshCw className="ml-auto h-3.5 w-3.5 animate-spin" aria-label="Saving day status" />}</div>{selectedDay.status === 'booked' && <p className="mt-2 text-xs leading-relaxed">This date is locked because one commuter already has the booking.</p>}{selectedDay.status !== 'booked' && <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void applySelectedDayStatus('available')} disabled={daySaving} aria-pressed={selectedDay.status === 'available'} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${selectedDay.status === 'available' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><Check className="h-4 w-4" aria-hidden="true" /> Open</button><button type="button" onClick={() => void applySelectedDayStatus('unavailable')} disabled={daySaving} aria-pressed={selectedDay.status === 'unavailable'} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${selectedDay.status === 'unavailable' ? 'border-slate-400 bg-slate-200 text-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><Ban className="h-4 w-4" aria-hidden="true" /> Closed</button></div>}</div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-slate-700">Configured hours</span><span className="text-[9px] font-semibold text-slate-400">{calendarTimeZone}</span></div>
                {selectedDay.configuredHours?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">{selectedDay.configuredHours.map((hours, index) => <span key={`${hours.from}-${hours.to}-${index}`} className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-emerald-700">{hours.from}–{hours.to}</span>)}</div>
                ) : (
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">No opening hours are configured for this date.</p>
                )}
              </div>
              {dayError && <p role="alert" className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-600"><AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />{dayError}</p>}
              {dayMessage && <SaveTick message={dayMessage} />}
              {selectedDay.status === 'booked' && <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center gap-2 text-[11px] font-bold text-slate-700"><Users className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" /> Commuter booking</div><div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-slate-500">Name</span><span className="text-right font-semibold text-slate-700">{selectedDay.booking?.commuterName || 'Booking details unavailable'}</span></div><div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-slate-500">Vehicle</span><span className="inline-flex items-center gap-1 text-right font-semibold text-slate-700"><Car className="h-3 w-3" aria-hidden="true" />{selectedDay.booking?.vehicle || '—'}</span></div>{selectedDay.booking?.commuterPhone && <div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-slate-500">Contact</span><span className="font-semibold text-slate-700">{selectedDay.booking.commuterPhone}</span></div>}</div>}
              <div className="rounded-xl border border-slate-100 p-3 text-[10px] leading-relaxed text-slate-500"><strong className="text-slate-700">One booking per day.</strong> Once a commuter books this spot, the day remains locked until the backend handles cancellation or reopening.</div>
            </aside>
          </div>

        </motion.section>
      )}
      </AnimatePresence>
    </div>
  );
}
