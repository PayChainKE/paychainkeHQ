import { motion } from 'framer-motion';
import { RefreshCw, Shield, FileCheck, Users, Zap } from 'lucide-react';
const ProblemSolution = () => {
  return (
    <section className="container mx-auto px-6 lg:px-8 py-12 md:py-20">
      {/* Intro card removed per request */}
      {/* Solution Section */}
      <div>
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">
          {/* Left: Text Content */}
          <div className="space-y-4">
            
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black mb-2">
              What we solve.
            </h2>
            <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
                One platform that protects your wealth from inflation with the <strong className="text-black font-bold">Inflation Shield</strong>, blocks fraud in under 100ms with <strong className="text-black font-bold">Sentinel AI</strong>, automates KRA compliance with <strong className="text-black font-bold">e-TIMS Native</strong>, and powers your payroll and supplier payments with <strong className="text-black font-bold">Pay-for-Business</strong>.
            </p>
            <p className="text-base text-slate-700 mt-3">
                This isn't a payment processor. It's the operating system your business has been waiting for.
            </p>
          </div>
          {/* Right: feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
            {[
              { icon: <RefreshCw className="w-5 h-5 text-emerald-400" />, label: 'Inflation Shield', desc: 'Auto-converts idle KES float to USDC on Base L2, protecting savings from shilling depreciation 24/7.', kpi: '+20% Preserved', color: 'border-emerald-500/20 bg-emerald-500/5' },
              { icon: <Shield className="w-5 h-5 text-blue-400" />, label: 'Sentinel AI', desc: 'Sub-100ms server-side verification eliminates fake SMS fraud, confirmed directly from Safaricom.', kpi: '<100ms Block', color: 'border-blue-500/20 bg-blue-500/5' },
              { icon: <FileCheck className="w-5 h-5 text-purple-400" />, label: 'e-TIMS Native', desc: 'Every sale triggers an automatic ETR receipt and KRA submission. Stay compliant without lifting a finger.', kpi: 'Zero Penalties', color: 'border-purple-500/20 bg-purple-500/5' },
              { icon: <Users className="w-5 h-5 text-amber-400" />, label: 'Pay-for-Business', desc: 'Bulk payroll, supplier payments, and utility bills — automated in one dashboard. In KES or USDC.', kpi: '1-Click Payouts', color: 'border-amber-500/20 bg-amber-500/5' },
            ].map(({ icon, label, desc, kpi, color }) => (
              <div key={label} className={`rounded-2xl border p-5 flex flex-col gap-3 h-full ${color}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">{icon}</div>
                    <h3 className="text-sm font-bold text-black">{label}</h3>
                  </div>
                    <div className="text-sm font-bold text-emerald-700">{kpi}</div>
                </div>
                  <p className="text-slate-700 text-sm leading-relaxed mt-3 flex-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolution;