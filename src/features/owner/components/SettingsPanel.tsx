import React, { useState } from 'react';
import { Building, Sliders, Save, CheckCircle, Wifi, Battery, Radio, ShieldAlert } from 'lucide-react';

interface SettingsPanelProps {
  bank: { name: string; accNo: string; holder: string };
  onSaveBank: (bank: { name: string; accNo: string; holder: string }) => void;
}

export default function SettingsPanel({ bank, onSaveBank }: SettingsPanelProps) {
  const [bankName, setBankName] = useState(bank.name);
  const [accNo, setAccNo] = useState(bank.accNo);
  const [holder, setHolder] = useState(bank.holder);

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsAppAlerts, setWhatsAppAlerts] = useState(true);
  const [autoPayout, setAutoPayout] = useState(false);

  const handleBankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accNo || !holder) {
      alert('Please complete all bank credential fields.');
      return;
    }
    onSaveBank({
      name: bankName,
      accNo,
      holder
    });
    alert(`Payout Preferences Updated!\n\nBank: ${bankName}\nAccount No: ${accNo}\nBeneficiary: ${holder}`);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Platform Settings</h1>
        <p className="text-slate-500 text-xs mt-1 leading-normal">
          Manage payout credentials, configure automatic wallet settlement rules, and audit active IoT edge hardware nodes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Payout configuration */}
        <div className="lg:col-span-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building className="w-4 h-4 text-blue-600" />
                Malaysian Payout Credentials
              </h2>

              <form onSubmit={handleBankSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Recipient Financial Institution</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                  >
                    <option value="Malayan Banking Berhad (Maybank)">Malayan Banking Berhad (Maybank)</option>
                    <option value="CIMB Bank Berhad">CIMB Bank Berhad</option>
                    <option value="Public Bank Berhad">Public Bank Berhad</option>
                    <option value="RHB Bank Berhad">RHB Bank Berhad</option>
                    <option value="Hong Leong Bank Berhad">Hong Leong Bank Berhad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Bank Account Number</label>
                  <input
                    type="text"
                    value={accNo}
                    onChange={(e) => setAccNo(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Beneficiary Account Name</label>
                  <input
                    type="text"
                    value={holder}
                    onChange={(e) => setHolder(e.target.value.toUpperCase())}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-semibold"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Must match registered IC name to prevent escrow compliance holdbacks.</p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-colors shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-blue-400" />
                    Save Bank Details
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Preference Toggles and IoT heartbeats */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-blue-600" />
              Notifications & Auto-Rules
            </h2>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-slate-50 pb-3">
                <div>
                  <span className="block text-xs font-bold text-slate-800">Email Notifications</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 leading-normal">Weekly supplies, ledger activity audits, and verification notices.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-start justify-between gap-4 border-b border-slate-50 pb-3">
                <div>
                  <span className="block text-xs font-bold text-slate-800">WhatsApp Smart Access Alerts</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 leading-normal">Real-time status events of barrier actuations and overstay alert notifications.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={whatsAppAlerts}
                  onChange={(e) => setWhatsAppAlerts(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="block text-xs font-bold text-slate-800">Auto-Withdraw Payout System</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 leading-normal">Settle wallet balance automatically when in-app earnings surpass RM 150.00.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={autoPayout}
                  onChange={(e) => setAutoPayout(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
