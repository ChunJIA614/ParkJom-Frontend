import AdminPageHeader from './AdminPageHeader';
import AdminSummaryCounts from './AdminSummaryCounts';
import SystemSelect from '@/components/ui/SystemSelect';
import { showAlert, showConfirm } from '@/components/common/ModalProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import VehicleAiScannerModal from '@/features/commuter/components/VehicleAiScannerModal';
import VehicleBrandModelFields from '@/features/commuter/components/VehicleBrandModelFields';
import { VEHICLE_CATALOG_FALLBACK } from '@/features/commuter/data/vehicleCatalog';
import {
  MAX_PLATE_LENGTH,
  normalizeVehiclePlate,
  sanitizePlateInput,
  validateVehiclePlate,
} from '@/features/commuter/lib/plateValidation';
import React, { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Car,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Info,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  createAdminVehicle,
  deleteAdminVehicle,
  updateAdminVehicle,
} from '../api/vehicleApi';
import {
  VEHICLE_COLOR_SUGGESTIONS,
  extractVehicleFilterOptions,
  filterAndSortVehicles,
  formatVehicleDate,
  getVehicleColorSwatch,
  getVehicleOwnerKey,
  isVehicleOwnedByUser,
  validateVehicleForm,
  type VehicleFormValues,
  type VehicleSortOption,
} from '../lib/vehicleHelpers';
import type { AdminVehicleDto } from '../types';

