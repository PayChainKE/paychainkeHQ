import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight, Shield, AlertTriangle } from "lucide-react";

const InflationShieldPage = () => {
  const [autoSwap, setAutoSwap] = useState(true);
  const [liquidAmount, setLiquidAmount] = useState("50000");

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
        {/* Vault Header */}
        <div className="bg-card rounded-2xl p-8 card-shadow text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-navy flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">K</span>
            </div>
            <motion.div
              animate={{ x: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRight className="w-6 h-6 text-emerald" />
            </motion.div>
            <div className="w-12 h-12 rounded-2xl bg-[#2775CA] flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">$</span>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Inflation Shield Vault</h2>
          <p className="text-sm text-muted-foreground">Auto-convert excess KES to USDC for inflation protection</p>
        </div>

        {/* Auto-Swap Toggle */}
        <div className="bg-card rounded-2xl p-6 card-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald" />
              <div>
                <p className="text-sm font-semibold text-foreground">Auto-Swap Incoming Payments</p>
                <p className="text-xs text-muted-foreground">Automatically convert excess KES to USDC</p>
              </div>
            </div>
            <button onClick={() => setAutoSwap(!autoSwap)}>
              <div className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${autoSwap ? "bg-emerald" : "bg-muted"}`}
                style={autoSwap ? { boxShadow: "0 0 8px rgba(0,200,150,0.4)" } : {}}>
                <motion.div layout className="absolute top-0.5 w-6 h-6 rounded-full bg-primary-foreground shadow-sm"
                  style={{ left: autoSwap ? "calc(100% - 26px)" : "2px" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              </div>
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-muted/30">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Keep liquid (KES)</label>
            <input
              type="text"
              value={liquidAmount}
              onChange={(e) => setLiquidAmount(e.target.value)}
              className="mt-2 w-full bg-input rounded-xl px-4 py-3 text-sm font-medium text-foreground input-inset focus:input-inset-focus outline-none transition-shadow"
              placeholder="Amount in KES"
            />
            <p className="text-xs text-muted-foreground mt-2">All incoming payments above this threshold will be auto-swapped to USDC</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 border-2 border-amber text-amber font-medium hover:bg-amber/10 transition-colors min-h-[48px]">
            <AlertTriangle className="w-4 h-4" />
            Emergency Swap: USDC → KES
          </button>
          <button className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 bg-emerald text-primary-foreground font-medium hover:bg-emerald-hover btn-primary-shadow transition-all active:scale-[0.98] min-h-[48px]">
            Pay Supplier via Escrow
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total in Vault", value: "$1,842.60", sub: "USDC" },
            { label: "% Yield", value: "4.2%", sub: "APY" },
            { label: "Protected Since", value: "Jan 15", sub: "2026" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card rounded-2xl p-4 card-shadow text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg font-semibold text-foreground tabular mt-1">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default InflationShieldPage;
