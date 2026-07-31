import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, AlertOctagon, FileText, CheckCircle, XCircle, 
  Search, Eye, HelpCircle, ArrowUpRight, ShieldAlert, BadgeAlert 
} from 'lucide-react';
import { ListingRequest } from '../types';

interface ListingGovernanceProps {
  listings: ListingRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  addActivityLog: (type: string, message: string, user: string) => void;
}

export default function ListingGovernance({ 
  listings, 
  onApprove, 
  onReject,
  addActivityLog 
}: ListingGovernanceProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'moderated'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListing, setSelectedListing] = useState<ListingRequest | null>(null);
  const [rejectingListingId, setRejectingListingId] = useState<string | null>(null);
  const [customRejectionReason, setCustomRejectionReason] = useState('Deed name mismatch with registration profile');
  
  // Whitelist/Blacklist state for testing governance controls
  const [blacklist, setBlacklist] = useState<string[]>([
    "spammer.owner@gmail.com"
  ]);
  const [newBlacklistEmail, setNewBlacklistEmail] = useState('');
  const [blacklistError, setBlacklistError] = useState('');

  const rejectionOptions = [
    "Deed name mismatch with registration profile",
    "Unclear strata title deed document scan",
    "Utility bill address does not match parking bay physical coordinates",
    "Invalid or expired government ID document",
    "Bay number mismatch with title registration deed"
  ];

  const filteredListings = listings.filter(l => {
    const matchesSearch = l.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          l.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'pending') {
      return l.status === 'pending' && matchesSearch;
    } else {
      return l.status !== 'pending' && matchesSearch;
    }
  });

  const handleApproveClick = (listing: ListingRequest) => {
    onApprove(listing.id);
    addActivityLog('governance', `Approved property listing ${listing.bayNumber} at ${listing.location}`, "Admin");
    if (selectedListing?.id === listing.id) {
      setSelectedListing(null);
    }
  };

  const handleRejectSubmit = () => {
    if (!rejectingListingId) return;
    onReject(rejectingListingId, customRejectionReason);
    addActivityLog('governance', `Rejected property listing ${rejectingListingId} due to: ${customRejectionReason}`, "Admin");
    setRejectingListingId(null);
    setSelectedListing(null);
  };

  const handleAddToBlacklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlacklistEmail || !newBlacklistEmail.includes('@')) {
      setBlacklistError('Please enter a valid email address');
      return;
    }
    if (blacklist.includes(newBlacklistEmail)) {
      setBlacklistError('Email is already on the suspension blacklist');
      return;
    }
    setBlacklist([...blacklist, newBlacklistEmail]);
    addActivityLog('governance', `Suspended/Blacklisted host email: ${newBlacklistEmail}`, "Admin");
    setNewBlacklistEmail('');
    setBlacklistError('');
  };

  const handleRemoveFromBlacklist = (email: string) => {
    setBlacklist(blacklist.filter(e => e !== email));
    addActivityLog('governance', `Reinstated/Whitelisted host email: ${email}`, "Admin");
  };

  return (
    <div id="listing-governance" className="space-y-6">
      {/* Header */}
      <div>
        <h2 id="governance-title" className="text-2xl font-bold text-slate-800 tracking-tight">Property & Listing Governance</h2>
        <p className="text-slate-500 text-sm">Review proof of strata ownership, coordinate approvals, and moderate platform hosts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Moderate Listing Column (takes 2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg self-start">
              <button 
                onClick={() => setActiveTab('pending')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${activeTab === 'pending' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Pending Review ({listings.filter(l => l.status === 'pending').length})
              </button>
              <button 
                onClick={() => setActiveTab('moderated')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${activeTab === 'moderated' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Moderation History
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text" 
                placeholder="Search by owner, location..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full sm:w-64 focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>
          </div>

          {/* Table list of listings */}
          <div className="overflow-x-auto">
            {filteredListings.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No property listings found matching the current criteria.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <th className="py-3 px-2">Verification ID</th>
                    <th className="py-3 px-2">Owner Profile</th>
                    <th className="py-3 px-2">Property & Bay</th>
                    <th className="py-3 px-2">Rate</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredListings.map((listing) => (
                    <tr key={listing.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-2 font-mono text-[#2563EB] font-bold">VR-{listing.id}</td>
                      <td className="py-3.5 px-2">
                        <div className="font-semibold text-slate-800">{listing.ownerName}</div>
                        <div className="text-[10px] text-slate-400">{listing.ownerEmail}</div>
                      </td>
                      <td className="py-3.5 px-2">
                        <div className="text-slate-700 font-medium line-clamp-1">{listing.location}</div>
                        <div className="text-[10px] text-[#2563EB] font-mono font-bold bg-[#2563EB]/5 px-1.5 py-0.2 rounded inline-block mt-0.5">{listing.bayNumber}</div>
                      </td>
                      <td className="py-3.5 px-2 font-semibold text-slate-700">
                        {listing.hourlyRate > 0 ? `RM ${listing.hourlyRate.toFixed(2)}/hr` : '—'}
                      </td>
                      <td className="py-3.5 px-2">
                        {listing.status === 'pending' && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full text-[10px] font-medium">Pending Review</span>
                        )}
                        {listing.status === 'approved' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-medium">Approved</span>
                        )}
                        {listing.status === 'rejected' && (
                          <div className="space-y-0.5">
                            <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full text-[10px] font-medium">Rejected</span>
                            <p className="text-[9px] text-rose-500 italic line-clamp-1">{listing.rejectionReason}</p>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => setSelectedListing(listing)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-[#2563EB] transition-colors"
                            title="Inspect Documents"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {listing.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleApproveClick(listing)}
                                className="p-1.5 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-colors"
                                title="Approve Verification"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setRejectingListingId(listing.id)}
                                className="p-1.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors"
                                title="Reject Verification"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar Column: Blacklist Governance & Blocked list */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <AlertOctagon className="w-4.5 h-4.5 text-rose-500" />
              <h3 className="text-sm font-semibold text-slate-800">Blacklist & Account Suspension</h3>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Temporarily or permanently suspend host profiles. Blacklisted owners cannot register new bays, and their existing active bays are automatically locked to safety state.
            </p>

            <form onSubmit={handleAddToBlacklist} className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Host Account Email</label>
                <div className="flex gap-2 mt-1">
                  <input 
                    type="text" 
                    placeholder="e.g. abuser@gmail.com" 
                    value={newBlacklistEmail}
                    onChange={(e) => setNewBlacklistEmail(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                  />
                  <button 
                    type="submit"
                    className="px-3 bg-slate-800 text-white font-semibold rounded-lg text-xs hover:bg-slate-700 transition-colors shrink-0"
                  >
                    Suspend
                  </button>
                </div>
              </div>
              {blacklistError && <p className="text-[10px] text-rose-600 font-medium">{blacklistError}</p>}
            </form>

            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Suspension List</span>
              
              {blacklist.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic">No suspended accounts currently.</div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {blacklist.map((email) => (
                    <div key={email} className="flex items-center justify-between p-2 bg-rose-50 border border-rose-100 rounded-lg text-xs">
                      <span className="font-mono text-rose-800 font-medium truncate max-w-[150px]">{email}</span>
                      <button 
                        onClick={() => handleRemoveFromBlacklist(email)}
                        className="text-[10px] text-[#2563EB] font-semibold hover:underline"
                      >
                        Reintegrate
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document View Drawer / Modal overlay */}
      <AnimatePresence>
        {selectedListing && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-xl max-w-2xl w-full space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#2563EB] font-bold bg-[#2563EB]/5 px-2 py-0.5 rounded">Ownership Verification</span>
                    <span className="text-xs text-slate-400">ID: {selectedListing.id}</span>
                  </div>
                  <h3 className="text-md font-bold text-slate-800 mt-1">{selectedListing.ownerName}'s Strata Submission</h3>
                </div>
                <button 
                  onClick={() => setSelectedListing(null)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Physical Details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Verification ID:</span>
                  <p className="text-slate-700 font-mono font-semibold">#{selectedListing.verificationRequestId}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Parking Spot ID:</span>
                  <p className="text-[#2563EB] font-bold font-mono">#{selectedListing.parkingSpotId}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Host Email:</span>
                  <p className="text-slate-700 font-semibold">{selectedListing.ownerEmail}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Designated Bay:</span>
                  <p className="text-[#2563EB] font-bold font-mono">{selectedListing.bayNumber}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-medium">Physical Location:</span>
                  <p className="text-slate-700 font-medium">{selectedListing.location}</p>
                </div>
              </div>

              {/* Uploaded Documents */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Uploaded Legal Proof Documents</span>
                
                {/* Strata Title Deed Doc */}
                <div className="p-3 border border-slate-100 rounded-lg flex items-start gap-3 bg-white hover:border-[#2563EB]/20 transition-all">
                  <FileText className="w-8 h-8 text-[#2563EB] shrink-0" />
                  <div className="text-xs space-y-0.5">
                    <span className="font-semibold text-slate-700">Strata Land Title Deed Certificate</span>
                    <p className="text-[11px] text-slate-500">{selectedListing.documents.titleDeed}</p>
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Legally Encrypted & Sealed
                    </span>
                  </div>
                </div>

                {/* Utility Bill Doc */}
                <div className="p-3 border border-slate-100 rounded-lg flex items-start gap-3 bg-white hover:border-[#2563EB]/20 transition-all">
                  <FileText className="w-8 h-8 text-blue-500 shrink-0" />
                  <div className="text-xs space-y-0.5">
                    <span className="font-semibold text-slate-700">Municipal Utility Statement (Water/Electric)</span>
                    <p className="text-[11px] text-slate-500">{selectedListing.documents.utilityBill}</p>
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Matches Host Name & Bay Address
                    </span>
                  </div>
                </div>

                {/* Identity Doc */}
                <div className="p-3 border border-slate-100 rounded-lg flex items-start gap-3 bg-white hover:border-[#2563EB]/20 transition-all">
                  <FileText className="w-8 h-8 text-slate-500 shrink-0" />
                  <div className="text-xs space-y-0.5">
                    <span className="font-semibold text-slate-700">Government Identity Card Scan</span>
                    <p className="text-[11px] text-slate-500">{selectedListing.documents.identityCard}</p>
                  </div>
                </div>
              </div>

              {/* Action bar inside modal */}
              {selectedListing.status === 'pending' && (
                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => setRejectingListingId(selectedListing.id)}
                    className="px-4 py-2 bg-rose-50 text-rose-700 font-semibold rounded-lg text-xs hover:bg-rose-100 transition-colors"
                  >
                    Reject Application
                  </button>
                  <button 
                    onClick={() => handleApproveClick(selectedListing)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors"
                  >
                    Approve Verification
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Overlay for selecting/specifying reasons */}
      <AnimatePresence>
        {rejectingListingId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-55">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xl max-w-md w-full space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 text-rose-600">
                  <BadgeAlert className="w-4.5 h-4.5" /> Reject Listing Verification
                </h3>
                <button 
                  onClick={() => setRejectingListingId(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Select Rejection Reason</label>
                  <select 
                    value={customRejectionReason}
                    onChange={(e) => setCustomRejectionReason(e.target.value)}
                    className="w-full mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                  >
                    {rejectionOptions.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                    <option value="custom">-- Custom Reason --</option>
                  </select>
                </div>

                {customRejectionReason === 'custom' && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custom Explanatory Note</label>
                    <textarea 
                      placeholder="Write exact legal reason why this Strata proof was rejected..."
                      onChange={(e) => setCustomRejectionReason(e.target.value)}
                      className="w-full mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 h-20 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                )}

                <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                  Submitting a rejection triggers an automated email notification with details explaining the corrective action required to the host Tan Kah Seng.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  onClick={() => setRejectingListingId(null)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRejectSubmit}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                >
                  Confirm Rejection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