interface VehicleManagementProps {
  vehicles: AdminVehicleDto[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void | Promise<void>;
  addActivityLog?: (type: string, message: string, user: string) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

const EMPTY_FORM: VehicleFormValues = {
  numberPlate: '',
  vehicleBrand: '',
  vehicleModel: '',
  vehicleColor: '',
};

const fieldClass =
  'min-h-9 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121214] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#71717A] outline-hidden focus:border-[#007AFF] dark:focus:border-[#0071E3] focus:ring-1 focus:ring-[#007AFF] disabled:bg-slate-50 dark:disabled:bg-white/[0.04] disabled:text-slate-400 dark:disabled:text-[#71717A] transition-colors';

const formFromVehicle = (vehicle: AdminVehicleDto): VehicleFormValues => ({
  numberPlate: vehicle.numberPlate,
  vehicleBrand: vehicle.vehicleBrand,
  vehicleModel: vehicle.vehicleModel,
  vehicleColor: vehicle.vehicleColor,
});

const confirmVehicleDeletion = (vehicle: AdminVehicleDto) => {
  const details = [vehicle.vehicleBrand, vehicle.vehicleModel].filter(Boolean).join(' ') || 'Vehicle';
  const ownerSummary = vehicle.ownerName || vehicle.ownerEmail || 'Unknown owner';
  return showConfirm({
    title: `Delete ${vehicle.numberPlate}?`,
    message: `Remove ${details} (${vehicle.numberPlate}) owned by ${ownerSummary}?\n\nThis action cannot be undone. Vehicles tied to active bookings may be blocked by the server.`,
    confirmText: 'Delete vehicle',
    cancelText: 'Cancel',
    variant: 'danger',
    icon: 'trash',
  });
};

export default function VehicleManagement({
  vehicles,
  isLoading,
  error,
  onRefresh,
  addActivityLog,
}: VehicleManagementProps) {
  const { user: currentUser } = useAuth();
  const token = currentUser?.token ?? '';
  const currentUserEmail = currentUser?.email ?? null;

  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [sortBy, setSortBy] = useState<VehicleSortOption>('newest-id');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<VehicleFormValues>(EMPTY_FORM);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<VehicleFormValues>(EMPTY_FORM);
  const [deletingVehicleId, setDeletingVehicleId] = useState<number | null>(null);
  const [scannerTarget, setScannerTarget] = useState<'create' | 'edit' | null>(null);

  const { brands, owners } = useMemo(() => extractVehicleFilterOptions(vehicles), [vehicles]);
  const hasOwnVehicles = useMemo(
    () => vehicles.some((vehicle) => isVehicleOwnedByUser(vehicle, currentUserEmail)),
    [currentUserEmail, vehicles],
  );

  const filteredVehicles = useMemo(
    () =>
      filterAndSortVehicles(vehicles, {
        searchQuery,
        brandFilter,
        ownerFilter,
        sortBy,
        currentUserEmail,
      }),
    [brandFilter, currentUserEmail, ownerFilter, searchQuery, sortBy, vehicles],
  );

  const uniqueOwnerCount = useMemo(
    () => new Set(vehicles.map(getVehicleOwnerKey)).size,
    [vehicles],
  );

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleVehicles = filteredVehicles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstResult = visibleVehicles.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastResult = visibleVehicles.length ? firstResult + visibleVehicles.length - 1 : 0;

  const selectedVehicle = useMemo(
    () => (selectedVehicleId === null ? null : vehicles.find((v) => v.vehicleId === selectedVehicleId) ?? null),
    [selectedVehicleId, vehicles],
  );

  const hasActiveFilters = Boolean(searchQuery.trim() || brandFilter || ownerFilter || sortBy !== 'newest-id');

  const clearFilters = () => {
    setSearchQuery('');
    setBrandFilter('');
    setOwnerFilter('');
    setSortBy('newest-id');
    setPage(1);
  };

  const handleOpenCreate = () => {
    setCreateForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const handleOpenDetail = (vehicle: AdminVehicleDto) => {
    setEditForm(formFromVehicle(vehicle));
    setSelectedVehicleId(vehicle.vehicleId);
  };

  const handleRowDelete = async (vehicle: AdminVehicleDto) => {
    if (!token) {
      void showAlert({
        title: 'Session missing',
        message: 'Your admin session is missing an authorization token.',
        variant: 'danger',
        icon: 'danger',
      });
      return;
    }

    const confirmed = await confirmVehicleDeletion(vehicle);
    if (!confirmed) return;

    setDeletingVehicleId(vehicle.vehicleId);
    try {
      const response = await deleteAdminVehicle(token, vehicle.vehicleId);
      if (selectedVehicleId === vehicle.vehicleId) {
        setSelectedVehicleId(null);
      }
      addActivityLog?.(
        'vehicles',
        `${response.message} (${vehicle.numberPlate} · Vehicle #${vehicle.vehicleId}).`,
        'Admin',
      );
      await onRefresh();
      void showAlert({
        title: 'Vehicle deleted',
        message: response.message || `Vehicle ${vehicle.numberPlate} was removed.`,
        variant: 'success',
        icon: 'success',
      });
    } catch (deleteError) {
      void showAlert({
        title: 'Unable to delete vehicle',
        message: deleteError instanceof Error ? deleteError.message : 'Unable to delete this vehicle.',
        variant: 'danger',
        icon: 'danger',
      });
    } finally {
      setDeletingVehicleId(null);
    }
  };

  const handleScannerApply = (extracted: {
    numberPlate: string;
    brand: string;
    model: string;
    color: string;
  }) => {
    const patch = (current: VehicleFormValues): VehicleFormValues => ({
      numberPlate: extracted.numberPlate ? normalizeVehiclePlate(extracted.numberPlate) : current.numberPlate,
      vehicleBrand: extracted.brand?.trim() || current.vehicleBrand,
      vehicleModel: extracted.model?.trim() || current.vehicleModel,
      vehicleColor: extracted.color?.trim() || current.vehicleColor,
    });

    if (scannerTarget === 'create') {
      setCreateForm(patch);
    } else if (scannerTarget === 'edit') {
      setEditForm(patch);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Vehicle management"
        description="Register, inspect, update, and remove vehicles across the platform."
        isLoading={isLoading}
        onRefresh={onRefresh}
      >
        <button
          type="button"
          onClick={handleOpenCreate}
          className="workspace-button workspace-button--primary cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Register vehicle
        </button>
      </AdminPageHeader>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="self-start font-semibold underline underline-offset-2 disabled:opacity-50 sm:self-auto cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      <AdminSummaryCounts
        items={[
          { label: 'Registered vehicles', value: vehicles.length },
          { label: 'Unique owners', value: uniqueOwnerCount },
          { label: 'Brands', value: brands.length },
          { label: 'Matching results', value: filteredVehicles.length },
        ]}
      />

      <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-3 shadow-sm sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <label className="relative block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-[#A1A1AA]" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search plate, make, model, color, owner, or #ID"
              aria-label="Search vehicles"
              className="min-h-9 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121214] pl-9 pr-8 text-xs text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#71717A] outline-hidden focus:border-[#007AFF] dark:focus:border-[#0071E3] focus:ring-1 focus:ring-[#007AFF] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-2 top-2 rounded-md p-1 text-slate-400 hover:text-slate-700 dark:text-[#71717A] dark:hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          <SystemSelect
            aria-label="Filter by brand"
            value={brandFilter}
            onChange={(event) => {
              setBrandFilter(event.target.value);
              setPage(1);
            }}
            className={fieldClass}
          >
            <option value="">All brands</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </SystemSelect>

          <SystemSelect
            aria-label="Filter by owner"
            value={ownerFilter}
            onChange={(event) => {
              setOwnerFilter(event.target.value);
              setPage(1);
            }}
            className={fieldClass}
          >
            <option value="">All owners</option>
            {hasOwnVehicles && <option value="__mine__">My vehicles</option>}
            {owners.map((owner) => (
              <option key={owner.key} value={owner.key}>
                {owner.label}
              </option>
            ))}
          </SystemSelect>

          <SystemSelect
            aria-label="Sort vehicles"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as VehicleSortOption);
              setPage(1);
            }}
            className={fieldClass}
          >
            <option value="newest-id">Newest ID</option>
            <option value="updated-desc">Recently updated</option>
            <option value="updated-asc">Oldest updated</option>
            <option value="plate-asc">Plate (A–Z)</option>
            <option value="owner-asc">Owner (A–Z)</option>
          </SystemSelect>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-white/[0.06] pt-2.5 text-[11px] text-slate-500 dark:text-[#A1A1AA]">
            <span>
              Showing <strong className="text-slate-700 dark:text-white">{filteredVehicles.length}</strong> of{' '}
              <strong className="text-slate-700 dark:text-white">{vehicles.length}</strong> vehicles
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-[#0A84FF] hover:underline cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset filters
            </button>
          </div>
        )}
      </div>

      {isLoading && vehicles.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] text-sm text-slate-500 dark:text-[#A1A1AA]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading vehicles
        </div>
      ) : visibleVehicles.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] px-4 py-8 text-center text-slate-500 dark:text-[#A1A1AA]">
          <Car className="h-7 w-7 text-slate-300 dark:text-[#71717A]" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700 dark:text-white">No vehicles found</p>
          <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">
            {hasActiveFilters
              ? 'Try clearing or adjusting your search and filter criteria.'
              : 'No vehicles have been registered on the platform yet.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          className={`overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] shadow-[0_8px_24px_rgba(15,23,42,0.06)] ${
            isLoading ? 'opacity-70' : ''
          }`}
        >
          <div className="overflow-x-auto">
            <table role="table" className="workspace-record-table w-full min-w-[900px] border-separate border-spacing-0 text-left">
              <thead role="rowgroup" className="bg-slate-50 dark:bg-[#18181C] text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">
                <tr role="row">
                  <th role="columnheader" scope="col" className="rounded-tl-2xl border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">
                    Vehicle
                  </th>
                  <th role="columnheader" scope="col" className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">
                    Owner
                  </th>
                  <th role="columnheader" scope="col" className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">
                    Details
                  </th>
                  <th role="columnheader" scope="col" className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">
                    Updated
                  </th>
                  <th role="columnheader" scope="col" className="rounded-tr-2xl border-b border-slate-200 dark:border-white/10 px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="[&_tr:last-child_td]:border-b-0">
                {visibleVehicles.map((vehicle) => {
                  const isMine = isVehicleOwnedByUser(vehicle, currentUserEmail);
                  const isDeleting = deletingVehicleId === vehicle.vehicleId;
                  const swatch = getVehicleColorSwatch(vehicle.vehicleColor);

                  return (
                    <tr
                      role="row"
                      key={vehicle.vehicleId}
                      className="align-top hover:bg-slate-50/70 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <td role="cell" data-label="Vehicle" className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-lg border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-[#1E1E24] px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-800 dark:text-white">
                            {vehicle.numberPlate}
                          </span>
                          {isMine && (
                            <span className="rounded-full bg-blue-50 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-[#0A84FF] ring-1 ring-blue-200 dark:ring-blue-800/60">
                              Yours
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-slate-400 dark:text-[#71717A]">
                          Vehicle #{vehicle.vehicleId}
                        </p>
                      </td>

                      <td role="cell" data-label="Owner" className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3 text-xs text-slate-600 dark:text-[#A1A1AA]">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-[#A1A1AA] ring-1 ring-slate-200 dark:ring-white/10">
                            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-700 dark:text-white">
                              {vehicle.ownerName || 'Unknown owner'}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-[#71717A]">
                              {vehicle.ownerEmail || 'No owner email'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td role="cell" data-label="Details" className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3 text-xs text-slate-600 dark:text-[#A1A1AA]">
                        <p className="font-semibold text-slate-700 dark:text-white">
                          {[vehicle.vehicleBrand, vehicle.vehicleModel].filter(Boolean).join(' ') || 'Unspecified model'}
                        </p>
                        <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-[#A1A1AA]">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/25"
                            style={{ backgroundColor: swatch }}
                            aria-hidden="true"
                          />
                          <span>{vehicle.vehicleColor || 'Unspecified color'}</span>
                        </div>
                      </td>

                      <td role="cell" data-label="Updated" className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3 text-xs text-slate-600 dark:text-[#A1A1AA]">
                        <p className="whitespace-nowrap text-slate-700 dark:text-white">
                          {formatVehicleDate(vehicle.updatedAt || vehicle.createdAt)}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400 dark:text-[#71717A]">
                          Added {formatVehicleDate(vehicle.createdAt)}
                        </p>
                      </td>

                      <td role="cell" data-label="Actions" className="border-b border-slate-200 dark:border-white/10 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(vehicle)}
                            disabled={isDeleting}
                            aria-label={`Manage vehicle ${vehicle.numberPlate}`}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-3 text-[11px] font-semibold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-[#0A84FF]" aria-hidden="true" />
                            Manage
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRowDelete(vehicle)}
                            disabled={isDeleting}
                            aria-label={`Delete vehicle ${vehicle.numberPlate}`}
                            className="inline-flex min-h-8 items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:cursor-wait disabled:opacity-50 cursor-pointer"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {isDeleting ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">
          Showing <span className="font-semibold text-slate-700 dark:text-white">{firstResult}-{lastResult}</span> of{' '}
          <span className="font-semibold text-slate-700 dark:text-white">{filteredVehicles.length}</span> vehicles
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">
            Rows per page
            <SystemSelect
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="min-h-9 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#121214] px-2 text-xs font-semibold text-slate-700 dark:text-white outline-hidden focus:border-[#007AFF] dark:focus:border-[#0071E3] focus:ring-1 focus:ring-[#007AFF]"
              aria-label="Vehicles rows per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </SystemSelect>
          </label>
          <nav className="flex items-center gap-1" aria-label="Vehicle pagination">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={isLoading || currentPage <= 1}
              title="First page"
              aria-label="First page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={isLoading || currentPage <= 1}
              title="Previous page"
              aria-label="Previous page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-20 text-center text-xs font-semibold text-slate-700 dark:text-white">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={isLoading || currentPage >= totalPages}
              title="Next page"
              aria-label="Next page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={isLoading || currentPage >= totalPages}
              title="Last page"
              aria-label="Last page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </div>

      {createOpen && (
        <VehicleCreateDrawer
          token={token}
          currentUserEmail={currentUserEmail}
          form={createForm}
          setForm={setCreateForm}
          disableEscapeClose={scannerTarget !== null}
          onOpenScanner={() => setScannerTarget('create')}
          onClose={() => setCreateOpen(false)}
          onCreated={async (createdPlate, message) => {
            setCreateOpen(false);
            addActivityLog?.('vehicles', `${message} (${createdPlate}).`, 'Admin');
            await onRefresh();
            void showAlert({
              title: 'Vehicle registered',
              message: `${message} (${createdPlate})`,
              variant: 'success',
              icon: 'success',
            });
          }}
        />
      )}

      {selectedVehicle && (
        <VehicleDetailDrawer
          token={token}
          vehicle={selectedVehicle}
          currentUserEmail={currentUserEmail}
          form={editForm}
          setForm={setEditForm}
          disableEscapeClose={scannerTarget !== null}
          onOpenScanner={() => setScannerTarget('edit')}
          onClose={() => setSelectedVehicleId(null)}
          onUpdated={async (updated, message) => {
            addActivityLog?.(
              'vehicles',
              `${message} (${updated.numberPlate} · Vehicle #${updated.vehicleId}).`,
              'Admin',
            );
            await onRefresh();
            void showAlert({
              title: 'Vehicle updated',
              message: message || `Vehicle ${updated.numberPlate} updated successfully.`,
              variant: 'success',
              icon: 'success',
            });
          }}
          onDeleted={async (deleted, message) => {
            setSelectedVehicleId(null);
            addActivityLog?.(
              'vehicles',
              `${message} (${deleted.numberPlate} · Vehicle #${deleted.vehicleId}).`,
              'Admin',
            );
            await onRefresh();
            void showAlert({
              title: 'Vehicle deleted',
              message: message || `Vehicle ${deleted.numberPlate} was removed.`,
              variant: 'success',
              icon: 'success',
            });
          }}
        />
      )}

      <VehicleAiScannerModal
        open={scannerTarget !== null}
        mode="onboarding"
        token={token}
        onClose={() => setScannerTarget(null)}
        onApplyVehicle={handleScannerApply}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Drawer Frame & Form Fields
