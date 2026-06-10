import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  getDocFromServer
} from "firebase/firestore";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Load Firebase applet configuration
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
} else {
  console.warn("firebase-applet-config.json is missing!");
}

const fireApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(fireApp, firebaseConfig.firestoreDatabaseId);

// Test Connection
async function testConnection() {
  try {
    await getDocFromServer(doc(firestoreDb, "test", "connection"));
    console.log("[Firestore] Connection verified and validated successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.error("[Firestore] Please check your Firebase configuration. Client appears offline.");
    }
  }
}
testConnection();

// Initialize Gemini SDK with User-Agent header for telemetry
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Interfaces
interface Party {
  id: string;
  name: string;
  type: "customer" | "supplier";
  phone: string;
  email: string;
  initialBalance: number; 
  currentBalance: number;
}

interface Transaction {
  id: string;
  date: string;
  type: "cash_in" | "cash_out";
  partyId: string;
  partyName: string;
  amount: number;
  paymentMode: "cash" | "bank" | "upi";
  remarks: string;
  category?: string;
}

interface WhatsAppLog {
  id: string;
  timestamp: string;
  type: "invoice" | "payment_reminder" | "entry_ticket";
  recipient: string;
  partyName: string;
  message: string;
  status: "sent" | "failed";
}

interface DatabaseSchema {
  openingBalance: number;
  parties: Party[];
  transactions: Transaction[];
  whatsappLogs: WhatsAppLog[];
}

// Core seed template for initial launch fallback
const initialDbSeed: DatabaseSchema = {
  openingBalance: 5000, 
  parties: [],
  transactions: [],
  whatsappLogs: []
};

// Firestore Operations enum & error handler
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: "server-auth",
      email: "server@eventledger.internal",
      emailVerified: true
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Database Firestore utilities
const LOCAL_DB_PATH = path.join(process.cwd(), "local-database-fallback.json");

let inMemoryDb: DatabaseSchema = {
  openingBalance: 5000,
  parties: [],
  transactions: [],
  whatsappLogs: []
};

let lastSavedDb: DatabaseSchema | null = null;

const loadDatabase = async (): Promise<DatabaseSchema> => {
  try {
    let openingBalance = 5000;
    const configDocRef = doc(firestoreDb, "globals", "config");
    const configSnap = await getDoc(configDocRef);
    if (configSnap.exists()) {
      openingBalance = configSnap.data().openingBalance ?? 5000;
    } else {
      try {
        await setDoc(configDocRef, { openingBalance });
      } catch (e) {
        console.warn("Failed to set initial config doc in Firestore, continuing:", e);
      }
    }

    const parties: Party[] = [];
    const partiesSnap = await getDocs(collection(firestoreDb, "parties"));
    partiesSnap.forEach((doc) => {
      parties.push(doc.data() as Party);
    });

    const transactions: Transaction[] = [];
    const txSnap = await getDocs(collection(firestoreDb, "transactions"));
    txSnap.forEach((doc) => {
      transactions.push(doc.data() as Transaction);
    });

    const whatsappLogs: WhatsAppLog[] = [];
    const logsSnap = await getDocs(collection(firestoreDb, "whatsappLogs"));
    logsSnap.forEach((doc) => {
      whatsappLogs.push(doc.data() as WhatsAppLog);
    });

    const dbObj = {
      openingBalance,
      parties,
      transactions,
      whatsappLogs
    };

    inMemoryDb = JSON.parse(JSON.stringify(dbObj));
    lastSavedDb = JSON.parse(JSON.stringify(dbObj));

    // Persist a local disk copy of fresh data
    try {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(dbObj, null, 2), "utf-8");
    } catch (saveErr) {
      console.warn("Failed to write to local database fallback file:", saveErr);
    }

    return dbObj;
  } catch (err) {
    console.error("Firestore loading failed. Serving from/falling back to local/in-memory database.", err);
    // Try to load from the local file backup if Firestore is unavailable
    if (fs.existsSync(LOCAL_DB_PATH)) {
      try {
        const localData = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf-8"));
        inMemoryDb = localData;
        lastSavedDb = JSON.parse(JSON.stringify(localData));
        return inMemoryDb;
      } catch (fileErr) {
        console.error("Failed to parse local database fallback file:", fileErr);
      }
    }
    return inMemoryDb;
  }
};

