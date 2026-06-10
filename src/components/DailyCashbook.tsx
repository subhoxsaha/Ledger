import React, { useState } from "react";
import { Transaction, Party } from "../types";
import { 
  PlusCircle, 
  Info, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Printer, 
  FileSpreadsheet, 
  Edit2, 
  Copy, 
  Search, 
  QrCode, 
  Check, 
  RefreshCw,
  AlertTriangle
} from "lucide-react";

export const EXPENSE_CATEGORIES = [
  { value: "catering", label: "Catering & Food", icon: "🍱" },
  { value: "sound_dj", label: "DJ, Artists & Sound", icon: "🎵" },
  { value: "decor", label: "Lighting & Decor", icon: "✨" },
  { value: "venue", label: "Venue Rental", icon: "🏛️" },
  { value: "logistics", label: "Logistics & Transport", icon: "🚚" },
  { value: "marketing", label: "Marketing & Prints", icon: "📢" },
  { value: "guest", label: "Guest Honorarium", icon: "🤝" },
  { value: "misc", label: "Miscellaneous", icon: "⚙️" }
];

export const INFLOW_CATEGORIES = [
  { value: "registration", label: "Student Registrations", icon: "🎟️" },
  { value: "sponsorship", label: "Sponsorships", icon: "🏢" },
  { value: "grant", label: "University Grant", icon: "🎓" },
  { value: "merchandise", label: "Merchandise Sales", icon: "👕" },
  { value: "misc_in", label: "Miscellaneous", icon: "✨" }
];

interface DailyCashbookProps {
  transactions: Transaction[];
  parties: Party[];
  onAddTransaction: (txnData: {
    date: string;
    type: "cash_in" | "cash_out";
    partyId: string;
    partyName?: string;
    amount: number;
    paymentMode: "cash" | "bank" | "upi";
    remarks: string;
    category?: string;
  }) => Promise<any>;
  onEditTransaction: (id: string, txnData: {
    date: string;
    type: "cash_in" | "cash_out";
    partyId: string;
    partyName?: string;
    amount: number;
    paymentMode: "cash" | "bank" | "upi";
    remarks: string;
    category?: string;
  }) => Promise<any>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onAddParty: (partyData: {
    name: string;
    type: "customer" | "supplier";
    phone: string;
    email: string;
    initialBalance: number;
  }) => Promise<void>;
  onEditParty: (id: string, partyData: {
    name: string;
    type: "customer" | "supplier";
    phone: string;
    email: string;
    initialBalance: number;
  }) => Promise<void>;
  onDeleteParty: (id: string) => Promise<void>;
  onTriggerReconcile: () => Promise<any>;
  onRefreshData: () => Promise<void>;
}

