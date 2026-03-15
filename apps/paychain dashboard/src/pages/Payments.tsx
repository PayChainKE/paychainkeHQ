import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, Filter, Search, Download } from "lucide-react";

const transactions = [
  { id: "TXN-9841", type: "in", from: "0712 XXX 432", amount: "KES 4,200", method: "M-PESA", time: "2 min ago", status: "Verified" },
  { id: "TXN-9840", type: "out", from: "Supplier Escrow", amount: "KES 45,000", method: "USDC Swap", time: "1 hr ago", status: "Verified" },
  { id: "TXN-9839", type: "in", from: "0798 XXX 115", amount: "KES 1,850", method: "M-PESA", time: "2 hrs ago", status: "Verified" },
  { id: "TXN-9838", type: "out", from: "KPLC Postpaid", amount: "KES 3,420", method: "Bill Pay", time: "5 hrs ago", status: "Verified" },
  { id: "TXN-9837", type: "in", from: "0722 XXX 890", amount: "KES 12,600", method: "M-PESA", time: "8 hrs ago", status: "Verified" },
  { id: "TXN-9836", type: "out", from: "Staff Payroll", amount: "KES 86,000", method: "Bulk M-PESA", time: "1 day ago", status: "Verified" },
  { id: "TXN-9835", type: "in", from: "0711 XXX 204", amount: "KES 950", method: "M-PESA", time: "1 day ago", status: "Pending" },
];

const PaymentsPage = () => {
  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Payments</h2>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 bg-muted hover:bg-muted/80 rounded-xl px-4 py-2.5 text-sm text-foreground font-medium transition-colors min-h-[44px]">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="flex items-center gap-2 bg-muted hover:bg-muted/80 rounded-xl px-4 py-2.5 text-sm text-foreground font-medium transition-colors min-h-[44px]">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Today's Inflow", value: "KES 18,650", change: "+12%" },
            { label: "Today's Outflow", value: "KES 48,420", change: "" },
            { label: "Pending", value: "KES 950", change: "1 transaction" },
            { label: "Net (30 days)", value: "KES 284,500", change: "+8.2% vs last month" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card rounded-2xl p-5 card-shadow">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-semibold text-foreground tabular tracking-tight-custom mt-1">{stat.value}</p>
              {stat.change && <p className="text-xs text-emerald font-medium mt-0.5">{stat.change}</p>}
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="bg-card rounded-2xl p-4 card-shadow">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full bg-input rounded-xl pl-10 pr-4 py-3 text-sm text-foreground input-inset focus:input-inset-focus outline-none transition-shadow"
              placeholder="Search by reference, phone number, or amount..."
            />
          </div>
        </div>

        {/* Transaction List */}
        <div className="bg-card rounded-2xl card-shadow overflow-hidden">
          <div className="p-6 pb-0">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Transaction History</h3>
          </div>
          <div className="divide-y divide-muted/20 mt-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    tx.type === "in" ? "bg-emerald/10" : "bg-destructive/10"
                  }`}>
                    {tx.type === "in" ? (
                      <ArrowDownLeft className="w-4 h-4 text-emerald" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{tx.from}</p>
                    <p className="text-xs text-muted-foreground">{tx.method} · {tx.time}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className={`text-sm font-semibold tabular ${tx.type === "in" ? "text-emerald" : "text-foreground"}`}>
                      {tx.type === "in" ? "+" : "-"}{tx.amount}
                    </p>
                    <p className="text-xs text-muted-foreground tabular">{tx.id}</p>
                  </div>
                  {tx.status === "Verified" ? (
                    <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default PaymentsPage;
