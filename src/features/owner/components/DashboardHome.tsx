import React, { useState } from 'react';
import { 
  Wallet, 
  CalendarClock, 
  CheckCircle, 
  TrendingDown, 
  Search, 
  ChevronRight, 
  Building, 
  Clock, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  X,
  CreditCard,
  Radio,
  Wifi,
  Battery,
  Settings,
  RefreshCw,
  Activity,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Booking } from '../types';

import { ParkingBay } from '../types';

interface DashboardHomeProps {
  walletBalance: number;
  onWithdraw: (amount: number) => void;
  bookings: Booking[];
  bays: ParkingBay[];
  baysLoading?: boolean;
  activeBank: { name: string; accNo: string; holder: string };
  onResolveDispute: (id: string) => void;
}

export default function DashboardHome({ 
  walletBalance, 
  onWithdraw, 
  bookings, 
  bays,
  baysLoading = false,
  activeBank,
  onResolveDispute 
}: DashboardHomeProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('150');
  const [agreeTerms, setWithdrawAgreeTerms] = useState(false);
  const [activeDispute, setActiveDispute] = useState<Booking | null>(null);

  interface IoTDevice {
    id: string;
    status: 'Online' | 'Offline';
    bay: string;
    location: string;
    batteryCell: number;
    barrierState: 'RAISED' | 'LOWERED' | 'LOWERING...' | 'RAISING...';
    rssi: number;
    lastHeartbeat: string;
    requiresService: boolean;
  }

  const [iotDevices, setIotDevices] = useState<IoTDevice[]>([
    {
      id: 'BLD-SS15-01',
      status: 'Online',
      bay: 'Bay 12',
      location: 'SS15 Courtyard, Subang Jaya',
      batteryCell: 89,
      barrierState: 'RAISED',
      rssi: -64,
      lastHeartbeat: '2 mins ago',
      requiresService: false,
    },
    {
      id: 'BLD-SS15-02',
      status: 'Online',
      bay: 'Bay 13',
      location: 'SS15 Courtyard, Subang Jaya',
      batteryCell: 94,
      barrierState: 'LOWERED',
      rssi: -61,
      lastHeartbeat: 'Just now',
      requiresService: false,
    },
    {
      id: 'BLD-KLCC-09',
      status: 'Online',
      bay: 'Bay B2-44',
      location: 'KLCC Parkview Residences',
      batteryCell: 12,
      barrierState: 'RAISED',
      rssi: -78,
      lastHeartbeat: '5 mins ago',
      requiresService: true,
    }
  ]);

  const [activeToast, setActiveToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setActiveToast({ message, type });
    setTimeout(() => {
      setActiveToast(null);
    }, 4000);
  };

  const handleToggleBarrier = (deviceId: string) => {
    setIotDevices(prev => prev.map(dev => {
      if (dev.id === deviceId) {
        if (dev.status === 'Offline') {
          showToast(`Cannot control node ${deviceId} while it is offline!`, 'warning');
          return dev;
        }
        const isCurrentlyRaised = dev.barrierState === 'RAISED';
        const nextTransitionState = isCurrentlyRaised ? 'LOWERING...' : 'RAISING...';
        
        // Trigger timeout to complete transition after 1.5s
        setTimeout(() => {
          setIotDevices(current => current.map(d => {
            if (d.id === deviceId) {
              showToast(`ESP32 Gateway [${deviceId}] successfully ${isCurrentlyRaised ? 'LOWERED' : 'RAISED'} the physical barrier!`, 'success');
              return {
                ...d,
                barrierState: isCurrentlyRaised ? 'LOWERED' : 'RAISED',
                lastHeartbeat: 'Just now'
              };
            }
            return d;
          }));
        }, 1500);

        showToast(`Sending command: ${isCurrentlyRaised ? 'LOWER_BARRIER' : 'RAISE_BARRIER'} to node ${deviceId}...`, 'info');
        return {
          ...dev,
          barrierState: nextTransitionState as any
        };
      }
      return dev;
    }));
  };

  const handleReboot = (deviceId: string) => {
    setIotDevices(prev => prev.map(dev => {
      if (dev.id === deviceId) {
        showToast(`Reboot command sent to ESP32 node ${deviceId}. Device going offline briefly...`, 'warning');
        
        // Put device Offline for a moment
        setTimeout(() => {
          setIotDevices(current => current.map(d => {
            if (d.id === deviceId) {
              showToast(`ESP32 Node [${deviceId}] is back online! Synced status 100%.`, 'success');
              return {
                ...d,
                status: 'Online',
                lastHeartbeat: 'Just now'
              };
            }
            return d;
          }));
        }, 2500);

        return {
          ...dev,
          status: 'Offline',
          barrierState: dev.barrierState
        };
      }
      return dev;
    }));
  };

  const handleDiagnose = (deviceId: string) => {
    showToast(`Running remote self-test diagnostic on node ${deviceId}...`, 'info');
    setTimeout(() => {
      const device = iotDevices.find(d => d.id === deviceId);
      if (device?.requiresService) {
        showToast(`Diagnostic Report for ${deviceId}: Internal battery warning (12% level). Solar auxiliary power is active. HC-SR04 ultrasonic sensor fully responsive.`, 'warning');
      } else {
        showToast(`Diagnostic Report for ${deviceId}: 100% operational. Battery: ${device?.batteryCell}%. RSSI: ${device?.rssi} dBm. Barrier actuator calibrated. No obstructions.`, 'success');
      }
    }, 1800);
  };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (amountNum > walletBalance) {
      alert('Insufficient wallet balance!');
      return;
    }
    if (!agreeTerms) {
      alert('Please agree to verification terms.');
      return;
    }

    onWithdraw(amountNum);
    setIsWithdrawModalOpen(false);
    setWithdrawAgreeTerms(false);
    // Alert feedback
    alert(`Settlement request of RM ${amountNum.toFixed(2)} successful!\n\nYour funds will be transferred to:\nBank: ${activeBank.name}\nAccount No: ${activeBank.accNo}\nBeneficiary Name: ${activeBank.holder}`);
  };

  // Filter Bookings
  const filteredBookings = bookings.filter(b => {
    const matchesSearch = 
      b.renterPlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.bayInfo.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate Paginated Bookings
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredBookings.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);

  const upcomingCount = bookings.filter(b => b.status === 'Upcoming' || b.status === 'Active').length;
  const completedCount = bookings.filter(b => b.status === 'Completed').length;
  
  // Commission represents 10% platform fee
  const totalCommission = bookings
    .filter(b => b.status === 'Completed')
    .reduce((acc, b) => acc + b.commissionPaid, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Welcome Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">Supply &amp; Earnings</h1>
          <p className="text-slate-500 text-[10px] md:text-xs mt-0.5 leading-normal hidden md:block">
            Verify bookings, track cash flows, and manage payouts near TODs.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-2.5 md:px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-semibold w-fit">
          <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-600 animate-pulse"></span>
          <span>Gateway: Online</span>
        </div>
      </div>

      {/* Overview stats cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6">
        {/* Wallet Balance Card */}
        <div className="lg:col-span-4 bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Wallet className="w-4 h-4 text-blue-600" />
                Withdrawable
              </span>
              <span className="bg-blue-50 border border-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                Verified Host
              </span>
            </div>
            <span className="text-slate-400 text-xs font-medium block mb-1">Current Balance</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 italic">RM</span>
              <span className="text-3xl font-black text-slate-900">{walletBalance.toFixed(2)}</span>
            </div>
          </div>

          <button 
            onClick={() => setIsWithdrawModalOpen(true)}
            className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-md animate-in"
          >
            <CreditCard className="w-4 h-4 text-blue-400" />
            Withdraw Funds
          </button>
        </div>

        {/* Analytic Metrics */}
        <div className="lg:col-span-8 grid grid-cols-2 gap-3 md:gap-6">
          {/* Upcoming Card */}
          <div className="bg-white p-3 md:p-5 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming</span>
              <div className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-lg">
                <CalendarClock className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
            <div className="mt-2 md:mt-4">
              <h3 className="text-2xl md:text-3xl font-black text-blue-600">{upcomingCount}</h3>
              <p className="text-green-600 text-[9px] md:text-[10px] font-semibold mt-0.5 md:mt-1 flex items-center gap-1 truncate">
                <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" /> Next at 8:30 AM
              </p>
            </div>
          </div>

          {/* Completed Card */}
          <div className="bg-white p-3 md:p-5 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Completed</span>
              <div className="p-1.5 md:p-2 bg-slate-50 text-slate-700 rounded-lg">
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
            <div className="mt-2 md:mt-4">
              <h3 className="text-2xl md:text-3xl font-black text-slate-900">{completedCount}</h3>
              <p className="text-slate-400 text-[9px] md:text-[10px] font-medium mt-0.5 md:mt-1">
                Sessions managed
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Parking Bays */}
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
          <h2 className="font-bold text-sm md:text-base text-slate-900">My Parking Bays</h2>
          <span className="text-[10px] font-medium text-slate-400 ml-auto">{bays.length} bay{bays.length !== 1 ? 's' : ''}</span>
        </div>

        {baysLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Loader2 size={28} className="mx-auto text-blue-600 mb-2 animate-spin" />
            <p className="text-[13px] text-slate-500">Loading your parking bays...</p>
          </div>
        ) : bays.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Building className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-[13px] font-medium text-slate-600">No parking bays yet</p>
            <p className="text-[11px] text-slate-400 mt-1">Go to Register to onboard your first property.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bays.map((bay) => (
              <div key={bay.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{bay.propertyName}</p>
                  <p className="text-[11px] text-slate-500">{bay.bayNumber} &middot; {bay.level} &middot; {bay.stationName}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[12px] font-bold text-emerald-600">RM {bay.hourlyRate.toFixed(2)}/hr</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      bay.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                      bay.status === 'Approved' ? 'bg-blue-50 text-blue-700' :
                      bay.status === 'Rejected' ? 'bg-rose-50 text-rose-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>{bay.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IoT Gateways */}
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 md:gap-2">
            <Radio className="w-4 h-4 md:w-5 md:h-5 text-blue-600 animate-pulse" />
            <h2 className="font-bold text-sm md:text-base text-slate-900 truncate">IoT Gateways</h2>
          </div>
          <span className="text-[9px] md:text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider bg-slate-100 border border-slate-200 px-2 md:px-2.5 py-0.5 rounded-lg whitespace-nowrap">
            {iotDevices.filter(d => d.status === 'Online').length}/{iotDevices.length} online
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
          {iotDevices.map((device) => (
            <div key={device.id} className="bg-white rounded-xl md:rounded-2xl border border-slate-200 p-3 md:p-6 flex flex-col justify-between shadow-sm">
              <div>
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">ESP32</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1 md:gap-1.5 mt-0.5 text-[11px] md:text-sm">
                      <Radio className="w-3 h-3 md:w-4 md:h-4 text-blue-500 shrink-0" />
                      <span className="truncate">{device.id}</span>
                    </span>
                  </div>
                  <span className={`shrink-0 px-1.5 md:px-2.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-extrabold uppercase flex items-center gap-1 border
                    ${device.status === 'Online' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}
                  `}>
                    <span className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${device.status === 'Online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {device.status}
                  </span>
                </div>

                {/* Info row */}
                <div className="flex items-center justify-between mt-2 md:mt-3 text-[10px] md:text-xs">
                  <span className="text-slate-400 font-medium">{device.bay}</span>
                  <span className="font-semibold text-slate-600 truncate ml-2">{device.location.split(',')[0]}</span>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-2 mt-2 md:mt-3 pt-2 md:pt-3 border-t border-slate-100">
                  <div>
                    <span className="block text-[7px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider">Battery</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Battery className={`w-3 h-3 md:w-4 md:h-4 ${device.batteryCell <= 15 ? 'text-rose-500' : 'text-emerald-500'}`} />
                      <span className={`text-[10px] md:text-xs font-black ${device.batteryCell <= 15 ? 'text-rose-600' : 'text-slate-800'}`}>{device.batteryCell}%</span>
                    </div>
                  </div>
                  <div>
                    <span className="block text-[7px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider">State</span>
                    <span className={`text-[9px] md:text-[10px] font-extrabold mt-0.5 inline-block
                      ${device.barrierState === 'RAISED' ? 'text-blue-700' : ''}
                      ${device.barrierState === 'LOWERED' ? 'text-emerald-700' : ''}
                      ${device.barrierState.includes('...') ? 'text-amber-700 animate-pulse' : ''}
                    `}>{device.barrierState}</span>
                  </div>
                  <div>
                    <span className="block text-[7px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider">RSSI</span>
                    <span className="text-[10px] md:text-xs font-bold text-slate-800 mt-0.5 inline-block">{device.rssi} dBm</span>
                  </div>
                </div>

                {device.requiresService && (
                  <div className="mt-2 flex items-center gap-1 text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-1.5 md:p-2 text-[9px] md:text-[10px] font-bold">
                    <AlertTriangle className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
                    <span>Service Needed</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-slate-100">
                <div className="flex gap-1.5 md:gap-2">
                  <button onClick={() => handleToggleBarrier(device.id)} disabled={device.barrierState.includes('...') || device.status === 'Offline'}
                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-lg md:rounded-xl py-1.5 md:py-2 text-[8px] md:text-[10px] font-bold disabled:opacity-40 transition-all active:scale-95">
                    {device.barrierState === 'RAISED' ? 'LOWER' : 'RAISE'}
                  </button>
                  <button onClick={() => handleReboot(device.id)} disabled={device.status === 'Offline'}
                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-lg md:rounded-xl py-1.5 md:py-2 text-[8px] md:text-[10px] font-bold disabled:opacity-40 transition-all active:scale-95">
                    REBOOT
                  </button>
                  <button onClick={() => handleDiagnose(device.id)} disabled={device.status === 'Offline'}
                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-lg md:rounded-xl py-1.5 md:py-2 text-[8px] md:text-[10px] font-bold disabled:opacity-40 transition-all active:scale-95">
                    TEST
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Booking History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-6">
          <div className="flex items-center gap-1.5 md:gap-2">
            <Clock className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
            <h2 className="font-bold text-sm md:text-base text-slate-900">Recent Rentals</h2>
          </div>

          {/* Filters */}
          <div className="flex gap-1.5 md:gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-2 md:pl-8 md:pr-3 py-1 md:py-1.5 text-[10px] md:text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 bg-slate-50/50 w-20 md:w-auto" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[10px] md:text-xs border border-slate-200 rounded-lg px-1.5 md:px-2.5 py-1 md:py-1.5 focus:outline-none bg-white font-medium">
              <option value="All">All</option>
              <option value="Completed">Done</option>
              <option value="Active">Active</option>
              <option value="Disputed">Dispute</option>
            </select>
          </div>
        </div>

        {/* Mobile: card list instead of table */}
        <div className="md:hidden space-y-2">
          {currentItems.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs font-medium">No rental bookings found.</div>
          ) : (
            currentItems.map((booking) => (
              <div key={booking.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400">{booking.date}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold inline-flex items-center gap-1
                    ${booking.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : ''}
                    ${booking.status === 'Disputed' ? 'bg-amber-50 text-amber-700' : ''}
                    ${booking.status === 'Active' ? 'bg-indigo-50 text-indigo-700' : ''}
                  `}>
                    <span className={`w-1 h-1 rounded-full
                      ${booking.status === 'Completed' ? 'bg-emerald-500' : ''}
                      ${booking.status === 'Disputed' ? 'bg-amber-500' : ''}
                      ${booking.status === 'Active' ? 'bg-indigo-500' : ''}
                    `} />
                    {booking.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-800">{booking.bayInfo}</span>
                    <span className="text-[9px] text-slate-400 block">{booking.propertyName}</span>
                    <span className="text-[9px] font-mono font-bold text-slate-500">{booking.renterPlate}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-600">RM {booking.totalEarned.toFixed(2)}</span>
                    <span className="text-[9px] text-slate-400 block">{booking.duration.slice(0, 20)}</span>
                  </div>
                </div>
                {booking.status === 'Disputed' && (
                  <button onClick={() => setActiveDispute(booking)}
                    className="w-full text-center bg-amber-500 text-white font-semibold text-[10px] py-1.5 rounded-lg mt-1">
                    Resolve Dispute
                  </button>
                )}
              </div>
            ))
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2">
              <span>{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredBookings.length)} of {filteredBookings.length}</span>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
                  className="px-2 py-1 rounded border border-slate-200 disabled:opacity-50 text-[10px]">←</button>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded border border-slate-200 disabled:opacity-50 text-[10px]">→</button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="p-4">Date</th>
                <th className="p-4">Renter Vehicle</th>
                <th className="p-4">Bay ID / Location</th>
                <th className="p-4">Duration Block</th>
                <th className="p-4">Earnings (RM)</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    No matching rental bookings found.
                  </td>
                </tr>
              ) : (
                currentItems.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 font-medium text-slate-600 whitespace-nowrap">{booking.date}</td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-700 inline-block w-fit text-[10px]">
                          {booking.renterPlate}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">{booking.renterName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{booking.bayInfo}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3" /> {booking.propertyName}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-slate-700">{booking.duration}</span>
                    </td>
                    <td className="p-4 font-bold text-emerald-600 font-mono text-sm whitespace-nowrap">
                      {booking.totalEarned < 0 ? '-' : ''}RM {Math.abs(booking.totalEarned).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold inline-flex items-center gap-1
                        ${booking.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : ''}
                        ${booking.status === 'Upcoming' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
                        ${booking.status === 'Active' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 animate-pulse' : ''}
                        ${booking.status === 'Disputed' ? 'bg-amber-50 text-amber-700 border border-amber-100' : ''}
                      `}>
                        <span className={`w-1.5 h-1.5 rounded-full
                          ${booking.status === 'Completed' ? 'bg-emerald-500' : ''}
                          ${booking.status === 'Upcoming' ? 'bg-blue-500' : ''}
                          ${booking.status === 'Active' ? 'bg-indigo-500' : ''}
                          ${booking.status === 'Disputed' ? 'bg-amber-500' : ''}
                        `}></span>
                        {booking.status}
                      </span>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      {booking.status === 'Disputed' ? (
                        <button 
                          onClick={() => setActiveDispute(booking)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px] px-2.5 py-1 rounded transition-colors shadow-sm"
                        >
                          Resolve Dispute
                        </button>
                      ) : (
                        <button 
                          onClick={() => alert(`Rental Log Details:\n\nBooking ID: ${booking.id}\nRenter: ${booking.renterName} (${booking.renterPlate})\nBay: ${booking.bayInfo} - ${booking.propertyName}\nDuration: ${booking.duration}\nRate Basis: RM 2.00/hr\nCommission Charged: RM ${booking.commissionPaid.toFixed(2)}\n\nActuation verification: IoT ESP32 handshake successfully logged locally on device.`)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] px-2.5 py-1 rounded transition-colors"
                        >
                          View Log
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination navigation */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4 text-[11px] text-slate-500 font-medium">
            <span>
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredBookings.length)} of {filteredBookings.length} records
            </span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-slate-200 disabled:opacity-50 hover:bg-slate-50 text-[10px]"
              >
                Previous
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[10px]
                    ${currentPage === i + 1 
                      ? 'bg-slate-900 text-white' 
                      : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                    }
                  `}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-slate-200 disabled:opacity-50 hover:bg-slate-50 text-[10px]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* WITHDRAWAL MODAL */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                Request Wallet Settlement
              </h3>
              <button onClick={() => setIsWithdrawModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleWithdrawSubmit} className="p-5 space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Current Withdrawable Balance</span>
                <h4 className="text-3xl font-extrabold text-slate-900 font-mono mt-1">RM {walletBalance.toFixed(2)}</h4>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Withdrawal Amount (RM)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono text-sm">RM</span>
                  <input 
                    type="number"
                    min="10"
                    max={walletBalance}
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full pl-10 pr-16 py-2.5 font-mono text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#10b981] font-bold"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setWithdrawAmount(walletBalance.toFixed(2))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#10b981] hover:bg-emerald-50 px-2 py-1 rounded"
                  >
                    ALL
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Minimum RM 10.00. Processing fee: RM 0.00</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Destination Bank Account</label>
                <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <span>{activeBank.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1 ml-6">
                    Account: {activeBank.accNo} <br />
                    Holder: {activeBank.holder}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2">
                <input 
                  type="checkbox"
                  id="agreeWithdraw"
                  checked={agreeTerms}
                  onChange={(e) => setWithdrawAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-200 text-[#10b981] focus:ring-[#10b981]"
                  required
                />
                <label htmlFor="agreeWithdraw" className="text-[10px] text-slate-500 leading-normal">
                  I verify that the beneficiary name matches my registered identification details under Malaysia strata guidelines. Payouts complete instantly within bank operating hours.
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold text-xs py-3 rounded-xl mt-3 transition-colors shadow"
              >
                Confirm Settlement Transfer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DISPUTE RESOLUTION MODAL */}
      {activeDispute && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <h3 className="font-bold text-base text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Resolve Parking Dispute
              </h3>
              <button onClick={() => setActiveDispute(null)} className="text-amber-700 hover:text-amber-950">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed">
                <span className="font-bold text-slate-800">Violation Instance:</span>
                <p className="mt-1 bg-slate-50 border border-slate-100 p-2.5 rounded-lg font-medium text-slate-700">
                  {activeDispute.disputeReason || 'Renter vehicle overstayed reservation. ESP32 distance sensor detected physical occupancy 23 minutes past booking block.'}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 leading-normal">
                <strong>Platform Action Recommended:</strong>
                <p className="mb-0 mt-0.5">The system has already calculated a 1.5x penalty rate of <strong>RM 3.60</strong>. Press "Acknowledge Settlement" to credit this overstay fine to your withdrawable balance immediately.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onResolveDispute(activeDispute.id);
                    setActiveDispute(null);
                  }}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-lg transition-colors"
                >
                  Acknowledge & Credit RM 3.60
                </button>
                <button
                  onClick={() => setActiveDispute(null)}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs py-2.5 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Toast Alert Banner */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div className={`px-4 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border text-xs font-semibold max-w-sm backdrop-blur bg-white/95
            ${activeToast.type === 'success' ? 'border-emerald-100 text-emerald-900 shadow-emerald-100/50' : ''}
            ${activeToast.type === 'info' ? 'border-blue-100 text-blue-900 shadow-blue-100/50' : ''}
            ${activeToast.type === 'warning' ? 'border-amber-100 text-amber-900 shadow-amber-100/50' : ''}
          `}>
            {activeToast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
            {activeToast.type === 'info' && <Radio className="w-4 h-4 text-blue-600 shrink-0 animate-pulse" />}
            {activeToast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            <span>{activeToast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
