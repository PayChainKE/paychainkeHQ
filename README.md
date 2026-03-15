# PayChainKE — The Merchant Dashboard Protecting Kenyan Businesses from Inflation

<img src="https://img.shields.io/badge/React-18-blue?logo=react" alt="React"/> <img src="https://img.shields.io/badge/TypeScript-TS-blue?logo=typescript" alt="TypeScript"/> <img src="https://img.shields.io/badge/TailwindCSS-3-teal?logo=tailwindcss" alt="Tailwind"/> <img src="https://img.shields.io/badge/Vite-5-purple?logo=vite" alt="Vite"/> <img src="https://img.shields.io/badge/Base%20L2-Chain-6f42c1" alt="Base L2"/>

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

<!-- Tech stack intentionally omitted from README as requested -->
---

## Project Structure

```
src/
	auth/          — Sign in, Sign up, KYC wizard (5 steps)
	pages/         — Overview, Tills, Inflation Shield, e-TIMS, Payroll
	components/    — Sidebar, TopBar, HybridBalanceCard, SentinelBadge
	data/          — Mock data and type definitions
	hooks/         — useAuthForm, useKYCWizard, useBalance
	# PayChainKE — Corporate Overview

	PayChainKE is a merchant-focused financial platform designed to help businesses preserve value, comply with local tax obligations, and operate with modern payment rails. This document is intended as a formal product and company overview for partners, investors, regulators, and enterprise customers.

	## Executive Summary

	PayChainKE provides merchants with a unified dashboard to manage receivables, compliance, and reserve strategies. The product bridges traditional Kenyan payment flows with regulated stable-value instruments to help businesses reduce exposure to currency depreciation while maintaining seamless local settlement and reporting.

	Our mission is to empower Kenyan businesses with tools that improve financial resilience, simplify tax compliance, and enable predictable settlement workflows.

	## Key Capabilities

	- Inflation Protection: tools and policies that enable merchants to preserve value against adverse currency movements.
	- Seamless Receivables: merchant-centric payment acceptance workflows tailored for high-conversion checkout and reconciliation.
	- Compliance Automation: integrated tax reporting and record-keeping designed to align with local regulatory requirements.
	- Risk Management: transaction-level monitoring to reduce fraud, disputes, and payment failure costs.
	- Enterprise Operations: batch payments, payroll, supplier settlement, and till management for business scalability.

	## Who We Serve

	PayChainKE is intended for:

	- Small and medium-sized enterprises (SMEs) seeking simpler financial operations.
	- Sole proprietors who need compliant payment and tax tools.
	- Corporate merchants requiring payroll, escrow, and supplier settlement capabilities.

	## Commercial Offerings

	- Hosted SaaS: secure multi-tenant dashboard with enterprise feature tiers.
	- Dedicated Deployments: on-premise or single-tenant hosting for regulated or high-security customers.
	- API & Integration Services: bespoke onboarding for banks, payroll providers, and enterprise ERPs.
	- Professional Services: compliance advisory, integration, and migration support.

	## Security & Compliance

	Security is foundational to PayChainKE. We apply industry-standard controls for data protection, access management, and operational resilience. Where applicable, we design integrations to meet local regulatory and data residency requirements and to support auditability for financial and tax authorities.

	## Partnerships & Integrations

	We collaborate with financial institutions, tax authorities, and technology providers to ensure smooth integration and regulatory alignment. Strategic partnerships are established with payment processors, banking APIs, and compliance platforms to deliver dependable merchant services.

	## Enterprise Adoption

	For enterprise customers we provide:

	- SLA-backed service levels
	- Custom onboarding and data migration
	- Dedicated support and compliance reporting

	Contact our sales team at sales@paychainke.com to request an enterprise evaluation.

	## Roadmap (High Level)

	- Commercial rollout and merchant onboarding
	- Expanded institutional integrations and settlement partners
	- Enhanced compliance workflows and reporting
	- Advanced risk and analytics capabilities for enterprise customers

	## How to Engage

	For partnership inquiries, sales, or media: contact@paychainke.com
	For security or compliance discussions: security@paychainke.com

	## Governance & Legal

	PayChainKE operates as an independent fintech product and maintains transparent governance practices. All customers are subject to standard terms of service and privacy policies; commercial terms vary by tier and region.

	## License

	This repository and accompanying materials are provided under the MIT License.

	---

	PayChainKE — Built to support resilient businesses and compliant operations.
---


