import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { ShieldCheck, Clock, CheckCircle, AlertTriangle, Plus, ArrowRight } from "lucide-react";

const escrows = [
  { id: "ESC-001", supplier: "Nairobi Fresh Produce", amount: "KES 45,000", usdc: "292 USDC", status: "In Progress", milestone: "Delivery Confirmed", date: "Mar 10, 2026" },
  { id: "ESC-002", supplier: "Mombasa Packaging Co.", amount: "KES 120,000", usdc: "778 USDC", status: "Completed", milestone: "Released", date: "Mar 8, 2026" },
  { id: "ESC-003", supplier: "Kisumu Textiles Ltd", amount: "KES 28,500", usdc: "185 USDC", status: "Pending", milestone: "Awaiting Goods", date: "Mar 12, 2026" },
  { id: "ESC-004", supplier: "Eldoret Grain Supplies", amount: "KES 67,200", usdc: "436 USDC", status: "Disputed", milestone: "Under Review", date: "Mar 6, 2026" },
];

const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle }> = {
  "Completed": { color: "text-emerald", bg: "bg-emerald/10", icon: CheckCircle },
  "In Progress": { color: "text-sky-500", bg: "bg-sky-500/10", icon: Clock },
  "Pending": { color: "text-amber", bg: "bg-amber/10", icon: Clock },
  "Disputed": { color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
};

const SupplierEscrowPage = () => {
  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Supplier Escrow</h2>
          <button className="bg-emerald hover:bg-emerald-hover text-primary-foreground font-medium rounded-xl px-5 py-2.5 btn-primary-shadow transition-all active:scale-[0.98] flex items-center gap-2 min-h-[48px]">
            <Plus className="w-4 h-4" />
            New Escrow
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total in Escrow", value: "KES 260,700", sub: "1,691 USDC" },
            { label: "Active Deals", value: "2", sub: "In progress" },
            { label: "Completed (30d)", value: "8", sub: "KES 842,000 settled" },
            { label: "Disputed", value: "1", sub: "Under review" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card rounded-2xl p-5 card-shadow">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-semibold text-foreground tabular tracking-tight-custom mt-1">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-card rounded-2xl p-6 card-shadow">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald" />
            How Escrow Works
          </h3>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-6">
            {["Fund Escrow (KES or USDC)", "Supplier Ships Goods", "Confirm Delivery", "Funds Released"].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald/10 text-emerald text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-sm text-foreground font-medium">{step}</p>
                {i < 3 && <ArrowRight className="w-4 h-4 text-muted-foreground hidden md:block" />}
              </div>
            ))}
          </div>
        </div>

        {/* Escrow List */}
        <div className="bg-card rounded-2xl card-shadow overflow-hidden">
          <div className="p-6 pb-0">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Active Escrows</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full mt-4">
              <thead>
                <tr className="text-left">
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30">Supplier</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30">Amount</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30 hidden md:table-cell">USDC Value</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30">Status</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30 hidden md:table-cell">Milestone</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30">Action</th>
                </tr>
              </thead>
              <tbody>
                {escrows.map((esc) => {
                  const cfg = statusConfig[esc.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={esc.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3.5 border-b border-muted/15">
                        <p className="text-sm font-medium text-foreground">{esc.supplier}</p>
                        <p className="text-xs text-muted-foreground tabular">{esc.id}</p>
                      </td>
                      <td className="text-sm font-medium text-foreground tabular px-6 py-3.5 border-b border-muted/15">{esc.amount}</td>
                      <td className="text-sm text-muted-foreground tabular px-6 py-3.5 border-b border-muted/15 hidden md:table-cell">{esc.usdc}</td>
                      <td className="px-6 py-3.5 border-b border-muted/15">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {esc.status}
                        </span>
                      </td>
                      <td className="text-sm text-muted-foreground px-6 py-3.5 border-b border-muted/15 hidden md:table-cell">{esc.milestone}</td>
                      <td className="px-6 py-3.5 border-b border-muted/15">
                        {esc.status === "In Progress" && (
                          <button className="text-xs font-medium text-emerald hover:text-emerald-hover bg-emerald/10 px-3 py-1.5 rounded-lg transition-colors">
                            Confirm Delivery
                          </button>
                        )}
                        {esc.status === "Disputed" && (
                          <button className="text-xs font-medium text-amber hover:text-amber/80 bg-amber/10 px-3 py-1.5 rounded-lg transition-colors">
                            View Dispute
                          </button>
                        )}
                        {esc.status === "Pending" && (
                          <button className="text-xs font-medium text-muted-foreground hover:text-foreground bg-muted px-3 py-1.5 rounded-lg transition-colors">
                            Track
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default SupplierEscrowPage;
