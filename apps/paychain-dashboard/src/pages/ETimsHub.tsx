import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { CheckCircle, Clock, Download } from "lucide-react";

const transactions = [
  { date: "Mar 12, 2026", amount: "KES 8,400", ref: "ETIMS-2026-04812-001", invoice: "INV-0412" },
  { date: "Mar 11, 2026", amount: "KES 3,200", ref: "ETIMS-2026-04812-002", invoice: "INV-0411" },
  { date: "Mar 10, 2026", amount: "KES 15,600", ref: "ETIMS-2026-04812-003", invoice: "INV-0410" },
  { date: "Mar 9, 2026", amount: "KES 2,100", ref: "ETIMS-2026-04812-004", invoice: "INV-0409" },
  { date: "Mar 8, 2026", amount: "KES 6,800", ref: "ETIMS-2026-04812-005", invoice: "INV-0408" },
];

const ETimsHubPage = () => {
  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Status Banner */}
        <div className="bg-emerald/10 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">PayChain registered as your KRA Technical Agent</span>
            <span className="text-muted-foreground ml-1">(MOU #KRA-2026-04812)</span>
          </p>
        </div>

        {/* Deadline Alert */}
        <div className="bg-amber/10 rounded-2xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber shrink-0" />
          <p className="text-sm font-medium text-foreground">VAT Filing Deadline: March 31, 2026</p>
        </div>

        {/* Tax Reserve */}
        <div className="bg-card rounded-2xl p-6 card-shadow">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Reserved for VAT (16%)</p>
          <p className="text-3xl font-semibold text-foreground tabular tracking-tight-custom mt-1">KES 18,420</p>
          <p className="text-xs text-muted-foreground mt-1">Auto-calculated from verified transactions</p>
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl card-shadow overflow-hidden">
          <div className="p-6 pb-0">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Recent e-TIMS Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full mt-4">
              <thead>
                <tr className="text-left">
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30">Date</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30">Amount</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30 hidden md:table-cell">e-TIMS Ref#</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30">Invoice</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 pb-3 border-b border-muted/30"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="text-sm text-foreground px-6 py-3 border-b border-muted/15">{tx.date}</td>
                    <td className="text-sm font-medium text-foreground tabular px-6 py-3 border-b border-muted/15">{tx.amount}</td>
                    <td className="text-sm text-muted-foreground tabular px-6 py-3 border-b border-muted/15 hidden md:table-cell">{tx.ref}</td>
                    <td className="text-sm text-foreground px-6 py-3 border-b border-muted/15">{tx.invoice}</td>
                    <td className="px-6 py-3 border-b border-muted/15">
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default ETimsHubPage;
