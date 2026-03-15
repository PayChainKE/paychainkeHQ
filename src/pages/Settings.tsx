import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { User, Bell, Shield, CreditCard, Building2, Key, ChevronRight } from "lucide-react";

const SettingsPage = () => {
  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile */}
          <div className="md:col-span-2 bg-card rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald" />
              Business Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Business Name", value: "Amara's General Store" },
                { label: "Owner", value: "Amara Osei" },
                { label: "Phone", value: "+254 712 XXX 432" },
                { label: "Email", value: "amara@paychain.ke" },
                { label: "KRA PIN", value: "A00XXXXXXX" },
                { label: "County", value: "Nairobi" },
              ].map((field) => (
                <div key={field.label}>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{field.label}</label>
                  <input
                    className="mt-2 w-full bg-input rounded-xl px-4 py-3 text-sm text-foreground input-inset focus:input-inset-focus outline-none transition-shadow"
                    defaultValue={field.value}
                  />
                </div>
              ))}
            </div>
            <button className="mt-5 bg-emerald hover:bg-emerald-hover text-primary-foreground font-medium rounded-xl px-5 py-2.5 btn-primary-shadow transition-all active:scale-[0.98] min-h-[48px]">
              Save Changes
            </button>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <div className="bg-card rounded-2xl p-5 card-shadow">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Account</h3>
              <div className="space-y-0">
                {[
                  { icon: Bell, label: "Notifications", desc: "Push & SMS alerts" },
                  { icon: Shield, label: "Security", desc: "2FA & PIN settings" },
                  { icon: Key, label: "API Keys", desc: "Developer access" },
                ].map((item) => (
                  <button key={item.label} className="w-full flex items-center justify-between py-3 border-b border-muted/30 last:border-0 hover:bg-muted/20 -mx-1 px-1 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <item.icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-2xl p-5 card-shadow">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Business</h3>
              <div className="space-y-0">
                {[
                  { icon: CreditCard, label: "Payment Methods", desc: "M-PESA, Bank, USDC" },
                  { icon: Building2, label: "KRA Integration", desc: "e-TIMS settings" },
                ].map((item) => (
                  <button key={item.label} className="w-full flex items-center justify-between py-3 border-b border-muted/30 last:border-0 hover:bg-muted/20 -mx-1 px-1 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <item.icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-card rounded-2xl p-6 card-shadow">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-5">Preferences</h3>
          <div className="space-y-4">
            {[
              { label: "Auto-swap incoming payments to USDC", desc: "Shield against KES inflation automatically", default: true },
              { label: "Daily transaction summary via SMS", desc: "Receive end-of-day reports at 9 PM EAT", default: true },
              { label: "Low balance alerts", desc: "Notify when KES balance drops below KES 10,000", default: false },
              { label: "Payroll reminders", desc: "Get reminded 3 days before scheduled payroll", default: true },
            ].map((pref) => (
              <div key={pref.label} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{pref.label}</p>
                  <p className="text-xs text-muted-foreground">{pref.desc}</p>
                </div>
                <button
                  className={`relative w-11 h-6 rounded-full transition-colors ${pref.default ? "bg-emerald" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform ${pref.default ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-card rounded-2xl p-6 card-shadow border border-destructive/20">
          <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider mb-2">Danger Zone</h3>
          <p className="text-xs text-muted-foreground mb-4">These actions are irreversible. Proceed with caution.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button className="text-sm font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 rounded-xl px-5 py-2.5 transition-colors min-h-[44px]">
              Deactivate Account
            </button>
            <button className="text-sm font-medium text-muted-foreground border border-muted/30 hover:bg-muted/20 rounded-xl px-5 py-2.5 transition-colors min-h-[44px]">
              Export All Data
            </button>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default SettingsPage;
