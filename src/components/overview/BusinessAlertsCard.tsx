import { AlertTriangle, Calendar } from "lucide-react";

const alerts = [
  {
    icon: AlertTriangle,
    color: "text-amber",
    bgColor: "bg-amber/10",
    title: "Low KES for Payroll?",
    description: "Use Overdraft to bridge the gap.",
    action: "View Options",
  },
  {
    icon: Calendar,
    color: "text-emerald",
    bgColor: "bg-emerald/10",
    title: "KPLC bill due in 2 days",
    description: "Pay with USDC Vault. KES 14,200 required.",
    action: "Pay Now",
  },
];

export function BusinessAlertsCard() {
  return (
    <div className="bg-card rounded-2xl p-6 card-shadow h-full">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Business Alerts</h3>
      <div className="space-y-3">
        {alerts.map((alert, i) => (
          <div key={i} className="rounded-xl p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${alert.bgColor} shrink-0`}>
                <alert.icon className={`w-4 h-4 ${alert.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                <button className="mt-2 text-xs font-medium text-emerald hover:text-emerald-hover transition-colors">
                  {alert.action} →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
