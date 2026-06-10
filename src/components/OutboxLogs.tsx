import React, { useState } from "react";
import { WhatsAppLog } from "../types";
import { 
  Search, 
  X, 
  Mail, 
  Ticket, 
  FileSpreadsheet, 
  Send, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Trash2,
  TrendingUp,
  Percent,
  CheckCircle2,
  XCircle
} from "lucide-react";

interface OutboxLogsProps {
  logs: WhatsAppLog[];
  onRefresh: () => Promise<void>;
  onClearLogs: () => Promise<void>;
}

export default function OutboxLogs({ logs, onRefresh, onClearLogs }: OutboxLogsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "invoice" | "entry_ticket" | "payment_reminder">("all");
  const [loading, setLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteClear = async () => {
    setIsClearing(true);
    try {
      await onClearLogs();
      setShowClearConfirm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  // Calculate statistics for the outbox
  const totalLogs = logs.length;
  const sentLogs = logs.filter(l => l.status === "sent").length;
  const failedLogs = logs.filter(l => l.status === "failed").length;
  const deliveryRate = totalLogs > 0 ? Math.round((sentLogs / totalLogs) * 100) : 100;
  
  const invoiceCount = logs.filter(l => l.type === "invoice").length;
  const ticketCount = logs.filter(l => l.type === "entry_ticket").length;
  const reminderCount = logs.filter(l => l.type === "payment_reminder").length;

  const filteredLogs = logs.filter((log) => {
    // 1. Type filter
    if (typeFilter !== "all" && log.type !== typeFilter) return false;

    // 2. Search check
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      return (
        log.partyName.toLowerCase().includes(q) ||
        (log.recipient && log.recipient.toLowerCase().includes(q)) ||
        log.message.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getLogTypeBadge = (type: string) => {
    switch (type) {
      case "invoice":
        return {
          label: "Invoice Issued",
          colorClass: "bg-indigo-50 border-indigo-150 text-indigo-700",
          icon: <FileSpreadsheet className="h-3 w-3" />,
        };
      case "entry_ticket":
        return {
          label: "Entry Ticket Confirmed",
          colorClass: "bg-emerald-50 border-emerald-150 text-emerald-700",
          icon: <Ticket className="h-3 w-3" />,
        };
      case "payment_reminder":
      default:
        return {
          label: "Payment Reminder",
          colorClass: "bg-amber-50 border-amber-150 text-amber-700",
          icon: <Mail className="h-3 w-3" />,
        };
    }
  };

  return (
    <div id="outbox-logs-container" className="space-y-6">
      
      {/* 🚀 OUTBOX STATS SUMMARY GLANCE CARD GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Stat 1: Total Dispatch notifications */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block leading-none">
              Total Dispatches
            </span>
            <span className="text-xl font-display font-extrabold text-slate-800 block mt-1">
              {totalLogs}
            </span>
            <span className="text-[10px] text-slate-500 font-sans block">
              Active outbox logs
            </span>
          </div>
        </div>

        {/* Stat 2: Success Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block leading-none">
              Delivery Success
            </span>
            <span className="text-xl font-display font-extrabold text-emerald-600 block mt-1">
              {deliveryRate}%
            </span>
            <span className="text-[10px] text-slate-500 font-sans block">
              {sentLogs} sent • {failedLogs} failed
            </span>
          </div>
        </div>

        {/* Stat 3: Invoices vs Tickets */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block leading-none">
              Invoices Issued
            </span>
            <span className="text-xl font-display font-extrabold text-slate-800 block mt-1">
              {invoiceCount}
            </span>
            <span className="text-[10px] text-slate-500 font-sans block">
              Financial certifications
            </span>
          </div>
        </div>

        {/* Stat 4: Tickets Count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block leading-none">
              Entry Tickets
            </span>
            <span className="text-xl font-display font-extrabold text-slate-800 block mt-1">
              {ticketCount}
            </span>
            <span className="text-[10px] text-slate-500 font-sans block">
              Access passes cleared
            </span>
          </div>
        </div>

      </div>

      {/* PRIMARY CONTROLS & LOG REGISTER REGISTER */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden flex flex-col justify-between">
        
        {/* Tab Header Controls */}
        <div className="border-b border-slate-100 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[9px] font-mono font-bold text-indigo-650 tracking-widest uppercase bg-indigo-50 px-2 py-0.5 rounded-md">
              System Audit Stream
            </span>
            <h2 className="text-lg font-display font-bold text-slate-800 flex items-center gap-1.5 mt-1 leading-none">
              🎙️ Outbox Activities & Registrations
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Secure automated delivery logs for university entrance tickets, cash receipts, and payment notifications.
            </p>
          </div>
          
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-205 text-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-indigo-555 ${loading ? "animate-spin" : ""}`} />
              <span>Sync</span>
            </button>

            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={logs.length === 0}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-100 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear Log</span>
            </button>
          </div>
        </div>

        {/* Filter Ribbon */}
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
          {/* Search */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-slate-400">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search outbox by registrant name, mobile, or text excerpt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 text-slate-700 font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="flex gap-1.5 overflow-x-auto pb-px scrollbar-none">
            <button
              onClick={() => setTypeFilter("all")}
              className={`px-3 py-1.5 rounded-lg border font-medium text-[10px] uppercase font-mono tracking-wider whitespace-nowrap cursor-pointer transition-all ${
                typeFilter === "all"
                  ? "bg-slate-900 border-slate-900 text-white font-bold"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              All Logs ({logs.length})
            </button>
            <button
              onClick={() => setTypeFilter("invoice")}
              className={`px-3 py-1.5 rounded-lg border font-medium text-[10px] uppercase font-mono tracking-wider whitespace-nowrap cursor-pointer transition-all ${
                typeFilter === "invoice"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              Invoices ({invoiceCount})
            </button>
            <button
              onClick={() => setTypeFilter("entry_ticket")}
              className={`px-3 py-1.5 rounded-lg border font-medium text-[10px] uppercase font-mono tracking-wider whitespace-nowrap cursor-pointer transition-all ${
                typeFilter === "entry_ticket"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              Entry Tickets ({ticketCount})
            </button>
          </div>
        </div>

        {/* Logs Table Area */}
        <div className="overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <MessageSquare className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-slate-400 font-sans text-sm font-semibold">No activity logs recorded under filters</p>
              <p className="text-[11px] text-slate-400 font-sans max-w-xs mx-auto">
                Automatic logs are generated here when customers settle their balances or ticket registrations are triggered.
              </p>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 text-slate-400 uppercase font-mono border-b border-slate-100 text-[10px]">
                  <th className="px-6 py-3 font-semibold">Logged Incident / Date</th>
                  <th className="px-6 py-3 font-semibold">Participant Target</th>
                  <th className="px-6 py-3 font-semibold">Dispatched Notification message</th>
                  <th className="px-6 py-3 font-semibold text-right">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600 font-sans">
                {filteredLogs.map((log) => {
                  const badge = getLogTypeBadge(log.type);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 space-y-1.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9.5px] font-mono font-bold uppercase tracking-wide ${badge.colorClass}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono italic">
                          {new Date(log.timestamp).toLocaleString("en-IN", {
                            hour12: true,
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </td>
                      <td className="px-6 py-4 space-y-0.5">
                        <p className="font-semibold text-slate-800 font-sans text-sm">{log.partyName}</p>
                        <p className="text-[10px] text-slate-400 font-mono tracking-wide">{log.recipient}</p>
                      </td>
                      <td className="px-6 py-4 max-w-xs md:max-w-md">
                        <p className="text-slate-600 leading-relaxed font-sans bg-slate-50/70 py-2 px-3 rounded-lg border border-slate-100 text-[11px] leading-relaxed">
                          {log.message}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase font-bold tracking-wider ${
                          log.status === "sent"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                            : "bg-rose-50 text-rose-800 border border-rose-100"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            log.status === "sent" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                          }`}></span>
                          {log.status === "sent" ? "Delivered" : "Failed"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50/60 p-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-widest">
          <span className="flex items-center gap-1.5 font-bold">
            <Send className="h-3 w-3 text-indigo-500" /> Dispatcher Queue Online
          </span>
          <span>Showing {filteredLogs.length} of {logs.length} outbox logs</span>
        </div>
      </div>

      {/* OVERLAY: Clear Logs Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 border border-slate-100 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center border border-red-100 mb-2 animate-bounce">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-sans font-bold text-base text-slate-900">Wipe Notification Records?</h3>
              <p className="text-slate-500 text-xs font-sans leading-relaxed">
                This will permanently delete all <strong className="text-rose-600 font-bold">{logs.length}</strong> activity logs, entry receipts, and ticket notifications. This action is irreversible.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                disabled={isClearing}
              >
                No, Keep Logs
              </button>
              <button
                type="button"
                onClick={handleExecuteClear}
                disabled={isClearing}
                className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-50"
              >
                {isClearing ? "Wiping..." : "Yes, Purge All"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
