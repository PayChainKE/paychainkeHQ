import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

const data = [
  { day: "Mar 1", balance: 1200 },
  { day: "Mar 5", balance: 1340 },
  { day: "Mar 8", balance: 1280 },
  { day: "Mar 10", balance: 1420 },
  { day: "Mar 14", balance: 1510 },
  { day: "Mar 18", balance: 1580 },
  { day: "Mar 22", balance: 1650 },
  { day: "Mar 25", balance: 1720 },
  { day: "Mar 28", balance: 1790 },
  { day: "Mar 30", balance: 1842 },
];

export function USDCSavingsCard() {
  return (
    <div className="bg-card rounded-2xl p-6 card-shadow h-full">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">USDC Savings & Inflation Shield</h3>
      
      <div className="h-40 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(162,100%,39%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(162,100%,39%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(215,16%,47%)" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "hsl(218,60%,10%)",
                border: "none",
                borderRadius: "8px",
                color: "white",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, "USDC"]}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="hsl(162,100%,39%)"
              strokeWidth={2}
              fill="url(#emeraldGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-muted/30">
        <p className="text-xs text-muted-foreground">Total inflation loss avoided</p>
        <p className="text-lg font-semibold text-emerald tabular">$142.80</p>
      </div>
    </div>
  );
}
