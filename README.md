<img src="apps/merchant-dashboard/src/assets/logo2.png" alt="PayChain" height="36" />

# PayChainKE

**Verified payments and working-capital infrastructure for Kenyan merchants.**

<img src="https://img.shields.io/badge/status-closed%20beta-orange" alt="Status"/> <img src="https://img.shields.io/badge/license-MIT-blue" alt="License"/> <img src="https://img.shields.io/badge/node-%3E%3D18-informational" alt="Node"/> <img src="https://img.shields.io/badge/payments-NCBA%20Open%20Banking-00A651" alt="NCBA Open Banking"/>

---

## Overview

PayChainKE gives Kenyan SMEs a single, verified account for collections, payroll, and working capital. Every inbound M‑PESA payment is collected through NCBA's Open Banking rails (STK Push, Paybill, and Lipa na M‑PESA) and bank-confirmed before it is ever posted to the merchant's ledger. On top of that ledger, merchants get electronic invoicing with KRA e-TIMS fiscalization, bulk payroll disbursement, revenue-based cash advances, and a trust score derived entirely from their own verified transaction history.

The platform is built for merchants who currently rely on M‑PESA statements, screenshots, and spreadsheets to run their business — replacing that with an auditable system of record.

## Product Suite

| App | Description |
|---|---|
| Merchant Dashboard | Primary web console for collections, bulk pay, invoicing, cash advance, and account management. |
| Mobile App | Native merchant experience for collections and account management on the move. |
| Admin Dashboard | Internal console for merchant oversight, revenue reporting, compliance verification, and support tooling. |
| Officer Portal | KYC/KYB application intake and review workstation for onboarding officers. |
| Checkout | Public, unbranded payment page customers land on to pay a link, invoice, or account. |
| Developer Docs | Public documentation for the PayChain Developer API — integration guides, webhooks, and reference. |
| Marketing Site | Public-facing site, waitlist, and product marketing. |
| Backend API | Core ledger, payments, payouts, and settlement service. |

## Core Capabilities

- **PayChain Virtual Account** — a dedicated collections account per merchant; every inbound payment is verified before it is ever shown as settled.
- **Electronic Invoicing** — line-itemed invoices with KRA e-TIMS fiscalization, emailed to customers, and payable via the same verified STK Push flow.
- **Bulk Payments** — payroll and supplier disbursement in a single, securely authorized batch.
- **Cash Advance** — revenue-based working capital, underwritten from verified transaction history rather than collateral.
- **Trust Score** — a proprietary score computed from real, verified merchant activity; it is not self-reported.
- **Audit Trail** — every balance-affecting event is logged for reconciliation.

## Architecture

A monorepo containing the merchant-facing web and mobile clients, internal admin/officer tooling, and the backend API.

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS.
- **Mobile**: Expo (React Native), TypeScript.
- **Backend**: Node.js, Express, MongoDB.
- **Payments & Settlement**: NCBA Open Banking — STK Push/Paybill collections, Mobile B2W, Lipa na M‑PESA, and PesaLink/RTGS/IFT bank payouts.
- **Monorepo tooling**: npm workspaces + Turborepo.

## Security & Compliance

- Multi-factor authorization on sensitive account actions.
- Digital KYC/KYB on merchant onboarding, with dedicated officer and admin review workflows.
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

# Any other workspace app (admin, officer, merchant-dashboard, checkout, docs)
npm run dev --workspace=apps/<app-name>

# Mobile app (Expo)
cd apps/mobile-app && npm start
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