const saveDatabase = async (data: DatabaseSchema) => {
  // Always keep in-memory cache up-to-date
  inMemoryDb = JSON.parse(JSON.stringify(data));

  // Persist a copy to disk immediately
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (fileErr) {
    console.error("Failed to write to local database backup file:", fileErr);
  }

  try {
    const promises: Promise<any>[] = [];

    // 1. Save globals config if it changed or it is first run
    if (!lastSavedDb || lastSavedDb.openingBalance !== data.openingBalance) {
      promises.push(setDoc(doc(firestoreDb, "globals", "config"), { openingBalance: data.openingBalance }));
    }

    const areObjectsEqual = (obj1: any, obj2: any) => {
      if (!obj1 || !obj2) return false;
      return JSON.stringify(obj1) === JSON.stringify(obj2);
    };

    // 2. Save all parties that are new or changed
    const oldPartiesMap = new Map<string, Party>();
    if (lastSavedDb) {
      lastSavedDb.parties.forEach(p => oldPartiesMap.set(p.id, p));
    }
    for (const p of data.parties) {
      const oldP = oldPartiesMap.get(p.id);
      if (!oldP || !areObjectsEqual(p, oldP)) {
        promises.push(setDoc(doc(firestoreDb, "parties", p.id), p));
      }
    }
    // Delete any parties absent in new data (if any)
    const newPartiesSet = new Set(data.parties.map(p => p.id));
    if (lastSavedDb) {
      for (const oldP of lastSavedDb.parties) {
        if (!newPartiesSet.has(oldP.id)) {
          promises.push(deleteDoc(doc(firestoreDb, "parties", oldP.id)));
        }
      }
    }

    // 3. Save all transactions that are new or changed
    const oldTxMap = new Map<string, Transaction>();
    if (lastSavedDb) {
      lastSavedDb.transactions.forEach(t => oldTxMap.set(t.id, t));
    }
    for (const t of data.transactions) {
      const oldT = oldTxMap.get(t.id);
      if (!oldT || !areObjectsEqual(t, oldT)) {
        promises.push(setDoc(doc(firestoreDb, "transactions", t.id), t));
      }
    }
    // Delete any transactions absent in new data
    const newTxSet = new Set(data.transactions.map(t => t.id));
    if (lastSavedDb) {
      for (const oldT of lastSavedDb.transactions) {
        if (!newTxSet.has(oldT.id)) {
          promises.push(deleteDoc(doc(firestoreDb, "transactions", oldT.id)));
        }
      }
    }

    // 4. Save all whatsappLogs that are new or changed
    const oldLogsMap = new Map<string, WhatsAppLog>();
    if (lastSavedDb) {
      lastSavedDb.whatsappLogs.forEach(w => oldLogsMap.set(w.id, w));
    }
    for (const w of data.whatsappLogs) {
      const oldW = oldLogsMap.get(w.id);
      if (!oldW || !areObjectsEqual(w, oldW)) {
        promises.push(setDoc(doc(firestoreDb, "whatsappLogs", w.id), w));
      }
    }
    // Delete any whatsappLogs absent in new data
    const newLogsSet = new Set(data.whatsappLogs.map(w => w.id));
    if (lastSavedDb) {
      for (const oldW of lastSavedDb.whatsappLogs) {
        if (!newLogsSet.has(oldW.id)) {
          promises.push(deleteDoc(doc(firestoreDb, "whatsappLogs", oldW.id)));
        }
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    lastSavedDb = JSON.parse(JSON.stringify(data));
  } catch (err) {
    console.error("Firestore sync save failed. Memory representation preserved.", err);
  }
};

// Reconcile and calculate real balances
const recalculateBalancesOfData = (db: DatabaseSchema): DatabaseSchema => {
  const recalculatedParties = db.parties.map((p) => {
    const initial = p.initialBalance;
    let balance = initial;

    const partyTx = db.transactions.filter((t) => t.partyId === p.id);

    partyTx.forEach((tx) => {
      if (p.type === "customer") {
        if (tx.type === "cash_in") {
          balance -= tx.amount;
        } else {
          balance += tx.amount;
        }
      } else {
        if (tx.type === "cash_out") {
          balance += tx.amount;
        } else {
          balance -= tx.amount;
        }
      }
    });

    return {
      ...p,
      currentBalance: balance,
    };
  });

  return {
    ...db,
    parties: recalculatedParties,
  };
};

/* --- API Endpoints --- */

// Base endpoint response indicating status
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", persistence: "Firestore database instances" });
});

