// PayChain's transaction history before this date is pre-production
// testing noise (Daraja sandbox top-ups, simulated B2C withdrawals, dev
// fx_swap runs with fabricated amounts) — never real money. NCBA virtual
// accounts went live 2026-07-28; that's the first date carrying genuine
// transactions.
//
// Admin financial dashboards (Overview, Insights/Analytics, Revenue) filter
// every Transaction query on this cutoff so they only ever reflect real
// activity — deliberately NOT a transaction-type filter (e.g. "only
// ncba_inbound"), so real M-Pesa/B2C/bulk-pay volume automatically counts
// the moment those rails go live for real too, with no further code change.
//
// Safe to delete this file (and its usages) entirely once enough real
// history has accumulated that the cutoff no longer matters, or if the
// test data is ever purged from the database directly instead.
export const LIVE_DATA_CUTOFF = new Date('2026-07-28T00:00:00+03:00');
