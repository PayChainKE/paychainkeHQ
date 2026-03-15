import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Upload, ArrowLeftRight } from "lucide-react";

const utilities = [
  { name: "KPLC Postpaid", lastPaid: "Mar 8, 2026" },
  { name: "KPLC Prepaid", lastPaid: "Mar 5, 2026" },
  { name: "Nairobi Water", lastPaid: "Feb 28, 2026" },
  { name: "Zuku Internet", lastPaid: "Mar 1, 2026" },
];

const PayrollPage = () => {
  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Payroll & Utilities</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Payroll */}
          <div className="bg-card rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Payroll</h3>
            <button className="w-full bg-muted hover:bg-muted/80 rounded-xl px-4 py-3 text-sm text-muted-foreground font-medium transition-colors flex items-center justify-center gap-2 mb-3">
              <Upload className="w-4 h-4" />
              Upload CSV
            </button>
            <textarea
              className="w-full bg-input rounded-xl px-4 py-3 text-sm text-foreground input-inset focus:input-inset-focus outline-none transition-shadow resize-none h-24"
              placeholder="Paste M-PESA numbers (one per line)"
            />
            <button className="mt-3 w-full bg-emerald hover:bg-emerald-hover text-primary-foreground font-medium rounded-xl px-5 py-2.5 btn-primary-shadow transition-all active:scale-[0.98] min-h-[48px]">
              Send Bulk Payroll
            </button>
          </div>

          {/* Utilities */}
          <div className="bg-card rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Utilities</h3>
            <div className="space-y-0">
              {utilities.map((u) => (
                <div key={u.name} className="flex items-center justify-between py-3 border-b border-muted/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground">Last paid: {u.lastPaid}</p>
                  </div>
                  <button className="text-xs font-medium text-emerald hover:text-emerald-hover bg-emerald/10 px-3 py-1.5 rounded-lg transition-colors">
                    Pay Now
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Swap & Settle */}
          <div className="bg-card rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4" />
              Swap & Settle
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Transfer USDC → M-PESA</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium">Amount (USDC)</label>
                <input className="mt-1 w-full bg-input rounded-xl px-4 py-3 text-sm text-foreground input-inset focus:input-inset-focus outline-none transition-shadow tabular" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">M-PESA Number</label>
                <input className="mt-1 w-full bg-input rounded-xl px-4 py-3 text-sm text-foreground input-inset focus:input-inset-focus outline-none transition-shadow" placeholder="07XX XXX XXX" />
              </div>
            </div>
            <div className="mt-3 p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground">Current Rate</p>
              <p className="text-sm font-semibold text-foreground tabular">1 USDC = 154.20 KES</p>
            </div>
            <button className="mt-3 w-full bg-emerald hover:bg-emerald-hover text-primary-foreground font-medium rounded-xl px-5 py-2.5 btn-primary-shadow transition-all active:scale-[0.98] min-h-[48px]">
              Swap & Send
            </button>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default PayrollPage;
