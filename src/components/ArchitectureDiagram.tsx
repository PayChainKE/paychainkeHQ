import React from 'react';

const ArchitectureDiagram: React.FC = () => {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-bold text-foreground mb-4">System Architecture</h3>
      
      <div className="min-w-[800px]">
        {/* Mermaid-style diagram rendered as SVG/HTML */}
        <div className="grid grid-cols-5 gap-4 text-center">
          {/* Layer 1: External */}
          <div className="col-span-5 flex justify-center gap-4 mb-4">
            <div className="px-4 py-3 rounded-lg bg-success/10 border border-success/30">
              <p className="text-xs text-success font-medium">M-PESA API</p>
              <p className="text-[10px] text-muted-foreground">Safaricom</p>
            </div>
            <div className="px-4 py-3 rounded-lg bg-accent/10 border border-accent/30">
              <p className="text-xs text-accent font-medium">Bank APIs</p>
              <p className="text-[10px] text-muted-foreground">KCB, Equity, etc.</p>
            </div>
          </div>

          {/* Arrow */}
          <div className="col-span-5 flex justify-center">
            <div className="w-0.5 h-6 bg-border" />
          </div>

          {/* Layer 2: Webhook Receiver */}
          <div className="col-span-5 flex justify-center mb-4">
            <div className="px-6 py-4 rounded-xl bg-gradient-primary text-primary-foreground">
              <p className="font-bold">🦀 Rust Webhook Listener</p>
              <p className="text-xs opacity-80">Axum + Tokio | &lt;100ms latency</p>
            </div>
          </div>

          {/* Split arrows */}
          <div className="col-span-5 grid grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-border" />
              <div className="w-12 h-0.5 bg-border" />
            </div>
            <div className="flex justify-center">
              <div className="w-0.5 h-6 bg-border" />
            </div>
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-border" />
              <div className="w-12 h-0.5 bg-border" />
            </div>
          </div>

          {/* Layer 3: Core Services */}
          <div className="col-span-5 grid grid-cols-3 gap-4 mb-4">
            <div className="px-4 py-3 rounded-lg border border-border bg-secondary">
              <p className="text-sm font-semibold text-foreground">Fraud AI</p>
              <p className="text-[10px] text-muted-foreground">Candle ML</p>
            </div>
            <div className="px-4 py-3 rounded-lg border border-primary bg-primary/10">
              <p className="text-sm font-semibold text-primary">Truth Engine</p>
              <p className="text-[10px] text-muted-foreground">Verify + Hash</p>
            </div>
            <div className="px-4 py-3 rounded-lg border border-border bg-secondary">
              <p className="text-sm font-semibold text-foreground">KRA eTIMS</p>
              <p className="text-[10px] text-muted-foreground">Tax Compliance</p>
            </div>
          </div>

          {/* Arrow */}
          <div className="col-span-5 flex justify-center">
            <div className="w-0.5 h-6 bg-border" />
          </div>

          {/* Layer 4: Data Layer */}
          <div className="col-span-5 grid grid-cols-2 gap-4 justify-center mb-4">
            <div className="px-4 py-3 rounded-lg border border-accent/30 bg-accent/10">
              <p className="text-sm font-semibold text-accent">PostgreSQL</p>
              <p className="text-[10px] text-muted-foreground">Transaction Store</p>
            </div>
            <div className="px-4 py-3 rounded-lg border border-warning/30 bg-warning/10">
              <p className="text-sm font-semibold text-warning">Redis</p>
              <p className="text-[10px] text-muted-foreground">Real-time Cache</p>
            </div>
          </div>

          {/* Arrow */}
          <div className="col-span-5 flex justify-center">
            <div className="w-0.5 h-6 bg-border" />
          </div>

          {/* Layer 5: Blockchain */}
          <div className="col-span-5 flex justify-center mb-4">
            <div className="px-6 py-4 rounded-xl border-2 border-accent bg-accent/5">
              <p className="font-bold text-accent">⛓️ Base L2 (Ethereum)</p>
              <p className="text-xs text-muted-foreground">Immutable Hash Anchoring</p>
            </div>
          </div>

          {/* Arrow */}
          <div className="col-span-5 flex justify-center">
            <div className="w-0.5 h-6 bg-primary" />
          </div>

          {/* Layer 6: Output */}
          <div className="col-span-5 flex justify-center gap-4">
            <div className="px-4 py-3 rounded-lg bg-primary/20 border border-primary animate-glow-pulse">
              <p className="text-sm font-bold text-primary">📱 TRUTH PING</p>
              <p className="text-[10px] text-muted-foreground">WebSocket Push</p>
            </div>
            <div className="px-4 py-3 rounded-lg bg-secondary border border-border">
              <p className="text-sm font-semibold text-foreground">🖥️ POS Terminal</p>
              <p className="text-[10px] text-muted-foreground">Merchant Display</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureDiagram;
