import React, { useState, useEffect } from "react";
import { Party, Transaction, FinancialMetrics, WhatsAppLog } from "./types";
import DashboardStats from "./components/DashboardStats";
import DailyCashbook from "./components/DailyCashbook";
import OutboxLogs from "./components/OutboxLogs";
import GeminiAudit from "./components/GeminiAudit";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "./firebase";
import LoginScreen from "./components/LoginScreen";
import { 
  Sparkles, 
  Library, 
  CalendarRange, 
  Info, 
  RefreshCw, 
  Layers, 
  LayoutGrid, 
  ArrowUpDown,
  History,
  LogOut,
  ShieldAlert,
  Trash2
} from "lucide-react";

export default function App() {
  // Firebase Auth & Guest states
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Live states
  const [openingBalance, setOpeningBalance] = useState(5000);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation section tab: "overview" | "cashbook" | "logs"
  const [activeTab, setActiveTab ] = useState<"overview" | "cashbook" | "logs">("overview");

  // Filter selection: "all" | "7days" | "30days"
  const [timelineFilter, setTimelineFilter] = useState("all");

  // Monitor Auth sessions on mount
  useEffect(() => {
    const isGuest = localStorage.getItem("el_guest_session") === "true";
    if (isGuest) {
      setUser({
        uid: "guest-volunteer",
        email: "guest@eventledger.internal",
        displayName: "Guest Volunteer"
      });
      setAuthLoading(false);
      fetchLedgerData();
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthLoading(false);
        fetchLedgerData();
      } else {
        if (localStorage.getItem("el_guest_session") !== "true") {
          setUser(null);
          setAuthLoading(false);
        } else {
          setAuthLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGuestAccess = () => {
    localStorage.setItem("el_guest_session", "true");
    setUser({
      uid: "guest-volunteer",
      email: "guest@eventledger.internal",
      displayName: "Guest Volunteer"
    });
    fetchLedgerData();
  };

  const handleSignOutUser = async () => {
    try {
      localStorage.removeItem("el_guest_session");
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error("Sign out process failed", err);
    }
  };

  const fetchLedgerData = async () => {
    try {
      const response = await fetch("/api/ledger");
      if (!response.ok) throw new Error("HTTP error retrieving ledger");
      const db = await response.json();
      setOpeningBalance(db.openingBalance || 0);
      setParties(db.parties || []);
      setTransactions(db.transactions || []);
      setWhatsappLogs(db.whatsappLogs || []);
    } catch (err) {
      console.error("Ledger synchronization failed", err);
    } finally {
      setLoading(false);
    }
  };

  // State calculations representing current chronological selections
  const getChronologicalTransactions = (): Transaction[] => {
    if (timelineFilter === "all") return transactions;

    const daysLimit = timelineFilter === "7days" ? 7 : 30;
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - daysLimit);
    
    return transactions.filter((t) => {
      const txDate = new Date(t.date);
      return txDate >= limitDate;
    });
  };

  const calculateFinancialFlowMetrics = (): FinancialMetrics => {
    const activeTxSet = getChronologicalTransactions();
    
    const totalIn = activeTxSet
      .filter((t) => t.type === "cash_in")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalOut = activeTxSet
      .filter((t) => t.type === "cash_out")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      openingBalance,
      totalIn,
      totalOut,
      // Closing liquid balance calculated as opening capital seed + all inflows - all outflows overall
      closingBalance: openingBalance + transactions.filter(t => t.type === "cash_in").reduce((s,t) => s+t.amount, 0) - transactions.filter(t => t.type === "cash_out").reduce((s,t) => s+t.amount, 0),
      netSurplus: totalIn - totalOut,
    };
  };

  // API Setters
  const handleUpdateOpeningBalance = async (val: number) => {
    try {
      const response = await fetch("/api/ledger/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: val }),
      });
      const data = await response.json();
      if (data.success) {
        setOpeningBalance(data.openingBalance);
        await fetchLedgerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnrollParty = async (partyData: {
    name: string;
    type: "customer" | "supplier";
    phone: string;
    email: string;
    initialBalance: number;
  }) => {
    try {
      const response = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partyData),
      });
      const data = await response.json();
      if (data.success) {
        await fetchLedgerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditParty = async (id: string, partyData: {
    name: string;
    type: "customer" | "supplier";
    phone: string;
    email: string;
    initialBalance: number;
  }) => {
    try {
      const response = await fetch(`/api/parties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partyData),
      });
      const data = await response.json();
      if (data.success) {
        await fetchLedgerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteParty = async (id: string) => {
    try {
      const response = await fetch(`/api/parties/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        await fetchLedgerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTransaction = async (txnData: {
    date: string;
    type: "cash_in" | "cash_out";
    partyId: string;
    partyName?: string;
    amount: number;
    paymentMode: "cash" | "bank" | "upi";
    remarks: string;
    category?: string;
  }) => {
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txnData),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        await fetchLedgerData();
        return { success: true };
      } else {
        return { success: false, error: data.error || "Failed to record transaction" };
      }
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || "Network request failed" };
    }
  };

  const handleEditTransaction = async (id: string, txnData: {
    date: string;
    type: "cash_in" | "cash_out";
    partyId: string;
    partyName?: string;
    amount: number;
    paymentMode: "cash" | "bank" | "upi";
    remarks: string;
    category?: string;
  }) => {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txnData),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        await fetchLedgerData();
        return { success: true };
      } else {
        return { success: false, error: data.error || "Failed to edit transaction" };
      }
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || "Network request failed" };
    }
  };

  const handleCheckoutPaymentSuccess = async (partyId: string, amount: number, paymentMode: "upi") => {
    await handleAddTransaction({
      date: new Date().toISOString().split("T")[0],
      type: "cash_in",
      partyId,
      amount,
      paymentMode,
      remarks: "On-spot PayU Dynamic QR secure scan settlement"
    });
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        await fetchLedgerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearLogs = async () => {
    try {
      const response = await fetch("/api/logs", {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        await fetchLedgerData();
      }
    } catch (err) {
      console.error("Failed to clear logs", err);
    }
  };

  const handleTriggerReconcile = async () => {
    try {
      const response = await fetch("/api/reconcile", { method: "POST" });
      const data = await response.ok ? await response.json() : { success: false };
      await fetchLedgerData();
      return data;
    } catch (err) {
      console.error("Reconciliation failed", err);
      return { success: false, message: "Server connection failed" };
    }
  };

  const handleTriggerGeminiAudit = async (): Promise<string> => {
    try {
      const response = await fetch("/api/gemini/audit", { method: "POST" });
      const data = await response.json();
      return data.auditReport || "### ⚠️ Ledger Analysis Empty\nAnalysis process succeeded but generated results are empty.";
    } catch (err: any) {
      console.error("Audit API call failed", err);
      throw err;
    }
  };

  const handleResetAllDatabase = async () => {
    const isConfirmed = window.confirm(
      "⚠️ CRITICAL ACTION REQUIRED ⚠️\n\nThis will permanently delete all cashbook vouchers, student and supplier registry records, and event outbox logs in the Firestore database.\n\nType OK or proceed to execute full master reset. Are you sure you want to clear all memory & caches?"
    );
    if (!isConfirmed) return;

    try {
      setLoading(true);
      const response = await fetch("/api/reset-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (data.success) {
        await fetchLedgerData();
        alert("SUCCESS: Database memory and cache fully cleared.");
      } else {
        alert("Reset failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error("Clear database failed", err);
      alert("Error contacting the server: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center space-y-3.5 px-4">
        <RefreshCw className="h-8 w-8 text-indigo-550 animate-spin" />
        <p className="text-sm font-sans text-slate-400 font-semibold tracking-wide uppercase animate-pulse">
          Securing volunteer session desk...
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onGuestAccess={handleGuestAccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-600 selection:text-white pb-16 antialiased">
      {/* Visual top border line */}
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>

      {/* Hero Section Header */}
      <header className="bg-white border-b border-slate-100 py-6 px-4 md:px-8 shadow-xs sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-md shadow-indigo-600/10">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-display font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5 leading-none">
                Simple Web-Based Event Ledger
              </h1>
              <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest mt-1 block">
                University Festival Settlement Desk
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchLedgerData}
              disabled={loading}
              className="p-2 hover:bg-slate-50 active:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 bg-white cursor-pointer"
              title="Refresh local ledger registers"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleResetAllDatabase}
              disabled={loading}
              className="p-2 hover:bg-rose-50 hover:text-rose-600 active:bg-rose-100 rounded-xl text-slate-400 hover:text-slate-500 transition-colors border border-slate-200 bg-white cursor-pointer"
              title="Clear Database Memory & Cache"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Authorized Volunteer Mode
              </span>
              <span className="text-xs text-slate-700 font-sans font-semibold mt-0.5" title={user.email || ""}>
                {user.displayName || user.email?.split("@")[0] || "Active Session"}
              </span>
            </div>
            <button
              onClick={handleSignOutUser}
              className="p-2 hover:bg-red-50 hover:text-red-655 active:bg-red-100 rounded-xl text-slate-400 hover:text-red-500 transition-colors border border-slate-205 bg-white cursor-pointer"
              title="Sign out of volunteer console"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        /* Large centering loading element */
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-24 flex flex-col items-center justify-center text-center space-y-3.5">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-sm font-sans text-slate-400 font-semibold tracking-wide uppercase">
            Recalculating event ledgers from cache...
          </p>
        </div>
      ) : (
        /* Actual Dashboard workspace grid map */
        <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8 animate-fade-in">
          {/* Real-time Event Registers & Financial Balances */}
          <DashboardStats
            metrics={calculateFinancialFlowMetrics()}
            onUpdateOpeningBalance={handleUpdateOpeningBalance}
            selectedFilter={timelineFilter}
            onChangeFilter={setTimelineFilter}
            transactions={transactions}
            parties={parties}
          />

          {/* Top Section Navigation Tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto pb-px gap-2 scrollbar-none">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-1.5 px-4 py-3 border-b-2 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap transition-all ${
                activeTab === "overview"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              1.0 Ledger & Settlement Audit
            </button>
            <button
              onClick={() => setActiveTab("cashbook")}
              className={`flex items-center gap-1.5 px-4 py-3 border-b-2 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap transition-all ${
                activeTab === "cashbook"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
              }`}
            >
              <ArrowUpDown className="h-4 w-4" />
              2.0 Unified Event Cashbook
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-1.5 px-4 py-3 border-b-2 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap transition-all ${
                activeTab === "logs"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
              }`}
            >
              <History className="h-4 w-4" />
              3.0 Registry Logs & Outbox
            </button>
          </div>

          {/* Conditional Workspaces Rendering */}
          {activeTab === "overview" && (
            <div className="space-y-8 animate-fade-in text-slate-800">
              <section id="section-audit" className="w-full">
                <GeminiAudit 
                  transactions={transactions} 
                  parties={parties} 
                  openingBalance={openingBalance} 
                />
              </section>
            </div>
          )}

          {activeTab === "cashbook" && (
            <div className="animate-fade-in">
              <DailyCashbook
                transactions={getChronologicalTransactions()}
                parties={parties}
                onAddTransaction={handleAddTransaction}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onAddParty={handleEnrollParty}
                onEditParty={handleEditParty}
                onDeleteParty={handleDeleteParty}
                onTriggerReconcile={handleTriggerReconcile}
                onRefreshData={fetchLedgerData}
              />
            </div>
          )}

          {activeTab === "logs" && (
            <div className="animate-fade-in">
              <OutboxLogs
                logs={whatsappLogs}
                onRefresh={fetchLedgerData}
                onClearLogs={handleClearLogs}
              />
            </div>
          )}
        </main>
      )}
    </div>
  );
}
