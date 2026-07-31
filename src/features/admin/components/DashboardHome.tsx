import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, Users, Radio, AlertTriangle, ShieldCheck, 
  Clock, DollarSign, ArrowUpRight, CheckCircle,
  BarChart3, PieChart, Activity, MapPin, Building
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
  PieChart as RePieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { PlatformStats } from '../types';

interface DashboardHomeProps {
  stats: PlatformStats;
  activityLogs: any[];
  setStats: React.Dispatch<React.SetStateAction<PlatformStats>>;
  systemConfig: { commissionRate: number; gracePeriodMinutes: number };
  setSystemConfig: React.Dispatch<React.SetStateAction<{ commissionRate: number; gracePeriodMinutes: number }>>;
}

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export default function DashboardHome({ 
  stats, 
  activityLogs, 
  systemConfig,
}: DashboardHomeProps) {

  // Revenue & Booking History over past week
  const weeklyChartData = [
    { day: "Mon", bookings: 120, revenue: 1540, commission: 231 },
    { day: "Tue", bookings: 145, revenue: 1980, commission: 297 },
    { day: "Wed", bookings: 160, revenue: 2100, commission: 315 },
    { day: "Thu", bookings: 152, revenue: 1850, commission: 277.5 },
    { day: "Fri", bookings: 210, revenue: 2950, commission: 442.5 },
    { day: "Sat", bookings: 245, revenue: 3820, commission: 573 },
    { day: "Sun", bookings: 280, revenue: 4120, commission: 618 },
  ];

  // Booking distribution by station
  const stationData = [
    { name: "Wangsa Maju LRT", bookings: 420, revenue: 2940 },
    { name: "Subang Jaya LRT", bookings: 380, revenue: 2660 },
    { name: "Gombak LRT", bookings: 310, revenue: 1860 },
    { name: "Kelana Jaya LRT", bookings: 280, revenue: 2240 },
    { name: "KLCC", bookings: 250, revenue: 2000 },
  ];

  // User growth data
  const userGrowthData = [
    { month: "Feb", drivers: 320, owners: 85 },
    { month: "Mar", drivers: 480, owners: 120 },
    { month: "Apr", drivers: 610, owners: 165 },
    { month: "May", drivers: 780, owners: 210 },
    { month: "Jun", drivers: 950, owners: 280 },
    { month: "Jul", drivers: 1120, owners: 300 },
  ];

  // Hourly booking distribution
  const hourlyData = [
    { hour: "6AM", bookings: 15 },
    { hour: "8AM", bookings: 85 },
    { hour: "10AM", bookings: 45 },
    { hour: "12PM", bookings: 30 },
    { hour: "2PM", bookings: 25 },
    { hour: "4PM", bookings: 40 },
    { hour: "6PM", bookings: 95 },
    { hour: "8PM", bookings: 55 },
    { hour: "10PM", bookings: 20 },
  ];

  // Booking status distribution for pie chart
  const bookingStatusData = [
    { name: "Completed", value: 68 },
    { name: "Active", value: 18 },
    { name: "Upcoming", value: 10 },
    { name: "Disputed", value: 4 },
  ];

  // Revenue breakdown by bay type
  const revenueByType = [
    { type: "Condo Bay", revenue: 18500, fill: "#2563EB" },
    { type: "Landed Driveway", revenue: 9850, fill: "#10B981" },
    { type: "Shop Lot", revenue: 4200, fill: "#F59E0B" },
    { type: "Office Basement", revenue: 2300, fill: "#8B5CF6" },
  ];

  const statCards = [
    {
      title: "Total Platform Gross Revenue",
      value: `RM ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: "Gross user bookings volume",
      icon: DollarSign,
      color: "#2563EB",
      textColor: "text-[#2563EB]",
      bgColor: "bg-[#2563EB]/5"
    },
    {
      title: "Platform Net Commission",
      value: `RM ${stats.platformCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: `${systemConfig.commissionRate}% active service fee`,
      icon: TrendingUp,
      color: "#2563EB",
      textColor: "text-[#2563EB]",
      bgColor: "bg-[#2563EB]/5"
    },
    {
      title: "Active Reservations",
      value: `${stats.activeBookings} bays`,
      subtitle: "In-progress smart locks",
      icon: ShieldCheck,
      color: "#10B981",
      textColor: "text-[#10B981]",
      bgColor: "bg-[#10B981]/5"
    },
    {
      title: "Registered Users",
      value: stats.totalUsers.toLocaleString(),
      subtitle: "Drivers & Property owners",
      icon: Users,
      color: "#2563EB",
      textColor: "text-[#2563EB]",
      bgColor: "bg-[#2563EB]/5"
    }
  ];

  return (
    <div id="dashboard-home" className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 id="home-title" className="text-2xl font-bold text-slate-800 tracking-tight">Executive Dashboard</h2>
          <p className="text-slate-500 text-sm">Real-time oversight of smart parking shares, IoT status, and transactions.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Stream Connected
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
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

      {/* Primary Analytics - Revenue Area Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Booking Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-md font-semibold text-slate-800">Financial Growth & Booking Volume</h3>
              <p className="text-xs text-slate-500">Weekly platform growth trend and calculated net commission</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
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
          </div>
        </div>

        {/* Booking Status Pie Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Booking Status Distribution</h3>
            </div>
          </div>
          <div className="h-52">
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
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {bookingStatusData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i] }}></span>
                <span className="text-slate-500">{item.name}</span>
                <span className="font-bold text-slate-700 ml-auto">{item.value}%</span>
              </div>
            ))}
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">IoT Online Rate</span>
              <span className="font-bold text-emerald-600">{stats.onlineBollardsRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Station Performance & Hourly Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bookings by Station - Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Bookings by LRT Station</h3>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stationData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} angle={-15} textAnchor="end" height={50} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="bookings" name="Total Bookings" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue (RM)" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours - Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Peak Booking Hours</h3>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip />
                <Bar dataKey="bookings" name="Bookings" radius={[4, 4, 0, 0]}>
                  {hourlyData.map((entry, index) => {
                    const fillColor = entry.bookings > 80 ? '#EF4444' : entry.bookings > 50 ? '#F59E0B' : '#10B981';
                    return <Cell key={`cell-${index}`} fill={fillColor} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-500 justify-center">
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]"></span> Peak (&gt;80)</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]"></span> Moderate (50-80)</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]"></span> Low (&lt;50)</div>
          </div>
        </div>
      </div>

      {/* Charts Row 3: User Growth & Revenue by Bay Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth - Line Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Platform User Growth</h3>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowthData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="drivers" name="Drivers" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="owners" name="Owners" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Bay Type - Horizontal Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Revenue by Bay Type</h3>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByType} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis dataKey="type" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={100} />
                <Tooltip />
                <Bar dataKey="revenue" name="Revenue (RM)" radius={[0, 4, 4, 0]}>
                  {revenueByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 justify-center">
            {revenueByType.map((item) => (
              <div key={item.type} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.fill }}></span>
                <span>{item.type}: <strong className="text-slate-700">RM {item.revenue.toLocaleString()}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom section: IoT Diagnostics & Logs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* IoT Quick Diagnostics */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500" />
            IoT Network Diagnostics
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>ESP32 Online Rate</span>
                <span className="font-semibold text-emerald-600">{stats.onlineBollardsRate}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${stats.onlineBollardsRate}%` }}></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Avg. Signal RSSI</span>
                <span className="font-semibold text-slate-800">-69 dBm</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: '78%' }}></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>MQTT Broker</span>
                <span className="font-semibold text-emerald-600">Stable</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Operation Logs */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Operational Log Feed</h3>
            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-mono font-bold">System Log Audit</span>
          </div>

          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {activityLogs.map((log) => {
              let tagColor = "bg-slate-100 text-slate-600 border-slate-200";
              if (log.type === "bollard_state") tagColor = "bg-blue-50 text-blue-700 border-blue-100";
              if (log.type === "overstay") tagColor = "bg-rose-50 text-rose-700 border-rose-100";
              if (log.type === "governance") tagColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
              if (log.type === "dispute") tagColor = "bg-amber-50 text-amber-700 border-amber-100";

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
