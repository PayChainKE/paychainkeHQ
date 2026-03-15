# PayChainKE — The Merchant Dashboard Protecting Kenyan Businesses from Inflation

██████╗  █████╗ ██╗   ██╗ ██████╗ ██████╗ ███████╗██╗  ██╗
██╔══██╗██╔══██╗██║   ██║██╔════╝██╔═══██╗██╔════╝██║ ██╔╝
██████╔╝███████║██║   ██║██║     ██║   ██║█████╗  █████╔╝ 
██╔══██╗██╔══██║██║   ██║██║     ██║   ██║██╔══╝  ██╔═██╗ 
██║  ██║██║  ██║╚██████╔╝╚██████╗╚██████╔╝███████╗██║  ██╗
╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝

Tagline: "The Merchant Dashboard for a secure business tool"

<img src="https://img.shields.io/badge/React-18-blue?logo=react" alt="React"/> <img src="https://img.shields.io/badge/TypeScript-TS-blue?logo=typescript" alt="TypeScript"/> <img src="https://img.shields.io/badge/TailwindCSS-3-teal?logo=tailwindcss" alt="Tailwind"/> <img src="https://img.shields.io/badge/Vite-5-purple?logo=vite" alt="Vite"/> <img src="https://img.shields.io/badge/Base%20L2-Chain-6f42c1" alt="Base L2"/> <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT"/> <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen" alt="PRs Welcome"/> <img src="https://img.shields.io/badge/Version-2.0.0-blue" alt="Version"/>
<br>
PayChainKE v2.0 — a hybrid KES / USDC merchant payments dashboard that combines M-PESA, KRA e-TIMS tax compliance, and Base L2 stablecoin savings.

---

## Screenshot / Live Demo

![PayChainKE Dashboard](./docs/screenshots/dashboard.png)

[Live Demo →](https://paychainke.com)

---

## Why PayChainKE?

Problem: Kenyan shillings (KES) have materially depreciated against major reserve currencies since 2020 — many merchants have lost over 30% of real purchasing power when holding fiat-only balances. This erosion harms cash flow, working capital, and margins for small and medium enterprises.

Solution: PayChainKE lets merchants accept payments in KES, automatically allocate or hedge value into USDC on Base L2, and remain KRA-compliant by design. The dashboard consolidates payments, compliance, savings, and settlement into one merchant-focused interface.

| Feature | What It Does | Why It Matters |
|:---|:---|:---|
| Inflation Shield Vault | Auto-swap or sweep KES into USDC on Base L2 | Protects merchant purchasing power; accessible stablecoin savings without complex wallets |
| Sentinel AI | Real-time fraud scoring on every payment | Reduces chargebacks and fraud exposure with automated detection |
| e-TIMS Hub | Per-transaction KRA e-TIMS filing integration | Ensures tax compliance and reduces audit risk for merchants |
| Hybrid Balance | KES ledger + USDC balance in one view | Simplifies liquidity decisions and reconciliation for daily operations |
| Supplier Escrow | USDC escrow for cross-border supplier payments | Enables secure settlement and minimizes FX friction |
| Bulk Payroll | Payroll and utility payments in batch | Saves operational time and supports mass disbursements |

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|:---|:---|:---:|:---|
| Frontend | React | 18 | App UI and component model |
| Frontend | TypeScript | — | Type safety across the app |
| Build | Vite | 5 | Fast dev server and build pipeline |
| Styling | Tailwind CSS | 3 | Utility-first styling system |
| UI Primitives | shadcn/ui | — | Accessible components and patterns |
| Animations | Framer Motion | — | Smooth UI transitions and micro-interactions |
| Charts | Recharts | — | Financial visualizations and trends |
| Routing | React Router | v6 | Client-side routing |
| Blockchain | Base L2 (Coinbase) | — | Settlement and USDC storage |
| Blockchain SDK | ethers.js (planned) | — | Wallet + contract interaction |
| Payments | M-PESA Daraja / Jenga | — | Local mobile money + bank integration |
| Tax | KRA e-TIMS API | — | Automated tax filing per transaction |
| Auth (planned) | Supabase / Firebase | — | Hosted auth and session management |

---

## Project Structure

```
src/
	auth/          — Sign in, Sign up, KYC wizard (5 steps)
	pages/         — Overview, Tills, Inflation Shield, e-TIMS, Payroll
	components/    — Sidebar, TopBar, HybridBalanceCard, SentinelBadge
	data/          — Mock data and type definitions
	hooks/         — useAuthForm, useKYCWizard, useBalance
	index.css      — Design tokens and Tailwind config
	main.tsx       — App entry and router
```

---

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
git clone https://github.com/paychainke/paychainke.git
cd paychainke
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173 in your browser.

### Available Scripts

| Command | Description |
|:---|:---|
| `npm run dev` | Start development server (Vite) |
| `npm run build` | Build production assets |
| `npm run preview` | Locally preview production build |
| `npm run lint` | Run ESLint across packages |
| `npm run type-check` | Run TypeScript type checks |

---

## Environment Variables

Create `.env.local` from `.env.example`. Example entries below:

```env
VITE_MPESA_CONSUMER_KEY=
VITE_MPESA_CONSUMER_SECRET=
VITE_JENGA_API_KEY=
VITE_KRA_ETIMS_PIN=
VITE_BASE_L2_RPC_URL=
```

All variables are optional in development — the app runs fully on mock data without keys set.

---

## Deployment

### Build for Production

```bash
npm run build
# output in /dist (ready for static hosting)
```

### Deployment Options

| Platform | Method | Notes |
|:---|:---|:---|
| Vercel | Git integration | Recommended — zero-config for Vite apps |
| Netlify | Git or drag/drop | Free tier available for quick previews |
| GitHub Pages | GitHub Actions | Use `.github/workflows/deploy.yml` for CI deployment |
| AWS S3 + CloudFront | CLI / CI | Best for global scale and custom caching |
| Railway | Dockerfile | Simple container deployment for backend services |

Add a custom domain via your hosting provider and configure SSL — most providers offer automated certificates.

---

## Contributing

- Fork the repository and create a feature branch: `feature/awesome-feature` or `fix/bug-name`
- Follow conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Open a PR with a clear description, screenshots, and test steps

See CONTRIBUTING.md for detailed guidelines (link placeholder).

---

## Roadmap

**Phase 1 — MVP (Current):**
- ✅ Auth & KYC onboarding wizard
- ✅ Hybrid KES/USDC dashboard
- ✅ Inflation Shield Vault UI
- ✅ e-TIMS Hub
- ✅ Payroll & Utilities

**Phase 2 — Integrations (Q2 2026):**
- ⬜ Live M-PESA Daraja API
- ⬜ Equity Jenga API (till issuance)
- ⬜ KRA e-TIMS live API
- ⬜ Base L2 wallet connection

**Phase 3 — Intelligence (Q3 2026):**
- ⬜ Sentinel AI fraud model (live)
- ⬜ Cash flow predictions
- ⬜ Supplier escrow smart contracts

---

## License

MIT License

Copyright (c) 2026 PayChainKE

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

Built with ❤️ for Kenyan merchants

---

PayChainKE is not affiliated with Safaricom, KRA, or Equity Bank. This is an independent fintech product.