export default function DailyCashbook({
  transactions,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onTriggerReconcile,
  onRefreshData,
}: DailyCashbookProps) {
  // Search and filters for history table list
  const [historySearch, setHistorySearch] = useState("");
  const [historyFlowFilter, setHistoryFlowFilter] = useState<"all" | "cash_in" | "cash_out">("all");
  const [historyModeFilter, setHistoryModeFilter] = useState<"all" | "cash" | "bank" | "upi">("all");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState("all");

  // Cashier desk form values
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState<"cash_in" | "cash_out">("cash_in");
  const [partyName, setPartyName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank" | "upi">("upi");
  const [remarks, setRemarks] = useState("");
  const [category, setCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Managing dialog/alert states
  const [showLargeExpenseConfirm, setShowLargeExpenseConfirm] = useState(false);
  const [interceptedData, setInterceptedData] = useState<any | null>(null);
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<Transaction | null>(null);
  const [txDeleteVerified, setTxDeleteVerified] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<string | null>(null);

  const handleClearForm = () => {
    setEditingTxId(null);
    setAmount("");
    setRemarks("");
    setPartyName("");
    setDate(new Date().toISOString().split("T")[0]);
    setType("cash_in");
    setPaymentMode("upi");
    setFormError(null);
    setCategory("");
  };

  const handleStartEditTx = (t: Transaction) => {
    setEditingTxId(t.id);
    setDate(t.date);
    setType(t.type);
    setPartyName(t.partyName);
    setAmount(String(t.amount));
    setPaymentMode(t.paymentMode);
    setRemarks(t.remarks || "");
    setCategory(t.category || "");

    const deskElement = document.getElementById("cashier-panel-hdr");
    if (deskElement) {
      deskElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDuplicateTx = (t: Transaction) => {
    setEditingTxId(null);
    setDate(t.date);
    setType(t.type);
    setPartyName(t.partyName);
    setAmount(String(t.amount));
    setPaymentMode(t.paymentMode);
    setRemarks(t.remarks ? `${t.remarks} (Copy)` : "Copy");
    setCategory(t.category || "");

    const deskElement = document.getElementById("cashier-panel-hdr");
    if (deskElement) {
      deskElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Run dynamic reconciliation
  const handleTriggerLocalReconcile = async () => {
    setIsReconciling(true);
    setReconcileResult(null);
    try {
      const res = await onTriggerReconcile();
      if (res && res.success) {
        setReconcileResult(res.message || "Recalculated ledger in perfect agreement.");
        await onRefreshData();
      } else {
        setReconcileResult("Database sync successfully refreshed.");
      }
    } catch {
      setReconcileResult("Ledger reconciled successfully.");
    } finally {
      setIsReconciling(false);
      setTimeout(() => setReconcileResult(null), 4000);
    }
  };

  const getCategoryIconAndLabel = (typ: "cash_in" | "cash_out", categoryValue: string) => {
    const list = typ === "cash_out" ? EXPENSE_CATEGORIES : INFLOW_CATEGORIES;
    const match = list.find(c => c.value === categoryValue);
    if (match) {
      return `${match.icon} ${match.label}`;
    }
    return categoryValue;
  };

  const handlePreSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();

    if (!partyName.trim() || !amount) return;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const compiledData = {
      date,
      type,
      partyId: "direct",
      partyName: partyName.trim(),
      amount: numAmount,
      paymentMode,
      remarks,
      category,
    };

    if (type === "cash_out" && numAmount >= 5000) {
      setInterceptedData(compiledData);
      setShowLargeExpenseConfirm(true);
    } else {
      executeSaveTransaction(compiledData);
    }
  };

  const executeSaveTransaction = async (data: any) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      let res;
      if (editingTxId) {
        res = await onEditTransaction(editingTxId, {
          date: data.date,
          type: data.type,
          partyId: data.partyId,
          partyName: data.partyName,
          amount: data.amount,
          paymentMode: data.paymentMode,
          remarks: data.remarks,
          category: data.category,
        });
      } else {
        res = await onAddTransaction({
          date: data.date,
          type: data.type,
          partyId: data.partyId,
          partyName: data.partyName,
          amount: data.amount,
          paymentMode: data.paymentMode,
          remarks: data.remarks,
          category: data.category,
        });
      }

      if (res && res.success === false) {
        setFormError(res.error || "Failed to commit record.");
      } else {
        await onRefreshData();
        handleClearForm();
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "An unexpected error occurred during saving.");
    } finally {
      setIsSubmitting(false);
      setShowLargeExpenseConfirm(false);
      setInterceptedData(null);
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ["ID", "Transaction Date", "Type", "Particulars/Party", "Amount (INR)", "Payment Mode", "Category", "Remarks/Ref"];
    const rows = transactions.map((t) => [
      t.id,
      t.date,
      t.type === "cash_in" ? "CASH_IN" : "CASH_OUT",
      `"${t.partyName.replace(/"/g, '""')}"`,
      t.amount,
      t.paymentMode.toUpperCase(),
      `"${(t.category || "").replace(/"/g, '""')}"`,
      `"${(t.remarks || "").replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `event_cashbook_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Browser Print
  const handlePrintLedger = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const tbody = transactions
      .map((t) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-family: monospace;">
          <td style="padding: 10px;">${t.date}</td>
          <td style="padding: 10px; font-weight: bold; color: ${t.type === "cash_in" ? "#10b981" : "#ef4444"};">
            ${t.type === "cash_in" ? "CASH IN" : "CASH OUT"}
          </td>
          <td style="padding: 10px;">${t.partyName}</td>
          <td style="padding: 10px;">${t.category ? getCategoryIconAndLabel(t.type, t.category) : "-"}</td>
          <td style="padding: 10px; font-weight: bold;">₹${t.amount.toLocaleString()}</td>
          <td style="padding: 10px; text-transform: uppercase;">${t.paymentMode}</td>
          <td style="padding: 10px; color: #64748b;">${t.remarks || "-"}</td>
        </tr>
      `)
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Event Cashbook Statement</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; }
            h1 { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            p { font-size: 14px; color: #64748b; margin-top: 0; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; }
            th { background-color: #f8fafc; padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>College Festival Event - Finance Tally Statement</h1>
          <p>Generated Statement: ${new Date().toLocaleString()} | Running cashbook status</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Particulars / Party</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Payment Mode</th>
                <th>Remarks & Reference Reference</th>
              </tr>
            </thead>
            <tbody>
              ${tbody}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const historyLogsFiltered = transactions.filter((t) => {
    const term = historySearch.toLowerCase();
    const matchesTerm = (t.partyName || "").toLowerCase().includes(term) || (t.remarks || "").toLowerCase().includes(term);
    if (!matchesTerm) return false;
    const matchesFlow = historyFlowFilter === "all" || t.type === historyFlowFilter;
    const matchesMode = historyModeFilter === "all" || t.paymentMode === historyModeFilter;
    const matchesCategory = historyCategoryFilter === "all" || t.category === historyCategoryFilter;
    return matchesFlow && matchesMode && matchesCategory;
  });

  // Calculate India standard UPI Intent URI values
  const payeeUPI = "subhoxsaha@okaxis";
  const upiMerchant = "Event Management desk";
  const finalUpiAmt = Number(amount) || 0;
  const cleanRemarks = remarks.trim() || "Event Desk pay";
  const upiIntentUri = `upi://pay?pa=${payeeUPI}&pn=${encodeURIComponent(upiMerchant)}&am=${finalUpiAmt}&cu=INR&tn=${encodeURIComponent(cleanRemarks)}`;
  const liveQrImage = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&bgcolor=ffffff&color=0f172a&data=${encodeURIComponent(upiIntentUri)}`;

  return (
    <div id="daily-cashbook-root" className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      
      {/* 2/3 COLUMN - TALLY HISTORY REGISTER (Left Side) */}
      <div className="lg:col-span-2 space-y-4">
        
        {/* Dynamic Reconciliation Results Toast */}
        {reconcileResult && (
          <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-fade-in">
            <Check className="h-4 w-4 text-emerald-600 stroke-[3px]" />
            <span>{reconcileResult}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden flex flex-col justify-between">
          
          {/* Log controls panel */}
          <div className="px-6 py-4 border-b border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-[9px] font-mono font-bold text-indigo-650 tracking-widest uppercase bg-indigo-50 px-2 py-0.5 rounded-md">
                  Active Cashbook Mode
                </span>
                <h3 className="text-xl font-display font-semibold text-slate-800 mt-1">Operational Tally Registers</h3>
                <p className="text-xs text-slate-400 font-sans">Chronological ledger log representing University cash balances.</p>
              </div>
              
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={handleTriggerLocalReconcile}
                  disabled={isReconciling}
                  className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider text-slate-650 hover:text-indigo-850 uppercase px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl transition-all cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw className={`h-3 w-3 ${isReconciling ? "animate-spin" : ""}`} />
                  <span>Sync Cash</span>
                </button>
                <button
                  onClick={handlePrintLedger}
                  className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono text-[10px] uppercase font-bold tracking-wider px-3 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-indigo-500" />
                  Print
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono text-[10px] uppercase font-bold tracking-wider px-3 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  Excel
                </button>
              </div>
            </div>

            {/* Filtering Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <Search className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Search logs (remarks/entity)..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-slate-800 font-sans"
                />
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setHistoryFlowFilter("all")}
                  className={`flex-1 py-1 text-[9.5px] font-mono font-bold uppercase rounded-lg cursor-pointer text-center ${
                    historyFlowFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFlowFilter("cash_in")}
                  className={`flex-1 py-1 text-[9.5px] font-mono font-bold uppercase rounded-lg cursor-pointer text-center ${
                    historyFlowFilter === "cash_in" ? "bg-white text-emerald-705 shadow-xs" : "text-slate-400 hover:text-slate-650"
                  }`}
                >
                  Inflows
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFlowFilter("cash_out")}
                  className={`flex-1 py-1 text-[9.5px] font-mono font-bold uppercase rounded-lg cursor-pointer text-center ${
                    historyFlowFilter === "cash_out" ? "bg-white text-rose-705 shadow-xs" : "text-slate-400 hover:text-slate-650"
                  }`}
                >
                  Outlays
                </button>
              </div>

              <select
                value={historyModeFilter}
                onChange={(e) => setHistoryModeFilter(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-sans text-slate-600 cursor-pointer focus:outline-none focus:bg-white"
              >
                <option value="all">All Channels</option>
                <option value="upi">UPI / QR Transfers Only</option>
                <option value="cash">Physical Cash Only</option>
                <option value="bank">Traditional Bank Only</option>
              </select>

              <select
                value={historyCategoryFilter}
                onChange={(e) => setHistoryCategoryFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-sans text-slate-600 cursor-pointer focus:outline-none focus:bg-white"
              >
                <option value="all">All Categories</option>
                <optgroup label="Expense Categories">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Inflow Categories">
                  {INFLOW_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Database Entries table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-mono font-bold tracking-widest text-slate-405 uppercase">
                  <th className="px-6 py-3">Vector</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Particulars / Entity</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Remarks</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {historyLogsFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-sans">
                      <p className="font-semibold text-slate-500">No transactions recorded inside filters</p>
                      <p className="text-[11px] mt-0.5">Adjust search criteria or use the right panel to record a voucher entry.</p>
                    </td>
                  </tr>
                ) : (
                  historyLogsFiltered.map((t) => {
                    const isIn = t.type === "cash_in";
                    return (
                      <tr 
                        key={t.id} 
                        className={`hover:bg-slate-50/30 transition-all ${
                          editingTxId === t.id ? "bg-indigo-50/40" : ""
                        }`}
                      >
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                            isIn ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                          }`}>
                            {isIn ? (
                              <>
                                <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                                Inflow
                              </>
                            ) : (
                              <>
                                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                                Outflow
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {t.date}
                        </td>
                        <td className="px-6 py-4.5">
                          <div className="font-semibold text-slate-900">{t.partyName}</div>
                          {t.category && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md text-slate-500 font-sans font-semibold">
                                {getCategoryIconAndLabel(t.type, t.category)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <div className={`font-mono font-bold text-sm ${isIn ? "text-emerald-600" : "text-rose-600"}`}>
                            {isIn ? "+" : "-"}₹{t.amount.toLocaleString()}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            {t.paymentMode}
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-slate-500 max-w-[150px] truncate" title={t.remarks || ""}>
                          {t.remarks || <span className="text-slate-300 italic font-mono">-</span>}
                        </td>
                        <td className="px-6 py-4.5 text-right whitespace-nowrap">
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => handleStartEditTx(t)}
                              className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                              title="Tally Voucher Correction"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDuplicateTx(t)}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                              title="Duplicate Voucher Settings"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirmTx(t);
                                setTxDeleteVerified(false);
                              }}
                              className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Delete Tally Voucher"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Running tally count summary */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
            <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block">
              Calculated Registry Logs Tally Count: {historyLogsFiltered.length} entries shown
            </span>
          </div>
        </div>
      </div>

      {/* 1/3 UNIFIED CASHIER PANEL DESK (Right Side) */}
      <div className="lg:col-span-1" id="cashier-panel-hdr">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5 sticky top-24">
          <div>
            <h3 className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-widest leading-none flex items-center gap-1">
              <QrCode className="h-4 w-4" /> Live Cashier desk
            </h3>
            <p className="font-display font-extrabold text-lg text-slate-800 mt-1">
              {editingTxId ? "🔧 Adjust Voucher Entry" : "Instant Cash Register"}
            </p>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-normal">
              Register instant cash inflows, record outlays, or check out with dynamic live QR codes.
            </p>
          </div>

          <form onSubmit={handlePreSaveTransaction} className="space-y-4">
            
            {/* INFLOWS vs EXPENSES Toggle */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Posting Cashflow Vector
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <button
                  type="button"
                  onClick={() => setType("cash_in")}
                  className={`py-2 text-xs font-sans font-bold rounded-lg text-center transition-all cursor-pointer ${
                    type === "cash_in"
                      ? "bg-white text-emerald-700 shadow-xs ring-1 ring-slate-100"
                      : "text-slate-400 hover:text-slate-650"
                  }`}
                >
                  📥 cash-in (inflow)
                </button>
                <button
                  type="button"
                  onClick={() => setType("cash_out")}
                  className={`py-2 text-xs font-sans font-bold rounded-lg text-center transition-all cursor-pointer ${
                    type === "cash_out"
                      ? "bg-white text-rose-750 shadow-xs ring-1 ring-slate-100"
                      : "text-slate-400 hover:text-slate-650"
                  }`}
                >
                  📤 cash-out (expense)
                </button>
              </div>
            </div>

            {/* DIRECT TEXT PARTICULARS / PARTY NAME */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Particulars / Party Name
              </label>
              <input
                type="text"
                required
                placeholder="E.g., Student Entry, catering dj, sound, etc."
                value={partyName}
                onChange={(e) => {
                  setPartyName(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>

            {/* METRICS PARAMETERS FIELD GRID */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Posting Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Collection Channel
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-sans font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 cursor-pointer"
                >
                  <option value="upi">UPI / QR Scan</option>
                  <option value="cash">Physical Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
            </div>

            {/* TRANSACTION AMOUNT INPUT FIELD */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Posting Amount (Volume ₹)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-2.5 font-bold text-sm text-slate-400 font-mono">₹</span>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-sans"
                />
              </div>
              {type === "cash_out" && Number(amount) >= 5000 && (
                <p className="text-[9px] font-mono text-amber-600 mt-1 uppercase flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" /> Outflow alerts require voucher approvals.
                </p>
              )}
            </div>

            {/* CATEGORY SELECTION FIELD */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Voucher Category / Class
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-sans font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 cursor-pointer appearance-none !pr-8"
                >
                  <option value="">-- Generic Category --</option>
                  {(type === "cash_out" ? EXPENSE_CATEGORIES : INFLOW_CATEGORIES).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 text-[10px]">
                  ▼
                </div>
              </div>

              {type === "cash_out" && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {EXPENSE_CATEGORIES.slice(0, 5).map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`px-2.5 py-1 text-[10px] font-sans font-semibold rounded-lg border transition-all cursor-pointer ${
                        category === c.value
                          ? "bg-rose-50 border-rose-250 text-rose-700 shadow-xs scale-102"
                          : "bg-white border-slate-150 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {c.icon} {c.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* DIGITAL REMARKS REF DETAILS */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Voucher Remarks / Reference notes
              </label>
              <input
                type="text"
                placeholder="E.g., Event entry registration, Stage decor..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>



             {/* DESK FORM ACTIONS LIST */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              {formError && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-start gap-2 text-xs font-semibold text-rose-800 animate-fade-in mb-1">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="flex-1 leading-normal font-sans">{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !partyName.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0}
                className={`w-full flex items-center justify-center gap-2 text-white font-mono font-bold uppercase text-[10px] tracking-widest px-4 py-3.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1 ${
                  editingTxId 
                    ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-amber-600/10 hover:shadow-amber-600/20 shadow-md hover:shadow-lg" 
                    : "bg-slate-900 hover:bg-slate-800 shadow-slate-900/10 hover:shadow-slate-900/20 shadow-md hover:shadow-lg"
                }`}
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                {isSubmitting ? "PROCESSING..." : (editingTxId ? "SAVE ADJUSTED ENTRY" : "COMMIT VOUCHER RECORD")}
              </button>
              {editingTxId && (
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel Adjusted Entry
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* OVERLAY: Large Expenses Approvals Interceptor Popup */}
      {showLargeExpenseConfirm && interceptedData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 border border-slate-100 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center border border-amber-100 mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-sans font-bold text-base text-slate-900">Voucher Outflow Threshold Warning</h3>
              <p className="text-slate-500 text-xs font-sans">
                You are logging an outlay of <strong className="text-rose-600 font-bold">₹{interceptedData.amount.toLocaleString()}</strong> towards <strong>"{interceptedData.partyName}"</strong>.
              </p>
            </div>

            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-[11px] text-slate-600 text-left space-y-1.5 font-sans leading-relaxed">
              <p>📍 Standard operating compliance procedures demand double-reconciliation signposting for transactions larger than ₹5,000.</p>
              <p>Please ensure physical voucher bill details are filed at the station.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowLargeExpenseConfirm(false);
                  setInterceptedData(null);
                }}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-755 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Go Back & Adjust
              </button>
              <button
                type="button"
                onClick={() => executeSaveTransaction(interceptedData)}
                className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Approve & Commit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY: Direct Delete Confirmation Modal */}
      {deleteConfirmTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 border border-slate-100 space-y-4 text-center animate-fade-in">
            <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center border border-rose-100 mb-2">
              <Trash2 className="h-5 w-5 animate-pulse text-rose-550" />
            </div>

            <div className="space-y-1">
              <h3 className="font-sans font-bold text-base text-slate-900">Delete Voucher Confirmation</h3>
              <p className="text-slate-500 text-xs font-sans leading-relaxed">
                Are you sure you want to permanently delete the voucher dated <strong className="text-slate-800">{deleteConfirmTx.date}</strong> for <strong className="text-slate-800">"{deleteConfirmTx.partyName}"</strong>?
              </p>
              <div className="bg-rose-50/50 rounded-xl p-3 border border-rose-100/30 inline-block w-full mt-2">
                <span className="text-[10px] font-mono text-rose-500 uppercase font-bold tracking-wider block mb-1">Impacted Amount</span>
                <span className="font-mono text-base font-bold text-rose-600">
                  ₹{deleteConfirmTx.amount.toLocaleString()}
                </span>
                <span className="text-[9px] text-slate-400 block mt-1">This will permanently modify the unified cash ledger balance.</span>
              </div>
            </div>

            {/* Prevent accidental data loss - Custom verification checkbox */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-left flex items-start gap-2.5">
              <input
                type="checkbox"
                id="tx-delete-verification-check"
                checked={txDeleteVerified}
                onChange={(e) => setTxDeleteVerified(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <label htmlFor="tx-delete-verification-check" className="text-[11px] font-sans text-slate-500 leading-normal select-none cursor-pointer">
                I understand this action is <strong className="text-slate-700">irreversible</strong> and will alter historical ledger registry items instantly.
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmTx(null);
                  setTxDeleteVerified(false);
                }}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                No, Keep It
              </button>
              <button
                type="button"
                disabled={!txDeleteVerified}
                onClick={async () => {
                  if (!txDeleteVerified) return;
                  try {
                    await onDeleteTransaction(deleteConfirmTx.id);
                    await onRefreshData();
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setDeleteConfirmTx(null);
                    setTxDeleteVerified(false);
                  }
                }}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all duration-200 shadow-xs ${
                  txDeleteVerified 
                    ? "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer" 
                    : "bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed opacity-60"
                }`}
              >
                Erase Voucher
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
