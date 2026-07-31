import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, Battery, HardDrive, Wifi, RefreshCw, ToggleLeft, 
  ToggleRight, Settings, AlertTriangle, CheckCircle2, Play, Activity
} from 'lucide-react';
import { IoTBollard } from '../types';

interface IotHealthMonitorProps {
  bollards: IoTBollard[];
  setBollards: React.Dispatch<React.SetStateAction<IoTBollard[]>>;
  addActivityLog: (type: string, message: string, user: string) => void;
}

export default function IotHealthMonitor({ 
  bollards, 
  setBollards,
  addActivityLog 
}: IotHealthMonitorProps) {
  const [filter, setFilter] = useState<'all' | 'online' | 'offline' | 'alert'>('all');
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [diagOutput, setDiagOutput] = useState<{ id: string; output: string[] } | null>(null);

  const filteredBollards = bollards.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'online') return b.status === 'online';
    if (filter === 'offline') return b.status === 'offline';
    if (filter === 'alert') return b.batteryLevel <= 15 || b.status === 'offline' || b.rssi < -85;
    return true;
  });

  const handleToggleBarrier = (bollard: IoTBollard) => {
    setOperatingId(bollard.id);
    const nextState = bollard.barrierState === 'raised' ? 'lowered' : 'raised';
    
    // Simulate transitioning
    setBollards(prev => prev.map(b => b.id === bollard.id ? { ...b, barrierState: 'transitioning' } : b));
    addActivityLog('bollard_state', `Sent Remote Command: Toggle barrier of ${bollard.id} to ${nextState}`, "Admin (Remote Override)");

    setTimeout(() => {
      setBollards(prev => prev.map(b => b.id === bollard.id ? { ...b, barrierState: nextState } : b));
      setOperatingId(null);
      addActivityLog('bollard_state', `Bollard ${bollard.id} barrier successfully ${nextState === 'raised' ? 'Raised' : 'Lowered'}`, "ESP32 Confirmation Callback");
    }, 1500);
  };

  const handleRebootDevice = (bollard: IoTBollard) => {
    setOperatingId(bollard.id);
    addActivityLog('system', `Sent remote reboot signal to ESP32: ${bollard.id}`, "Admin (Remote Override)");
    
    // Set to offline first
    setBollards(prev => prev.map(b => b.id === bollard.id ? { ...b, status: 'offline', barrierState: 'raised' } : b));

    setTimeout(() => {
      setBollards(prev => prev.map(b => b.id === bollard.id ? { 
        ...b, 
        status: 'online', 
        batteryLevel: b.batteryLevel > 0 ? b.batteryLevel : 95, // Refill empty battery on mock reboot diagnostic
        lastHeartbeat: "Just now" 
      } : b));
      setOperatingId(null);
      addActivityLog('system', `ESP32 ${bollard.id} finished boot cycle. Connected to MQTT Broker.`, "ESP32 SysLog Client");
    }, 2500);
  };

  const handleRunDiagnostics = (bollard: IoTBollard) => {
    setOperatingId(bollard.id);
    const logOutput: string[] = [
      `[INFO] Starting hardware diagnostics for ${bollard.id}...`,
      `[INFO] Target physical layer: ESP32-WROOM-32D (80MHz Xtensa Dual-Core CPU)`,
      `[INFO] Fetching MQTT connection status... connected.`,
      `[DIAG] Measuring signal quality (RSSI): ${bollard.rssi} dBm (${bollard.rssi > -70 ? 'Excellent' : 'Degraded'})`,
      `[DIAG] Checking Battery Voltage: ${bollard.batteryLevel}% (${(3.3 * (bollard.batteryLevel / 100) + 0.7).toFixed(2)}V Cell Ref)`,
      `[DIAG] Solenoid Lock Coil Resistance: 12.4 Ohm (Normal)`,
      `[DIAG] Gyro / Barrier Angle sensor deviation: 0.1 deg (Calibrated)`,
      `[SUCCESS] Diagnostics completed. Status code: 0x00 (Normal)`
    ];
    
    setTimeout(() => {
      setDiagOutput({ id: bollard.id, output: logOutput });
      setOperatingId(null);
    }, 1000);
  };

  // Signal Strength badge helper
  const getRssiBadge = (rssi: number) => {
    if (rssi > -65) return { text: "Strong", color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
    if (rssi > -80) return { text: "Moderate", color: "text-blue-600 bg-blue-50 border-blue-100" };
    return { text: "Weak", color: "text-rose-600 bg-rose-50 border-rose-100" };
  };

  return (
    <div id="iot-health-monitor" className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 id="iot-title" className="text-2xl font-bold text-slate-800 tracking-tight">IoT Smart Bollard Fleet</h2>
          <p className="text-slate-500 text-sm">Monitor physical smart locks, control barriers remotely, and trace ESP32 diagnostic signals.</p>
        </div>
        
        {/* Quick controls */}
        <div className="flex bg-slate-100 p-1 rounded-lg self-start text-xs font-semibold">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-md ${filter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>All ({bollards.length})</button>
          <button onClick={() => setFilter('online')} className={`px-3 py-1.5 rounded-md ${filter === 'online' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>Online ({bollards.filter(b => b.status === 'online').length})</button>
          <button onClick={() => setFilter('offline')} className={`px-3 py-1.5 rounded-md ${filter === 'offline' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>Offline ({bollards.filter(b => b.status === 'offline').length})</button>
          <button onClick={() => setFilter('alert')} className={`px-3 py-1.5 rounded-md text-rose-600 ${filter === 'alert' ? 'bg-rose-50 text-rose-800 shadow-xs border border-rose-100' : 'text-rose-500 hover:text-rose-800'}`}>Alerts ({bollards.filter(b => b.batteryLevel <= 15 || b.status === 'offline').length})</button>
        </div>
      </div>

      {/* Grid containing physical bollards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBollards.map((bollard) => {
          const rssiInfo = getRssiBadge(bollard.rssi);
          const isLowBattery = bollard.batteryLevel <= 15;
          const isOffline = bollard.status === 'offline';
          const isTransitioning = bollard.barrierState === 'transitioning';
          const isPendingCurrent = operatingId === bollard.id;

          return (
            <motion.div
              key={bollard.id}
              layoutId={bollard.id}
              className={`bg-white rounded-xl border p-5 shadow-sm space-y-4 relative overflow-hidden transition-all duration-200 ${isOffline ? 'border-rose-100 bg-rose-50/10' : 'border-slate-200/80 hover:border-slate-300'}`}
            >
              {/* Top Banner details */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">ESP32 Client ID</span>
                  <h3 className="text-sm font-bold text-slate-800 font-mono flex items-center gap-1.5">
                    <Radio className={`w-4 h-4 ${isOffline ? 'text-slate-300' : 'text-[#2563EB] animate-pulse'}`} />
                    {bollard.id}
                  </h3>
                </div>
                
                {/* Status Indicator Badge */}
                <div>
                  {bollard.status === 'online' && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                    </span>
                  )}
                  {bollard.status === 'maintenance' && (
                    <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Maintenance
                    </span>
                  )}
                  {bollard.status === 'offline' && (
                    <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Offline
                    </span>
                  )}
                </div>
              </div>

              {/* Physical Location Details */}
              <div className="text-xs bg-slate-50 p-2.5 rounded border border-slate-100 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bay:</span>
                  <span className="font-bold text-slate-800">{bollard.bayNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Location:</span>
                  <span className="font-medium text-slate-700 text-right line-clamp-1">{bollard.location}</span>
                </div>
              </div>

              {/* Physical Diagnostics stats */}
              <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                {/* Battery Level */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Battery Cell</span>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Battery className={`w-5 h-5 ${isLowBattery ? 'text-rose-500' : 'text-slate-600'}`} />
                      {/* Battery charge level overlay */}
                      <div 
                        className={`absolute left-0.5 top-1.5 bottom-1.5 rounded-xs ${isLowBattery ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(12, 12 * (bollard.batteryLevel / 100))}px` }}
                      />
                    </div>
                    <span className={`font-semibold ${isLowBattery ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                      {bollard.batteryLevel}%
                    </span>
                  </div>
                  {isLowBattery && (
                    <span className="text-[9px] text-rose-500 font-bold flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> Requires Service
                    </span>
                  )}
                </div>

                {/* Barrier physical state */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Barrier Mechanical State</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded inline-block ${
                    bollard.barrierState === 'raised' ? 'bg-[#2563EB]/5 text-[#2563EB] border border-[#2563EB]/10' :
                    bollard.barrierState === 'lowered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                  }`}>
                    {bollard.barrierState.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Signals */}
              <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-slate-100">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">Signal (RSSI)</span>
                  <div className="flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-slate-500" />
                    <span className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${rssiInfo.color}`}>
                      {bollard.rssi} dBm ({rssiInfo.text})
                    </span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">Last Heartbeat</span>
                  <span className="text-slate-600 font-medium block">{bollard.lastHeartbeat}</span>
                </div>
              </div>

              {/* Remote Override Operations Bar */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remote Operations Override</span>
                
                <div className="grid grid-cols-3 gap-1">
                  <button
                    disabled={isOffline || isTransitioning || isPendingCurrent}
                    onClick={() => handleToggleBarrier(bollard)}
                    className="px-1.5 py-1.5 bg-[#2563EB]/5 text-[#2563EB] rounded-lg text-[10px] font-semibold hover:bg-[#2563EB]/10 transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-1 cursor-pointer"
                    title={bollard.barrierState === 'raised' ? 'Lower Bollard Lock' : 'Raise Bollard Lock'}
                  >
                    <Settings className={`w-3.5 h-3.5 ${isPendingCurrent && isTransitioning ? 'animate-spin' : ''}`} />
                    <span className="font-bold">{bollard.barrierState === 'raised' ? 'LOWER' : 'RAISE'}</span>
                  </button>

                  <button
                    disabled={isPendingCurrent}
                    onClick={() => handleRebootDevice(bollard)}
                    className="px-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer"
                    title="Send Hard Reboot Command"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPendingCurrent && !isTransitioning ? 'animate-spin' : ''}`} />
                    <span className="font-bold">REBOOT</span>
                  </button>

                  <button
                    disabled={isOffline || isPendingCurrent}
                    onClick={() => handleRunDiagnostics(bollard)}
                    className="px-1.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-1 cursor-pointer"
                    title="Run Active Diagnostics"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span className="font-bold">DIAGNOSE</span>
                  </button>
                </div>
              </div>

              {/* Loading progress blocker overlay */}
              {isPendingCurrent && (
                <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[0.5px] flex items-center justify-center">
                  <div className="bg-white/90 shadow-md border border-slate-100 rounded-full px-3.5 py-1.5 flex items-center gap-2 text-[11px] font-semibold text-[#2563EB]">
                    <RefreshCw className="w-3 h-3 animate-spin text-[#2563EB]" />
                    Executing Command...
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Diagnostics output Modal */}
      <AnimatePresence>
        {diagOutput && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-950 text-slate-100 rounded-xl border border-slate-800 p-5 shadow-xl max-w-xl w-full space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-emerald-400 font-mono flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-pulse" /> ESP32 Diagnostic Core Dump: {diagOutput.id}
                </h3>
                <button 
                  onClick={() => setDiagOutput(null)}
                  className="text-slate-500 hover:text-slate-300 font-mono text-xs"
                >
                  [CLOSE_X]
                </button>
              </div>

              <div className="font-mono text-[11px] space-y-1 bg-slate-900 p-3.5 rounded-lg border border-slate-800 text-slate-300 max-h-72 overflow-y-auto leading-relaxed">
                {diagOutput.output.map((line, idx) => (
                  <p key={idx} className={
                    line.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' :
                    line.includes('[DIAG]') ? 'text-blue-400' :
                    line.includes('[INFO]') ? 'text-slate-400' : 'text-slate-300'
                  }>
                    {line}
                  </p>
                ))}
              </div>

              <div className="flex justify-end gap-2 text-xs pt-1">
                <button 
                  onClick={() => {
                    const randomSignalNoise = Math.floor(Math.random() * 20) - 80; // randomize RSSI
                    setBollards(prev => prev.map(b => b.id === diagOutput.id ? { ...b, rssi: randomSignalNoise } : b));
                    setDiagOutput(null);
                    addActivityLog('system', `Calibration loop completed for ESP32: ${diagOutput.id}`, "Calibration Cron");
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-bold rounded-lg text-[11px] font-mono"
                >
                  CALIBRATE_ANTENNA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
