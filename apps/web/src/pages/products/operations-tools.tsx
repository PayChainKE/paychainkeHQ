import React from 'react'
import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import {
  LayoutDashboard,
  FileCheck,
  TrendingUp,
  Users,
  BarChart2,
  Download,
  Bell,
  Layers,
} from "lucide-react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import useOperationAnimations from "./useOperationAnimations";
import "./operations-tools.css";

const features = [
  {
    icon: LayoutDashboard,
    title: "Real-Time Merchant Dashboard",
    body:
      "Every transaction — collections, payments, FX swaps, cash advance activity — updated in real time. Your full financial picture, always current.",
  },
  {
    icon: FileCheck,
    title: "KRA e-TIMS Tax Compliance",
    body:
      "Automatically generates KRA e-TIMS compliant tax records from your transaction history. Clean records for KRA. One click download for your accountant.",
  },
  {
    icon: TrendingUp,
    title: "Trust Score Monitor",
    body:
      "Track your Trust Score in real time — see exactly how close you are to unlocking your next Cash Advance tier.",
  },
  {
    icon: Users,
    title: "Team Access & Spending Controls",
    body:
      "Add team members with defined roles, set spending limits, require approval for large transactions — without giving up full account access.",
  },
  {
    icon: BarChart2,
    title: "Business Analytics & Insights",
    body:
      "Revenue trends, peak payment periods, top customers by volume, month-on-month growth — all visualized clearly. Decisions based on data, not guesswork.",
  },
  {
    icon: Download,
    title: "Downloadable Financial Reports",
    body:
      "Export transaction histories, payroll records, FX logs, and tax summaries — formatted for your accountant, investors, or your own records.",
  },
  {
    icon: Bell,
    title: "Smart Notifications & Alerts",
    body:
      "Custom alerts for large inflows, low balances, upcoming payments, and Trust Score milestones. Stay in control without watching the dashboard all day.",
  },
  {
    icon: Layers,
    title: "Multi-Account Management",
    body:
      "Multiple business locations or entities? Manage separate dashboards with consolidated reporting and shared team access under one login.",
  },
];

const chartData = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
  datasets: [
    {
      label: "Revenue (KES)",
      data: [120000, 140000, 125000, 165000, 180000, 172000, 195000],
      borderColor: "#10B981",
      backgroundColor: "rgba(16,185,129,0.08)",
      fill: true,
      tension: 0.3,
    },
  ],
};

