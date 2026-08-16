// Shared "payment object" shape returned by the Developer API and embedded
// in every webhook delivery payload — kept in one place so a payment looks
// identical whether a developer fetches it via GET /payments/:id or receives
// it via a payment.* webhook event.
export function publicDeveloperPayment(payment) {
  return {
    id: payment._id,
    mode: payment.mode,
    kind: payment.kind,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    failureReason: payment.failureReason,
    reference: payment.reference,
    counterparty: payment.counterparty,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}
