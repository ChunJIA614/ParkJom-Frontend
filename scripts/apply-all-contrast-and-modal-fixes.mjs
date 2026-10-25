import fs from 'node:fs';

function replaceNormalized(filePath, search, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  const normSearchLF = search.replace(/\r\n/g, '\n');
  const normSearchCRLF = search.replace(/\r?\n/g, '\r\n');
  const normRepl = content.includes('\r\n')
    ? replacement.replace(/\r?\n/g, '\r\n')
    : replacement.replace(/\r\n/g, '\n');

  if (content.includes(normSearchCRLF)) {
    content = content.replace(normSearchCRLF, normRepl);
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  if (content.includes(normSearchLF)) {
    content = content.replace(normSearchLF, normRepl);
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

console.log('--- Step 1: Update index.css for search-results and table row hover ---');
let css = fs.readFileSync('src/app/styles/index.css', 'utf8');

// Table hover in dark mode
const oldTrHover = `.dark .app-workspace tr:hover td {
  background-color: rgba(255, 255, 255, 0.03) !important;
}`;

const newTrHover = `.dark .app-workspace tr,
.dark .app-workspace tbody tr {
  transition: background-color 150ms ease;
}

.dark .app-workspace :where(tr[class*="hover:bg-"], tbody tr):hover,
.dark .app-workspace tr:hover,
.dark .app-workspace tr[class*="hover:bg-slate-50"]:hover,
.dark .app-workspace [class*="hover:bg-slate-50\/50"]:hover,
.dark .app-workspace [class*="hover:bg-slate-50\/70"]:hover {
  background-color: rgba(255, 255, 255, 0.04) !important;
}

.dark .app-workspace tr:hover td {
  background-color: transparent !important;
}`;

let ok = replaceNormalized('src/app/styles/index.css', oldTrHover, newTrHover);
console.log('Table hover rule updated:', ok);

// Search results popover in dark mode
const oldSearchResult = `.workspace-header__search-result svg {
  color: #8e8e93;
}`;

const newSearchResult = `.workspace-header__search-result svg {
  color: #8e8e93;
}

.dark .workspace-header__search-results,
.dark .workspace-header__mobile-search {
  background: #1c1c1e !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6) !important;
}

.dark .workspace-header__search-result {
  color: #f5f5f7 !important;
}

.dark .workspace-header__search-result svg {
  color: #8e8e93 !important;
}

.dark .workspace-header__search-result:hover,
.dark .workspace-header__search-result:focus-visible {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #0a84ff !important;
}

.dark .workspace-header__search-result:hover svg,
.dark .workspace-header__search-result:focus-visible svg {
  color: #0a84ff !important;
}

.dark .workspace-header__search-empty {
  color: #8e8e93 !important;
}

.dark .workspace-header__mobile-search-field {
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: #8e8e93 !important;
}

.dark .workspace-header__mobile-search-field input {
  color: #f5f5f7 !important;
}`;

ok = replaceNormalized('src/app/styles/index.css', oldSearchResult, newSearchResult);
console.log('Search dropdown rules updated:', ok);

console.log('--- Step 2: Fix ListingGovernance modal z-index, dimensions, and styling ---');
const oldModal = `      {/* Verification request details */}
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
                    <span className={\`rounded-full border px-2 py-0.5 text-[10px] font-medium \${
                      selectedListing.status === 'pending'
                        ? 'border-amber-100 bg-amber-50 text-amber-700'
                        : selectedListing.status === 'approved'
                          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                          : selectedListing.status === 'rejected'
                            ? 'border-rose-100 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-slate-100 text-slate-700'
                    }\`}>{selectedListing.verificationStatusLabel} · Code {selectedListing.verificationStatus}</span>
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
                              {documentTypeLabels[document.documentType] || \`Document type \${document.documentType}\`}
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
                          {documentLoadingId === document.mediaFileId ? 'Loading file…' : \`View \${isImageDocument(document) ? 'image' : 'PDF'}\`}
                        </button>
                      </article>
                    ))}
                  </div>
                )}`;

const newModal = `      {/* Verification request details */}
      <AnimatePresence>
        {selectedListing && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[1300]">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-white/[0.12] p-4 sm:p-6 shadow-2xl max-w-2xl w-full space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#2563EB] font-bold bg-[#2563EB]/5 dark:bg-[#2563EB]/20 px-2 py-0.5 rounded">VR-{selectedListing.verificationRequestId}</span>
                    <span className={\`rounded-full border px-2 py-0.5 text-[10px] font-medium \${
                      selectedListing.status === 'pending'
                        ? 'border-amber-100 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        : selectedListing.status === 'approved'
                          ? 'border-emerald-100 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : selectedListing.status === 'rejected'
                            ? 'border-rose-100 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'
                            : 'border-slate-200 dark:border-white/[0.12] bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300'
                    }\`}>{selectedListing.verificationStatusLabel} · Code {selectedListing.verificationStatus}</span>
                  </div>
                  <h3 className="text-md font-bold text-slate-800 dark:text-[#f5f5f7] mt-1">Verification request details</h3>
                </div>
                <button 
                  onClick={closeSelectedListing}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-full text-slate-400 dark:text-[#8e8e93] hover:text-slate-600 dark:hover:text-[#f5f5f7] transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4 bg-slate-50 dark:bg-white/[0.04] p-3.5 sm:p-4 rounded-xl border border-slate-100 dark:border-white/[0.08] text-xs sm:grid-cols-2">
                <div>
                  <span className="text-slate-400 dark:text-[#a1a1a6] font-medium">Verification ID:</span>
                  <p className="text-slate-700 dark:text-[#f5f5f7] font-mono font-semibold">#{selectedListing.verificationRequestId}</p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#a1a1a6] font-medium">Parking Spot ID:</span>
                  <p className="text-[#2563EB] dark:text-[#0a84ff] font-bold font-mono">#{selectedListing.parkingSpotId}</p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#a1a1a6] font-medium">Parking Label:</span>
                  <p className="text-[#2563EB] dark:text-[#0a84ff] font-bold font-mono">{selectedListing.parkingLabel}</p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#a1a1a6] font-medium">Property ID:</span>
                  <p className="text-slate-700 dark:text-[#f5f5f7] font-mono font-semibold">#{selectedListing.propertyId}</p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#a1a1a6] font-medium">Property Name:</span>
                  <p className="text-slate-700 dark:text-[#f5f5f7] font-semibold">{selectedListing.propertyName}</p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#a1a1a6] font-medium">Verification Status:</span>
                  <p className="text-slate-700 dark:text-[#f5f5f7] font-semibold">{selectedListing.verificationStatusLabel}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400 dark:text-[#8e8e93]">API value: {selectedListing.verificationStatus}</p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#a1a1a6] font-medium">Submitted By User ID:</span>
                  <p className="text-slate-700 dark:text-[#f5f5f7] font-mono font-semibold">#{selectedListing.submittedByUserId}</p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#a1a1a6] font-medium">Submitted By Name:</span>
                  <p className="text-slate-700 dark:text-[#f5f5f7] font-semibold">{selectedListing.submittedByName}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 dark:text-[#a1a1a6] font-medium">Submitted By Email:</span>
                  <p className="break-all text-slate-700 dark:text-[#f5f5f7] font-semibold">{selectedListing.submittedByEmail}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 dark:text-[#a1a1a6] font-medium">Submitted At:</span>
                  <p className="text-slate-700 dark:text-[#f5f5f7] font-semibold">{formatSubmittedAt(selectedListing.submittedAt)}</p>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-slate-400 dark:text-[#8e8e93]">{selectedListing.submittedAt}</p>
                </div>
              </div>

              <section className="space-y-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-3.5 sm:p-4" aria-labelledby="private-document-title">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-500/15 p-2 text-[#2563EB] dark:text-[#0a84ff]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 id="private-document-title" className="text-sm font-bold text-slate-800 dark:text-[#f5f5f7]">
                      Private verification documents ({selectedListing.documents.length})
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-[#a1a1a6]">Files are loaded securely using the media IDs returned with this verification request.</p>
                  </div>
                </div>

                {selectedListing.documents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] p-4 text-center text-xs text-slate-500 dark:text-[#a1a1a6]">
                    No supporting documents were returned for this request.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedListing.documents.map((document) => (
                      <article key={document.verificationDocumentId} className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] p-3 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800 dark:text-[#f5f5f7]">{getDocumentFileName(document)}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-[#a1a1a6]">
                              {documentTypeLabels[document.documentType] || \`Document type \${document.documentType}\`}
                            </p>
                          </div>
                          <span className="rounded-full bg-white dark:bg-white/[0.08] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-white/[0.08]">
                            {document.format}
                          </span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                          <div><dt className="text-slate-400 dark:text-[#a1a1a6]">Verification document ID</dt><dd className="font-mono font-semibold text-slate-700 dark:text-[#f5f5f7]">#{document.verificationDocumentId}</dd></div>
                          <div><dt className="text-slate-400 dark:text-[#a1a1a6]">Media file ID</dt><dd className="font-mono font-semibold text-slate-700 dark:text-[#f5f5f7]">#{document.mediaFileId}</dd></div>
                          <div><dt className="text-slate-400 dark:text-[#a1a1a6]">Resource type</dt><dd className="font-semibold text-slate-700 dark:text-[#f5f5f7]">{document.resourceType}</dd></div>
                          <div><dt className="text-slate-400 dark:text-[#a1a1a6]">Document type code</dt><dd className="font-mono font-semibold text-slate-700 dark:text-[#f5f5f7]">{document.documentType}</dd></div>
                          <div className="col-span-2"><dt className="text-slate-400 dark:text-[#a1a1a6]">Uploaded at</dt><dd className="font-semibold text-slate-700 dark:text-[#f5f5f7]">{formatSubmittedAt(document.uploadedAt)}</dd><dd className="mt-0.5 break-all font-mono text-[9px] text-slate-400 dark:text-[#8e8e93]">{document.uploadedAt}</dd></div>
                        </dl>
                        <button
                          type="button"
                          onClick={() => handleViewDocument(document)}
                          disabled={documentLoadingId !== null}
                          className="mt-3 w-full rounded-lg bg-[#2563EB] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {documentLoadingId === document.mediaFileId ? 'Loading file…' : \`View \${isImageDocument(document) ? 'image' : 'PDF'}\`}
                        </button>
                      </article>
                    ))}
                  </div>
                )}`;

ok = replaceNormalized('src/features/admin/components/ListingGovernance.tsx', oldModal, newModal);
console.log('ListingGovernance details modal updated:', ok);

// Reject overlay z-index in ListingGovernance
const oldRejectModal = `<div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-55">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xl max-w-md w-full space-y-4"
            >`;

const newRejectModal = `<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1350]">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-white/[0.12] p-5 shadow-2xl max-w-md w-full space-y-4"
            >`;

ok = replaceNormalized('src/features/admin/components/ListingGovernance.tsx', oldRejectModal, newRejectModal);
console.log('ListingGovernance reject overlay updated:', ok);

// Update table row hover in ListingGovernance
const oldTr = `<tr key={listing.id} className="hover:bg-slate-50/50 transition-colors">`;
const newTr = `<tr key={listing.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.04] transition-colors">`;
ok = replaceNormalized('src/features/admin/components/ListingGovernance.tsx', oldTr, newTr);
console.log('ListingGovernance tr hover updated:', ok);

console.log('--- Step 3: Fix ModalContext z-index ---');
const oldModalContext = `className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in-0 duration-150"`;
const newModalContext = `className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in-0 duration-150"`;
ok = replaceNormalized('src/contexts/ModalContext.tsx', oldModalContext, newModalContext);
console.log('ModalContext z-index updated:', ok);

console.log('--- Step 4: Fix ProfileDialog dark mode contrast on all elements ---');
let profileContent = fs.readFileSync('src/features/profile/components/ProfileDialog.tsx', 'utf8');

// 1. User name and email
profileContent = profileContent.replace(
  '<p className="truncate text-[17px] font-semibold text-[#1d1d1f]">{displayName}</p>',
  '<p className="truncate text-[17px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{displayName}</p>'
);
profileContent = profileContent.replace(
  '<p className="truncate text-[12px] text-[#6e6e73]">{profile?.email ?? user.email}</p>',
  '<p className="truncate text-[12px] text-[#6e6e73] dark:text-[#a1a1a6]">{profile?.email ?? user.email}</p>'
);

// 2. Buttons in identity card
profileContent = profileContent.replace(
  'className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[12px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7] disabled:opacity-50"',
  'className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-white/[0.08] px-3 py-2 text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors hover:bg-[#f5f5f7] dark:hover:bg-white/[0.12] disabled:opacity-50"'
);
profileContent = profileContent.replace(
  'className="inline-flex items-center rounded-full border border-black/[0.08] bg-white px-2.5 py-2 text-[#d70015] transition-colors hover:bg-rose-50 disabled:opacity-50"',
  'className="inline-flex items-center rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-white/[0.08] px-2.5 py-2 text-[#d70015] dark:text-rose-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50"'
);

// 3. Metric cards
profileContent = profileContent.replace(
  '<div key={label} className="rounded-2xl border border-black/[0.06] bg-white p-3">',
  '<div key={label} className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] p-3">'
);
profileContent = profileContent.replace(
  '<div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#8e8e93]">',
  '<div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#8e8e93] dark:text-[#a1a1a6]">'
);
profileContent = profileContent.replace(
  '<p className="mt-1.5 text-[16px] font-semibold text-[#1d1d1f]">{value}</p>',
  '<p className="mt-1.5 text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{value}</p>'
);

// 4. Form personal details card
profileContent = profileContent.replace(
  '<form onSubmit={handleSave} className="space-y-3 rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">',
  '<form onSubmit={handleSave} className="space-y-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] p-4 sm:p-5">'
);
profileContent = profileContent.replace(
  '<h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f]">',
  '<h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">'
);

// Labels in form
profileContent = profileContent.replaceAll(
  '<span className="text-[11px] font-semibold text-[#6e6e73]">',
  '<span className="text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6]">'
);

// 5. Account role card
profileContent = profileContent.replace(
  '<div className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">',
  '<div className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">'
);
profileContent = profileContent.replace(
  '<p className="mt-1 text-[11px] text-[#6e6e73]">',
  '<p className="mt-1 text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">'
);
profileContent = profileContent.replace(
  '<span className="inline-flex shrink-0 items-center rounded-full bg-[#f5f5f7] px-3.5 py-1.5 text-[12px] font-medium text-[#1d1d1f]">',
  '<span className="inline-flex shrink-0 items-center rounded-full bg-[#f5f5f7] dark:bg-white/[0.08] px-3.5 py-1.5 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">'
);

// 6. Appearance card
profileContent = profileContent.replace(
  '<div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">',
  '<div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] p-4 sm:p-5">'
);

fs.writeFileSync('src/features/profile/components/ProfileDialog.tsx', profileContent, 'utf8');
console.log('ProfileDialog dark mode contrast updated successfully');

console.log('--- Step 5: Notifications popover in AdminDashboard.tsx ---');
let adminDash = fs.readFileSync('src/features/admin/pages/AdminDashboard.tsx', 'utf8');
const oldAdminPopover = `<div id="admin-notifications" role="dialog" aria-label="Admin notifications" className="workspace-popover absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/[0.08] bg-white py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <div className="border-b border-[#f1f3f4] px-4 py-2.5 text-[13px] font-semibold text-[#111]">Notifications</div>
            {adminNotifications.length > 0 ? adminNotifications.map((message) => (
              <p key={message} className="border-b border-[#f8f9fa] px-4 py-3 text-[11px] leading-relaxed text-[#5f6368] last:border-0">{message}</p>
            )) : (
              <p className="px-4 py-5 text-center text-[11px] text-[#8e8e93]">No new operational alerts.</p>
            )}
          </div>`;

const newAdminPopover = `<div id="admin-notifications" role="dialog" aria-label="Admin notifications" className="workspace-popover absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1c1c1e] py-2 shadow-2xl">
            <div className="border-b border-[#f1f3f4] dark:border-white/[0.08] px-4 py-2.5 text-[13px] font-semibold text-[#111] dark:text-[#f5f5f7]">Notifications</div>
            {adminNotifications.length > 0 ? adminNotifications.map((message) => (
              <p key={message} className="border-b border-[#f8f9fa] dark:border-white/[0.04] px-4 py-3 text-[11px] leading-relaxed text-[#5f6368] dark:text-[#a1a1a6] last:border-0">{message}</p>
            )) : (
              <p className="px-4 py-5 text-center text-[11px] text-[#8e8e93]">No new operational alerts.</p>
            )}
          </div>`;

ok = replaceNormalized('src/features/admin/pages/AdminDashboard.tsx', oldAdminPopover, newAdminPopover);
console.log('AdminDashboard notifications popover updated:', ok);
