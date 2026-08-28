import React, { useMemo, useState } from 'react';
import { AlertCircle, Car, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, RefreshCw, Search, UserRound } from 'lucide-react';
import type { AdminVehicleDto } from '../types';

interface VehicleManagementProps {
  vehicles: AdminVehicleDto[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void | Promise<void>;
}

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || '-' : date.toLocaleString([], {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

export default function VehicleManagement({
  vehicles,
  isLoading,
  error,
  onRefresh,
}: VehicleManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) => !normalizedSearch || [
    vehicle.numberPlate,
    vehicle.vehicleBrand,
    vehicle.vehicleModel,
    vehicle.vehicleColor,
    vehicle.ownerName,
    vehicle.ownerEmail,
    vehicle.vehicleId,
  ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch))), [normalizedSearch, vehicles]);
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleVehicles = filteredVehicles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstResult = visibleVehicles.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastResult = visibleVehicles.length ? firstResult + visibleVehicles.length - 1 : 0;

  const changeSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const changePageSize = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Vehicle Management</h2>
          <p className="text-sm text-slate-500">Review every vehicle registered by commuters on ParkJom.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={isLoading}
          className="inline-flex min-h-9 items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</span>
          <button type="button" onClick={onRefresh} disabled={isLoading} className="self-start font-semibold underline underline-offset-2 disabled:opacity-50 sm:self-auto">Try again</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-slate-400">Registered vehicles</span><Car className="h-4 w-4 text-blue-600" /></div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{vehicles.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-slate-400">Unique owners</span><UserRound className="h-4 w-4 text-emerald-600" /></div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{new Set(vehicles.map((vehicle) => vehicle.ownerEmail || vehicle.ownerName || vehicle.vehicleId)).size}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-slate-400">Search results</span><Search className="h-4 w-4 text-amber-600" /></div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{filteredVehicles.length}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <label className="relative block w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input type="search" value={searchQuery} onChange={(event) => changeSearch(event.target.value)}
            placeholder="Search plate, vehicle, or owner" aria-label="Search vehicles"
            className="min-h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </label>
      </div>

      {isLoading && vehicles.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading vehicles</div>
      ) : visibleVehicles.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center text-slate-500"><AlertCircle className="h-7 w-7 text-slate-300" /><p className="text-sm font-semibold">No vehicles found</p><p className="text-xs">Try a different search term.</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500"><tr>
                <th className="rounded-tl-[11px] border-b-2 border-r border-slate-200 px-4 py-3">Vehicle</th>
                <th className="border-b-2 border-r border-slate-200 px-4 py-3">Owner</th>
                <th className="border-b-2 border-r border-slate-200 px-4 py-3">Details</th>
                <th className="rounded-tr-[11px] border-b-2 border-slate-200 px-4 py-3">Updated</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-200">{visibleVehicles.map((vehicle) => (
                <tr key={vehicle.vehicleId} className="align-top hover:bg-slate-50/70">
                  <td className="border-r border-slate-200 px-4 py-3"><p className="text-xs font-semibold text-slate-800">{vehicle.numberPlate}</p><p className="mt-1 font-mono text-[10px] text-slate-400">Vehicle #{vehicle.vehicleId}</p></td>
                  <td className="border-r border-slate-200 px-4 py-3 text-xs text-slate-600"><p className="font-semibold text-slate-700">{vehicle.ownerName || 'Unknown owner'}</p><p className="mt-0.5 text-[10px] text-slate-400">{vehicle.ownerEmail || 'No owner email'}</p></td>
                  <td className="border-r border-slate-200 px-4 py-3 text-xs text-slate-600"><p className="font-semibold text-slate-700">{vehicle.vehicleBrand} {vehicle.vehicleModel}</p><p className="mt-0.5 text-[10px] text-slate-400">{vehicle.vehicleColor}</p></td>
                  <td className="px-4 py-3 text-xs text-slate-600"><p className="whitespace-nowrap">{formatDate(vehicle.updatedAt)}</p><p className="mt-1 text-[10px] text-slate-400">Added {formatDate(vehicle.createdAt)}</p></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p className="text-[11px] text-slate-500">Showing <span className="font-semibold text-slate-700">{firstResult}-{lastResult}</span> of <span className="font-semibold text-slate-700">{filteredVehicles.length}</span> vehicles</p>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Rows per page
            <select value={pageSize} onChange={(event) => changePageSize(Number(event.target.value))} className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500" aria-label="Vehicles rows per page">
              <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
            </select>
          </label>
          <nav className="flex items-center gap-1" aria-label="Vehicle pagination">
            <button type="button" onClick={() => setPage(1)} disabled={isLoading || currentPage <= 1} title="First page" aria-label="First page" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronsLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={isLoading || currentPage <= 1} title="Previous page" aria-label="Previous page" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-20 text-center text-xs font-semibold text-slate-700">Page {currentPage} of {totalPages}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={isLoading || currentPage >= totalPages} title="Next page" aria-label="Next page" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={isLoading || currentPage >= totalPages} title="Last page" aria-label="Last page" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronsRight className="h-4 w-4" /></button>
          </nav>
        </div>
      </div>
    </div>
  );
}
