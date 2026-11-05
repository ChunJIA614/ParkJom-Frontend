import React, { useState, useEffect } from 'react';
import { Mail, Check } from 'lucide-react';
import { fetchNotificationPreferences, updateNotificationPreferences } from '@/features/notifications/api';
import SystemSelect from '@/components/ui/SystemSelect';
import { Building, Sliders, Save, CheckCircle, Wifi, Battery, Radio, ShieldAlert, UserRound, Sparkles } from 'lucide-react';
import { showAlert } from '@/contexts/ModalContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import ProfileDialog from '@/features/profile/components/ProfileDialog';

interface SettingsPanelProps {
  bank: { name: string; accNo: string; holder: string };
  onSaveBank: (bank: { name: string; accNo: string; holder: string }) => void;
}

export default function SettingsPanel({ bank, onSaveBank }: SettingsPanelProps) {
  const { user } = useAuth();
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [bankName, setBankName] = useState(bank.name);
  const [accNo, setAccNo] = useState(bank.accNo);
  const [holder, setHolder] = useState(bank.holder);

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false);

  useEffect(() => {
    if (!user?.token) return;
    fetchNotificationPreferences(user.token)
      .then((res) => {
        const emailPrefs = res.preferences.filter((p) => p.channel.toLowerCase() === 'email');
        if (emailPrefs.length > 0) {
          setEmailAlerts(emailPrefs.some((p) => p.enabled));
        }
      })
      .catch((err) => console.warn('Failed to fetch notification preferences:', err));
  }, [user?.token]);

  const handleToggleEmailAlerts = async (enabled: boolean) => {
    if (!user?.token) return;
    setEmailAlerts(enabled);
    setIsSavingEmail(true);
    setEmailSaveSuccess(false);
    try {
      const categories = ['Booking', 'Wallet', 'Listing', 'Support', 'Account', 'System'];
      await updateNotificationPreferences(
        user.token,
        categories.map((c) => ({ category: c, channel: 'Email', enabled }))
      );
      setEmailSaveSuccess(true);
      setTimeout(() => setEmailSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update email notification preferences:', err);
      setEmailAlerts(!enabled);
    } finally {
      setIsSavingEmail(false);
    }
  };
  const [autoPayout, setAutoPayout] = useState(false);

  const handleBankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accNo || !holder) {
      void showAlert({
        title: 'Missing Credentials',
        message: 'Please complete all bank credential fields before submitting.',
        variant: 'warning',
      });
      return;
    }
    onSaveBank({
      name: bankName,
      accNo,
      holder
    });
    void showAlert({
      title: 'Preferences Updated',
      message: `Your payout preferences have been saved successfully.\n\nBank: ${bankName}\nAccount No: ${accNo}\nBeneficiary: ${holder}`,
      variant: 'success',
    });
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

      {/* Account Profile Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {user?.picture ? (
            <img src={user.picture} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600 ring-1 ring-slate-200">
              {(user?.firstName?.charAt(0) || user?.email?.charAt(0) || '?').toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email}
              </h2>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-blue-200">
                Property Owner
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
            {user?.phoneNumber && <p className="text-[11px] text-slate-400 mt-0.5">{user.phoneNumber}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowProfileDialog(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <UserRound className="w-4 h-4 text-blue-600" />
          Manage Profile &amp; Role
        </button>
      </div>

      <ProfileDialog open={showProfileDialog} onClose={() => setShowProfileDialog(false)} />

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
                  <SystemSelect
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                  >
                    <option value="Malayan Banking Berhad (Maybank)">Malayan Banking Berhad (Maybank)</option>
                    <option value="CIMB Bank Berhad">CIMB Bank Berhad</option>
                    <option value="Public Bank Berhad">Public Bank Berhad</option>
                    <option value="RHB Bank Berhad">RHB Bank Berhad</option>
                    <option value="Hong Leong Bank Berhad">Hong Leong Bank Berhad</option>
                  </SystemSelect>
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
                  <div className="flex items-center gap-2">
                    <span className="block text-xs font-bold text-slate-800">Email Notifications</span>
                    {emailSaveSuccess ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                        <Check className="h-2.5 w-2.5" /> Saved
                      </span>
                    ) : isSavingEmail ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200">
                        Saving...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200">
                        <Mail className="h-2.5 w-2.5" /> Active Channel
                      </span>
                    )}
                  </div>
                  <span className="block text-[10px] text-slate-400 mt-0.5 leading-normal">
                    Receive booking confirmations, payout summaries, and system alerts via your registered email ({user?.email || 'email'}).
                  </span>
                </div>
                <input 
                  type="checkbox"
                  checked={emailAlerts}
                  disabled={isSavingEmail}
                  onChange={(e) => void handleToggleEmailAlerts(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-700">Official Channel Policy:</span> External alert delivery operates exclusively via authenticated Email for regulatory compliance and audit security.
                </div>
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
