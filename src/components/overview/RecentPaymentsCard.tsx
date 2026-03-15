import { motion } from "framer-motion";

const payments = [
  { time: "14:32", phone: "0712 XXX 456", amount: "4,200", verified: true },
  { time: "14:18", phone: "0798 XXX 112", amount: "1,850", verified: true },
  { time: "13:55", phone: "0723 XXX 890", amount: "12,000", verified: true },
  { time: "13:41", phone: "0711 XXX 234", amount: "650", verified: false },
  { time: "13:22", phone: "0745 XXX 678", amount: "3,400", verified: true },
  { time: "12:58", phone: "0700 XXX 901", amount: "8,750", verified: true },
];

function SentinelPulse() {
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="w-2 h-2 rounded-full bg-emerald"
        animate={{ boxShadow: ["0 0 0 0 rgba(0,200,150,0.4)", "0 0 0 6px rgba(0,200,150,0)"] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
}

export function RecentPaymentsCard() {
  return (
    <div className="bg-card rounded-2xl p-6 card-shadow h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Recent Payments</h3>
        <span className="text-[10px] font-medium text-emerald bg-emerald/10 px-2 py-1 rounded-lg">AI Verified</span>
      </div>
      <div className="space-y-0">
        {payments.map((p, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-muted/30 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              {p.verified ? <SentinelPulse /> : <div className="w-2 h-2 rounded-full bg-muted" />}
              <div>
                <p className="text-sm font-medium text-foreground tabular">{p.phone}</p>
                <p className="text-xs text-muted-foreground">{p.time}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground tabular">KES {p.amount}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
