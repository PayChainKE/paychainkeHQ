// Describes WHERE an outgoing payment went — mobile wallet, Paybill, Till,
// bank account or utility — as a label plus labeled rows (bank name, account
// number, phone number, Paybill account, ...) for a transaction detail view.
//
// Uses tx.destination (recorded at payout time by the backend) plus
// tx.recipient (the number/account itself). Transactions recorded before
// tx.destination existed fall back to what their type implies; details that
// were never stored (e.g. the bank name on an old transfer) are omitted,
// never guessed.
//
// Returns null for money coming in or anything that isn't a payout.
// Mirrors the merchant-dashboard copy.

import { formatPhoneDisplay } from './formatPhoneDisplay'

const RAIL: Record<string, string> = { pesalink: 'PesaLink', eft: 'EFT', rtgs: 'RTGS', ift: 'Internal transfer' }
const NETWORK: Record<string, string> = { safaricom: 'Safaricom M-Pesa', airtel: 'Airtel Money' }
const UTILITY: Record<string, string> = { KPLC: 'KPLC bill payment', KPLC_PREPAID: 'KPLC prepaid token', WATER: 'Water bill payment' }

// Payout types whose destination kind is implied by the type alone.
const KIND_BY_TYPE: Record<string, string> = {
  ncba_outbound: 'bank',
  ncba_mobile_b2w: 'mobile',
  mpesa_b2c: 'mobile',
  bulk_pay: 'mobile',
  ncba_lipa_na_mpesa: 'paybill_or_till',
  mpesa_b2b: 'paybill_or_till',
  ncba_kplc: 'utility_kplc',
  ncba_kplc_prepaid: 'utility_kplc_prepaid',
  ncba_ncwsc: 'utility_water',
}

export interface DestinationRow { label: string; value: string }
export interface DestinationDescription { label: string; rows: DestinationRow[] }

export function describeDestination(tx: any): DestinationDescription | null {
  if (!tx) return null
  const d = tx.destination || {}
  const kind = d.kind || KIND_BY_TYPE[tx.type]
  if (!kind) return null

  const id = tx.recipient?.id ? String(tx.recipient.id) : null
  const rows: DestinationRow[] = []
  const add = (label: string, value?: string | null) => { if (value) rows.push({ label, value }) }

  switch (kind) {
    case 'bank':
      add('Bank', d.bankName)
      add('Account number', id)
      add('Sent via', RAIL[tx.settlementRail])
      return { label: 'Bank transfer', rows }
    case 'paybill': {
      add('Paybill number', id)
      add('Account', d.accountReference || tx.paybillAccountReference)
      return { label: 'Paybill', rows }
    }
    case 'till':
      add('Till number', id)
      return { label: 'Till', rows }
    case 'paybill_or_till': {
      // Older record: whether it was a Paybill or a Till wasn't stored.
      const ref = tx.paybillAccountReference
      add(ref ? 'Paybill number' : 'Paybill / Till number', id)
      add('Account', ref)
      return { label: ref ? 'Paybill' : 'Paybill / Till', rows }
    }
    case 'mobile':
      add('Phone number', formatPhoneDisplay(id))
      add('Network', NETWORK[d.network || tx.mobileNetwork])
      return { label: 'Mobile money', rows }
    case 'utility':
      add('Account / meter number', id)
      return { label: UTILITY[d.provider] || 'Utility payment', rows }
    case 'utility_kplc':
      add('Account / meter number', id)
      return { label: UTILITY.KPLC, rows }
    case 'utility_kplc_prepaid':
      add('Meter number', id)
      return { label: UTILITY.KPLC_PREPAID, rows }
    case 'utility_water':
      add('Account number', id)
      return { label: UTILITY.WATER, rows }
    default:
      return null
  }
}
