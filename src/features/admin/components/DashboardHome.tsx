import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  TrendingUp, Users, Radio, ShieldCheck,
  Clock, DollarSign, Activity, MapPin, Building,
  RefreshCw, AlertTriangle, Inbox, Wifi, WifiOff, Percent
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
  PieChart as RePieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import type { AdminDashboardData, SystemConfig } from '../types';

interface DashboardHomeProps {
  dashboard: AdminDashboardData | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  activityLogs: { id: string; type: string; message: string; timestamp: string; user: string }[];
  systemConfig: SystemConfig | null;
}

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const money = (value: number) =>
  `RM ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const compactMoney = (value: number) =>
  `RM ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/** Shared placeholder so an empty series never renders as a broken axis. */
function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center">
      <Inbox className="h-5 w-5 text-slate-300" />
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  );
}

export default function DashboardHome({
  dashboard,
  isLoading,
  error,
  onRefresh,
  activityLogs,
  systemConfig,
}: DashboardHomeProps) {
  const prefersReducedMotion = useReducedMotion();

  const stats = dashboard?.stats;
  const bookingCounts = dashboard?.bookingCounts;
  const weeklyChartData = dashboard?.weekly ?? [];
  const stationData = dashboard?.stations ?? [];
  const userGrowthData = dashboard?.userGrowth ?? [];
  const hourlyData = dashboard?.hourly ?? [];
  const revenueByType = dashboard?.revenueByType ?? [];

  const bookingStatusData = bookingCounts
    ? [
        { name: 'Completed', value: bookingCounts.completed },
        { name: 'Active', value: bookingCounts.active },
        { name: 'Confirmed', value: bookingCounts.confirmed },
        { name: 'Pending', value: bookingCounts.pending },
        { name: 'Cancelled', value: bookingCounts.cancelled },
        { name: 'Expired', value: bookingCounts.expired },
      ].filter((entry) => entry.value > 0)
    : [];
  const bookingStatusTotal = bookingStatusData.reduce((sum, entry) => sum + entry.value, 0);

  const peakHourlyBookings = hourlyData.reduce((max, point) => Math.max(max, point.bookings), 0);
  const hourlyBarColor = (bookings: number) => {
    if (peakHourlyBookings <= 0) return '#10B981';
    if (bookings >= peakHourlyBookings * 0.66) return '#EF4444';
    if (bookings >= peakHourlyBookings * 0.33) return '#F59E0B';
    return '#10B981';
  };

  const offlineBollards = stats ? Math.max(0, stats.totalBollards - stats.onlineBollards) : 0;
  const totalBays = bookingCounts?.total ?? 0;

  const statCards = [
    {
      title: 'Total Platform Revenue',
      value: money(stats?.totalRevenue ?? 0),
      subtitle: `Commission + overstay penalties · gross bookings ${compactMoney(stats?.grossBookingValue ?? 0)}`,
      icon: DollarSign,
      color: '#2563EB',
      textColor: 'text-[#2563EB]',
      bgColor: 'bg-[#2563EB]/5'
    },
    {
      title: 'Platform Net Commission',
      value: money(stats?.platformCommission ?? 0),
      subtitle: systemConfig
        ? `${systemConfig.commissionRate}% active service fee`
        : 'Commission rate unavailable',
      icon: TrendingUp,
      color: '#2563EB',
      textColor: 'text-[#2563EB]',
      bgColor: 'bg-[#2563EB]/5'
    },
    {
      title: 'Active Reservations',
      value: `${stats?.activeBookings ?? 0} bays`,
      subtitle: `${bookingCounts?.confirmed ?? 0} confirmed upcoming · ${bookingCounts?.completed ?? 0} completed`,
      icon: ShieldCheck,
      color: '#10B981',
      textColor: 'text-[#10B981]',
      bgColor: 'bg-[#10B981]/5'
    },
    {
      title: 'Registered Users',
      value: (stats?.totalUsers ?? 0).toLocaleString(),
      subtitle: `${stats?.totalCommuters ?? 0} commuters · ${stats?.totalOwners ?? 0} owners`,
      icon: Users,
      color: '#2563EB',
      textColor: 'text-[#2563EB]',
      bgColor: 'bg-[#2563EB]/5'
    }
  ];

  const attentionItems = stats
    ? [
        { label: 'Listing reviews pending', value: stats.pendingListingsCount, tone: 'text-amber-600' },
        { label: 'Open disputes', value: stats.openDisputesCount, tone: 'text-rose-600' },
        { label: 'Active overstays', value: stats.activeOverstaysCount, tone: 'text-rose-600' },
        { label: 'Open support tickets', value: stats.openTicketsCount, tone: 'text-indigo-600' },
      ]
    : [];

  return (
    <div id="dashboard-home" className="space-y-6">
      {/* Source + freshness banner */}
      <div className="flex flex-col gap-3 rounded-xl bg-[#f2f2f7] px-4 py-3 text-[12px] text-[#6e6e73] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Activity size={16} className="mt-0.5 shrink-0 text-[#007AFF]" />
          <p>
            {dashboard
              ? `All counters and charts are aggregated live from platform records${dashboard.generatedAt ? ` as of ${new Date(dashboard.generatedAt).toLocaleString()}` : ''}.`
              : 'Loading live platform metrics…'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#3c4043] transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : undefined} />
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-500" />
          <div className="min-w-0">
            <p className="font-semibold">Live metrics could not be loaded</p>
            <p className="mt-0.5 leading-relaxed">{error}</p>
            <p className="mt-1 text-rose-600">
              The values below are not current. Do not act on them until this reloads.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion
              ? { duration: 0.12, ease: 'linear' }
              : { type: 'spring', bounce: 0, duration: 0.34, delay: i * 0.03 }}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all duration-200 group relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{card.title}</span>
                <h3 className="text-2xl font-bold text-[#1E293B] tracking-tight">{card.value}</h3>
                <span className="text-xs text-[#64748B] block">{card.subtitle}</span>
              </div>
              <div className={`p-2.5 rounded-lg ${card.bgColor} ${card.textColor} group-hover:scale-105 transition-transform duration-200`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Attention strip — the queues an operator should look at first */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {attentionItems.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{item.label}</p>
              <p className={`mt-1 text-xl font-bold ${item.value > 0 ? item.tone : 'text-slate-400'}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Primary Analytics - Revenue Area Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-md font-semibold text-slate-800">Revenue &amp; Booking Volume — last 7 days</h3>
              <p className="text-xs text-slate-500">Gross booking value against the commission retained by the platform</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#2563EB]"></span>
                <span>Gross Revenue (RM)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]"></span>
                <span>Net Commission (RM)</span>
              </div>
            </div>
          </div>
          <div className="h-72 w-full">
            {weeklyChartData.length === 0 ? (
              <ChartEmptyState message="No bookings were recorded in the last seven days." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    labelClassName="font-semibold text-slate-700"
                  />
                  <Area type="monotone" dataKey="revenue" name="Gross (RM)" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="commission" name="Commission (RM)" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorCommission)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Booking Status Pie Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Booking Status Distribution</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">{totalBays} total</span>
          </div>
          <div className="h-52">
            {bookingStatusData.length === 0 ? (
              <ChartEmptyState message="No bookings have been created yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={bookingStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {bookingStatusData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} bookings`, '']} />
                </RePieChart>
              </ResponsiveContainer>
            )}
          </div>
          {bookingStatusData.length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {bookingStatusData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                  <span className="text-slate-500">{item.name}</span>
                  <span className="font-bold text-slate-700 ml-auto">
                    {bookingStatusTotal > 0 ? Math.round((item.value / bookingStatusTotal) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Bollards online</span>
              <span className="font-bold text-emerald-600">
                {stats?.onlineBollardsRate ?? 0}%
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{stats?.onlineBollards ?? 0} of {stats?.totalBollards ?? 0} registered</span>
              <span>{offlineBollards} offline</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Station Performance & Hourly Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Top Stations by Bookings</h3>
            </div>
            <span className="text-[10px] text-slate-400">Top 5</span>
          </div>
          <div className="h-64">
            {stationData.length === 0 ? (
              <ChartEmptyState message="No bookings are linked to a transit station yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stationData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} angle={-15} textAnchor="end" height={50} interval={0} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="bookings" name="Total Bookings" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenue" name="Revenue (RM)" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Peak Booking Hours</h3>
            </div>
            <span className="text-[10px] text-slate-400">By start time</span>
          </div>
          <div className="h-64">
            {hourlyData.length === 0 ? (
              <ChartEmptyState message="No bookings to distribute across the day yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="bookings" name="Bookings" radius={[4, 4, 0, 0]}>
                    {hourlyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={hourlyBarColor(entry.bookings)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-500 justify-center">
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]"></span> Busiest third</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]"></span> Moderate</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]"></span> Quiet</div>
          </div>
        </div>
      </div>

      {/* Charts Row 3: User Growth & Revenue by Bay Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Platform User Growth</h3>
            </div>
            <span className="text-[10px] text-slate-400">Last 6 months</span>
          </div>
          <div className="h-64">
            {userGrowthData.length === 0 ? (
              <ChartEmptyState message="No account registrations recorded yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userGrowthData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="drivers" name="Commuters" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="owners" name="Owners" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Revenue by Property Type</h3>
            </div>
            <span className="text-[10px] text-slate-400">Gross booking value</span>
          </div>
          <div className="h-64">
            {revenueByType.length === 0 ? (
              <ChartEmptyState message="No revenue has been recorded by property type yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByType} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis dataKey="type" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={110} />
                  <Tooltip />
                  <Bar dataKey="revenue" name="Revenue (RM)" radius={[0, 4, 4, 0]}>
                    {revenueByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {revenueByType.length > 0 && (
            <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 justify-center">
              {revenueByType.map((item, index) => (
                <div key={item.type} className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span>{item.type}: <strong className="text-slate-700">{compactMoney(item.revenue)}</strong></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: IoT Diagnostics & Logs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500" />
            Bollard Fleet Health
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Online rate</span>
                <span className="font-semibold text-emerald-600">{stats?.onlineBollardsRate ?? 0}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, stats?.onlineBollardsRate ?? 0)}%` }}></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Wifi className="w-3 h-3 text-emerald-500" /> Online
                </span>
                <span className="text-lg font-bold text-slate-800">{stats?.onlineBollards ?? 0}</span>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <WifiOff className="w-3 h-3 text-rose-500" /> Offline
                </span>
                <span className="text-lg font-bold text-slate-800">{offlineBollards}</span>
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">
              Signal strength and broker status are not exposed by the API yet, so they are not shown here.
            </p>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Actions taken in this session</h3>
            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-mono font-bold">Local audit trail</span>
          </div>

          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {activityLogs.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-slate-400">
                Nothing has been changed from this browser session yet. The full audit trail lives under System Audit.
              </p>
            ) : activityLogs.map((log) => {
              let tagColor = 'bg-slate-100 text-slate-600 border-slate-200';
              if (log.type === 'bollard_state') tagColor = 'bg-blue-50 text-blue-700 border-blue-100';
              if (log.type === 'overstay') tagColor = 'bg-rose-50 text-rose-700 border-rose-100';
              if (log.type === 'governance') tagColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
              if (log.type === 'dispute') tagColor = 'bg-amber-50 text-amber-700 border-amber-100';

              return (
                <div key={log.id} className="flex items-start gap-3 p-2 bg-slate-50/60 rounded-lg border border-slate-100 text-xs">
                  <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap mt-0.5">{log.timestamp}</span>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-slate-700 font-medium">{log.message}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full border ${tagColor}`}>{log.type}</span>
                      {log.user && <span className="text-[9px] text-slate-400">Triggered by: {log.user}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
