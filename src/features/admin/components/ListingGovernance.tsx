import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertOctagon, CheckCircle, XCircle, Search, Eye, BadgeAlert,
  RefreshCw, Clock3, FileText, Download, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  ListingRequest,
  ParkingVerificationDecisionResult,
  ParkingVerificationDocumentDto,
  VerificationRequestListStatus,
  VerificationRequestPaginationState,
} from '../types';
import type { SuspendedAccount } from '../api/accountSuspensionApi';

interface ListingGovernanceProps {
  listings: ListingRequest[];
  isLoading: boolean;
  error: string | null;
  statusFilter: VerificationRequestListStatus;
  pagination: VerificationRequestPaginationState;
  onStatusChange: (status: VerificationRequestListStatus) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRefresh: () => void | Promise<void>;
  onViewDocument: (document: ParkingVerificationDocumentDto) => Promise<Blob>;
  onApprove: (id: string) => Promise<ParkingVerificationDecisionResult>;
  onReject: (id: string, reason: string) => Promise<ParkingVerificationDecisionResult>;
  onSuspend: (email: string) => Promise<SuspendedAccount>;
  onReintegrate: (email: string) => Promise<SuspendedAccount>;
  onLoadSuspensions: () => Promise<SuspendedAccount[]>;
  addActivityLog: (type: string, message: string, user: string) => void;
}