// Load ledger package
app.get("/api/ledger", async (req, res) => {
  try {
    let db = await loadDatabase();
    db = recalculateBalancesOfData(db);
    await saveDatabase(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve ledger data", msg: err.message });
  }
});

// Post a new registration / configure initial balances for student/vendor
app.post("/api/parties", async (req, res) => {
  try {
    const { name, type, phone, email, initialBalance } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: "Party name and type are required fields" });
    }

    const db = await loadDatabase();
    const newId = "p_" + Date.now();
    
    // Default registration fee ₹1,200 for clients, negative liability for supplies
    const initBal = initialBalance !== undefined ? Number(initialBalance) : (type === "customer" ? 1200 : -10000);

    const newParty: Party = {
      id: newId,
      name,
      type,
      phone: phone || "",
      email: email || "",
      initialBalance: initBal,
      currentBalance: initBal,
    };

    db.parties.push(newParty);
    const updatedDb = recalculateBalancesOfData(db);

    // Automation: Automatically send high-fidelity digital invoices for newly enrolled college students!
    if (type === "customer") {
      const autoLog: WhatsAppLog = {
        id: "w_invoice_" + Date.now(),
        timestamp: new Date().toISOString(),
        type: "invoice",
        recipient: newParty.phone || "+919999988888",
        partyName: newParty.name,
        message: `Hello ${newParty.name}! Your student registration invoice for the Event Ledger is issued. Total Pending: ₹${initBal.toLocaleString()}. Clear your dues via UPI QR on the dashboard.`,
        status: "sent"
      };
      updatedDb.whatsappLogs.unshift(autoLog);
    }

    await saveDatabase(updatedDb);

    res.json({ success: true, party: newParty });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create party record", msg: err.message });
  }
});

// Update an existing party (Student or Vendor) and optional initial balance / opening balance
app.put("/api/parties/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, type, initialBalance } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Party name is required" });
    }

    const db = await loadDatabase();
    const partyIdx = db.parties.findIndex((p) => p.id === id);
    if (partyIdx === -1) {
      return res.status(404).json({ error: "Ledger record not found" });
    }

    const originalParty = db.parties[partyIdx];
    
    const updatedParty: Party = {
      ...originalParty,
      name,
      phone: phone || "",
      email: email || "",
      type: type || originalParty.type,
      initialBalance: initialBalance !== undefined ? Number(initialBalance) : originalParty.initialBalance,
    };

    db.parties[partyIdx] = updatedParty;

    // Maintain database transaction references consistency
    if (name !== originalParty.name) {
      db.transactions = db.transactions.map((t) => {
        if (t.partyId === id) {
          return { ...t, partyName: name };
        }
        return t;
      });
    }

    const updatedDb = recalculateBalancesOfData(db);
    await saveDatabase(updatedDb);

    res.json({ success: true, party: updatedDb.parties[partyIdx] });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update party record", msg: err.message });
  }
});

// Delete a party (Student or Vendor) and clean up its associated transactions to prevent double-entries
app.delete("/api/parties/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let db = await loadDatabase();

    const partyIdx = db.parties.findIndex((p) => p.id === id);
    if (partyIdx === -1) {
      return res.status(404).json({ error: "Registry entry not found" });
    }

    // Remove the party
    db.parties.splice(partyIdx, 1);

    // Also remove associated transactions to keep ledger clean and avoid double counting
    db.transactions = db.transactions.filter((t) => t.partyId !== id);

    const updatedDb = recalculateBalancesOfData(db);
    await saveDatabase(updatedDb);

    res.json({ success: true, message: "Registry entry and all associated history successfully deleted" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete registry entry", msg: err.message });
  }
});