// ---------------------------------------------------------------------------

interface VehicleDrawerFrameProps {
  title: string;
  subtitle: string;
  titleId: string;
  closeLabel: string;
  isBusy: boolean;
  disableEscapeClose?: boolean;
  onClose: () => void;
  children: ReactNode;
}

function VehicleDrawerFrame({
  title,
  subtitle,
  titleId,
  closeLabel,
  isBusy,
  disableEscapeClose = false,
  onClose,
  children,
}: VehicleDrawerFrameProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy && !disableEscapeClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [disableEscapeClose, isBusy, onClose]);

  const drawer = (
    <div className="admin-drawer-portal fixed inset-0 z-[100] flex justify-end bg-black/50 dark:bg-black/70 backdrop-blur-xs">
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 cursor-default"
        onClick={() => !isBusy && onClose()}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="admin-drawer-panel relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121214] shadow-2xl animate-in slide-in-from-right duration-200"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-5 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-base font-bold text-slate-800 dark:text-white">
              {title}
            </h3>
            <p className="truncate text-xs text-slate-500 dark:text-[#A1A1AA]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-500 dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(drawer, document.body) : drawer;
}

interface VehicleFormFieldsProps {
  values: VehicleFormValues;
  onChange: (next: VehicleFormValues) => void;
  disabled: boolean;
  onOpenScanner: () => void;
  scannerDisabled?: boolean;
}

