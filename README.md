<img src="apps/merchant-dashboard/src/assets/logo2.png" alt="PayChain" height="36" />

# PayChainKE

**Verified payments and working-capital infrastructure for Kenyan merchants.**

<img src="https://img.shields.io/badge/status-closed%20beta-orange" alt="Status"/> <img src="https://img.shields.io/badge/license-MIT-blue" alt="License"/> <img src="https://img.shields.io/badge/node-%3E%3D18-informational" alt="Node"/> <img src="https://img.shields.io/badge/payments-M--PESA%20Daraja-00A651" alt="M-PESA"/> <img src="https://img.shields.io/badge/settlement-Base%20L2-6f42c1" alt="Base L2"/>

---

## Overview

PayChainKE gives Kenyan SMEs a single, verified account for collections, payroll, and working capital. Every inbound M‑PESA payment is confirmed directly against the Safaricom Daraja API, posted to the merchant's ledger in real time, and — where enabled — hedged into USDC on Base L2 to protect balances from KES depreciation. On top of that ledger, merchants get bulk payroll disbursement, revenue-based cash advances, and a trust score derived entirely from their own verified transaction history.

The platform is built for merchants who currently rely on M‑PESA statements, screenshots, and spreadsheets to run their business — replacing that with an auditable system of record.

## Product Suite

| App | Path | Description |
|---|---|---|
| Merchant Dashboard | [`apps/merchant-dashboard`](apps/merchant-dashboard) | Primary web console for collections, bulk pay, cash advance, and account management. React + Vite. |
| Mobile App | [`apps/mobile-app`](apps/mobile-app) | Full-parity native experience for merchants on the move. Expo + React Native + TypeScript. |
| Admin Console | [`apps/admin`](apps/admin) | Internal operations console — reconciliation, merchant lifecycle, revenue sweeps, audit trail. |
| Officer Portal | [`apps/officer`](apps/officer) | Field/KYC officer workflows for merchant onboarding and verification. |
| Marketing Site | [`apps/web`](apps/web) | Public-facing site, waitlist, and product marketing. |
| Backend API | [`backend`](backend) | Core ledger, payments, payouts, and settlement service. Node.js + Express + MongoDB. |

## Core Capabilities

- **PayChain Virtual Account** — a dedicated collections account per merchant; every inbound payment is verified against Daraja before it is ever shown as settled.
- **Inflation Shield** — optional, rate-limited automatic conversion of KES balances into USDC on Base L2, with a manual kill switch and bounded execution timeout so it never blocks payment notifications.
- **Bulk Payments** — payroll and supplier disbursement in a single batch, gated by OTP + PIN authorization, with M‑PESA B2C and bank payout rails.
- **Cash Advance** — revenue-based working capital, underwritten from verified transaction history rather than collateral.
- **Trust Score** — a proprietary score computed from real, verified merchant activity; it is not self-reported.
- **Audit Trail** — every balance-affecting event (payments, sweeps, payouts, admin actions) is logged for reconciliation.

## Architecture

```text
paychainkeHQ-2/
├── apps/
│   ├── merchant-dashboard/   React 18 + Vite + Tailwind CSS
│   ├── mobile-app/           Expo + React Native + TypeScript
│   ├── admin/                Internal ops console
│   ├── officer/              KYC / onboarding console
│   └── web/                  Marketing site
├── backend/                  Express API, Mongoose models, payment/payout controllers
└── packages/                 Shared code across apps
```

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS.
- **Mobile**: Expo (React Native), TypeScript.
- **Backend**: Node.js, Express 5, MongoDB / Mongoose.
- **Payments**: Safaricom M‑PESA Daraja API (STK Push, C2B confirmation, B2C payouts).
- **Settlement**: Base L2 (Coinbase) for USDC conversion and immutable transaction records.
- **Banking**: NCBA integration for bank and utility payouts.
- **Monorepo tooling**: npm workspaces + Turborepo.

## Security & Compliance

- OTP + PIN dual-factor authorization on bulk payouts, backed by rate-limited, time-boxed verification tokens.
- Strict CORS allowlisting and origin verification on all API traffic.
- Digital KYC on merchant onboarding.
- Immutable transaction and audit logging for every balance-affecting event.
- Built-in KRA e-TIMS electronic tax invoicing support.

This repository contains application and infrastructure code. It does not contain production credentials, customer data, or secrets — all environments are configured via `.env` files that are excluded from version control (see each app's `.env.example`).

## Getting Started

**Prerequisites**: Node.js ≥ 18, npm ≥ 10, a MongoDB connection string.

```bash
# Install dependencies for every app in the workspace
npm install

# Run everything in dev mode
npm run dev

# Run a single app
npm run dev:web
npm run dev:backend
```

Each app defines its own environment variables — copy the relevant `.env.example` (e.g. [`apps/merchant-dashboard/.env.example`](apps/merchant-dashboard/.env.example), [`backend/.env.example`](backend/.env.example)) to `.env` and fill in local values before running.

## Roadmap

| Phase | Target |
|---|---|
| Closed Beta | Hand-selected merchants in Nairobi and Juja |
| Public Launch | All Kenyan merchants (5,000 SME target) |
| Regional Expansion | Mombasa, Kisumu, Nakuru, Uganda, Tanzania |
| Pan-African Scale | 1,000,000+ merchants |

## Contributing

This is a private, closed-source product repository. External contributions are not currently accepted. Internal engineers should branch from `staging`, open a PR, and route production releases through `main`.

## License

Released under the [MIT License](LICENSE) unless otherwise noted in a specific package.

## Contact

- General enquiries: `contact@paychainke.com`
- Partnerships: `partnerships@paychain.co.ke`

**PayChainKE** — infrastructure for resilient, compliant Kenyan businesses.
