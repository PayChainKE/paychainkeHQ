import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { Plus, Search } from "lucide-react";

const tills = [
  { number: "TILL-882014", name: "Main Shop Westlands", status: "Active", volume: "KES 142,800" },
  { number: "TILL-882015", name: "Kiosk Kibera", status: "Active", volume: "KES 48,200" },
  { number: "TILL-882016", name: "Pop-up Market Lavington", status: "Inactive", volume: "KES 0" },
];

const MyTillsPage = () => {
  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">My Tills</h2>
          <button className="bg-emerald hover:bg-emerald-hover text-primary-foreground font-medium rounded-xl px-5 py-2.5 btn-primary-shadow transition-all active:scale-[0.98] flex items-center gap-2 min-h-[48px]">
            <Plus className="w-4 h-4" />
            Spawn New Equity Till
          </button>
        </div>

        {/* Tills list */}
        <div className="space-y-3">
          {tills.map((till) => (
            <div key={till.number} className="bg-card rounded-2xl p-5 card-shadow flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center">
                  <span className="text-navy font-semibold text-xs">🏪</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{till.name}</p>
                  <p className="text-xs text-muted-foreground tabular">{till.number}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
                  till.status === "Active" ? "bg-emerald/10 text-emerald" : "bg-muted text-muted-foreground"
                }`}>{till.status}</span>
                <p className="text-sm font-semibold text-foreground tabular hidden sm:block">{till.volume}/day</p>
              </div>
            </div>
          ))}
        </div>

        {/* Claim Payment */}
        <div className="bg-card rounded-2xl p-6 card-shadow">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Claim Unlinked Payment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">M-PESA Reference Code</label>
              <input className="mt-2 w-full bg-input rounded-xl px-4 py-3 text-sm text-foreground input-inset focus:input-inset-focus outline-none transition-shadow" placeholder="e.g. SLK2XXXXX" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Amount (KES)</label>
              <input className="mt-2 w-full bg-input rounded-xl px-4 py-3 text-sm text-foreground input-inset focus:input-inset-focus outline-none transition-shadow tabular" placeholder="0.00" />
            </div>
          </div>
          <button className="mt-4 bg-emerald hover:bg-emerald-hover text-primary-foreground font-medium rounded-xl px-5 py-2.5 btn-primary-shadow transition-all active:scale-[0.98] flex items-center gap-2 min-h-[48px]">
            <Search className="w-4 h-4" />
            Match & Verify with Sentinel AI
          </button>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default MyTillsPage;
