import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { TrendingUp, Clock, CheckCircle, Zap } from "lucide-react";

const repayments = [
  { date: "Mar 15, 2026", amount: "KES 5,200", status: "Upcoming" },
  { date: "Mar 22, 2026", amount: "KES 5,200", status: "Upcoming" },
  { date: "Mar 29, 2026", amount: "KES 5,200", status: "Upcoming" },
  { date: "Apr 5, 2026", amount: "KES 5,200", status: "Upcoming" },
];

const CashAdvancePage = () => {
  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Cash Advance</h2>

        {/* Eligibility Card */}
        <div className="bg-gradient-to-br from-secondary to-navy rounded-2xl p-6 text-secondary-foreground">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider opacity-70">You're Pre-Approved For</p>
              <p className="text-4xl font-semibold tabular tracking-tight-custom mt-1">KES 150,000</p>
              <p className="text-sm opacity-70 mt-1">Based on your 90-day transaction volume</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-emerald" />
            </div>
          </div>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button className="bg-emerald hover:bg-emerald-hover text-primary-foreground font-medium rounded-xl px-6 py-3 btn-primary-shadow transition-all active:scale-[0.98] min-h-[48px]">
              Request Advance
            </button>
            <button className="border border-secondary-foreground/20 hover:bg-secondary-foreground/10 text-secondary-foreground font-medium rounded-xl px-6 py-3 transition-all min-h-[48px]">
              View Terms
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Current Advance */}
          <div className="bg-card rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Current Advance</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Borrowed</span>
                <span className="text-sm font-semibold text-foreground tabular">KES 50,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Repaid</span>
                <span className="text-sm font-semibold text-emerald tabular">KES 29,200</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Outstanding</span>
                <span className="text-sm font-semibold text-foreground tabular">KES 20,800</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Fee (3%)</span>
                <span className="text-sm text-muted-foreground tabular">KES 1,500</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Repayment Progress</span>
                <span className="tabular">58%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald rounded-full transition-all" style={{ width: "58%" }} />
              </div>
            </div>
          </div>

          {/* Repayment Schedule */}
          <div className="bg-card rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Repayment Schedule</h3>
            <div className="space-y-0">
              {repayments.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-muted/30 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.date}</p>
                      <p className="text-xs text-muted-foreground">{r.status}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground tabular">{r.amount}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Advance History */}
          <div className="bg-card rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">History</h3>
            <div className="space-y-0">
              {[
                { date: "Jan 2026", amount: "KES 30,000", status: "Repaid", days: "18 days" },
                { date: "Nov 2025", amount: "KES 25,000", status: "Repaid", days: "14 days" },
                { date: "Sep 2025", amount: "KES 15,000", status: "Repaid", days: "10 days" },
              ].map((h, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-muted/30 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{h.amount}</p>
                      <p className="text-xs text-muted-foreground">{h.date} · {h.days}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald bg-emerald/10 px-2.5 py-1 rounded-lg">{h.status}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl bg-emerald/5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald" />
                <p className="text-xs font-medium text-foreground">Credit Score: <span className="text-emerald">Excellent</span></p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">100% on-time repayment rate</p>
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default CashAdvancePage;