function VehicleFormFields({
  values,
  onChange,
  disabled,
  onOpenScanner,
  scannerDisabled = false,
}: VehicleFormFieldsProps) {
  const plateError = values.numberPlate.trim() ? validateVehiclePlate(values.numberPlate) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 rounded-xl border border-blue-200/80 dark:border-white/10 bg-blue-50/70 dark:bg-white/[0.04] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-[#0A84FF]" aria-hidden="true" />
            AI Plate &amp; Vehicle Scanner
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#A1A1AA]">
            Auto-fill plate, brand, model, and color from a vehicle or road-tax photo.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenScanner}
          disabled={disabled || scannerDisabled}
          className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-blue-200 dark:border-white/15 bg-white dark:bg-[#1E1E24] px-3 text-[11px] font-semibold text-blue-600 dark:text-[#0A84FF] hover:bg-blue-50 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-40 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Scan with AI
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-[#A1A1AA]">
          Number plate
        </span>
        <input
          type="text"
          value={values.numberPlate}
          onChange={(event) => onChange({ ...values, numberPlate: sanitizePlateInput(event.target.value) })}
          placeholder="WXY 1234"
          maxLength={MAX_PLATE_LENGTH}
          required
          disabled={disabled}
          aria-label="Number plate"
          aria-invalid={Boolean(plateError)}
          className={`${fieldClass} font-mono font-semibold uppercase tracking-wider ${
            plateError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500 dark:border-rose-500/70' : ''
          }`}
        />
        {plateError ? (
          <span className="block text-[11px] font-medium text-rose-600 dark:text-rose-400">{plateError}</span>
        ) : (
          <span className="block text-[10px] text-slate-400 dark:text-[#71717A]">
            Malaysian JPJ format, e.g. WXY 1234 or W 1234 A
          </span>
        )}
      </label>

      <VehicleBrandModelFields
        brand={values.vehicleBrand}
        model={values.vehicleModel}
        catalog={VEHICLE_CATALOG_FALLBACK}
        disabled={disabled}
        onBrandChange={(vehicleBrand) => onChange({ ...values, vehicleBrand })}
        onModelChange={(vehicleModel) => onChange({ ...values, vehicleModel })}
      />

      <div className="space-y-1.5">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-[#A1A1AA]">
            Color
          </span>
          <input
            type="text"
            value={values.vehicleColor}
            onChange={(event) => onChange({ ...values, vehicleColor: event.target.value })}
            placeholder="Silver"
            maxLength={30}
            required
            disabled={disabled}
            aria-label="Vehicle color"
            className={fieldClass}
          />
        </label>
        <div className="flex flex-wrap gap-1.5 pt-0.5" role="group" aria-label="Quick color choices">
          {VEHICLE_COLOR_SUGGESTIONS.map((colorOption) => {
            const active = values.vehicleColor.trim().toLowerCase() === colorOption.toLowerCase();
            return (
              <button
                key={colorOption}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...values, vehicleColor: colorOption })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors disabled:opacity-40 cursor-pointer ${
                  active
                    ? 'border-blue-500 dark:border-[#0A84FF] bg-blue-50 dark:bg-[#0A84FF]/15 text-blue-700 dark:text-[#0A84FF]'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-black/15 dark:ring-white/25"
                  style={{ backgroundColor: getVehicleColorSwatch(colorOption) }}
                  aria-hidden="true"
                />
                {colorOption}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Vehicle Drawer
// ---------------------------------------------------------------------------

interface VehicleCreateDrawerProps {
  token: string;
  currentUserEmail: string | null;
  form: VehicleFormValues;
  setForm: (next: VehicleFormValues) => void;
  disableEscapeClose: boolean;
  onOpenScanner: () => void;
  onClose: () => void;
  onCreated: (createdPlate: string, message: string) => Promise<void>;
}

function VehicleCreateDrawer({
  token,
  currentUserEmail,
  form,
  setForm,
  disableEscapeClose,
  onOpenScanner,
  onClose,
  onCreated,
}: VehicleCreateDrawerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Your admin session is missing an authorization token.');
      return;
    }

    const validationError = validateVehicleForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const response = await createAdminVehicle(token, form);
      const createdPlate = response.data?.numberPlate || form.numberPlate.trim().toUpperCase();
      await onCreated(createdPlate, response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to register this vehicle.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <VehicleDrawerFrame
      title="Register vehicle"
      subtitle="Add a vehicle record using the catalog or Vision AI."
      titleId="admin-vehicle-create-title"
      closeLabel="Close vehicle registration"
      isBusy={isSaving}
      disableEscapeClose={disableEscapeClose}
      onClose={onClose}
    >
      <div className="flex items-start gap-2.5 rounded-2xl border border-blue-200/80 dark:border-white/10 bg-blue-50/70 dark:bg-white/[0.04] px-4 py-3 text-[11px] leading-relaxed text-slate-600 dark:text-[#A1A1AA]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-[#0A84FF]" aria-hidden="true" />
        <div>
          <p className="font-semibold text-slate-800 dark:text-white">Assigned to signed-in admin account</p>
          <p className="mt-0.5">
            The current backend endpoint <code className="font-mono text-[10px]">POST /api/vehicle/add</code> registers new vehicles under{' '}
            <strong className="text-slate-800 dark:text-white">{currentUserEmail || 'your active account'}</strong>{' '}
            and does not yet accept a target commuter <code className="font-mono text-[10px]">userId</code>.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-xs text-rose-800 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 shadow-sm"
      >
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">
          Vehicle details
        </h4>

        <VehicleFormFields
          values={form}
          onChange={setForm}
          disabled={isSaving}
          onOpenScanner={onOpenScanner}
          scannerDisabled={!token}
        />

        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-white/[0.06] pt-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="min-h-9 rounded-xl px-3.5 text-xs font-semibold text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-[#0071E3] px-4 text-xs font-semibold text-white hover:bg-blue-700 dark:hover:bg-[#0077ED] shadow-sm transition-colors disabled:opacity-40 cursor-pointer"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {isSaving ? 'Registering…' : 'Register vehicle'}
          </button>
        </div>
      </form>
    </VehicleDrawerFrame>
  );
}

// ---------------------------------------------------------------------------
// Detail + Edit + Delete Drawer
// ---------------------------------------------------------------------------

interface VehicleDetailDrawerProps {
  token: string;
  vehicle: AdminVehicleDto;
  currentUserEmail: string | null;
  form: VehicleFormValues;
  setForm: (next: VehicleFormValues) => void;
  disableEscapeClose: boolean;
  onOpenScanner: () => void;
  onClose: () => void;
  onUpdated: (vehicle: AdminVehicleDto, message: string) => Promise<void>;
  onDeleted: (vehicle: AdminVehicleDto, message: string) => Promise<void>;
}

function VehicleDetailDrawer({
  token,
  vehicle,
  currentUserEmail,
  form,
  setForm,
  disableEscapeClose,
  onOpenScanner,
  onClose,
  onUpdated,
  onDeleted,
}: VehicleDetailDrawerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [vehicle.vehicleId]);

  const isBusy = isSaving || isDeleting;
  const isSelfOwned = isVehicleOwnedByUser(vehicle, currentUserEmail);

  const hasChanges =
    form.numberPlate.trim().toUpperCase() !== vehicle.numberPlate.trim().toUpperCase()
    || form.vehicleBrand.trim() !== vehicle.vehicleBrand.trim()
    || form.vehicleModel.trim() !== vehicle.vehicleModel.trim()
    || form.vehicleColor.trim() !== vehicle.vehicleColor.trim();

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Your admin session is missing an authorization token.');
      return;
    }

    const validationError = validateVehicleForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const response = await updateAdminVehicle(token, {
        vehicleId: vehicle.vehicleId,
        ...form,
      });
      const updatedDto: AdminVehicleDto = response.data ?? {
        ...vehicle,
        numberPlate: form.numberPlate.trim().toUpperCase(),
        vehicleBrand: form.vehicleBrand.trim(),
        vehicleModel: form.vehicleModel.trim(),
        vehicleColor: form.vehicleColor.trim(),
        updatedAt: new Date().toISOString(),
      };
      setForm(formFromVehicle(updatedDto));
      await onUpdated(updatedDto, response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update this vehicle.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    if (!token) {
      setError('Your admin session is missing an authorization token.');
      return;
    }

    const confirmed = await confirmVehicleDeletion(vehicle);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await deleteAdminVehicle(token, vehicle.vehicleId);
      await onDeleted(vehicle, response.message);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this vehicle.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <VehicleDrawerFrame
      title={`Vehicle #${vehicle.vehicleId}`}
      subtitle={`${vehicle.numberPlate} · ${[vehicle.vehicleBrand, vehicle.vehicleModel].filter(Boolean).join(' ') || 'Vehicle'}`}
      titleId="admin-vehicle-detail-title"
      closeLabel="Close vehicle details"
      isBusy={isBusy}
      disableEscapeClose={disableEscapeClose}
      onClose={onClose}
    >
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-xs text-rose-800 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-white/[0.06] text-blue-600 dark:text-[#0A84FF] ring-1 ring-slate-200 dark:ring-white/10">
              <Car className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-[#1E1E24] px-2.5 py-0.5 font-mono text-sm font-bold tracking-wider text-slate-900 dark:text-white">
                  {vehicle.numberPlate}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-[#A1A1AA]">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-black/15 dark:ring-white/25"
                    style={{ backgroundColor: getVehicleColorSwatch(vehicle.vehicleColor) }}
                    aria-hidden="true"
                  />
                  {vehicle.vehicleColor || 'Unspecified'}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-[#A1A1AA]">
                {[vehicle.vehicleBrand, vehicle.vehicleModel].filter(Boolean).join(' ') || 'Unspecified make & model'}
              </p>
            </div>
          </div>

          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${
              isSelfOwned
                ? 'bg-blue-50 dark:bg-white/[0.06] text-blue-700 dark:text-[#0A84FF] ring-blue-200 dark:ring-blue-800/60'
                : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-[#A1A1AA] ring-slate-200 dark:ring-white/10'
            }`}
          >
            {isSelfOwned ? 'Your account' : 'Commuter owned'}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 dark:border-white/[0.06] pt-3 text-[11px]">
          <dt className="text-slate-400 dark:text-[#71717A]">Owner</dt>
          <dd className="truncate font-semibold text-slate-700 dark:text-white">
            {vehicle.ownerName || 'Unknown owner'}
          </dd>
          <dt className="text-slate-400 dark:text-[#71717A]">Owner email</dt>
          <dd className="truncate text-slate-700 dark:text-white">{vehicle.ownerEmail || '—'}</dd>
          <dt className="text-slate-400 dark:text-[#71717A]">Registered</dt>
          <dd className="text-slate-700 dark:text-white">{formatVehicleDate(vehicle.createdAt)}</dd>
          <dt className="text-slate-400 dark:text-[#71717A]">Last updated</dt>
          <dd className="text-slate-700 dark:text-white">{formatVehicleDate(vehicle.updatedAt)}</dd>
        </dl>
      </section>

      <form
        onSubmit={handleSave}
        className="space-y-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 shadow-sm"
      >
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">
          Edit vehicle
        </h4>

        {!isSelfOwned && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Owned by <strong>{vehicle.ownerName || vehicle.ownerEmail || 'another user'}</strong>.{' '}
              <code className="font-mono text-[10px]">PUT /api/vehicle/modify</code> currently enforces vehicle ownership on the live backend unless admin override is enabled.
            </span>
          </div>
        )}

        <VehicleFormFields
          values={form}
          onChange={setForm}
          disabled={isBusy}
          onOpenScanner={onOpenScanner}
          scannerDisabled={!token}
        />

        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-white/[0.06] pt-3">
          <button
            type="button"
            disabled={!hasChanges || isBusy}
            onClick={() => {
              setForm(formFromVehicle(vehicle));
              setError(null);
            }}
            className="min-h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={!hasChanges || isBusy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-[#0071E3] px-4 text-xs font-semibold text-white hover:bg-blue-700 dark:hover:bg-[#0077ED] shadow-sm transition-colors disabled:opacity-40 cursor-pointer"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-[#18181C] p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Remove vehicle
            </h4>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-[#A1A1AA]">
              Admin deletion uses <code className="font-mono text-[10px]">DELETE /api/vehicle/delete/{vehicle.vehicleId}</code>. Vehicles with active bookings cannot be removed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isBusy}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-40 cursor-pointer"
          >
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {isDeleting ? 'Deleting…' : 'Delete vehicle'}
          </button>
        </div>
      </section>
    </VehicleDrawerFrame>
  );
}
