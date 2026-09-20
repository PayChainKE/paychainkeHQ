import React from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Ticket, Wifi, Repeat, Smartphone, Store, Home, Users2, Receipt, HeartHandshake, Bus, ArrowRight } from "lucide-react";
import Callout from "@/components/Callout";

type Item = { icon: React.ComponentType<{ className?: string }>; title: string; who: string; how: string; use: string; to: string; toLabel: string };

const ITEMS: Item[] = [
  { icon: ShoppingCart, title: "WooCommerce shops", who: "WordPress stores", how: "Install the plugin and paste a key. Orders are marked paid for you.", use: "Plugin", to: "/woocommerce", toLabel: "WooCommerce plugin" },
  { icon: ShoppingCart, title: "Shopify stores", who: "Shopify merchants", how: "A small service you run marks Shopify orders paid after the customer pays from their order email.", use: "Shopify app", to: "/shopify", toLabel: "Shopify app" },
  { icon: ShoppingCart, title: "Wix, Squarespace, WordPress, any website", who: "Anyone without a developer", how: "Generate a payment button and paste two lines onto your page.", use: "No-code button", to: "/no-code-integration", toLabel: "No-code integration" },
  { icon: ShoppingCart, title: "Custom shops and carts", who: "Developers (Magento, PrestaShop, OpenCart, your own code)", how: "Create a hosted checkout per order, send the customer to it, and mark the order paid from the signed webhook.", use: "Hosted checkout + webhook", to: "/payment-collection", toLabel: "Payment collection" },
  { icon: Ticket, title: "Ticketing and events", who: "Event organisers, ticketing platforms, cinemas", how: "Hold the seats, create a checkout that expires with the hold, issue tickets from the webhook.", use: "Hosted checkout + webhook", to: "/ticketing", toLabel: "Ticketing guide" },
  { icon: Wifi, title: "ISPs and hotspots", who: "Internet providers, Wi-Fi vouchers", how: "Collect with the subscriber id as the reference. When the webhook arrives, lift the suspension.", use: "STK push + webhook", to: "/guides", toLabel: "ISP guide" },
  { icon: Smartphone, title: "Mobile apps and one-tap checkout", who: "Delivery, ride, wallet and service apps", how: "You have the phone number, so send the M-PESA prompt straight from your server and wait for the webhook.", use: "STK push + webhook", to: "/payment-collection", toLabel: "Payment collection" },
  { icon: Repeat, title: "Subscriptions and SaaS", who: "Software, memberships, gyms, schools", how: "Send an invoice or an M-PESA prompt each billing cycle, with the subscription id as the reference. The customer approves each payment.", use: "Invoices or STK push", to: "/invoices", toLabel: "Invoices" },
  { icon: Store, title: "Marketplaces and platforms", who: "Platforms paying many sellers", how: "Link each seller's merchant to your account with a key per seller, or collect centrally and pay sellers out.", use: "Multi-merchant keys + payouts", to: "/integration-guide", toLabel: "Integration guide" },
  { icon: Home, title: "Rent, utilities and Paybill payments", who: "Landlords, property managers, estates", how: "Customers pay your Paybill as usual and your system gets a webhook for each payment. It cannot tell you which customer paid, so for exact matching use a prompt or checkout with a reference.", use: "Paybill webhook", to: "/webhooks", toLabel: "Webhooks" },
  { icon: Users2, title: "Payroll and supplier payments", who: "Employers, agencies, farms, logistics", how: "Pay a whole batch of wallets, banks and Paybills in one call. PayChain pays the exact amounts you send; work out and remit PAYE, NSSF and SHIF yourself.", use: "Bulk payments", to: "/bulk-payments", toLabel: "Bulk payments" },
  { icon: Receipt, title: "Invoicing, accounting and CRM", who: "Accounting tools, CRMs, agencies", how: "Create payable invoices from your software and update the deal when the invoice.paid webhook arrives.", use: "Invoices + webhook", to: "/guides", toLabel: "CRM guide" },
  { icon: HeartHandshake, title: "Donations, churches and fundraisers", who: "Charities, schools, community groups", how: "Share a payment link or a QR code. Nothing to build.", use: "Payment links and QR", to: "/payment-collection", toLabel: "Payment collection" },
  { icon: Bus, title: "Transport, parking and pay-at-the-door", who: "Matatus, parking, vending, kiosks", how: "Show a dynamic QR for the exact amount. The customer scans, pays, and your system gets the webhook.", use: "Dynamic QR", to: "/payment-collection", toLabel: "Payment collection" },
];

const NOT_YET = [
  "Refunds through the API",
  "Split payments between several parties",
  "Automatic recurring charges (each payment is approved by the customer)",
  "Card payments and currencies other than KES",
  "Ready-made SDKs and a Postman collection (plain REST works today)",
];

export default function Integrations() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Where to integrate PayChain</h1>
      <p>
        PayChain works anywhere you need to take an M-PESA payment or send money and then react to the result. Find
        what you are building below. Every option has a free sandbox, so you can try it before real money is involved.
      </p>

      <div className="grid md:grid-cols-2 gap-3 mt-8 mb-10 not-prose">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.title}
              to={it.to}
              className="group flex flex-col gap-2 p-4 rounded-xl border border-border bg-surface hover:border-brand/30 hover:bg-surface-raised transition-all no-underline"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-brand-bright" />
                </div>
                <span className="text-[14.5px] font-semibold text-ink">{it.title}</span>
              </div>
              <div className="text-[12px] text-ink-faint leading-4">{it.who}</div>
              <div className="text-[13px] text-ink-muted leading-5">{it.how}</div>
              <div className="flex items-center justify-between mt-auto pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-bright">{it.use}</span>
                <span className="text-[12.5px] font-semibold text-brand flex items-center gap-1">{it.toLabel}<ArrowRight className="w-3 h-3" /></span>
              </div>
            </Link>
          );
        })}
      </div>

      <h2>Pick the right building block</h2>
      <ul>
        <li><strong>Customer pays you:</strong> hosted checkout (PayChain shows the page) or STK push (you already have the phone number). Both end with a signed webhook.</li>
        <li><strong>You pay someone:</strong> payouts for one person, bulk payments for many.</li>
        <li><strong>You bill someone:</strong> invoices, paid by the customer, with an <code>invoice.paid</code> webhook.</li>
        <li><strong>No developer:</strong> payment links, QR codes and the no-code button.</li>
      </ul>

      <h2>Not available yet</h2>
      <p>Plan around these, and <Link to="/contact">tell us which ones you need first</Link>:</p>
      <ul>
        {NOT_YET.map((n) => <li key={n}>{n}</li>)}
      </ul>

      <Callout variant="tip" title="Start here">
        New to PayChain? The <Link to="/quickstart">Quickstart</Link> takes your first sandbox payment in five minutes.
      </Callout>
    </>
  );
}