// Post a new cashflow entry inside the interactive Cashbook
app.post("/api/transactions", async (req, res) => {
  try {
    const { date, type, partyId, partyName, amount, paymentMode, remarks, category } = req.body;
    const numAmount = Number(amount);

    if (!date || !type || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "All transaction fields (Date, Cash In/Out, Positive Amount) are required" });
    }

    let db = await loadDatabase();
    let finalPartyId = partyId || "direct";
    let finalPartyName = partyName || "General Entry";

    if (partyId && partyId !== "direct") {
      const p = db.parties.find((item) => item.id === partyId);
      if (p) {
        finalPartyName = p.name;
      }
    }

    const newTx: Transaction = {
      id: "t_" + Date.now(),
      date,
      type,
      partyId: finalPartyId,
      partyName: finalPartyName,
      amount: numAmount,
      paymentMode,
      remarks: remarks || "",
    };

    if (category) {
      newTx.category = category;
    }

    db.transactions.unshift(newTx);
    let updatedDb = recalculateBalancesOfData(db);

    // After updating balance, check if some customer hits 0 balance to auto issue tickets!
    const targetPartyAfter = updatedDb.parties.find(item => item.id === finalPartyId);
    if (targetPartyAfter && targetPartyAfter.type === "customer" && targetPartyAfter.currentBalance <= 0) {
      // Create and auto send entry ticket log!
      const ticketLog: WhatsAppLog = {
        id: "w_ticket_" + Date.now(),
        timestamp: new Date().toISOString(),
        type: "entry_ticket",
        recipient: targetPartyAfter.phone || "+919999988888",
        partyName: targetPartyAfter.name,
        message: `🎟️ Entry Confirmed! Hello ${targetPartyAfter.name}, your balance of ₹${targetPartyAfter.currentBalance} is fully cleared. Show this message at the desk. Ticket ID: GOLD-${targetPartyAfter.id.toUpperCase()}`,
        status: "sent"
      };
      updatedDb.whatsappLogs.unshift(ticketLog);
    }

    await saveDatabase(updatedDb);

    res.json({ success: true, transaction: newTx });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to record cashbook transaction", msg: err.message });
  }
});

// Update an existing transaction inside the Cashbook
app.put("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { date, type, partyId, partyName, amount, paymentMode, remarks, category } = req.body;
    const numAmount = Number(amount);

    if (!date || !type || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "All transaction fields (Date, Cash In/Out, Positive Amount) are required" });
    }

    let db = await loadDatabase();
    const txIdx = db.transactions.findIndex((t) => t.id === id);
    if (txIdx === -1) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    let finalPartyId = partyId || "direct";
    let finalPartyName = partyName || "General Entry";

    if (partyId && partyId !== "direct") {
      const p = db.parties.find((item) => item.id === partyId);
      if (p) {
        finalPartyName = p.name;
      }
    }

    const updatedTx: Transaction = {
      ...db.transactions[txIdx],
      date,
      type,
      partyId: finalPartyId,
      partyName: finalPartyName,
      amount: numAmount,
      paymentMode,
      remarks: remarks || "",
    };

    if (category) {
      updatedTx.category = category;
    } else {
      delete updatedTx.category;
    }

    db.transactions[txIdx] = updatedTx;
    let updatedDb = recalculateBalancesOfData(db);

    // After updating balance, check if some customer hits 0 balance to auto issue tickets!
    const targetPartyAfter = updatedDb.parties.find(item => item.id === finalPartyId);
    if (targetPartyAfter && targetPartyAfter.type === "customer" && targetPartyAfter.currentBalance <= 0) {
      // Create and auto send entry ticket log if not already issued
      const ticketLog: WhatsAppLog = {
        id: "w_ticket_upd_" + Date.now(),
        timestamp: new Date().toISOString(),
        type: "entry_ticket",
        recipient: targetPartyAfter.phone || "+919999988888",
        partyName: targetPartyAfter.name,
        message: `🎟️ Entry Confirmed! Hello ${targetPartyAfter.name}, your balance of ₹${targetPartyAfter.currentBalance} is fully cleared. Show this message at the desk. Ticket ID: GOLD-${targetPartyAfter.id.toUpperCase()}`,
        status: "sent"
      };
      updatedDb.whatsappLogs.unshift(ticketLog);
    }

    await saveDatabase(updatedDb);

    res.json({ success: true, transaction: updatedTx });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update transaction", msg: err.message });
  }
});

// Delete a transaction entries for corrections
app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let db = await loadDatabase();
    const initialLength = db.transactions.length;
    db.transactions = db.transactions.filter((t) => t.id !== id);

    if (db.transactions.length === initialLength) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Explicitly delete from Firestore document path
    await deleteDoc(doc(firestoreDb, "transactions", id));

    const updatedDb = recalculateBalancesOfData(db);
    await saveDatabase(updatedDb);
    res.json({ success: true, message: "Transaction removed and ledger re-balanced" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete transaction", msg: err.message });
  }
});

