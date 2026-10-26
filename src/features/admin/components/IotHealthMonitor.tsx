import React from 'react';
import { Radio, HardDrive, Cpu, Wifi, Activity, ShieldCheck, Terminal, AlertTriangle } from 'lucide-react';
import ServiceUpcoming from '@/components/ui/ServiceUpcoming';
import type { IoTBollard } from '../types';

interface IotHealthMonitorProps {
  bollards?: IoTBollard[];
  setBollards?: React.Dispatch<React.SetStateAction<IoTBollard[]>>;
  addActivityLog?: (type: string, message: string, user: string) => void;
}

export default function IotHealthMonitor({}: IotHealthMonitorProps) {
  return (
    <div id="iot-health-monitor" className="space-y-6">
      {/* Title */}
      <div>
        <h2 id="iot-title" className="text-2xl font-bold text-slate-800 tracking-tight">IoT Smart Bollard Fleet</h2>
        <p className="text-slate-500 text-sm">Centralized physical barrier fleet management, ESP32 telemetry, and remote hardware overrides.</p>
      </div>

      {/* Service Upcoming Banner */}
      <ServiceUpcoming
        icon={Radio}
        title="IoT Smart Bollard Fleet Management"
        badge="Service Upcoming"
        description="The physical barrier hardware management gateway is currently being prepared for production deployment. This module will ingest real-time MQTT telemetry from deployed ESP32 microcontrollers and provide operators with authoritative remote override controls."
        plannedFeatures={[
          "Live ESP32 telemetry streaming (battery voltage, RSSI signal, lock coil resistance)",
          "Authenticated remote barrier actuation override (Raise / Lower / Emergency Lockdown)",
          "Automated offline heartbeat detection & maintenance work order dispatch",
          "Cryptographic handshake verification for physical Bluetooth / QR unlock commands"
        ]}
        technicalNote="ESP32 hardware integration requires backend MQTT broker connectivity and /api/admin/iot/devices endpoints currently scheduled in Phase 3."
      />

      {/* Planned Architecture Specification Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Edge Hardware Tier</h4>
              <p className="text-[11px] text-slate-400">ESP32-WROOM-32D Microcontroller</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-600 leading-relaxed">
            Dual-core 80MHz MCU with 12V DC solenoid motor actuator, optical limit switches, and hardware-accelerated SHA-256 token verification.
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400">
            <span>Status: Provisioned</span>
            <span className="font-semibold text-amber-600">Awaiting Firmware Rollout</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Communication Protocol</h4>
              <p className="text-[11px] text-slate-400">MQTT over TLS &amp; BLE 5.0</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-600 leading-relaxed">
            Bidirectional lightweight pub/sub telemetry broker with 30-second keep-alive heartbeats and fallback BLE beacon for offline commuter pairing.
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400">
            <span>Broker: Mosquitto / AWS IoT</span>
            <span className="font-semibold text-amber-600">Connecting Gateway</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Security &amp; Audit</h4>
              <p className="text-[11px] text-slate-400">Signed Actuation Audits</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-600 leading-relaxed">
            Every remote command is digitally logged in the immutable system audit trail with administrator identity, GPS geofence validation, and timestamp.
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400">
            <span>Audit: ActiveLog DB</span>
            <span className="font-semibold text-emerald-600">Audit Logging Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
