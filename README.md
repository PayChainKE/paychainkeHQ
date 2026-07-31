<img src="apps/merchant-dashboard/src/assets/logo2.png" alt="PayChain" height="36" />

# PayChainKE

**Verified payments and working-capital infrastructure for Kenyan merchants.**

<img src="https://img.shields.io/badge/status-closed%20beta-orange" alt="Status"/> <img src="https://img.shields.io/badge/license-MIT-blue" alt="License"/> <img src="https://img.shields.io/badge/node-%3E%3D18-informational" alt="Node"/> <img src="https://img.shields.io/badge/payments-M--PESA%20Daraja-00A651" alt="M-PESA"/> <img src="https://img.shields.io/badge/settlement-Base%20L2-6f42c1" alt="Base L2"/>

---

## Overview

PayChainKE gives Kenyan SMEs a single, verified account for collections, payroll, and working capital. Every inbound M‑PESA payment is confirmed directly against the Safaricom Daraja API, posted to the merchant's ledger in real time, and — where enabled — hedged into USDC on Base L2 to protect balances from KES depreciation. On top of that ledger, merchants get bulk payroll disbursement, revenue-based cash advances, and a trust score derived entirely from their own verified transaction history.

The platform is built for merchants who currently rely on M‑PESA statements, screenshots, and spreadsheets to run their business — replacing that with an auditable system of record.

## Product Suite

| App | Description |
|---|---|
| Merchant Dashboard | Primary web console for collections, bulk pay, cash advance, and account management. |
| Mobile App | Full-parity native experience for merchants on the move. |
| Marketing Site | Public-facing site, waitlist, and product marketing. |
| Backend API | Core ledger, payments, payouts, and settlement service. |

## Core Capabilities

- **PayChain Virtual Account** — a dedicated collections account per merchant; every inbound payment is verified before it is ever shown as settled.
- **Inflation Shield** — optional automatic conversion of KES balances into USDC on Base L2 to protect against depreciation.
- **Bulk Payments** — payroll and supplier disbursement in a single, securely authorized batch.
- **Cash Advance** — revenue-based working capital, underwritten from verified transaction history rather than collateral.
- **Trust Score** — a proprietary score computed from real, verified merchant activity; it is not self-reported.
- **Audit Trail** — every balance-affecting event is logged for reconciliation.

## Architecture

A monorepo containing the merchant-facing web and mobile clients alongside the backend API.

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS.
- **Mobile**: Expo (React Native), TypeScript.
- **Backend**: Node.js, Express, MongoDB.
- **Payments**: Safaricom M‑PESA Daraja API.
- **Settlement**: Base L2 (Coinbase) for USDC conversion.
- **Monorepo tooling**: npm workspaces + Turborepo.

## Security & Compliance

- Multi-factor authorization on sensitive account actions.
- Digital KYC on merchant onboarding.
- Immutable transaction and audit logging for every balance-affecting event.
- Built-in KRA e-TIMS electronic tax invoicing support.

This repository contains application code only. It does not contain production credentials, customer data, internal operational tooling, or secrets — all environments are configured via `.env` files that are excluded from version control.

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

Each app defines its own environment variables — copy the relevant `.env.example` to `.env` and fill in local values before running.

## Contributing

This repository is not currently accepting external contributions.

## License

Released under the [MIT License](LICENSE) unless otherwise noted in a specific package.

## Contact

- General enquiries: `contact@paychainke.com`
- Partnerships: `partnerships@paychain.co.ke`

**PayChainKE** — infrastructure for resilient, compliant Kenyan businesses.
