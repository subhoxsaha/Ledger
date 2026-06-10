import React, { useState } from "react";
import { FinancialMetrics, Transaction, Party } from "../types";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Coins, 
  Building2, 
  Smartphone, 
  Users, 
  Store, 
  Edit3, 
  Check, 
  Layers,
  FileCheck2,
  PieChart
} from "lucide-react";

interface DashboardStatsProps {
  metrics: FinancialMetrics;
  onUpdateOpeningBalance: (amount: number) => void;
  selectedFilter: string;
  onChangeFilter: (filter: string) => void;
  transactions: Transaction[];
  parties: Party[];
}

export default function DashboardStats({
  metrics,
  onUpdateOpeningBalance,
  selectedFilter,
  onChangeFilter,
  transactions = [],
  parties = []
}: DashboardStatsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [openingInput, setOpeningInput] = useState(metrics.openingBalance.toString());

  const handleSaveOpening = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(openingInput);
    if (!isNaN(val) && val >= 0) {
      onUpdateOpeningBalance(val);
      setIsEditing(false);
    }
  };

  const isNetPositive = metrics.netSurplus >= 0;

  // Mode-specific liquid registers from active log
  const cashRegisterTxDelta = transactions
    .filter((t) => t.paymentMode === "cash")
    .reduce((sum, t) => sum + (t.type === "cash_in" ? t.amount : -t.amount), 0);

  // The actual physical cash in drawer starts with Opening Capital + Cash cashbook activities
  const cashDrawerBalance = metrics.openingBalance + cashRegisterTxDelta;

  const bankLedgerBalance = transactions
    .filter((t) => t.paymentMode === "bank")
    .reduce((sum, t) => sum + (t.type === "cash_in" ? t.amount : -t.amount), 0);

  const upiDigitalBalance = transactions
    .filter((t) => t.paymentMode === "upi")
    .reduce((sum, t) => sum + (t.type === "cash_in" ? t.amount : -t.amount), 0);

  // Outstanding student invoicing fees (unpaid customer dues)
  const outstandingReceivables = parties
    .filter((p) => p.type === "customer" && p.currentBalance > 0)
    .reduce((sum, p) => sum + p.currentBalance, 0);

  // Unpaid decorator/activity vendor invoices (unsettled supplier liabilities)
  const outstandingPayables = parties
    .filter((p) => p.type === "supplier" && p.currentBalance < 0)
    .reduce((sum, p) => sum + Math.abs(p.currentBalance), 0);

  return (
    <div id="dashboard-stats-card" className="space-y-6">
      {/* Date timeline filter spectrum and stats header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
            <PieChart className="h-4 w-4" />
            Unified Accounts Spectrum
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview of physical drawer, virtual bank/UPI channels, and roster balances.
          </p>
        </div>
        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
          {["all", "7days", "30days"].map((f) => (
            <button
              key={f}
              id={`filter-btn-${f}`}
              onClick={() => onChangeFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-250 ${
                selectedFilter === f
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {f === "all" ? "All Time" : f === "7days" ? "Last 7 Days" : "Last 30 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Group 2: Portfolio and Outstanding Balances (Now Primary Stats Roster) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-px w-6 bg-slate-200"></span>
          <h3 className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wider">
            Festival Ledger & Settlement Balance Sheet
          </h3>
          <span className="h-px flex-1 bg-slate-100"></span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {/* Card: Opening Seed Capital (Adjustable) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015] lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                Seed Reserve
              </span>
              <span className="p-1.5 bg-slate-50 text-slate-600 rounded-lg">
                <Wallet className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-3">
              {isEditing ? (
                <form onSubmit={handleSaveOpening} className="flex items-center gap-1">
                  <span className="text-slate-400 font-display font-bold text-base">₹</span>
                  <input
                    type="number"
                    value={openingInput}
                    onChange={(e) => setOpeningInput(e.target.value)}
                    className="w-full bg-slate-50 border border-indigo-200 rounded px-1.5 py-0.5 text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-800"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="p-1 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </form>
              ) : (
                <div className="flex items-baseline gap-1 group">
                  <span className="text-lg font-display font-bold text-slate-900 tracking-tight">
                    ₹{metrics.openingBalance.toLocaleString()}
                  </span>
                  <button
                    onClick={() => {
                      setOpeningInput(metrics.openingBalance.toString());
                      setIsEditing(true);
                    }}
                    className="text-slate-400 hover:text-indigo-600 focus:text-indigo-600 p-1 hover:bg-slate-100 rounded-md transition-all cursor-pointer inline-flex items-center"
                    title="Change starting seed capital reserve button"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                </div>
              )}
              <p className="text-[9px] font-mono text-slate-400 mt-1 uppercase">
                Seed Reserve Input
              </p>
            </div>
          </div>

          {/* Card: Cumulative incoming flows */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015] lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                Total In
              </span>
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-lg font-display font-bold text-slate-900 tracking-tight">
                ₹{metrics.totalIn.toLocaleString()}
              </span>
              <p className="text-[9px] font-mono text-emerald-600 mt-1 uppercase">
                Inflows collected
              </p>
            </div>
          </div>

          {/* Card: Cumulative outgoing flows */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015] lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                Total Out
              </span>
              <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                <ArrowDownRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-lg font-display font-bold text-slate-900 tracking-tight">
                ₹{metrics.totalOut.toLocaleString()}
              </span>
              <p className="text-[9px] font-mono text-rose-600 mt-1 uppercase">
                Settled payouts
              </p>
            </div>
          </div>

          {/* Card: Outstanding Customer Receivables (Dues to Collect) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015] lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-amber-600 uppercase tracking-wider">
                Total Receivables
              </span>
              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                <Users className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-lg font-display font-bold text-slate-900 tracking-tight">
                ₹{outstandingReceivables.toLocaleString()}
              </span>
              <p className="text-[9px] font-mono text-amber-600 mt-1 uppercase">
                Student dues pending
              </p>
            </div>
          </div>

          {/* Card: Outstanding Supplier Payables (Vendor balances to Settle) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015] lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-rose-500 uppercase tracking-wider">
                Total Payables
              </span>
              <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
                <Store className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-lg font-display font-bold text-slate-900 tracking-tight">
                ₹{outstandingPayables.toLocaleString()}
              </span>
              <p className="text-[9px] font-mono text-rose-500 mt-1 uppercase">
                Vendor bills to pay
              </p>
            </div>
          </div>

          {/* Card: Net periodic surplus/deficit */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015] lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                Net Period Result
              </span>
              <span className={`p-1 rounded-lg ${isNetPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                {isNetPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              </span>
            </div>
            <div className="mt-3">
              <span className={`text-lg font-display font-bold tracking-tight ${isNetPositive ? "text-emerald-600" : "text-rose-655"}`}>
                {isNetPositive ? "+" : ""}
                ₹{metrics.netSurplus.toLocaleString()}
              </span>
              <p className={`text-[9px] font-mono mt-1 uppercase font-semibold ${isNetPositive ? "text-emerald-600" : "text-rose-500"}`}>
                {isNetPositive ? "Net Profit" : "Net Deficit"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
