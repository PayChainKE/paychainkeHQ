// Testnet-only — matches backend/utils/stellarHelper.js's STELLAR_NETWORK
// default. Every hash shown in the demo can be verified by opening it here.
export const EXPLORER_TX_BASE = 'https://stellar.expert/explorer/testnet/tx/'

export const shortHash = (h, head = 8, tail = 6) => (h && h.length > head + tail + 1 ? `${h.slice(0, head)}…${h.slice(-tail)}` : h || '—')

export const maskPhone = (phone) => {
  const d = String(phone || '').replace(/\D/g, '')
  const local = d.startsWith('254') ? `0${d.slice(3)}` : d
  return local.length >= 9 ? `${local.slice(0, 4)} *** ${local.slice(-3)}` : '—'
}