// Clear all WhatsApp activity logs completely
app.delete("/api/logs", async (req, res) => {
  try {
    let db = await loadDatabase();
    
    // Clear out documents from Firestore whatsappLogs collection
    const logsSnap = await getDocs(collection(firestoreDb, "whatsappLogs"));
    const deletePromises: Promise<any>[] = [];
    logsSnap.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(firestoreDb, "whatsappLogs", docSnap.id)));
    });
    await Promise.all(deletePromises);

    db.whatsappLogs = [];
    await saveDatabase(db);

    res.json({ success: true, message: "Registry and outbox activity logs cleared successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to clear logs", msg: err.message });
  }
});

// Explicit Reconcile update endpoint
app.post("/api/reconcile", async (req, res) => {
  try {
    let db = await loadDatabase();
    
    // Detect changes
    const originalParties = JSON.parse(JSON.stringify(db.parties));
    db = recalculateBalancesOfData(db);
    await saveDatabase(db);

    const discrepancies = [];
    for (let i = 0; i < db.parties.length; i++) {
      const oldP = originalParties.find((o: any) => o.id === db.parties[i].id);
      if (oldP && oldP.currentBalance !== db.parties[i].currentBalance) {
        discrepancies.push({
          partyId: db.parties[i].id,
          name: db.parties[i].name,
          type: db.parties[i].type,
          oldBalance: oldP.currentBalance,
          newBalance: db.parties[i].currentBalance,
          difference: db.parties[i].currentBalance - oldP.currentBalance
        });
      }
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      discrepanciesCount: discrepancies.length,
      recalculatedParties: discrepancies,
      message: discrepancies.length > 0 ? "Discrepancies rectified successfully." : "Ledger fully verified and in sync."
    });
  } catch (err: any) {
    res.status(500).json({ error: "Reconciliation processing failed", msg: err.message });
  }
});

