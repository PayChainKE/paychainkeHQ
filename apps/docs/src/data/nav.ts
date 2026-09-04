export interface NavItem {
  title: string;
  path: string;
  description: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const nav: NavGroup[] = [
  {
    label: "Get started",
    items: [
      { title: "Introduction", path: "/", description: "What the PayChain API does and how the pieces fit together." },
      { title: "No-code integration", path: "/no-code-integration", description: "Add a working payment button to Wix, Shopify, or WordPress — no code, no developer account." },
      { title: "Integration guide", path: "/integration-guide", description: "The account model, the sandbox, and the full path from signup to live traffic." },
      { title: "Authentication", path: "/authentication", description: "Test vs. live API keys, and how to send them." },
    ],
  },
  {
    label: "Products",
    items: [
      { title: "Payment collection", path: "/payment-collection", description: "STK push, hosted checkout, payment links, and dynamic QR codes." },
      { title: "Send money", path: "/send-money", description: "Pay out to mobile wallets, Paybills, Tills, and bank accounts." },
      { title: "Invoices", path: "/invoices", description: "Create, send, and track real, payable invoices." },
      { title: "Bulk payments", path: "/bulk-payments", description: "Payroll, contractor, and vendor payments in one batch call." },
      { title: "Webhooks", path: "/webhooks", description: "Push notifications the instant a payment, invoice, or bulk batch resolves." },
    ],
  },
  {
    label: "Resources",
    items: [
      { title: "Guides", path: "/guides", description: "ISP auto-reconnection and CRM sync, end to end." },
      { title: "Errors & idempotency", path: "/errors", description: "Error shape, status codes, and safe retries." },
    ],
  },
  {
    label: "Support",
    items: [
      { title: "Help & support", path: "/help", description: "Troubleshooting, FAQs, and how to reach a human." },
      { title: "Contact us", path: "/contact", description: "Sales, support, and general enquiries." },
    ],
  },
];

export const flatNav: NavItem[] = nav.flatMap((g) => g.items);
