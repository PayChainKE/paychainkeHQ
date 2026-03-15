import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function HybridBalanceCard() {
  const [shieldActive, setShieldActive] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="relative rounded-2xl p-6 md:p-8 overflow-hidden bg-gradient-to-br from-navy to-navy-mid">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle_at_center,rgba(0,200,150,0.15),transparent_70%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        {/* Balances */}
        <div className="space-y-4">
          <div>
            <p className="text-primary-foreground/50 text-xs font-medium uppercase tracking-wider">Available KES</p>
            <p className="text-primary-foreground text-4xl md:text-5xl font-semibold tracking-tight-custom tabular mt-1">
              284,500
            </p>
          </div>
          <div className="glass-surface rounded-xl p-4 inline-flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#2775CA] flex items-center justify-center">
              <span className="text-primary-foreground text-[10px] font-bold">$</span>
            </div>
            <div>
              <p className="text-primary-foreground/50 text-[10px] uppercase tracking-wider">Available USDC</p>
              <p className="text-primary-foreground text-lg font-semibold tabular">1,842.60</p>
            </div>
            <span className="text-primary-foreground/30 text-[10px] ml-1">Base L2</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4 items-start md:items-end">
          {/* Shield Toggle */}
          <button
            onClick={() => setShieldActive(!shieldActive)}
            className="flex items-center gap-3"
          >
            <span className="text-primary-foreground/70 text-sm font-medium">Inflation Shield</span>
            <div className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${shieldActive ? "bg-emerald" : "bg-primary-foreground/20"}`}
              style={shieldActive ? { boxShadow: "0 0 12px rgba(0,200,150,0.4)" } : {}}>
              <motion.div
                layout
                className="absolute top-0.5 w-6 h-6 rounded-full bg-primary-foreground"
                style={{ left: shieldActive ? "calc(100% - 26px)" : "2px" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
            {shieldActive && (
              <motion.div
                className="w-2 h-2 rounded-full bg-emerald"
                animate={{ boxShadow: ["0 0 0 0 rgba(0,200,150,0.4)", "0 0 0 6px rgba(0,200,150,0)"] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </button>

          {/* Move Money */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="bg-emerald hover:bg-emerald-hover text-primary-foreground font-medium rounded-xl px-5 py-2.5 btn-primary-shadow transition-all duration-200 flex items-center gap-2 active:scale-[0.98]"
            >
              Move Money
              <ChevronDown className="w-4 h-4" />
            </button>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl card-shadow p-1.5 z-50"
              >
                {["Swap KES to USDC", "Pay Supplier Escrow", "Pay Staff", "Pay Bills"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setDropdownOpen(false)}
                    className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
