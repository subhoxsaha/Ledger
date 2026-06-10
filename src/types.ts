export interface Party {
  id: string;
  name: string;
  type: "customer" | "supplier"; // customer = students/participants, supplier = vendors/decorators/DJs/caterers
  phone: string;
  email: string;
  initialBalance: number; // For suppliers, negative means we owe them standard balances. For customers, positive means they owe us standard fees.
  currentBalance: number; // Reconciled balance
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: "cash_in" | "cash_out";
  partyId: string;
  partyName: string;
  amount: number;
  paymentMode: "cash" | "bank" | "upi";
  remarks: string;
  category?: string;
}

export interface FinancialMetrics {
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
  netSurplus: number;
}

export interface WhatsAppLog {
  id: string;
  timestamp: string;
  type: "invoice" | "payment_reminder" | "entry_ticket";
  recipient: string;
  partyName: string;
  message: string;
  status: "sent" | "failed";
}

export interface ReconciliationReport {
  timestamp: string;
  discrepanciesCount: number;
  recalculatedParties: {
    partyId: string;
    name: string;
    type: "customer" | "supplier";
    oldBalance: number;
    newBalance: number;
    difference: number;
  }[];
}