export default function ListingGovernance({ 
  listings,
  isLoading,
  error,
  statusFilter,
  pagination,
  onStatusChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onViewDocument,
  onApprove, 
  onReject,
  onSuspend,
  onReintegrate,
  onLoadSuspensions,
  addActivityLog 
}: ListingGovernanceProps) {
  const activeTab = statusFilter === 'pending' ? 'pending' : 'moderated';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListing, setSelectedListing] = useState<ListingRequest | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<ParkingVerificationDocumentDto | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentLoadingId, setDocumentLoadingId] = useState<number | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [rejectingListingId, setRejectingListingId] = useState<string | null>(null);
  const [selectedRejectionReason, setSelectedRejectionReason] = useState('Deed name mismatch with registration profile');
  const [customRejectionNote, setCustomRejectionNote] = useState('');
  const [decisionLoadingId, setDecisionLoadingId] = useState<string | null>(null);
  const [decisionFeedback, setDecisionFeedback] = useState<{ success: boolean; message: string } | null>(null);
  
  const [suspendedAccounts, setSuspendedAccounts] = useState<SuspendedAccount[]>([]);
  const [newBlacklistEmail, setNewBlacklistEmail] = useState('');
  const [blacklistError, setBlacklistError] = useState('');
  const [suspensionMessage, setSuspensionMessage] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);
  const [reintegratingUserId, setReintegratingUserId] = useState<number | null>(null);
  const [suspensionsLoading, setSuspensionsLoading] = useState(true);
  const [suspensionsLoadError, setSuspensionsLoadError] = useState('');
  const [suspensionSearch, setSuspensionSearch] = useState('');

  const rejectionOptions = [
    "Deed name mismatch with registration profile",
    "Unclear strata title deed document scan",
    "Utility bill address does not match parking bay physical coordinates",
    "Invalid or expired government ID document",
    "Bay number mismatch with title registration deed"
  ];

  const formatSubmittedAt = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '—';

    return new Intl.DateTimeFormat('en-MY', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const documentTypeLabels: Record<number, string> = {
    1: 'SPA / Sale and Purchase Agreement',
    2: 'Utility Bill',
    3: 'Parking Photo',
    4: 'Identity Card',
    5: 'Other Supporting Document',
  };

  const isImageDocument = (document: ParkingVerificationDocumentDto) => {
    const format = document.format.trim().toLowerCase();
    return document.resourceType.trim().toLowerCase() === 'image'
      || format === 'jpg'
      || format === 'jpeg'
      || format === 'png';
  };

  const getDocumentFileName = (document: ParkingVerificationDocumentDto) => {
    const name = document.originalFileName.trim() || `verification-document-${document.verificationDocumentId}`;
    const extension = document.format.trim().toLowerCase();
    return extension && !name.toLowerCase().endsWith(`.${extension}`) ? `${name}.${extension}` : name;
  };

  const filteredListings = listings.filter(l => {
    const searchableValues = [
      l.verificationRequestId,
      l.parkingSpotId,
      l.parkingLabel,
      l.propertyId,
      l.propertyName,
      l.submittedByUserId,
      l.submittedByEmail,
      l.submittedByName,
      l.verificationStatus,
      l.submittedAt,
      ...l.documents.flatMap((document) => [
        document.verificationDocumentId,
        document.documentType,
        document.mediaFileId,
        document.resourceType,
        document.format,
        document.originalFileName,
        document.uploadedAt,
      ]),
    ];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch = searchableValues.some((value) =>
      String(value).toLowerCase().includes(normalizedQuery)
    );
    
    if (activeTab === 'pending') {
      return l.status === 'pending' && matchesSearch;
    } else {
      return l.status !== 'pending' && matchesSearch;
    }
  });
  // Keep the UI limit authoritative even if an API response unexpectedly
  // contains more records than the selected page size.
  const visibleListings = filteredListings.slice(0, pagination.pageSize);

  const changeStatusTab = (status: VerificationRequestListStatus) => {
    setSearchQuery('');
    setSelectedListing(null);
    setSelectedDocument(null);
    setDocumentUrl(null);
    setDocumentError(null);
    onStatusChange(status);
  };

  const firstResult = visibleListings.length === 0
    ? 0
    : (pagination.page - 1) * pagination.pageSize + 1;
  const lastResult = visibleListings.length === 0
    ? 0
    : firstResult + visibleListings.length - 1;

  const handleApproveClick = async (listing: ListingRequest) => {
    setDecisionLoadingId(listing.id);
    setDecisionFeedback(null);
    const result = await onApprove(listing.id);
    setDecisionLoadingId(null);
    setDecisionFeedback(result);
    if (result.success && selectedListing?.id === listing.id) closeSelectedListing();
  };

  const handleRejectSubmit = async () => {
    if (!rejectingListingId) return;
    const reviewNotes = selectedRejectionReason === 'custom'
      ? customRejectionNote.trim()
      : selectedRejectionReason;
    if (!reviewNotes) {
      setDecisionFeedback({ success: false, message: 'Review notes are required when rejecting a request.' });
      return;
    }

    setDecisionLoadingId(rejectingListingId);
    setDecisionFeedback(null);
    const result = await onReject(rejectingListingId, reviewNotes);
    setDecisionLoadingId(null);
    setDecisionFeedback(result);
    if (result.success) {
      setRejectingListingId(null);
      closeSelectedListing();
    }
  };

  const rejectingListing = listings.find((listing) => listing.id === rejectingListingId);

  const openRejectDialog = (id: string) => {
    setRejectingListingId(id);
    setCustomRejectionNote('');
    setDecisionFeedback(null);
  };

  React.useEffect(() => {
    return () => {
      if (documentUrl) URL.revokeObjectURL(documentUrl);
    };
  }, [documentUrl]);

  const loadSuspensions = React.useCallback(async () => {
    setSuspensionsLoading(true);
    setSuspensionsLoadError('');
    try {
      setSuspendedAccounts(await onLoadSuspensions());
    } catch (loadError) {
      setSuspensionsLoadError(loadError instanceof Error ? loadError.message : 'Unable to load suspended accounts.');
    } finally {
      setSuspensionsLoading(false);
    }
  }, [onLoadSuspensions]);

  React.useEffect(() => {
    void loadSuspensions();
  }, [loadSuspensions]);

  const closeSelectedListing = () => {
    setSelectedListing(null);
    setSelectedDocument(null);
    setDocumentUrl(null);
    setDocumentError(null);
  };

  const openSelectedListing = (listing: ListingRequest) => {
    setSelectedListing(listing);
    setSelectedDocument(null);
    setDocumentUrl(null);
    setDocumentError(null);
  };

  const handleViewDocument = async (document: ParkingVerificationDocumentDto) => {
    setDocumentLoadingId(document.mediaFileId);
    setSelectedDocument(document);
    setDocumentError(null);
    setDocumentUrl(null);

    try {
      const file = await onViewDocument(document);
      setDocumentUrl(URL.createObjectURL(file));
    } catch (loadError) {
      setDocumentError(loadError instanceof Error ? loadError.message : 'Unable to load this private document.');
    } finally {
      setDocumentLoadingId(null);
    }
  };

  const handleAddToBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newBlacklistEmail.trim().toLowerCase();
    setSuspensionMessage('');
    if (!email || !email.includes('@')) {
      setBlacklistError('Please enter a valid email address');
      return;
    }
    if (suspendedAccounts.some((account) => account.email.toLowerCase() === email)) {
      setBlacklistError('Email is already on the suspension blacklist');
      return;
    }
    setIsSuspending(true);
    setBlacklistError('');
    try {
      const account = await onSuspend(email);
      setSuspendedAccounts((current) => [
        account,
        ...current.filter((item) => item.userId !== account.userId),
      ]);
      addActivityLog('governance', `Suspended account: ${account.email}`, 'Admin');
      setNewBlacklistEmail('');
      setSuspensionMessage(`${account.firstName} ${account.lastName} is now ${account.accountStatus.toLowerCase()}.`);
    } catch (suspensionError) {
      setBlacklistError(suspensionError instanceof Error ? suspensionError.message : 'Unable to suspend this account.');
    } finally {
      setIsSuspending(false);
    }
  };

  const handleReintegrate = async (account: SuspendedAccount) => {
    setReintegratingUserId(account.userId);
    setBlacklistError('');
    setSuspensionMessage('');
    try {
      const reintegrated = await onReintegrate(account.email);
      setSuspendedAccounts((current) => current.filter((item) => item.userId !== reintegrated.userId));
      addActivityLog('governance', `Reintegrated account: ${reintegrated.email}`, 'Admin');
      setSuspensionMessage(`${reintegrated.firstName} ${reintegrated.lastName} is now ${reintegrated.accountStatus.toLowerCase()}.`);
    } catch (reintegrationError) {
      setBlacklistError(reintegrationError instanceof Error ? reintegrationError.message : 'Unable to reintegrate this account.');
    } finally {
      setReintegratingUserId(null);
    }
  };

  const normalizedSuspensionSearch = suspensionSearch.trim().toLowerCase();
  const filteredSuspendedAccounts = suspendedAccounts.filter((account) => !normalizedSuspensionSearch || [
    account.userId,
    account.email,
    account.firstName,
    account.lastName,
    account.accountStatus,
    account.userType,
    account.lockedParkingSpotCount,
  ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSuspensionSearch)));

  return (
    <div id="listing-governance" className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="governance-title" className="text-2xl font-bold text-slate-800 tracking-tight">Parking Verification Requests</h2>
            <p className="text-slate-500 text-sm">Review every parking-space verification submitted by property owners.</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing…' : 'Refresh requests'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={onRefresh} className="self-start font-semibold underline underline-offset-2 sm:self-auto">
            Try again
          </button>
        </div>
      )}

      {decisionFeedback && (
        <div
          role={decisionFeedback.success ? 'status' : 'alert'}
          className={`rounded-xl border px-4 py-3 text-sm ${
            decisionFeedback.success
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {decisionFeedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Moderate Listing Column (takes 2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg self-start">
              <button 
                type="button"
                onClick={() => changeStatusTab('pending')}
                aria-pressed={activeTab === 'pending'}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${activeTab === 'pending' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Pending Review
              </button>
              <button 
                type="button"
                onClick={() => changeStatusTab('completed')}
                aria-pressed={activeTab === 'moderated'}
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
                placeholder="Search any request field..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full sm:w-64 focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>
          </div>

          {/* Table list of listings */}
          <div className="overflow-x-auto">
            {isLoading && listings.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading verification requests…
              </div>
            ) : visibleListings.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No property listings found matching the current criteria.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <th className="py-3 px-2">Verification</th>
                    <th className="py-3 px-2">Submitted By</th>
                    <th className="py-3 px-2">Property & Bay</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {visibleListings.map((listing) => (
                    <tr key={listing.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-2">
                        <div className="font-mono font-bold text-[#2563EB]">VR-{listing.verificationRequestId}</div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock3 className="h-3 w-3" /> {formatSubmittedAt(listing.submittedAt)}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                          <FileText className="h-3 w-3" /> {listing.documents.length} document{listing.documents.length === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        <div className="font-semibold text-slate-800">{listing.submittedByName}</div>
                        <div className="text-[10px] text-slate-400">{listing.submittedByEmail}</div>
                        <div className="mt-0.5 text-[10px] font-mono text-slate-400">User #{listing.submittedByUserId}</div>
                      </td>
                      <td className="py-3.5 px-2">
                        <div className="text-slate-700 font-medium line-clamp-1">{listing.propertyName}</div>
                        <div className="text-[10px] text-slate-400">Property #{listing.propertyId}</div>
                        <div className="text-[10px] text-[#2563EB] font-mono font-bold bg-[#2563EB]/5 px-1.5 py-0.5 rounded inline-block mt-1">
                          Bay {listing.parkingLabel} · Spot #{listing.parkingSpotId}
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        {listing.status === 'pending' && (
                          <div>
                            <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full text-[10px] font-medium">{listing.verificationStatusLabel}</span>
                            <p className="mt-1 text-[9px] font-mono text-slate-400">Code: {listing.verificationStatus}</p>
                          </div>
                        )}
                        {listing.status === 'approved' && (
                          <div>
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-medium">{listing.verificationStatusLabel}</span>
                            <p className="mt-1 text-[9px] font-mono text-slate-400">Code: {listing.verificationStatus}</p>
                          </div>
                        )}
                        {listing.status === 'rejected' && (
                          <div>
                            <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full text-[10px] font-medium">{listing.verificationStatusLabel}</span>
                            <p className="mt-1 text-[9px] font-mono text-slate-400">Code: {listing.verificationStatus}</p>
                          </div>
                        )}
                        {listing.status === 'unknown' && (
                          <div>
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-medium">{listing.verificationStatusLabel}</span>
                            <p className="mt-1 text-[9px] font-mono text-slate-400">Code: {listing.verificationStatus}</p>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => openSelectedListing(listing)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-[#2563EB] transition-colors"
                            title="View verification details"
                            aria-label={`View verification request ${listing.verificationRequestId}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {listing.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleApproveClick(listing)}
                                disabled={decisionLoadingId !== null}
                                className="p-1.5 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                                title="Approve Verification"
                              >
                                {decisionLoadingId === listing.id
                                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                                  : <CheckCircle className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => openRejectDialog(listing.id)}
                                disabled={decisionLoadingId !== null}
                                className="p-1.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] text-slate-500" aria-live="polite">
              {pagination.totalCount !== null ? (
                <>
                  Showing <span className="font-semibold text-slate-700">{firstResult}-{Math.min(lastResult, pagination.totalCount)}</span>
                  {' '}of <span className="font-semibold text-slate-700">{pagination.totalCount}</span> requests
                </>
              ) : (
                <>
                  Page <span className="font-semibold text-slate-700">{pagination.page}</span>
                  {' '}· {listings.length} request{listings.length === 1 ? '' : 's'} returned
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                Rows per page
                <select
                  value={pagination.pageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                  disabled={isLoading}
                  className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-hidden transition-colors hover:border-slate-300 focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Rows per page"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>

              <nav className="flex items-center gap-2" aria-label="Verification request pagination">
                <button
                  type="button"
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={isLoading || pagination.page <= 1}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <span className="min-w-20 text-center text-xs font-semibold text-slate-700">
                  Page {pagination.page}
                  {pagination.totalPages !== null ? ` of ${pagination.totalPages}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={isLoading || !pagination.hasNextPage}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </nav>
            </div>
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
                    disabled={isSuspending}
                    className="px-3 bg-slate-800 text-white font-semibold rounded-lg text-xs hover:bg-slate-700 transition-colors shrink-0"
                  >
                    {isSuspending ? 'Suspending…' : 'Suspend'}
                  </button>
                </div>
              </div>
              {blacklistError && <p className="text-[10px] text-rose-600 font-medium">{blacklistError}</p>}
              {suspensionMessage && <p role="status" className="text-[10px] text-emerald-700 font-medium">{suspensionMessage}</p>}
            </form>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Suspension List</span>
                <button type="button" onClick={loadSuspensions} disabled={suspensionsLoading} className="text-[10px] font-semibold text-[#2563EB] disabled:opacity-50">
                  {suspensionsLoading ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              <label className="relative block">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  value={suspensionSearch}
                  onChange={(event) => setSuspensionSearch(event.target.value)}
                  placeholder="Search suspended accounts"
                  aria-label="Search suspended accounts"
                  className="min-h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
              
              {suspensionsLoadError ? (
                <div className="text-[11px] text-rose-600">{suspensionsLoadError}</div>
              ) : suspensionsLoading && suspendedAccounts.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic">Loading suspended accounts…</div>
              ) : suspendedAccounts.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic">No suspended accounts.</div>
              ) : filteredSuspendedAccounts.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic">No suspended accounts match “{suspensionSearch.trim()}”.</div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {filteredSuspendedAccounts.map((account) => (
                    <div key={account.userId} className="flex items-center justify-between gap-2 p-2 bg-rose-50 border border-rose-100 rounded-lg text-xs">
                      <div className="min-w-0">
                        <p className="font-mono text-rose-800 font-medium truncate">{account.email}</p>
                        <p className="mt-0.5 text-[10px] text-rose-600">{account.firstName} {account.lastName} · {account.accountStatus}</p>
                        {typeof account.lockedParkingSpotCount === 'number' && (
                          <p className="mt-0.5 text-[10px] text-slate-500">{account.lockedParkingSpotCount} locked parking spot{account.lockedParkingSpotCount === 1 ? '' : 's'}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReintegrate(account)}
                        disabled={reintegratingUserId !== null}
                        className="shrink-0 text-[10px] text-[#2563EB] font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {reintegratingUserId === account.userId ? 'Reintegrating…' : 'Reintegrate'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Verification request details */}
      <AnimatePresence>
        {selectedListing && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-xl max-w-4xl w-full space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#2563EB] font-bold bg-[#2563EB]/5 px-2 py-0.5 rounded">VR-{selectedListing.verificationRequestId}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      selectedListing.status === 'pending'
                        ? 'border-amber-100 bg-amber-50 text-amber-700'
                        : selectedListing.status === 'approved'
                          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                          : selectedListing.status === 'rejected'
                            ? 'border-rose-100 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-slate-100 text-slate-700'
                    }`}>{selectedListing.verificationStatusLabel} · Code {selectedListing.verificationStatus}</span>
                  </div>
                  <h3 className="text-md font-bold text-slate-800 mt-1">Verification request details</h3>
                </div>
                <button 
                  onClick={closeSelectedListing}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-slate-400 font-medium">Verification ID:</span>
                  <p className="text-slate-700 font-mono font-semibold">#{selectedListing.verificationRequestId}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Parking Spot ID:</span>
                  <p className="text-[#2563EB] font-bold font-mono">#{selectedListing.parkingSpotId}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Parking Label:</span>
                  <p className="text-[#2563EB] font-bold font-mono">{selectedListing.parkingLabel}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Property ID:</span>
                  <p className="text-slate-700 font-mono font-semibold">#{selectedListing.propertyId}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Property Name:</span>
                  <p className="text-slate-700 font-semibold">{selectedListing.propertyName}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Verification Status:</span>
                  <p className="text-slate-700 font-semibold">{selectedListing.verificationStatusLabel}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">API value: {selectedListing.verificationStatus}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Submitted By User ID:</span>
                  <p className="text-slate-700 font-mono font-semibold">#{selectedListing.submittedByUserId}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Submitted By Name:</span>
                  <p className="text-slate-700 font-semibold">{selectedListing.submittedByName}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-medium">Submitted By Email:</span>
                  <p className="break-all text-slate-700 font-semibold">{selectedListing.submittedByEmail}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-medium">Submitted At:</span>
                  <p className="text-slate-700 font-semibold">{formatSubmittedAt(selectedListing.submittedAt)}</p>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-slate-400">{selectedListing.submittedAt}</p>
                </div>
              </div>

              <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="private-document-title">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-50 p-2 text-[#2563EB]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 id="private-document-title" className="text-sm font-bold text-slate-800">
                      Private verification documents ({selectedListing.documents.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">Files are loaded securely using the media IDs returned with this verification request.</p>
                  </div>
                </div>

                {selectedListing.documents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                    No supporting documents were returned for this request.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedListing.documents.map((document) => (
                      <article key={document.verificationDocumentId} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800">{getDocumentFileName(document)}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {documentTypeLabels[document.documentType] || `Document type ${document.documentType}`}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-slate-600 ring-1 ring-slate-200">
                            {document.format}
                          </span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                          <div><dt className="text-slate-400">Verification document ID</dt><dd className="font-mono font-semibold text-slate-700">#{document.verificationDocumentId}</dd></div>
                          <div><dt className="text-slate-400">Media file ID</dt><dd className="font-mono font-semibold text-slate-700">#{document.mediaFileId}</dd></div>
                          <div><dt className="text-slate-400">Resource type</dt><dd className="font-semibold text-slate-700">{document.resourceType}</dd></div>
                          <div><dt className="text-slate-400">Document type code</dt><dd className="font-mono font-semibold text-slate-700">{document.documentType}</dd></div>
                          <div className="col-span-2"><dt className="text-slate-400">Uploaded at</dt><dd className="font-semibold text-slate-700">{formatSubmittedAt(document.uploadedAt)}</dd><dd className="mt-0.5 break-all font-mono text-[9px] text-slate-400">{document.uploadedAt}</dd></div>
                        </dl>
                        <button
                          type="button"
                          onClick={() => handleViewDocument(document)}
                          disabled={documentLoadingId !== null}
                          className="mt-3 w-full rounded-lg bg-[#2563EB] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {documentLoadingId === document.mediaFileId ? 'Loading file…' : `View ${isImageDocument(document) ? 'image' : 'PDF'}`}
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                {documentError && <p role="alert" className="text-xs font-medium text-rose-600">{documentError}</p>}

                {documentUrl && selectedDocument && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-xs font-semibold text-slate-700">Preview: {getDocumentFileName(selectedDocument)}</p>
                      <a
                        href={documentUrl}
                        download={getDocumentFileName(selectedDocument)}
                        className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> Download file
                      </a>
                    </div>
                    {isImageDocument(selectedDocument) ? (
                      <img
                        src={documentUrl}
                        alt={`Verification document ${selectedDocument.verificationDocumentId}`}
                        className="max-h-[560px] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
                      />
                    ) : (
                      <iframe
                        src={documentUrl}
                        title={`Private verification document ${selectedDocument.verificationDocumentId}`}
                        className="h-[480px] w-full rounded-lg border border-slate-200 bg-slate-50"
                      />
                    )}
                  </div>
                )}
              </section>

              {/* Action bar inside modal */}
              {selectedListing.status === 'pending' && (
                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => openRejectDialog(selectedListing.id)}
                    disabled={decisionLoadingId !== null}
                    className="px-4 py-2 bg-rose-50 text-rose-700 font-semibold rounded-lg text-xs hover:bg-rose-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject Application
                  </button>
                  <button 
                    onClick={() => handleApproveClick(selectedListing)}
                    disabled={decisionLoadingId !== null}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {decisionLoadingId === selectedListing.id ? 'Submitting…' : 'Approve Verification'}
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
                    value={selectedRejectionReason}
                    onChange={(e) => setSelectedRejectionReason(e.target.value)}
                    className="w-full mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                  >
                    {rejectionOptions.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                    <option value="custom">-- Custom Reason --</option>
                  </select>
                </div>

                {selectedRejectionReason === 'custom' && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custom Explanatory Note</label>
                    <textarea 
                      placeholder="Write exact legal reason why this Strata proof was rejected..."
                      value={customRejectionNote}
                      onChange={(e) => setCustomRejectionNote(e.target.value)}
                      className="w-full mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 h-20 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                )}

                <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                  Submitting a rejection triggers an automated email notification with corrective-action details for {rejectingListing?.submittedByName ?? 'this owner'}.
                </p>
                {decisionFeedback && !decisionFeedback.success && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-medium text-rose-700">
                    {decisionFeedback.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  onClick={() => setRejectingListingId(null)}
                  disabled={decisionLoadingId !== null}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRejectSubmit}
                  disabled={decisionLoadingId !== null}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {decisionLoadingId === rejectingListingId ? 'Submitting…' : 'Confirm Rejection'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