const OperationsTools = () => {
  const containerRef = useRef<HTMLElement | null>(null);
  useOperationAnimations(containerRef);

  return (
    <div className="min-h-screen bg-gray-50 text-[#0A192F] font-sans">
      <Navbar />
      <main className="operations-page container mx-auto px-6 py-12" ref={containerRef}>
      <section className="hero grid md:grid-cols-2 gap-8 items-center">
        <div className="hero-copy">
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">
            Run Your Entire Business from One Intelligent Dashboard.
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            PayChain Operation Tools gives you real-time visibility, financial
            controls, compliance automation, and team management — everything you
            need to run a modern Kenyan business, without the complexity.
          </p>
          <div className="mt-6">
            <Link
              to="/waitlist"
              className="inline-flex items-center gap-3 bg-primary text-white px-5 py-3 rounded-md shadow-sm"
              aria-label="See It in Action"
            >
              See It in Action
            </Link>
          </div>
        </div>

        <div className="hero-visual bg-white rounded-xl shadow-md p-4" aria-hidden>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <div className="flex gap-4 mb-4">
                <div className="stat-card p-3 bg-gray-50 rounded-md">
                  <div className="text-xs text-muted-foreground">Balance</div>
                  <div className="text-lg font-semibold">KES 1,254,300</div>
                </div>
                <div className="stat-card p-3 bg-gray-50 rounded-md">
                  <div className="text-xs text-muted-foreground">Today</div>
                  <div className="text-lg font-semibold">KES 42,300</div>
                </div>
              </div>

              <div className="chart-box bg-white rounded-md p-3">
                <Line data={chartData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>

            <aside className="col-span-1 flex flex-col gap-4">
              <div className="trust-card p-3 bg-gray-50 rounded-md">
                <div className="text-xs text-muted-foreground">Trust Score</div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                    <div className="trust-fill h-3 rounded-full" style={{ width: "72%" }} />
                  </div>
                  <div className="text-sm mt-2 font-medium">72 — Good</div>
                </div>
              </div>

              <div className="activity p-3 bg-gray-50 rounded-md">
                <div className="text-xs text-muted-foreground">Team activity</div>
                <ul className="mt-2 text-sm">
                  <li>Mary approved payout — 10m ago</li>
                  <li>Ken requested FX swap — 1h ago</li>
                  <li>New user added: John — today</li>
                </ul>
              </div>
            </aside>
          </div>

          <div className="mt-4 transaction-feed bg-white rounded-md p-3 border">
            <div className="text-sm text-muted-foreground mb-2">Recent transactions</div>
            <div className="overflow-auto max-h-44">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td>INV-001234</td>
                    <td className="text-muted-foreground">Card • KES 4,200</td>
                    <td className="text-right text-sm">2h ago</td>
                  </tr>
                  <tr>
                    <td>INV-001233</td>
                    <td className="text-muted-foreground">Mpesa • KES 12,400</td>
                    <td className="text-right text-sm">5h ago</td>
                  </tr>
                  <tr>
                    <td>INV-001232</td>
                    <td className="text-muted-foreground">Card • KES 2,800</td>
                    <td className="text-right text-sm">1d ago</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="problem mt-12 bg-gray-900 text-white p-8 rounded-md reveal">
        <h2 className="text-2xl font-semibold">Most Kenyan Merchants Are Running Blind.</h2>
        <p className="mt-3 max-w-3xl">
          No real-time transaction data. No automated tax records. No team spending
          controls. No clear picture of what came in, what went out, and what's left.
          Just a phone full of SMS notifications and a notebook that never quite adds up.
          PayChain Operation Tools changes all of that.
        </p>
      </section>

      <section className="explainer mt-12 reveal">
        <h3 className="text-xl font-semibold">The Control Center Your Business Has Always Needed.</h3>
        <p className="mt-3 max-w-3xl">
          PayChain Operation Tools is the intelligence layer across all four PayChain
          products — a unified command center giving you real-time data, automated
          compliance, team controls, and business insights on one dashboard built for Kenyan SMEs.
        </p>
      </section>

      <section className="features mt-12">
        <h3 className="text-2xl font-semibold">Every Tool You Need. Nothing You Don't.</h3>
        <div className="mt-6 grid gap-8">
          {features.map((f, i) => {
            const Icon = f.icon as unknown as React.ComponentType<React.SVGProps<SVGSVGElement>>;
            const left = i % 2 === 0;
            return (
              <div key={f.title} className={`feature-row grid md:grid-cols-2 gap-6 items-center reveal ${left ? "" : "md:flex-row-reverse"}`}>
                <div className="feature-icon flex items-start">
                  <div className="icon bg-primary/10 text-primary rounded-md p-3">
                    <Icon />
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold">{f.title}</h4>
                  <p className="mt-2 text-muted-foreground">{f.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="kra-spotlight mt-12 reveal">
        <div className="paper bg-white p-6 rounded-md border">
          <h3 className="text-xl font-semibold">Tax Compliance Without the Headache.</h3>
          <p className="mt-3 text-muted-foreground max-w-3xl">
            KRA's e-TIMS system requires merchants to electronically submit transaction
            records for tax purposes. For most Kenyan businesses, this means manual data entry,
            spreadsheets, and accountants charging by the hour. PayChain eliminates all of that.
            Every verified transaction is automatically formatted for e-TIMS compliance, organized
            by period, and available for download with one click. Your accountant gets clean records.
            KRA gets what it needs. You get to run your business.
          </p>

          <div className="tax-mock mt-6 grid md:grid-cols-3 gap-4 items-start">
            <div className="md:col-span-2 bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-muted-foreground">Period</div>
                  <div className="font-medium">Jan 2026 — Mar 2026</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Total transactions</div>
                  <div className="font-medium">1,248</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total revenue</div>
                  <div className="font-semibold">KES 3,412,800</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">VAT summary</div>
                  <div className="font-semibold">KES 280,400</div>
                </div>
              </div>
            </div>

            <div className="md:col-span-1 flex flex-col gap-3">
              <button className="bg-primary text-white px-4 py-2 rounded-md">Download e-TIMS report</button>
              <div className="text-sm text-muted-foreground">Official format — ready for KRA</div>
            </div>
          </div>
        </div>
      </section>

      <section className="use-cases mt-12 reveal">
        <h3 className="text-2xl font-semibold">Built for How Kenyan Businesses Actually Operate</h3>
        <div className="mt-6 grid md:grid-cols-4 gap-4">
          <div className="card p-4 bg-white rounded-md">
            <h4 className="font-semibold">Retail & Hospitality</h4>
            <p className="mt-2 text-sm text-muted-foreground">Monitor daily revenue in real time, track peak hours, and run end-of-day reconciliation automatically.</p>
          </div>
          <div className="card p-4 bg-white rounded-md">
            <h4 className="font-semibold">Service Agencies</h4>
            <p className="mt-2 text-sm text-muted-foreground">Generate records, track payments, run payroll, and download clean tax records — all from one place.</p>
          </div>
          <div className="card p-4 bg-white rounded-md">
            <h4 className="font-semibold">Import/Export Traders</h4>
            <p className="mt-2 text-sm text-muted-foreground">Monitor KES and USDC balances simultaneously, track FX history, manage supplier payment schedules.</p>
          </div>
          <div className="card p-4 bg-white rounded-md">
            <h4 className="font-semibold">Multi-Location Businesses</h4>
            <p className="mt-2 text-sm text-muted-foreground">Manage multiple merchant accounts under one login with consolidated reporting across all locations.</p>
          </div>
        </div>
      </section>

      <section className="final-cta mt-12 text-center reveal">
        <h3 className="text-2xl font-semibold">Stop Running Your Business on Guesswork.</h3>
        <p className="mt-2 text-muted-foreground">Join our closed beta launching Q2 2026 and experience full financial visibility for the first time.</p>
        <div className="mt-4">
          <Link to="/waitlist" className="bg-primary text-white px-6 py-3 rounded-md inline-block">Join the Waitlist</Link>
        </div>
      </section>
      </main>
      <Footer />
    </div>
  );
};

export default OperationsTools;
