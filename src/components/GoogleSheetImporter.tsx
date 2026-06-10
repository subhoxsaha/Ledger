import React, { useState } from "react";
import { Sparkles, HelpCircle, Loader2, Link, FileSpreadsheet, Check, CheckSquare, PlusCircle, AlertCircle } from "lucide-react";

interface GoogleSheetImporterProps {
  onImportComplete: () => Promise<void>;
}

export default function GoogleSheetImporter({ onImportComplete }: GoogleSheetImporterProps) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  const [importedStatus, setImportedStatus] = useState<string | null>(null);

  const handleFetchPreview = async () => {
    if (!sheetUrl.trim()) return;

    setLoading(true);
    setError("");
    setPreviewRows([]);
    setOriginalHeaders([]);
    setImportedStatus(null);

    try {
      const response = await fetch("/api/google-sheets/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: sheetUrl.trim() }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid and un-parseable response from proxy server. Verify the URL is a public Google Sheets or CSV link.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to parse Google Spreadsheet content.");
      }

      setOriginalHeaders(data.originalHeaders || []);
      setPreviewRows(data.previewRows || []);

      // Auto-select all parsed rows by default
      const initialSelection: Record<string, boolean> = {};
      (data.previewRows || []).forEach((row: any) => {
        initialSelection[row.id] = true;
      });
      setSelectedIds(initialSelection);
    } catch (err: any) {
      setError(err.message || "Failed to download Google spreadsheet. Please ensure sharing is set to 'Anyone with link can view'.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleSelectAll = () => {
    const allSelected = previewRows.every((row) => selectedIds[row.id]);
    const nextSelection: Record<string, boolean> = {};
    previewRows.forEach((row) => {
      nextSelection[row.id] = !allSelected;
    });
    setSelectedIds(nextSelection);
  };

  const handleImportRecords = async () => {
    const recordsToImport = previewRows.filter((row) => selectedIds[row.id]);
    if (recordsToImport.length === 0) return;

    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/google-sheets/import-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parties: recordsToImport }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid and un-parseable response from bulk-import server.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.msg || data.error || "Failed bulk-importing transactions");
      }

      setImportedStatus(`Successfully enrolled ${data.importedCount} student participants! Double-entry balances recalculated.`);
      setPreviewRows([]);
      setSheetUrl("");
      
      // Refresh the ledger data of parent
      await onImportComplete();
    } catch (err: any) {
      setError(err.message || "Bulk register action failed.");
    } finally {
      setImporting(false);
    }
  };

  const loadSampleRecords = () => {
    const sampleRows = [
      {
        id: "gs_sample_1",
        name: "Aarav Sharma",
        phone: "+91 98765 43210",
        email: "aarav.sharma@gmail.com",
        type: "customer",
        initialBalance: 2500,
        currentBalance: 2500
      },
      {
        id: "gs_sample_2",
        name: "Ananya Iyer",
        phone: "+91 81234 56789",
        email: "ananya.iyer@yahoo.com",
        type: "customer",
        initialBalance: 1500,
        currentBalance: 1500
      },
      {
        id: "gs_sample_3",
        name: "Kabir Mehta",
        phone: "+91 90123 45678",
        email: "kabir.mehta@outlook.com",
        type: "customer",
        initialBalance: 2000,
        currentBalance: 2000
      },
      {
        id: "gs_sample_4",
        name: "Catering Head - Dev Samosa",
        phone: "+91 70000 12345",
        email: "catering@devevent.com",
        type: "supplier",
        initialBalance: -8500,
        currentBalance: -8500
      },
      {
        id: "gs_sample_5",
        name: "Sound System & DJ Rex",
        phone: "+91 98989 12345",
        email: "djrex@soundbeats.com",
        type: "supplier",
        initialBalance: -12000,
        currentBalance: -12000
      }
    ];
    setPreviewRows(sampleRows);
    const initialSelection: Record<string, boolean> = {};
    sampleRows.forEach((row) => {
      initialSelection[row.id] = true;
    });
    setSelectedIds(initialSelection);
    setError("");
    setImportedStatus(null);
  };

  return (
    <div id="google-sheet-importer-container" className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-5">
      <div>
        <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Google Sheets Integration
        </h3>
        <p className="text-sm font-display font-semibold text-slate-800 mt-1">Instant Participant Registry Importer</p>
        <p className="text-xs text-slate-400 mt-1.5 font-sans leading-relaxed">
          Instantly synchronizes bulk registrations by loading spreadsheet rows. Direct spreadsheet URL link extraction handles CORS and maps headers dynamically.
        </p>
      </div>

      {/* Sharing help guide */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-500 font-sans space-y-1">
        <p className="font-semibold text-slate-700 flex items-center gap-1">
          <HelpCircle className="h-3.5 w-3.5 text-indigo-500" /> Public sharing step (MANDATORY):
        </p>
        <ol className="list-decimal pl-4.5 space-y-0.5 leading-normal">
          <li>Open your Google Sheet and click the top-right <strong className="text-slate-700">Share</strong> button.</li>
          <li>Set General Access role to: <strong className="text-indigo-600">Anyone with the link can view</strong>.</li>
          <li>Copy and paste the browser URL below.</li>
        </ol>
      </div>

      {/* URL Inputs */}
      <div className="space-y-3">
        <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest">
          Shared Google Sheets URL
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-2.5 text-slate-400">
              <Link className="h-4 w-4" />
            </span>
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-sans focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
          </div>
          <button
            onClick={handleFetchPreview}
            disabled={loading || !sheetUrl.trim()}
            className="bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-mono font-bold text-xs px-5 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none disabled:transform-none shrink-0 flex items-center justify-center gap-1.5 shadow-sm"
          >
            {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : "Preview"}
          </button>
        </div>
      </div>

      {/* 4th Child Status & Feedback panel */}
      {(loading || error || importedStatus) && (
        <div className="space-y-3">
          {loading && (
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3 animate-pulse">
              <Loader2 className="h-5 w-5 text-indigo-600 animate-spin shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-indigo-900 leading-none">Fetching Registry Sheets</p>
                <p className="text-[10px] text-indigo-600/80 font-sans leading-relaxed">
                  Syncing Google Spreadsheet rows, validating registration cells, and recalculating ledger balances...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex flex-col gap-2.5 text-xs text-rose-700 font-sans">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-sans leading-relaxed">{error}</p>
                </div>
              </div>
              <div className="pl-7 mt-0.5">
                <button
                  type="button"
                  onClick={loadSampleRecords}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-2 cursor-pointer focus:outline-hidden text-left"
                >
                  💡 Load demo participant registrations and vendor rows to test instantly
                </button>
              </div>
            </div>
          )}

          {importedStatus && (
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-fade-in">
              <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="font-semibold">{importedStatus}</p>
            </div>
          )}
        </div>
      )}

      {/* Active parsing data preview list table */}
      {previewRows.length > 0 && (
        <div className="space-y-4 animate-fade-in" id="sheets-bulk-preview-panel">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider font-bold">
              Detected Rows ({previewRows.length})
            </span>
            <button
              onClick={toggleSelectAll}
              className="text-[9px] font-mono text-indigo-600 hover:text-indigo-800 font-bold tracking-widest uppercase cursor-pointer"
            >
              {previewRows.every((row) => selectedIds[row.id]) ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto divide-y divide-slate-50 text-[11px]">
            {previewRows.map((row) => {
              const isSelected = selectedIds[row.id];
              return (
                <div
                  key={row.id}
                  onClick={() => toggleSelectRow(row.id)}
                  className={`p-2.5 flex items-center justify-between transition-colors cursor-pointer hover:bg-slate-50 ${
                    isSelected ? "bg-slate-50/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                        isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200"
                      }`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 stroke-[4px]" />}
                    </span>
                    <div>
                      <span className="font-medium text-slate-800">{row.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono block">
                        {row.phone || "No phone"} • {row.email || "No email"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className={row.initialBalance < 0 ? "text-slate-500" : "text-rose-600 font-bold"}>
                      ₹{Math.abs(row.initialBalance).toLocaleString()}
                    </span>
                    <span className="text-[8px] text-slate-400 uppercase block">
                      {row.type === "supplier" ? "Supplier" : "Student Fee"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleImportRecords}
            disabled={importing || !previewRows.some((row) => selectedIds[row.id])}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-mono font-bold text-[11px] tracking-wider uppercase py-3.5 rounded-xl transition-all shadow-md shadow-emerald-500/15 hover:shadow-lg hover:shadow-emerald-500/25 cursor-pointer disabled:opacity-40 disabled:pointer-events-none disabled:transform-none flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                Processing Registry Mass Import...
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4 text-emerald-100" />
                Bulk Import {previewRows.filter((row) => selectedIds[row.id]).length} Selected Participants
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
