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
      { title: "Integration guide", path: "/integration-guide", description: "The account model, the sandbox, and the full path from signup to live traffic." },
      { title: "Authentication", path: "/authentication", description: "Test vs. live API keys, and how to send them." },
    ],
  },
  {
    label: "Core API",
    items: [
      { title: "Payments", path: "/payments", description: "Collect via STK push, pay out, and check status." },
      { title: "Checkout", path: "/checkout", description: "A hosted payment page to redirect customers to, or share directly as a payment link. No card/phone data touches your servers." },
      { title: "Webhooks", path: "/webhooks", description: "Get notified the instant a payment resolves." },
      { title: "Errors & idempotency", path: "/errors", description: "Error shape, status codes, and safe retries." },
    ],
  },
  {
    label: "Guides",
    items: [
      { title: "Integration patterns", path: "/guides", description: "ISP auto-reconnection and CRM sync, end to end." },
    ],
  },
];

export const flatNav: NavItem[] = nav.flatMap((g) => g.items);