// Trigger intelligent Gemini financial audits and advice reports
app.post("/api/gemini/audit", async (req, res) => {
  try {
    const db = await loadDatabase();
    
    // Prep variables for optimal token usage
    const numParties = db.parties.length;
    const numTransactions = db.transactions.length;

    // Fast analytics prep
    const currentInTotal = db.transactions.filter(t => t.type === "cash_in").reduce((acc, t) => acc + t.amount, 0);
    const currentOutTotal = db.transactions.filter(t => t.type === "cash_out").reduce((acc, t) => acc + t.amount, 0);
    
    const customersDueState = db.parties.filter(p => p.type === "customer" && p.currentBalance > 0);
    const suppliersPayableState = db.parties.filter(p => p.type === "supplier" && p.currentBalance < 0);

    const dataDumpSummary = {
      openingBalance: db.openingBalance,
      totalCashInFlow: currentInTotal,
      totalCashOutFlow: currentOutTotal,
      netCurrentCash: db.openingBalance + currentInTotal - currentOutTotal,
      ledgerSummary: db.parties.map(p => ({
        name: p.name,
        type: p.type,
        initialBalance: p.initialBalance,
        outstandingBalance: p.currentBalance
      })),
      recentTransactions: db.transactions.slice(0, 10).map(t => ({
        date: t.date,
        party: t.partyName,
        type: t.type,
        amount: t.amount,
        mode: t.paymentMode,
        remarks: t.remarks
      }))
    };

    if (!ai) {
      // Fallback response with beautiful simulated smart insights if GEMINI_API_KEY is not defined
      const customerRows = customersDueState.length > 0 
        ? customersDueState.slice(0, 3).map(p => `  * **${p.name}** owes registration dues of ₹${p.currentBalance.toLocaleString()}`).join("\n")
        : "  * No outstanding student receivables detected. All active students have cleared their fees!";

      const supplierRows = suppliersPayableState.length > 0
        ? suppliersPayableState.slice(0, 3).map(p => `  * **${p.name}**: Outstanding payable ledger is ₹${Math.abs(p.currentBalance).toLocaleString()}`).join("\n")
        : "  * No supplier payable liability outstanding. All vendor payments are settled!";

      const fallbackReport = `### 📋 Automated Core Financial Ledger Report
*Note: Gemini AI is currently running in Automated/Local mode. Set your \`GEMINI_API_KEY\` in Settings secrets for direct live model integration and customized deep analyses.*

---

### **1. Executive Budgetary Standings**
* **Total Ledger Volume:** ₹**${(db.openingBalance + currentInTotal).toLocaleString()}** total funds registered (including ₹**${db.openingBalance.toLocaleString()}** Opening Cash Reserve).
* **Outgoing Expenditures:** Realized cash withdrawals stand at ₹**${currentOutTotal.toLocaleString()}**, representing active vendor settlement structures.
* **Net Vault Assets:** **₹${(db.openingBalance + currentInTotal - currentOutTotal).toLocaleString()}** current remaining in secure cache.

---

### **2. Crucial Operational Deficits (Outstanding)**
* **Customer Receivables:** We have **${customersDueState.length}** participant accounts outstanding, totaling **₹${customersDueState.reduce((sum, p) => sum + p.currentBalance, 0).toLocaleString()}**.
${customerRows}
* **Supplier Liability:** **${suppliersPayableState.length}** vendors have pending balances amounting to **₹${Math.abs(suppliersPayableState.reduce((sum, p) => sum + p.currentBalance, 0)).toLocaleString()}** that must be fulfilled ahead of the event date.
${supplierRows}

---

### **3. Strategic Cashflow & Optimization Directives**
1. **Target Registration Recovery:** Direct cash reserves are low, but the receivables of ₹${customersDueState.reduce((sum, p) => sum + p.currentBalance, 0).toLocaleString()} can immediately offset short-term vendor demands. Trigger the dashboard action to send **WhatsApp One-Click Payment links** to students with non-zero balances.
2. **Prioritize Pending Vendor Payments:** Ensure critical suppliers are prioritized based on their active contract delivery deadlines.
3. **Minimize Cash Mode Operations:** Encourage UPI registration modes since banking digital logs are automated, reducing manual physical cashbook validation risks.
`;
      return res.json({ auditReport: fallbackReport, usedFallback: true });
    }

    const auditPrompt = `You are a professional chartered accountant auditing a college festival event budget ledger.
Analyze the following JSON structured event financial transactions, opening balance, and party ledger states. Make a short, insightful, scannable report in standard professional clean markdown. Do not provide code blocks or technical jargon. Provide concrete names of parties and actions they should take.

JSON DATA PACK:
${JSON.stringify(dataDumpSummary, null, 2)}

Ensure your auditing guidelines cover:
1. Short Financial Health Status & Net Balance overview.
2. Budget breakdown analysis (outstanding receivables from students vs supplier payables debts). Name the exact people who owe/are owed.
3. 3-4 specific tactical cashflow optimization recommendations (e.g. recommend invoking WhatsApp payment reminders to specific students, which suppliers should receive priority payments, and physical cash vs digital balance warnings).
4. Present with stylish typography formatting, bold highlights, and clean organization. Maintain a helpful and professional tone. Keep length around 350-450 words.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: auditPrompt,
      config: {
        systemInstruction: "You are an elite, human-centric college event auditor who loves helping student committees succeed. Speak concisely, clearly, and structure your responses with elegant headers and structured recommendations.",
      }
    });

    res.json({ auditReport: response.text, usedFallback: false });
  } catch (err: any) {
    res.status(500).json({ error: "Gemini AI audit execution failed", msg: err.message });
  }
});

// CSV parser helper
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
         i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      row.push(currentValue.trim());
      if (row.length > 0 && row.some(cell => cell !== "")) {
        lines.push(row);
      }
      row = [];
      currentValue = "";
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF
      }
    } else {
      currentValue += char;
    }
  }
  if (currentValue || row.length > 0) {
    row.push(currentValue.trim());
    if (row.some(cell => cell !== "")) {
      lines.push(row);
    }
  }
  return lines;
}

// Google Sheets CSV Preview API
app.post("/api/google-sheets/preview", async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    if (!sheetUrl) {
      return res.status(400).json({ error: "Google sheet URL or CSV link is required" });
    }

    let fetchUrl = sheetUrl.trim();
    if (!fetchUrl.startsWith("http://") && !fetchUrl.startsWith("https://")) {
      return res.status(400).json({ error: "Google Sheet URL or CSV link must start with http:// or https://" });
    }

    // Extract SpreadsheetID if it's a standard sharing or edit request
    const googleSheetIdMatch = fetchUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (googleSheetIdMatch) {
      const sheetId = googleSheetIdMatch[1];
      // Use standard CSV export endpoint with optional gid param support
      fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      
      const gidMatch = sheetUrl.match(/[\?&]gid=([0-9]+)/) || sheetUrl.match(/#gid=([0-9]+)/);
      if (gidMatch) {
        fetchUrl += `&gid=${gidMatch[1]}`;
      }
    }

    console.log(`Fetching spreadsheet data from: ${fetchUrl}`);
    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      throw new Error(`Google Sheets fetch returned status code ${response.status}`);
    }

    const csvText = await response.text();
    const csvTrimmed = csvText.trim();
    if (csvTrimmed.startsWith("<") || csvTrimmed.includes("<!DOCTYPE") || csvTrimmed.includes("<html")) {
      return res.status(400).json({
        success: false,
        error: "Google Sheets returned an HTML login or private access screen. Please ensure the sharing permissions (Share top-right button in your Google Sheets) is set to 'Anyone with the link can view' so it can be extracted publicly as CSV."
      });
    }

    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return res.json({ success: true, headers: [], previewRows: [] });
    }

    // Attempt intelligent mapping using first row as headers
    const headers = (rows[0] || []).map(h => (h || "").trim().toLowerCase());
    
    // Column indices
    let nameIdx = -1;
    let phoneIdx = -1;
    let emailIdx = -1;
    let balanceIdx = -1;
    let typeIdx = -1;

    headers.forEach((header, index) => {
      if (header.includes("name") || header.includes("student") || header.includes("participant") || header.includes("constituent") || header.includes("member")) {
        if (nameIdx === -1) nameIdx = index;
      } else if (header.includes("phone") || header.includes("mobile") || header.includes("contact") || header.includes("number") || header.includes("tel")) {
        if (phoneIdx === -1) phoneIdx = index;
      } else if (header.includes("email") || header.includes("mail")) {
        if (emailIdx === -1) emailIdx = index;
      } else if (header.includes("balance") || header.includes("due") || header.includes("fee") || header.includes("initial") || header.includes("cost") || header.includes("amount") || header.includes("charge")) {
        if (balanceIdx === -1) balanceIdx = index;
      } else if (header.includes("type") || header.includes("role") || header.includes("category")) {
        if (typeIdx === -1) typeIdx = index;
      }
    });

    // Fallbacks if header mapping was fully unsuccessful
    if (nameIdx === -1 && rows[0].length > 0) nameIdx = 0;
    if (phoneIdx === -1 && rows[0].length > 1) phoneIdx = 1;
    if (emailIdx === -1 && rows[0].length > 2) emailIdx = 2;
    if (balanceIdx === -1 && rows[0].length > 3) balanceIdx = 3;

    // Build prediction objects skip header
    const previewRows = rows.slice(1).map((row, rowIdx) => {
      const rawName = nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : "";
      const rawPhone = phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx] : "";
      const rawEmail = emailIdx !== -1 && row[emailIdx] ? row[emailIdx] : "";
      const rawBalStr = balanceIdx !== -1 && row[balanceIdx] ? row[balanceIdx] : "";
      const rawType = typeIdx !== -1 && row[typeIdx] ? row[typeIdx].toLowerCase() : "";

      // Clean balance string (strip currency, commas, whitespace)
      const cleanBalStr = rawBalStr.replace(/[^\d.-]/g, "");
      const finalBalance = isNaN(parseFloat(cleanBalStr)) ? 1200 : parseFloat(cleanBalStr);

      // Determine type preference
      let type: "customer" | "supplier" = "customer";
      if (rawType.includes("supplier") || rawType.includes("vendor") || rawType.includes("catering") || rawType.includes("lights") || rawType.includes("sound") || finalBalance < 0) {
        type = "supplier";
      }

      return {
        id: `gs_${rowIdx}_${Date.now()}`,
        name: rawName || `Row ${rowIdx + 1} Record`,
        phone: rawPhone,
        email: rawEmail,
        type,
        initialBalance: finalBalance,
        currentBalance: finalBalance
      };
    });

    res.json({
      success: true,
      originalHeaders: rows[0],
      mappedColumns: { nameIdx, phoneIdx, emailIdx, balanceIdx, typeIdx },
      previewRows: previewRows.filter(p => p.name.trim() !== "")
    });
  } catch (err: any) {
    console.error("Google sheets preview failed", err);
    res.status(500).json({ error: "Failed to download or parse Google Sheets CSV. Verify the spreadsheet sharing permission is set to public." });
  }
});

// Post action imports selected sheet elements in bulk
app.post("/api/google-sheets/import-bulk", async (req, res) => {
  try {
    const { parties } = req.body;
    if (!parties || !Array.isArray(parties)) {
      return res.status(400).json({ error: "No parties array provided for importing" });
    }

    const db = await loadDatabase();
    let importCount = 0;

    parties.forEach((p: any) => {
      const newId = "p_gs_" + Math.random().toString(36).substring(2, 9).toUpperCase();
      
      const pName = ((p.name || "Unnamed Participant") + "").trim().substring(0, 100) || "Unnamed Participant";
      const pPhone = ((p.phone || "") + "").trim().substring(0, 30);
      const pEmail = ((p.email || "") + "").trim().substring(0, 100);
      const pType = p.type === "supplier" ? "supplier" : "customer";
      const pBal = Number(p.initialBalance) || 0;

      const newParty: Party = {
        id: newId,
        name: pName,
        type: pType,
        phone: pPhone,
        email: pEmail,
        initialBalance: pBal,
        currentBalance: pBal
      };

      db.parties.push(newParty);
      importCount++;

      // Autocommit digital invoice reminder queue to simulation chat log for customers
      if (newParty.type === "customer" && newParty.initialBalance > 0) {
        const autoLog: WhatsAppLog = {
          id: "w_invoice_gs_" + Math.random().toString(36).substring(2, 9).toUpperCase(),
          timestamp: new Date().toISOString(),
          type: "invoice",
          recipient: pPhone || "+919999988888",
          partyName: pName,
          message: `Hello ${pName}! Your student registration invoice for the Event Ledger is issued. Total Pending: ₹${pBal.toLocaleString()}. Clear your dues via UPI QR on the dashboard.`.substring(0, 1000),
          status: "sent"
        };
        db.whatsappLogs.unshift(autoLog);
      }
    });

    const updatedDb = recalculateBalancesOfData(db);
    await saveDatabase(updatedDb);

    res.json({
      success: true,
      importedCount: importCount,
      message: `${importCount} records successfully imported. Ledgers balanced and verified.`
    });
  } catch (err: any) {
    console.error("Bulk sheet import failed:", err);
    res.status(500).json({ 
      error: "Bulk import execution failed", 
      msg: err.message || String(err) 
    });
  }
});

// Configure Opening Balance
app.post("/api/ledger/opening-balance", async (req, res) => {
  try {
    const { amount } = req.body;
    if (amount === undefined || isNaN(Number(amount))) {
      return res.status(400).json({ error: "Valid numeric opening balance is required" });
    }
    const db = await loadDatabase();
    db.openingBalance = Number(amount);
    await saveDatabase(db);
    res.json({ success: true, openingBalance: db.openingBalance });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to configure opening balance" });
  }
});

// Clear Cache and All Database Memory
app.post("/api/reset-all", async (req, res) => {
  try {
    // 1. Force load the database so we have everything in memory and lastSavedDb tracked
    await loadDatabase();
    
    // 2. Define empty database representing the fresh state
    const blankDb: DatabaseSchema = {
      openingBalance: 5000,
      parties: [],
      transactions: [],
      whatsappLogs: []
    };

    // 3. Save the blank database which will trigger Firestore to delete all existing records
    await saveDatabase(blankDb);

    // 4. Force override of our local caches to guarantee no stale data remains
    inMemoryDb = JSON.parse(JSON.stringify(blankDb));
    lastSavedDb = JSON.parse(JSON.stringify(blankDb));

    console.log("[Firestore] Database memory and caches have been fully cleared and reset.");
    res.json({ success: true, message: "Database and cache fully cleared successfully" });
  } catch (err: any) {
    console.error("Database clear failed:", err);
    res.status(500).json({ error: "Failed to reset database", msg: err.message });
  }
});

/* --- Vite Dev Server & Asset Routing --- */

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Middleware Node mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    // Inject Vite middleware
    app.use(vite.middlewares);
  } else {
    // Production client static file builder serving
    const distPath = path.join(process.cwd(), "dist");
    
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.warn("WARNING: Production build 'dist' directory not found. Serving development setup if possible.");
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Event Ledger Server] running on http://0.0.0.0:${PORT} in env: ${process.env.NODE_ENV || "development"}`);
  });
}

startServer();
