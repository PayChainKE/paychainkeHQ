// Shared "payment object" shape returned by the Developer API and embedded
// in every webhook delivery payload — kept in one place so a payment looks
// identical whether a developer fetches it via GET /payments/:id or receives
// it via a payment.* webhook event.
export function publicDeveloperPayment(payment) {
  return {
    id: payment._id,
    mode: payment.mode,
    kind: payment.kind,
    // 'admin_test' for a small real payment PayChain staff made to check the
    // setup. Safe for a developer's system to ignore.
    origin: payment.origin || 'api',
    // Which of the developer's linked merchants this payment is for. Matters
    // when one account serves several: events all arrive at the same webhook.
    merchantId: payment.merchantId || null,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    failureReason: payment.failureReason,
    reference: payment.reference,
    counterparty: payment.counterparty,
    // Only populated for a row created via POST /bulk-payments — null for a
    // standalone POST /payments/payout or /payments/collect.
    batchId: payment.batchId || null,
    payeeType: payment.payeeType || null,
    grossAmount: payment.grossAmount ?? null,
    taxDeductions: payment.grossAmount != null ? payment.taxDeductions : null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}
